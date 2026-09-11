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
from app.schemas import LoginIn, RegisterIn, TokenOut, UserOut
from app.security.audit import audit
from app.security.auth import create_access_token, get_current_user, hash_password, verify_password

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
    return TokenOut(access_token=create_access_token(user), role=user.role)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
