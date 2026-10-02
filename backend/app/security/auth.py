"""Authentication & authorization: JWT issuing/verification, bcrypt password
hashing, and FastAPI dependencies for role-based access control.

Implements:
- OWASP API2: Broken Authentication (JWT + expiry + strong hashing)
- OWASP API5: Broken Function Level Authorization (role dependencies)
"""
import datetime as dt
import secrets
import threading
import time
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import User

settings = get_settings()
_bearer_scheme = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------- passwords
def hash_password(password: str) -> str:
    """bcrypt password hashing with per-hash salt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# ---------------------------------------------------------------- JWT
def create_access_token(user: User) -> str:
    now = dt.datetime.now(dt.timezone.utc)
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "iat": now,
        "exp": now + dt.timedelta(minutes=settings.access_token_expire_minutes),
        "jti": secrets.token_hex(16),  # unique token ID (revocation-ready)
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def access_token_ttl_seconds() -> int:
    """Lifetime of a freshly issued access token, in seconds."""
    return settings.access_token_expire_minutes * 60


_revoked_jtis: dict[str, float] = {}
_revocation_lock = threading.Lock()


def revoke_token(jti: str, ttl_seconds: int = 3600) -> None:
    """Revoke a token JTI until its natural expiry (JTI blocklist)."""
    if not jti:
        return
    expiry = time.time() + ttl_seconds
    with _revocation_lock:
        _revoked_jtis[jti] = expiry
        now = time.time()
        expired = [k for k, exp in _revoked_jtis.items() if exp < now]
        for k in expired:
            del _revoked_jtis[k]

    if settings.redis_url:
        try:
            import redis
            r = redis.Redis.from_url(settings.redis_url)
            r.setex(f"revoked:jti:{jti}", ttl_seconds, "1")
        except Exception:
            pass


def is_token_revoked(jti: str) -> bool:
    if not jti:
        return False
    with _revocation_lock:
        if jti in _revoked_jtis:
            if time.time() < _revoked_jtis[jti]:
                return True
            del _revoked_jtis[jti]

    if settings.redis_url:
        try:
            import redis
            r = redis.Redis.from_url(settings.redis_url)
            if r.exists(f"revoked:jti:{jti}"):
                return True
        except Exception:
            pass
    return False


def decode_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
        jti = payload.get("jti")
        if jti and is_token_revoked(jti):
            return None
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


# ---------------------------------------------------------------- dependencies
def _credentials_exception(detail: str = "Could not validate credentials") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _credentials_exception("Missing bearer token")

    payload = decode_token(credentials.credentials)
    if payload is None:
        raise _credentials_exception("Invalid or expired token")

    try:
        user_id = int(payload.get("sub", ""))
    except (TypeError, ValueError):
        raise _credentials_exception("Invalid token subject")

    user = db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()
    if user is None:
        raise _credentials_exception("User not found or inactive")

    # Attach request metadata for audit logging downstream.
    request.state.user = user
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    """OWASP API5 — function-level authorization for the SOC dashboard APIs."""
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    return user
