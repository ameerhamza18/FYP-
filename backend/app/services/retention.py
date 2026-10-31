"""Automated data retention and privacy maintenance (storage limitation / FR-10).

Purges expired scan records according to RETENTION_ANALYSIS_DAYS while honoring
AUDIT_LOG_APPEND_ONLY=True by default so the HMAC-SHA256 cryptographic audit
chain remains unbroken and append-only (FR-10).
"""
import datetime as dt
import logging
from typing import Dict

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Analysis, AuditLog

logger = logging.getLogger("trustlayer.retention")


def purge_expired_records(db: Session) -> Dict:
    """Purge expired analyses; preserve append-only HMAC audit chain by default."""
    cfg = get_settings()
    now = dt.datetime.now(dt.timezone.utc)
    analysis_cutoff = now - dt.timedelta(days=cfg.retention_analysis_days)
    audit_cutoff = now - dt.timedelta(days=cfg.retention_audit_days)

    purged_analyses = 0
    purged_audits = 0

    try:
        old_analyses = db.query(Analysis).filter(Analysis.created_at < analysis_cutoff).all()
        purged_analyses = len(old_analyses)
        for a in old_analyses:
            db.delete(a)

        if not cfg.audit_log_append_only:
            purged_audits = (
                db.query(AuditLog)
                .filter(AuditLog.created_at < audit_cutoff)
                .delete(synchronize_session=False)
            )

        db.commit()
        if purged_analyses or purged_audits:
            logger.info(
                "Data retention purge completed: %d analyses, %d audit logs removed",
                purged_analyses,
                purged_audits,
            )
    except Exception as exc:
        db.rollback()
        logger.error("Data retention purge failed: %s", exc)
        raise

    return {
        "status": "success",
        "purged_analyses": purged_analyses,
        "purged_audit_logs": purged_audits,
        "audit_log_append_only": cfg.audit_log_append_only,
        "analysis_retention_days": cfg.retention_analysis_days,
        "audit_retention_days": cfg.retention_audit_days,
    }


def delete_user_cascade(db: Session, user) -> None:
    """Consistently delete a user and all cascaded relations across PostgreSQL and SQLite."""
    from app.models import Analysis, Indicator, Notification, SEFinding

    user_id = user.id

    try:
        db.query(Notification).filter(Notification.user_id == user_id).delete(synchronize_session=False)

        analysis_ids = [
            row[0] for row in db.query(Analysis.id).filter(Analysis.user_id == user_id).all()
        ]
        if analysis_ids:
            db.query(Indicator).filter(Indicator.analysis_id.in_(analysis_ids)).delete(synchronize_session=False)
            db.query(SEFinding).filter(SEFinding.analysis_id.in_(analysis_ids)).delete(synchronize_session=False)
            db.query(Analysis).filter(Analysis.id.in_(analysis_ids)).delete(synchronize_session=False)

        db.delete(user)
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error("Failed to delete user %s and related cascade data: %s", user_id, exc)
        raise
