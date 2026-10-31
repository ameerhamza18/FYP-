"""Admin SOC Security Center API (RBAC-restricted, OWASP API5, FR-10 & FR-12)."""
import asyncio
import datetime as dt
import json
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import SessionLocal, get_db
from app.models import Analysis, AuditLog, Campaign, SEFinding, ThreatIOC, User
from app.schemas import (
    AdminAnalysisOut,
    AdminAnalysisPage,
    AdminStatsOut,
    AdminUserUpdateIn,
    AuditChainVerifyOut,
    CampaignOut,
    ThreatIOCBulkSyncIn,
    ThreatIOCIn,
    ThreatIOCOut,
)
from app.security.audit import audit, verify_audit_chain
from app.security.auth import require_admin
from services.threat_engine import sender_intel, threat_intel

router = APIRouter(prefix="/api/admin", tags=["admin"])

RISK_LEVELS = ("LOW", "MEDIUM", "HIGH", "CRITICAL")
INPUT_TYPES = ("text", "url", "screenshot")


def sync_db_iocs_to_memory(db: Session) -> None:
    """Synchronize active custom ThreatIOC rows from DB into threat_intel & sender_intel."""
    active_rows = db.query(ThreatIOC).filter(ThreatIOC.is_active.is_(True)).all()
    domains = {r.value: r.description for r in active_rows if r.ioc_type == "domain"}
    keywords = [(r.value, r.description) for r in active_rows if r.ioc_type == "keyword"]
    senders = {r.value: r.description for r in active_rows if r.ioc_type == "sender"}

    threat_intel.reset_and_sync_custom_iocs(domains=domains, keywords=keywords)
    sender_intel.reset_and_sync_custom_senders(custom_senders=senders)


def _normalize_ioc_value(ioc_type: str, raw_value: str) -> str:
    if ioc_type == "domain":
        cleaned = raw_value.lower().strip()
        cleaned = re.sub(r"^https?://", "", cleaned)
        cleaned = cleaned.split("/", 1)[0].strip(".")
        return cleaned
    if ioc_type == "sender":
        return re.sub(r"\s+", "", raw_value).strip().upper()
    return raw_value.lower().strip()


@router.get("/stats", response_model=AdminStatsOut)
def stats(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    total = db.query(func.count(Analysis.id)).scalar() or 0
    high_risk = db.query(func.count(Analysis.id)).filter(
        Analysis.risk_level.in_(["HIGH", "CRITICAL"])
    ).scalar() or 0

    type_counts = dict(
        db.query(Analysis.threat_type, func.count(Analysis.id))
        .group_by(Analysis.threat_type)
        .all()
    )

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
        .limit(8)
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
            Campaign.hits >= 3
        ).scalar() or 0,
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
    """Paginated, filterable threat feed powering the SOC dashboard."""
    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    query = db.query(Analysis, User.email).join(User, Analysis.user_id == User.id)
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
    return db.query(Campaign).order_by(Campaign.hits.desc()).limit(50).all()


# ---------------------------------------------------------------------------
# SOC IOC Blocklist Controls (FR-12, Section 1.4.1 & DFD Level 0 / D1)
# ---------------------------------------------------------------------------
@router.get("/iocs", response_model=list[ThreatIOCOut])
def list_iocs(
    ioc_type: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Return built-in + SOC custom Indicators of Compromise."""
    results: list[ThreatIOCOut] = []

    custom_rows = db.query(ThreatIOC).order_by(ThreatIOC.created_at.desc()).all()
    custom_keys = {(r.ioc_type, r.value) for r in custom_rows}

    for r in custom_rows:
        if ioc_type and r.ioc_type != ioc_type:
            continue
        results.append(
            ThreatIOCOut(
                id=r.id,
                ioc_type=r.ioc_type,
                value=r.value,
                severity=r.severity,
                description=r.description,
                source="custom",
                is_active=r.is_active,
                created_at=str(r.created_at),
            )
        )

    if not ioc_type or ioc_type == "domain":
        for dom, desc in sorted(threat_intel.BUILTIN_MALICIOUS_DOMAINS.items()):
            if ("domain", dom) not in custom_keys:
                results.append(
                    ThreatIOCOut(
                        id=None,
                        ioc_type="domain",
                        value=dom,
                        severity="HIGH",
                        description=desc,
                        source="builtin",
                        is_active=True,
                    )
                )

    if not ioc_type or ioc_type == "keyword":
        for kw, desc in threat_intel.BUILTIN_MALICIOUS_KEYWORDS:
            if ("keyword", kw) not in custom_keys:
                results.append(
                    ThreatIOCOut(
                        id=None,
                        ioc_type="keyword",
                        value=kw,
                        severity="MEDIUM",
                        description=desc,
                        source="builtin",
                        is_active=True,
                    )
                )

    if not ioc_type or ioc_type == "sender":
        for snd, desc in sorted(sender_intel.BUILTIN_SCAM_SENDERS.items()):
            if ("sender", snd) not in custom_keys:
                results.append(
                    ThreatIOCOut(
                        id=None,
                        ioc_type="sender",
                        value=snd,
                        severity="CRITICAL",
                        description=desc,
                        source="builtin",
                        is_active=True,
                    )
                )

    return results


@router.post("/iocs", response_model=ThreatIOCOut, status_code=status.HTTP_201_CREATED)
def create_ioc(
    payload: ThreatIOCIn,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Add or update a custom IOC in D1 Local Threat Intel Store and sync live."""
    norm_val = _normalize_ioc_value(payload.ioc_type, payload.value)
    if not norm_val:
        raise HTTPException(status_code=422, detail="Invalid IOC value after normalization")

    existing = (
        db.query(ThreatIOC)
        .filter(ThreatIOC.ioc_type == payload.ioc_type, ThreatIOC.value == norm_val)
        .first()
    )
    if existing:
        existing.severity = payload.severity
        existing.description = payload.description
        existing.is_active = True
        row = existing
    else:
        row = ThreatIOC(
            ioc_type=payload.ioc_type,
            value=norm_val,
            severity=payload.severity,
            description=payload.description,
            is_active=True,
            created_by=admin_user.id,
        )
        db.add(row)

    db.commit()
    db.refresh(row)
    sync_db_iocs_to_memory(db)

    audit(
        db,
        "ADMIN_IOC_ADDED",
        user_id=admin_user.id,
        resource=f"ioc:{row.ioc_type}:{row.value}",
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        meta={"severity": row.severity, "id": row.id},
    )
    return ThreatIOCOut(
        id=row.id,
        ioc_type=row.ioc_type,
        value=row.value,
        severity=row.severity,
        description=row.description,
        source="custom",
        is_active=row.is_active,
        created_at=str(row.created_at),
    )


@router.post("/iocs/sync")
def bulk_sync_iocs(
    payload: ThreatIOCBulkSyncIn,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Bulk-import threat intelligence feed entries (DFD Level 0 Threat Intel Feeds)."""
    added = 0
    updated = 0
    for item in payload.items:
        norm_val = _normalize_ioc_value(item.ioc_type, item.value)
        if not norm_val:
            continue
        existing = (
            db.query(ThreatIOC)
            .filter(ThreatIOC.ioc_type == item.ioc_type, ThreatIOC.value == norm_val)
            .first()
        )
        if existing:
            existing.severity = item.severity
            existing.description = item.description
            existing.is_active = True
            updated += 1
        else:
            db.add(
                ThreatIOC(
                    ioc_type=item.ioc_type,
                    value=norm_val,
                    severity=item.severity,
                    description=item.description,
                    is_active=True,
                    created_by=admin_user.id,
                )
            )
            added += 1

    db.commit()
    sync_db_iocs_to_memory(db)
    audit(
        db,
        "ADMIN_IOC_FEED_SYNC",
        user_id=admin_user.id,
        resource="threat_iocs:bulk_sync",
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        meta={"added": added, "updated": updated},
    )
    return {"status": "success", "added": added, "updated": updated}


@router.delete("/iocs/{ioc_id}")
def delete_ioc(
    ioc_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Delete a custom SOC IOC and refresh live threat-intel memory."""
    row = db.query(ThreatIOC).filter(ThreatIOC.id == ioc_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Custom IOC not found")

    ioc_ref = f"ioc:{row.ioc_type}:{row.value}"
    db.delete(row)
    db.commit()
    sync_db_iocs_to_memory(db)

    audit(
        db,
        "ADMIN_IOC_REMOVED",
        user_id=admin_user.id,
        resource=ioc_ref,
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return {"status": "success", "deleted_id": ioc_id}


# ---------------------------------------------------------------------------
# Chained HMAC-SHA256 Audit Logs & Verification (FR-10)
# ---------------------------------------------------------------------------
@router.get("/audit-logs")
def audit_logs(limit: int = 100, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    limit = max(1, min(limit, 500))
    logs = db.query(AuditLog).order_by(AuditLog.id.desc()).limit(limit).all()
    return [
        {
            "id": l.id,
            "user_id": l.user_id,
            "action": l.action,
            "resource": l.resource,
            "ip": l.ip,
            "prev_hash": l.prev_hash,
            "hmac_signature": l.hmac_signature,
            "created_at": str(l.created_at),
        }
        for l in logs
    ]


@router.get("/audit-logs/verify", response_model=AuditChainVerifyOut)
def verify_audit_logs_endpoint(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Cryptographically verify the entire append-only HMAC-SHA256 audit log chain."""
    return AuditChainVerifyOut(**verify_audit_chain(db))


# ---------------------------------------------------------------------------
# User RBAC & Operational Oversight
# ---------------------------------------------------------------------------
@router.get("/users")
def users(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return [
        {
            "id": u.id,
            "email": u.email,
            "role": u.role,
            "is_active": u.is_active,
            "created_at": str(u.created_at),
        }
        for u in db.query(User).order_by(User.id).all()
    ]


@router.patch("/users/{user_id}/status")
def toggle_user_status(
    user_id: int,
    payload: AdminUserUpdateIn,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
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
    audit(
        db,
        "ADMIN_USER_STATUS_CHANGE",
        user_id=admin_user.id,
        resource=f"user:{target.id}:{target.email}",
        meta={"new_status": target.is_active},
    )
    return {"status": "success", "user_id": target.id, "is_active": target.is_active}


@router.patch("/users/{user_id}/role")
def update_user_role(
    user_id: int,
    payload: AdminUserUpdateIn,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
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
    audit(
        db,
        "ADMIN_USER_ROLE_CHANGE",
        user_id=admin_user.id,
        resource=f"user:{target.id}:{target.email}",
        meta={"new_role": target.role},
    )
    return {"status": "success", "user_id": target.id, "role": target.role}


@router.delete("/users/{user_id}", status_code=status.HTTP_200_OK)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if target.id == admin_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot delete their own account via the admin panel",
        )

    target_id = target.id
    target_email = target.email
    from app.services.retention import delete_user_cascade
    delete_user_cascade(db, target)
    audit(
        db,
        "ADMIN_USER_DELETED",
        user_id=admin_user.id,
        resource=f"user:{target_id}:{target_email}",
    )
    return {"status": "success", "message": f"User {target_email} removed"}


@router.get("/metrics")
def operational_metrics(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    from services.nlp.classifier import get_classifier
    classifier = get_classifier()

    total_analyses = db.query(func.count(Analysis.id)).scalar() or 0
    total_users = db.query(func.count(User.id)).scalar() or 0
    active_users = db.query(func.count(User.id)).filter(User.is_active.is_(True)).scalar() or 0
    high_critical = db.query(func.count(Analysis.id)).filter(
        Analysis.risk_level.in_(["HIGH", "CRITICAL"])
    ).scalar() or 0
    avg_latency = db.query(func.avg(Analysis.latency_ms)).scalar() or 0.0
    custom_ioc_count = db.query(func.count(ThreatIOC.id)).filter(ThreatIOC.is_active.is_(True)).scalar() or 0

    return {
        "status": "healthy",
        "timestamp": dt.datetime.now(dt.timezone.utc).isoformat(),
        "database": {"connection": "active", "total_analyses": total_analyses},
        "users": {"total": total_users, "active": active_users},
        "threat_intel": {
            "builtin_domains": len(threat_intel.BUILTIN_MALICIOUS_DOMAINS),
            "builtin_keywords": len(threat_intel.BUILTIN_MALICIOUS_KEYWORDS),
            "custom_iocs": custom_ioc_count,
        },
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
def export_audit_logs_csv(
    request: Request,
    limit: int = 5000,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Export HMAC-chained audit logs as CSV file for SOC compliance (FR-10, FR-12)."""
    import csv
    import io
    from fastapi.responses import Response
    from app.security.validation import sanitize_csv_row

    audit(
        db,
        "ADMIN_EXPORT_AUDIT_CSV",
        user_id=admin_user.id,
        resource="audit_logs:csv",
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    limit = max(1, min(limit, 20000))
    logs = db.query(AuditLog).order_by(AuditLog.id.desc()).limit(limit).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id", "user_id", "action", "resource", "ip", "user_agent",
        "created_at", "prev_hash", "hmac_signature",
    ])
    for l in logs:
        writer.writerow(sanitize_csv_row([
            l.id, l.user_id, l.action, l.resource, l.ip, l.user_agent,
            l.created_at, l.prev_hash, l.hmac_signature,
        ]))

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=trustlayer_audit_logs.csv"},
    )


@router.get("/export/analyses/csv")
def export_analyses_csv(
    request: Request,
    limit: int = 5000,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Export threat analyses feed as CSV file for security reporting (FR-10, FR-12)."""
    import csv
    import io
    from fastapi.responses import Response
    from app.security.validation import sanitize_csv_row

    audit(
        db,
        "ADMIN_EXPORT_ANALYSES_CSV",
        user_id=admin_user.id,
        resource="analyses:csv",
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

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
    writer.writerow([
        "analysis_id", "user_email", "input_type", "risk_score", "risk_level",
        "threat_type", "campaign_flagged", "created_at",
    ])
    for a, email in rows:
        writer.writerow(sanitize_csv_row([
            a.id, email, a.input_type, a.risk_score, a.risk_level,
            a.threat_type, a.campaign_flagged, a.created_at,
        ]))

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=trustlayer_threat_analyses.csv"},
    )


@router.post("/maintenance/purge-retention")
def trigger_retention_purge(
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Manually trigger data retention expiration purge (admin-only)."""
    from app.services.retention import purge_expired_records
    res = purge_expired_records(db)
    audit(
        db,
        "ADMIN_RETENTION_PURGE",
        user_id=admin_user.id,
        resource="maintenance:purge-retention",
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        meta={"purged_analyses": res.get("purged_analyses", 0)},
    )
    return res
