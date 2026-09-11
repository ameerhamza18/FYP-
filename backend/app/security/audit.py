"""Append-only audit logging helper (non-repudiation / OWASP API9)."""
from typing import Optional

from sqlalchemy.orm import Session

from app.models import AuditLog


def audit(
    db: Session,
    action: str,
    user_id: Optional[int] = None,
    resource: Optional[str] = None,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
    meta: Optional[dict] = None,
) -> None:
    """Record a security-relevant event. Never raises to the caller."""
    try:
        db.add(
            AuditLog(
                user_id=user_id,
                action=action,
                resource=resource,
                ip=ip,
                user_agent=(user_agent or "")[:255],
                meta=meta or {},
            )
        )
        db.commit()
    except Exception:  # noqa: BLE001 — auditing must not break request flow
        db.rollback()
