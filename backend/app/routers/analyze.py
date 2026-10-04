"""Threat-analysis endpoints: message text, URL, screenshot (multimodal).

Every request: JWT-authenticated, rate-limited, input-validated, audited.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, status, BackgroundTasks
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import Analysis, User
from app.schemas import AnalysisDetailOut, AnalysisOut, AnalyzeTextIn, AnalyzeUrlIn
from app.security.audit import audit
from app.security.auth import get_current_user
from app.security.validation import validate_image_upload, validate_text_payload
from app.services.analysis_engine import analyze_content
from services.vision.ocr import OCRUnavailableError, extract_text

router = APIRouter(prefix="/api/analyze", tags=["analyze"])
settings = get_settings()
logger = logging.getLogger("trustlayer.analyze")


def _client_ip(request: Request) -> str:
    if request.client:
        return request.client.host
    return "unknown"


def _analyze(request: Request, user: User, input_type: str, text: str,
             source: str, db: Session, sender: Optional[str] = None,
             background_tasks: Optional[BackgroundTasks] = None) -> Analysis:
    analysis = analyze_content(
        user_id=user.id, input_type=input_type, text=text,
        source=source, db=db, client_ip=_client_ip(request), sender=sender,
    )
    audit(db, "ANALYZE", user_id=user.id, resource=f"analysis:{analysis.id}",
          ip=_client_ip(request), user_agent=request.headers.get("user-agent"),
          meta={"input_type": input_type, "risk_level": analysis.risk_level,
                "risk_score": analysis.risk_score, "has_sender": bool(sender)})

    # Auto-generate in-app alert notification for actionable threats
    if analysis.risk_level in ("HIGH", "CRITICAL") or analysis.campaign_flagged:
        from app.models import Notification
        title = (
            "🚨 Coordinated Campaign Threat Detected"
            if analysis.campaign_flagged
            else f"🚨 {analysis.risk_level} Risk Threat Flagged"
        )
        msg = (
            f"Analysis #{analysis.id} detected {analysis.threat_type} "
            f"with a risk score of {analysis.risk_score}/100. "
            f"Key action: {analysis.recommendation[:140]}..."
        )
        db.add(Notification(
            user_id=user.id,
            title=title,
            message=msg,
            notification_type="campaign" if analysis.campaign_flagged else "alert",
        ))
        db.commit()

    return analysis



@router.post("/text", response_model=AnalysisDetailOut)
def analyze_text(payload: AnalyzeTextIn, request: Request,
                 background_tasks: BackgroundTasks,
                 user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    text = validate_text_payload(payload.text)
    analysis = _analyze(request, user, "text", text, payload.source, db,
                        background_tasks=background_tasks, sender=payload.sender)
    return _detail(db, analysis.id)


@router.post("/url", response_model=AnalysisDetailOut)
def analyze_url_endpoint(payload: AnalyzeUrlIn, request: Request,
                         background_tasks: BackgroundTasks,
                         user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    text = validate_text_payload(payload.url)
    analysis = _analyze(request, user, "url", text, "url", db,
                        background_tasks=background_tasks)
    return _detail(db, analysis.id)


@router.post("/screenshot", response_model=AnalysisDetailOut)
async def analyze_screenshot(request: Request, upload: UploadFile,
                             background_tasks: BackgroundTasks,
                             user: User = Depends(get_current_user),
                             db: Session = Depends(get_db)):
    """OCR a screenshot in memory (bytes never written to disk) and analyze."""
    image_bytes = await validate_image_upload(upload, settings.max_upload_size_bytes)
    try:
        text = extract_text(image_bytes)
    except OCRUnavailableError as exc:
        logger.warning("OCR unavailable: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OCR service unavailable on this deployment. "
                   "Install Tesseract, or use text analysis instead.",
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))

    if not text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No readable text found in the screenshot",
        )
    analysis = _analyze(request, user, "screenshot", text, "screenshot", db,
                        background_tasks=background_tasks)
    return _detail(db, analysis.id)


@router.get("/history", response_model=list[AnalysisOut])
def my_history(limit: int = 20, user: User = Depends(get_current_user),
               db: Session = Depends(get_db)):
    """Recent threats for the mobile app home screen."""
    limit = max(1, min(limit, 100))
    return (
        db.query(Analysis)
        .filter(Analysis.user_id == user.id)
        .order_by(Analysis.created_at.desc())
        .limit(limit)
        .all()
    )


@router.get("/{analysis_id}", response_model=AnalysisDetailOut)
def get_analysis(analysis_id: int, user: User = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    """Object-level authorization (OWASP API1: BOLA) enforced here."""
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if analysis is None:
        raise HTTPException(status_code=404, detail="Analysis not found")
    if analysis.user_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to view this analysis")
    return _detail(db, analysis_id)


@router.get("/{analysis_id}/export-report")
def export_incident_report(
    analysis_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate a structured, verifiable forensic incident report for fraud/phishing evidence.

    Suitable for law enforcement, bank chargeback disputes, and cybersecurity records.
    """
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if analysis is None:
        raise HTTPException(status_code=404, detail="Analysis not found")
    if analysis.user_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to view this report")

    detail = _detail(db, analysis_id)
    created_str = str(analysis.created_at)

    return {
        "report_id": f"TL-IR-{analysis.id:06d}",
        "platform": "TrustLayer Cyber Intelligence Platform",
        "generated_at": created_str,
        "investigator_account": user.email,
        "integrity_hash": analysis.content_hash,
        "threat_assessment": {
            "risk_score": analysis.risk_score,
            "risk_level": analysis.risk_level,
            "threat_type": analysis.threat_type,
            "input_type": analysis.input_type,
            "campaign_correlated": analysis.campaign_flagged,
            "campaign_signature": analysis.campaign_signature,
        },
        "forensic_breakdown": {
            "ml_probability": analysis.ml_score,
            "rule_engine_score": analysis.rule_score,
            "intel_score": analysis.intel_score,
            "url_score": analysis.url_score,
            "indicators": [
                {
                    "category": ind.category,
                    "severity": ind.severity,
                    "title": ind.title,
                    "detail": ind.detail,
                }
                for ind in detail.indicators
            ],
            "social_engineering_tactics": [
                {
                    "technique": se.technique,
                    "intensity": se.intensity,
                    "evidence": se.evidence,
                }
                for se in detail.se_techniques
            ],
        },
        "verdict_summary": {
            "technical_explanation": analysis.explanation,
            "recommended_actions": analysis.recommendation,
        },
        "disclaimer": (
            "This report is generated by TrustLayer automated forensic analysis. "
            "Evidence hashes and timestamps are cryptographically recorded for auditability."
        ),
    }


def _detail(db: Session, analysis_id: int) -> AnalysisDetailOut:
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).one()
    return AnalysisDetailOut.model_validate(analysis)

