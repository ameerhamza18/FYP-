"""Admin SOC-style Security Center API (role-restricted, OWASP API5)."""
import datetime as dt

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Analysis, Campaign, SEFinding, User
from app.schemas import AdminStatsOut, CampaignOut
from app.security.auth import require_admin

router = APIRouter(prefix="/api/admin", tags=["admin"])


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
