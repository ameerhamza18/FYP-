"""Admin SOC-style Security Center API (role-restricted, OWASP API5)."""
import asyncio
import datetime as dt
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import SessionLocal, get_db
from app.models import Analysis, AuditLog, Campaign, Notification, SEFinding, User
from app.schemas import (
    AdminAnalysisOut,
    AdminAnalysisPage,
    AdminStatsOut,
    AdminUserUpdateIn,
    CampaignOut,
)
from app.security.audit import audit
from app.security.auth import require_admin


router = APIRouter(prefix="/api/admin", tags=["admin"])

RISK_LEVELS = ("LOW", "MEDIUM", "HIGH", "CRITICAL")
INPUT_TYPES = ("text", "url", "screenshot")


@router.get("/stats", response_model=AdminStatsOut)
def stats(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    total = db.query(func.count(Analysis.id)).scalar() or 0
    high_risk = db.query(func.count(Analysis.id)).filter(
        Analysis.risk_level.in_(["HIGH", "CRITICAL"])).scalar() or 0

    # Single aggregated query for all threat types instead of 5 separate scans
    type_counts = dict(
        db.query(Analysis.threat_type, func.count(Analysis.id))
        .group_by(Analysis.threat_type)
        .all()
    )

    # 14-day threat trend
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
        phishing=type_counts.get("Phishing", 0),
        job_scams=type_counts.get("Job Scam", 0),
        financial_fraud=type_counts.get("Financial Fraud", 0),
        investment_scams=type_counts.get("Investment Scam", 0),
        prize_scams=type_counts.get("Prize Scam", 0),
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


@router.patch("/users/{user_id}/status")
def toggle_user_status(
    user_id: int,
    payload: AdminUserUpdateIn,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Enable or disable user account access (OWASP API5 RBAC protected)."""
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if target.id == admin_user.id and payload.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot deactivate their own active session",
        )

    if payload.is_active is not None:
        target.is_active = payload.is_active

    db.commit()
    audit(db, "ADMIN_USER_STATUS_CHANGE", user_id=admin_user.id,
          resource=f"user:{target.id}:{target.email}",
          meta={"new_status": target.is_active})
    return {"status": "success", "user_id": target.id, "is_active": target.is_active}


@router.patch("/users/{user_id}/role")
def update_user_role(
    user_id: int,
    payload: AdminUserUpdateIn,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Change user authorization role (admin or user)."""
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if target.id == admin_user.id and payload.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot demote their own account role",
        )

    if payload.role:
        target.role = payload.role

    db.commit()
    audit(db, "ADMIN_USER_ROLE_CHANGE", user_id=admin_user.id,
          resource=f"user:{target.id}:{target.email}",
          meta={"new_role": target.role})
    return {"status": "success", "user_id": target.id, "role": target.role}


@router.delete("/users/{user_id}", status_code=status.HTTP_200_OK)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Permanently delete user account and associated records."""
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if target.id == admin_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot delete their own account via the admin panel",
        )

    db.query(Notification).filter(Notification.user_id == target.id).delete()
    db.query(Analysis).filter(Analysis.user_id == target.id).delete()
    db.delete(target)
    db.commit()
    audit(db, "ADMIN_USER_DELETED", user_id=admin_user.id,
          resource=f"user:{target.id}:{target.email}")
    return {"status": "success", "message": f"User {target.email} removed"}


@router.get("/metrics")
def operational_metrics(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    """System and operational metrics for DevOps monitoring."""
    from services.nlp.classifier import get_classifier
    classifier = get_classifier()

    total_analyses = db.query(func.count(Analysis.id)).scalar() or 0
    total_users = db.query(func.count(User.id)).scalar() or 0
    active_users = db.query(func.count(User.id)).filter(User.is_active.is_(True)).scalar() or 0
    high_critical = db.query(func.count(Analysis.id)).filter(
        Analysis.risk_level.in_(["HIGH", "CRITICAL"])
    ).scalar() or 0
    avg_latency = db.query(func.avg(Analysis.latency_ms)).scalar() or 0.0

    return {
        "status": "healthy",
        "timestamp": dt.datetime.now(dt.timezone.utc).isoformat(),
        "database": {"connection": "active", "total_analyses": total_analyses},
        "users": {"total": total_users, "active": active_users},
        "performance": {
            "avg_latency_ms": round(float(avg_latency), 2),
            "high_critical_count": high_critical,
            "threat_ratio_pct": round((high_critical / total_analyses * 100), 2) if total_analyses else 0,
        },
        "ml_engine": {
            "model_loaded": classifier.available,
            "mode": "hybrid-ml-rules" if classifier.available else "rules-intel-fallback",
        },
    }



@router.get("/stream/threats")
async def stream_threats(_: User = Depends(require_admin)):
    """Server-Sent Events (SSE) live feed of incoming threats for the SOC dashboard."""
    async def event_generator():
        last_checked = dt.datetime.now(dt.timezone.utc) - dt.timedelta(seconds=10)
        while True:
            db = SessionLocal()
            try:
                new_threats = (
                    db.query(Analysis, User.email)
                    .join(User, Analysis.user_id == User.id)
                    .filter(Analysis.created_at > last_checked)
                    .order_by(Analysis.created_at.asc())
                    .limit(20)
                    .all()
                )
                if new_threats:
                    last_checked = new_threats[-1][0].created_at
                    events_data = [
                        {
                            "id": a.id,
                            "user_email": email,
                            "input_type": a.input_type,
                            "risk_score": a.risk_score,
                            "risk_level": a.risk_level,
                            "threat_type": a.threat_type,
                            "campaign_flagged": a.campaign_flagged,
                            "created_at": a.created_at.isoformat() if a.created_at else None,
                        }
                        for a, email in new_threats
                    ]
                    yield f"event: threat\ndata: {json.dumps(events_data)}\n\n"
                else:
                    yield ": ping\n\n"
            except Exception:
                pass
            finally:
                db.close()
            await asyncio.sleep(3)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/export/audit-logs/csv")
def export_audit_logs_csv(limit: int = 5000, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    """Export audit logs as CSV file for SOC compliance."""
    import csv
    import io
    from fastapi.responses import Response
    from app.models import AuditLog

    limit = max(1, min(limit, 20000))
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).all()
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
def export_analyses_csv(limit: int = 5000, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    """Export threat analyses feed as CSV file for security reporting."""
    import csv
    import io
    from fastapi.responses import Response

    limit = max(1, min(limit, 20000))
    rows = (
        db.query(Analysis, User.email)
        .join(User, Analysis.user_id == User.id)
        .order_by(Analysis.created_at.desc())
        .limit(limit)
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


@router.post("/maintenance/purge-retention")
def trigger_retention_purge(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    """Manually trigger data retention expiration purge (admin-only)."""
    from app.services.retention import purge_expired_records
    return purge_expired_records(db)

