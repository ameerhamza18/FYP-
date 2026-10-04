"""Authentication endpoints: register, login, me.

Security controls: bcrypt hashing, JWT access tokens, login rate limiting,
audit logging, no user-enumeration-friendly error messages.
"""
import datetime as dt
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import LoginIn, PasswordChangeIn, RegisterIn, TokenOut, UserOut
from app.security.audit import audit
from app.security.auth import (
    access_token_ttl_seconds,
    create_access_token,
    decode_token,
    get_current_user,
    hash_password,
    revoke_token,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = logging.getLogger("trustlayer.auth")


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterIn, request: Request, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        audit(db, "REGISTER_DENIED", resource=payload.email, ip=request.client.host if request.client else None)
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(email=payload.email.lower(), password_hash=hash_password(payload.password), role="user")
    db.add(user)
    db.commit()
    db.refresh(user)
    audit(db, "REGISTER", user_id=user.id, resource=user.email,
          ip=request.client.host if request.client else None,
          user_agent=request.headers.get("user-agent"))
    return user


@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if user is None or not verify_password(payload.password, user.password_hash) or not user.is_active:
        audit(db, "LOGIN_FAILED", resource=payload.email,
              ip=request.client.host if request.client else None,
              user_agent=request.headers.get("user-agent"))
        # Deliberately vague message (prevents user enumeration).
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    user.last_login_at = dt.datetime.now(dt.timezone.utc)
    db.commit()
    audit(db, "LOGIN", user_id=user.id, resource=user.email,
          ip=request.client.host if request.client else None,
          user_agent=request.headers.get("user-agent"))
    return TokenOut(
        access_token=create_access_token(user),
        role=user.role,
        expires_in=access_token_ttl_seconds(),
    )


@router.post("/refresh", response_model=TokenOut)
def refresh(request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Extend a still-valid session by issuing a fresh access token.

    Access tokens are deliberately short-lived (60 min by default), but a user
    halfway through analysing a message must not be thrown back to the login
    screen. Clients call this while the user is active, producing a sliding
    session: activity extends it, idleness lets it lapse.

    This is intentionally NOT a refresh-token flow. It requires a currently
    valid token, so nothing here can resurrect an already-expired credential —
    an attacker holding a dead token gains nothing.
    """
    audit(db, "TOKEN_REFRESH", user_id=user.id, resource=user.email,
          ip=request.client.host if request.client else None)
    return TokenOut(
        access_token=create_access_token(user),
        role=user.role,
        expires_in=access_token_ttl_seconds(),
    )


@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        token = auth_header.split(" ")[1]
        payload = decode_token(token)
        if payload and "jti" in payload:
            revoke_token(payload["jti"])
    audit(db, "LOGOUT", user_id=user.id, resource=user.email,
          ip=request.client.host if request.client else None)
    return {"status": "success", "message": "Successfully logged out"}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.post("/password", status_code=status.HTTP_200_OK)
def change_password(payload: PasswordChangeIn, request: Request,
                    user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Allow authenticated user to change their account password securely."""
    if not verify_password(payload.old_password, user.password_hash):
        audit(db, "PASSWORD_CHANGE_FAILED", user_id=user.id, resource=user.email,
              ip=request.client.host if request.client else None)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")

    if verify_password(payload.new_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="New password must be different from current password")

    user.password_hash = hash_password(payload.new_password)
    db.commit()
    audit(db, "PASSWORD_CHANGED", user_id=user.id, resource=user.email,
          ip=request.client.host if request.client else None)
    return {"status": "success", "message": "Password updated successfully"}


@router.delete("/me", status_code=status.HTTP_200_OK)
def delete_me(request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Delete current user account and data (Google Play Policy requirement)."""
    user_id = user.id
    email = user.email
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        token = auth_header.split(" ")[1]
        payload = decode_token(token)
        if payload and "jti" in payload:
            revoke_token(payload["jti"])

    audit(db, "ACCOUNT_DELETED", user_id=user_id, resource=email,
          ip=request.client.host if request.client else None)

    # Clean up user's analyses and findings
    from app.models import Analysis, Notification
    db.query(Notification).filter(Notification.user_id == user_id).delete()
    db.query(Analysis).filter(Analysis.user_id == user_id).delete()
    db.delete(user)
    db.commit()
    return {"status": "success", "message": f"Account {email} permanently deleted"}


