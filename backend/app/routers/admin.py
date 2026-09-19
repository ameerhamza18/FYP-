"""Admin SOC-style Security Center API (role-restricted, OWASP API5)."""
import datetime as dt
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Analysis, Campaign, SEFinding, User
from app.schemas import AdminAnalysisOut, AdminAnalysisPage, AdminStatsOut, CampaignOut
from app.security.auth import require_admin

router = APIRouter(prefix="/api/admin", tags=["admin"])

RISK_LEVELS = ("LOW", "MEDIUM", "HIGH", "CRITICAL")
INPUT_TYPES = ("text", "url", "screenshot")


@router.get("/stats", response_model=AdminStatsOut)
def stats(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    total = db.query(func.count(Analysis.id)).scalar() or 0
    high_risk = db.query(func.count(Analysis.id)).filter(
        Analysis.risk_level.in_(["HIGH", "CRITICAL"])).scalar() or 0

    def count_type(threat: str) -> int:
        return db.query(func.count(Analysis.id)).filter(
            Analysis.threat_type == threat).scalar() or 0

    # 14-day threat trend
    trend = []
    since = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=13)
    rows = (
        db.query(Analysis.risk_level, func.date(Analysis.created_at), func.count(Analysis.id))
        .filter(Analysis.created_at >= since)
        .group_by(func.date(Analysis.created_at), Analysis.risk_level)
        .all()
    )
    by_day: dict = {}
    for level, day, cnt in rows:
        key = str(day)
        by_day.setdefault(key, {"date": key, "total": 0, "high": 0})
        by_day[key]["total"] += cnt
        if level in ("HIGH", "CRITICAL"):
            by_day[key]["high"] += cnt
    trend = sorted(by_day.values(), key=lambda d: d["date"])

    top_techniques = (
        db.query(SEFinding.technique, func.count(SEFinding.id).label("count"))
        .group_by(SEFinding.technique)
        .order_by(func.count(SEFinding.id).desc())
        .limit(5)
        .all()
    )

    return AdminStatsOut(
        total_analyses=total,
        high_risk=high_risk,
        phishing=count_type("Phishing"),
        job_scams=count_type("Job Scam"),
        financial_fraud=count_type("Financial Fraud"),
        investment_scams=count_type("Investment Scam"),
        prize_scams=count_type("Prize Scam"),
        threat_trend=trend,
        top_techniques=[{"technique": t, "count": c} for t, c in top_techniques],
        active_campaigns=db.query(func.count(Campaign.id)).filter(
            Campaign.hits >= 3).scalar() or 0,
    )


@router.get("/analyses", response_model=AdminAnalysisPage)
def analyses(
    limit: int = 25,
    offset: int = 0,
    risk_level: Optional[str] = None,
    input_type: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Paginated, filterable threat feed powering the SOC dashboard.

    Kept separate from /api/analyze/history (which is strictly per-user) so the
    SOC view has organisation-wide visibility without weakening BOLA rules.
    """
    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    query = (
        db.query(Analysis, User.email)
        .join(User, Analysis.user_id == User.id)
    )
    if risk_level and risk_level.upper() in RISK_LEVELS:
        query = query.filter(Analysis.risk_level == risk_level.upper())
    if input_type and input_type.lower() in INPUT_TYPES:
        query = query.filter(Analysis.input_type == input_type.lower())

    total = query.count()
    rows = (
        query.order_by(Analysis.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    # Build models explicitly (avoids the "declared type vs. raw dict" pitfall
    # that Pydantic only surfaces as a serialization warning).
    items = [
        AdminAnalysisOut(
            id=a.id,
            user_id=a.user_id,
            user_email=email,
            input_type=a.input_type,
            risk_score=a.risk_score,
            risk_level=a.risk_level,
            threat_type=a.threat_type,
            campaign_flagged=a.campaign_flagged,
            latency_ms=a.latency_ms,
            content_snippet=a.content_snippet,
            created_at=a.created_at,
        )
        for a, email in rows
    ]

    return AdminAnalysisPage(total=total, limit=limit, offset=offset, items=items)


@router.get("/campaigns", response_model=list[CampaignOut])
def campaigns(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return (
        db.query(Campaign)
        .order_by(Campaign.hits.desc())
        .limit(50)
        .all()
    )


@router.get("/audit-logs")
def audit_logs(limit: int = 100, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    from app.models import AuditLog
    limit = max(1, min(limit, 500))
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).all()
    return [
        {
            "id": l.id, "user_id": l.user_id, "action": l.action,
            "resource": l.resource, "ip": l.ip, "created_at": str(l.created_at),
        }
        for l in logs
    ]


@router.get("/users")
def users(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return [
        {"id": u.id, "email": u.email, "role": u.role,
         "is_active": u.is_active, "created_at": str(u.created_at)}
        for u in db.query(User).order_by(User.id).all()
    ]


@router.get("/export/audit-logs/csv")
def export_audit_logs_csv(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    """Export audit logs as CSV file for SOC compliance."""
    import csv
    import io
    from fastapi.responses import Response
    from app.models import AuditLog

    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "user_id", "action", "resource", "ip", "user_agent", "created_at"])
    for l in logs:
        writer.writerow([l.id, l.user_id, l.action, l.resource, l.ip, l.user_agent, l.created_at])
    
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=trustlayer_audit_logs.csv"},
    )


@router.get("/export/analyses/csv")
def export_analyses_csv(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    """Export threat analyses feed as CSV file for security reporting."""
    import csv
    import io
    from fastapi.responses import Response

    rows = (
        db.query(Analysis, User.email)
        .join(User, Analysis.user_id == User.id)
        .order_by(Analysis.created_at.desc())
        .all()
    )
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["analysis_id", "user_email", "input_type", "risk_score", "risk_level", "threat_type", "campaign_flagged", "created_at"])
    for a, email in rows:
        writer.writerow([a.id, email, a.input_type, a.risk_score, a.risk_level, a.threat_type, a.campaign_flagged, a.created_at])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=trustlayer_threat_analyses.csv"},
    )

