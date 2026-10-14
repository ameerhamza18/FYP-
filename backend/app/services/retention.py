"""Automated data retention and privacy maintenance (storage limitation / GDPR).

Ensures old user message analyses and security audit logs are not stored
indefinitely. Retention windows are configured in Settings via:
  RETENTION_ANALYSIS_DAYS (default: 90 days)
  RETENTION_AUDIT_DAYS    (default: 365 days)
"""
import datetime as dt
import logging
from typing import Dict
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Analysis, AuditLog

logger = logging.getLogger("trustlayer.retention")
settings = get_settings()


def purge_expired_records(db: Session) -> Dict:
    """Purge analyses and audit logs older than configured retention limits."""
    now = dt.datetime.now(dt.timezone.utc)
    analysis_cutoff = now - dt.timedelta(days=settings.retention_analysis_days)
    audit_cutoff = now - dt.timedelta(days=settings.retention_audit_days)

    purged_analyses = 0
    purged_audits = 0

    try:
        # Cascade will clean up indicators and se_findings
        old_analyses = db.query(Analysis).filter(Analysis.created_at < analysis_cutoff).all()
        purged_analyses = len(old_analyses)
        for a in old_analyses:
            db.delete(a)

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
        "analysis_retention_days": settings.retention_analysis_days,
        "audit_retention_days": settings.retention_audit_days,
    }


def delete_user_cascade(db: Session, user) -> None:
    """Consistently delete a user and all cascaded relations across PostgreSQL and SQLite.

    Ensures consistent deletion order:
    1. Removes all notifications for the user.
    2. Identifies all analyses belonging to the user.
    3. Removes all indicator records tied to those analyses.
    4. Removes all social-engineering finding records tied to those analyses.
    5. Removes all analysis records for the user.
    6. Removes the user record itself.
    """
    from app.models import Analysis, Indicator, Notification, SEFinding

    user_id = user.id

    try:
        # 1. Delete notifications
        db.query(Notification).filter(Notification.user_id == user_id).delete(synchronize_session=False)

        # 2. Find all analyses for this user
        analysis_ids = [
            row[0] for row in db.query(Analysis.id).filter(Analysis.user_id == user_id).all()
        ]
        if analysis_ids:
            # 3. Delete indicators referencing these analyses
            db.query(Indicator).filter(Indicator.analysis_id.in_(analysis_ids)).delete(synchronize_session=False)
            # 4. Delete SE findings referencing these analyses
            db.query(SEFinding).filter(SEFinding.analysis_id.in_(analysis_ids)).delete(synchronize_session=False)
            # 5. Delete analyses
            db.query(Analysis).filter(Analysis.id.in_(analysis_ids)).delete(synchronize_session=False)

        # 6. Delete user
        db.delete(user)
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error("Failed to delete user %s and related cascade data: %s", user_id, exc)
        raise
