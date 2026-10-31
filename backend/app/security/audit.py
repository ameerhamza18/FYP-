"""Append-only cryptographic audit logging & HMAC-SHA256 chain verifier (FR-10).

Every audit record commits to the previous record's HMAC-SHA256 digest plus its
own canonical fields, forming a tamper-evident hash chain anchored at
``GENESIS_AUDIT_HASH``. Any out-of-band SQL modification, insertion, or row
deletion breaks ``verify_audit_chain(db)``.
"""
import datetime as dt
import hashlib
import hmac
import json
import threading
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import AuditLog, GENESIS_AUDIT_HASH

_audit_lock = threading.Lock()


def canonicalize_timestamp(ts: dt.datetime) -> str:
    """Normalize naive or aware datetimes to canonical UTC ISO-8601 microseconds."""
    if isinstance(ts, str):
        ts = dt.datetime.fromisoformat(ts.replace("Z", "+00:00"))
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=dt.timezone.utc)
    else:
        ts = ts.astimezone(dt.timezone.utc)
    return ts.strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def compute_audit_hmac(
    prev_hash: str,
    created_at: dt.datetime,
    user_id: Optional[int],
    action: str,
    resource: Optional[str],
    ip: Optional[str],
    user_agent: Optional[str],
    meta: Optional[dict],
    secret_key: Optional[str] = None,
) -> str:
    """Compute deterministic HMAC-SHA256 signature for an audit log entry."""
    key = (secret_key or get_settings().secret_key).encode("utf-8")
    ts_str = canonicalize_timestamp(created_at)
    meta_json = json.dumps(meta or {}, sort_keys=True, separators=(",", ":"))
    uid_str = "" if user_id is None else str(user_id)
    ua_str = (user_agent or "")[:255]
    canonical = (
        f"{prev_hash or GENESIS_AUDIT_HASH}|{ts_str}|{uid_str}|"
        f"{action or ''}|{resource or ''}|{ip or ''}|{ua_str}|{meta_json}"
    )
    return hmac.new(key, canonical.encode("utf-8"), hashlib.sha256).hexdigest()


def audit(
    db: Session,
    action: str,
    user_id: Optional[int] = None,
    resource: Optional[str] = None,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
    meta: Optional[dict] = None,
) -> None:
    """Record a security-relevant event chained via HMAC-SHA256. Never raises."""
    try:
        with _audit_lock:
            now = dt.datetime.now(dt.timezone.utc)
            last = db.query(AuditLog).order_by(AuditLog.id.desc()).first()
            prev_sig = (
                last.hmac_signature
                if last is not None and last.hmac_signature
                else GENESIS_AUDIT_HASH
            )
            clean_ua = (user_agent or "")[:255]
            clean_meta = meta or {}
            sig = compute_audit_hmac(
                prev_hash=prev_sig,
                created_at=now,
                user_id=user_id,
                action=action,
                resource=resource,
                ip=ip,
                user_agent=clean_ua,
                meta=clean_meta,
            )
            db.add(
                AuditLog(
                    user_id=user_id,
                    action=action,
                    resource=resource,
                    ip=ip,
                    user_agent=clean_ua,
                    meta=clean_meta,
                    prev_hash=prev_sig,
                    hmac_signature=sig,
                    created_at=now,
                )
            )
            db.commit()
    except Exception:  # noqa: BLE001 — auditing must not break request flow
        db.rollback()


def verify_audit_chain(db: Session) -> Dict[str, Any]:
    """Verify cryptographic integrity of the entire append-only AuditLog chain."""
    rows = db.query(AuditLog).order_by(AuditLog.id.asc()).all()
    expected_prev = GENESIS_AUDIT_HASH
    checked = 0

    for row in rows:
        checked += 1
        if row.prev_hash != expected_prev:
            return {
                "valid": False,
                "checked_count": checked,
                "total_records": len(rows),
                "head_signature": rows[-1].hmac_signature if rows else GENESIS_AUDIT_HASH,
                "broken_at_id": row.id,
                "reason": "prev_hash_mismatch",
            }
        recomputed = compute_audit_hmac(
            prev_hash=row.prev_hash,
            created_at=row.created_at,
            user_id=row.user_id,
            action=row.action,
            resource=row.resource,
            ip=row.ip,
            user_agent=row.user_agent,
            meta=row.meta,
        )
        if not hmac.compare_digest(row.hmac_signature or "", recomputed):
            return {
                "valid": False,
                "checked_count": checked,
                "total_records": len(rows),
                "head_signature": rows[-1].hmac_signature if rows else GENESIS_AUDIT_HASH,
                "broken_at_id": row.id,
                "reason": "hmac_signature_mismatch",
            }
        expected_prev = row.hmac_signature

    return {
        "valid": True,
        "checked_count": checked,
        "total_records": len(rows),
        "head_signature": expected_prev,
        "broken_at_id": None,
        "reason": None,
    }
