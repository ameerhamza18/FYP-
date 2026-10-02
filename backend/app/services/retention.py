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
