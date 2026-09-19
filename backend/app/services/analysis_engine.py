"""Trust Engine orchestrator.

Runs the full multimodal analysis pipeline for one piece of content:

    text/url/screenshot → preprocess → NLP (SE techniques + ML)
        → URL analyzer (for every URL found) → deterministic rules
        → threat intelligence → score fusion → LLM/template explanation
        → persistence + campaign detection + audit

This module is transport-agnostic; the FastAPI routers are thin wrappers.
"""
import hashlib
import logging
import re
import time
from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models import Analysis, Campaign, Indicator, SEFinding
from app.security.llm_guard import detect_prompt_injection
from services.llm.explainer import generate_explanation
from services.nlp import preprocessing, se_techniques
from services.nlp.classifier import get_classifier
from services.threat_engine import campaign_detector, rule_engine, risk_scoring, threat_intel
from services.url_intelligence.analyzer import analyze_url

logger = logging.getLogger("trustlayer.engine")


def content_hash(text: str) -> str:
    """Stable hash of normalized content (dedup + campaign correlation)."""
    normalized = re.sub(r"\s+", " ", (text or "").lower()).strip()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def _run_url_channel(text: str) -> Tuple[Optional[float], List[Dict], List[str]]:
    """Analyze every URL embedded in the text; aggregate the worst findings."""
    urls = preprocessing.extract_urls(text)
    if not urls:
        return None, [], []
    best_score: Optional[float] = None
    indicators: List[Dict] = []
    domains: List[str] = []
    for url in urls[:5]:
        result = analyze_url(url)
        score = result["score"]
        if best_score is None or score > best_score:
            best_score = score
        host = result.get("features", {}).get("host", "")
        if host:
            domains.append(host)
        for ind in result["indicators"]:
            indicators.append({
                "category": "URL",
                "severity": ind["severity"],
                "title": f"{ind['title']} ({host})" if host else ind["title"],
                "detail": ind.get("detail"),
            })
        # Intel cross-check of the host itself.
        intel = threat_intel.check_domain(host)
        if intel["matches"]:
            for m in intel["matches"]:
                indicators.append({
                    "category": "Threat Intel", "severity": "HIGH",
                    "title": f"Known-malicious domain: {m['value']}",
                    "detail": m["description"],
                })
    return best_score, indicators, domains


def _collect_indicators(rule_result: Dict, intel_result: Dict, url_indicators: List[Dict],
                        ml_prob: Optional[float], injection: Dict) -> List[Dict]:
    """Merge all evidence channels into one indicator list."""
    indicators: List[Dict] = []
    for hit in rule_result["hits"]:
        indicators.append({
            "category": hit["category"], "severity": hit["severity"],
            "title": hit["title"], "detail": hit["detail"],
        })
    for m in intel_result["matches"]:
        indicators.append({
            "category": "Threat Intel", "severity": "HIGH",
            "title": f"Threat-intel match: {m['value']}", "detail": m["description"],
        })
    indicators += url_indicators
    if injection["injection_detected"]:
        indicators.append({
            "category": "Security", "severity": "MEDIUM",
            "title": "Prompt-injection attempt detected",
            "detail": "The message contains instructions targeting AI systems; ignored by the engine.",
        })
    if ml_prob is not None and ml_prob >= 0.6:
        indicators.append({
            "category": "ML", "severity": "HIGH" if ml_prob >= 0.8 else "MEDIUM",
            "title": "ML scam classifier flagged content",
            "detail": f"P(scam) = {ml_prob:.2f}",
        })
    elif ml_prob is not None and ml_prob <= 0.15 and not indicators:
        indicators.append({
            "category": "ML", "severity": "INFO",
            "title": "ML classifier found no scam signals",
            "detail": f"P(scam) = {ml_prob:.2f}",
        })
    return indicators


def _persist_campaign(db: Session, analysis: Analysis, campaign_signature: Optional[str],
                      verdict: Dict) -> None:
    """Correlate this analysis against known campaign signatures."""
    if not campaign_signature:
        return
    campaign = db.query(Campaign).filter(Campaign.signature == campaign_signature).first()
    if campaign is None:
        db.add(Campaign(
            signature=campaign_signature, hits=1, distinct_users=1,
            sample_snippet=analysis.content_snippet[:300],
            severity=verdict["risk_level"],
        ))
        return
    campaign.hits += 1
    if verdict["risk_score"] > {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}.get(campaign.severity, 0):
        campaign.severity = verdict["risk_level"]
    # distinct_users is incremented by the router when the report comes from a
    # different user than the previous reports of this campaign (tracked via a
    # lightweight SQL count on the analyses table for correctness).
    from app.models import Analysis as _A
    campaign.distinct_users = (
        db.query(_A.user_id).filter(_A.campaign_signature == campaign_signature).distinct().count()
    )
    if campaign_detector.should_flag_campaign(campaign.hits, campaign.distinct_users):
        analysis.campaign_flagged = True
        # Fire real-time webhook alert (Slack / Discord / SOC SIEM).
        try:
            from app.config import get_settings
            webhook_url = get_settings().campaign_webhook_url or None
            campaign_detector.trigger_campaign_webhook(
                webhook_url=webhook_url,
                campaign_signature=campaign_signature,
                hits=campaign.hits,
                users=campaign.distinct_users,
                snippet=campaign.sample_snippet,
            )
        except Exception as _wh_exc:
            logger.debug("Webhook skipped: %s", _wh_exc)


def analyze_content(user_id: int, input_type: str, text: str, source: str,
                    db: Session, client_ip: Optional[str] = None) -> Analysis:
    """Execute the full Trust Engine pipeline and persist the result."""
    started = time.perf_counter()

    # ---------- 1. Preprocessing ----------
    entities = preprocessing.extract_entities(text)
    snippet = text[:500]

    # ---------- 2. Social-engineering technique detection ----------
    se_findings = se_techniques.detect_techniques(text)
    se_score = se_techniques.se_risk_score(se_findings)

    # ---------- 3. ML channel ----------
    ml_prob = get_classifier().predict_proba(text)

    # ---------- 4. URL channel ----------
    url_score, url_indicators, url_domains = _run_url_channel(text)

    # ---------- 5. Deterministic rule engine ----------
    rule_result = rule_engine.run_rules(text)

    # ---------- 6. Threat intelligence ----------
    intel_result = threat_intel.check_text(text)

    # ---------- 7. Prompt-injection security scan ----------
    injection = detect_prompt_injection(text)

    # SE findings reinforce rule evidence (cross-channel fusion).
    fused_rule_score = min(100.0, rule_result["score"] + se_score * 0.4)

    # ---------- 8. Deterministic score fusion ----------
    verdict = risk_scoring.fuse_scores(
        ml_prob=ml_prob,
        rule_score=fused_rule_score,
        intel_score=intel_result["score"],
        url_score=url_score,
        rule_result=rule_result,
    )

    indicators = _collect_indicators(rule_result, intel_result, url_indicators, ml_prob, injection)

    # ---------- 9. Explainable AI ----------
    explanation, explanation_source = generate_explanation(verdict, indicators, se_findings, snippet)

    # ---------- 10. Persist ----------
    latency_ms = (time.perf_counter() - started) * 1000.0
    analysis = Analysis(
        user_id=user_id,
        input_type=input_type,
        content_hash=content_hash(text),
        content_snippet=snippet,
        risk_score=verdict["risk_score"],
        risk_level=verdict["risk_level"],
        threat_type=verdict["threat_type"],
        ml_score=ml_prob,
        rule_score=round(fused_rule_score, 2),
        intel_score=round(intel_result["score"], 2),
        url_score=url_score,
        recommendation=verdict["recommendation"],
        explanation=explanation,
        explanation_source=explanation_source,
        engine_breakdown={
            "verdict": verdict["breakdown"],
            "weights": verdict["weights_used"],
            "se_score": round(se_score, 2),
            "rules": {"hits": rule_result["hits"], "evaluated": rule_result["rules_evaluated"]},
            "intel_matches": intel_result["matches"],
            "entities": entities,
            "prompt_injection": injection,
            "source": source,
        },
        latency_ms=round(latency_ms, 2),
    )
    db.add(analysis)
    db.flush()

    for ind in indicators:
        db.add(Indicator(analysis_id=analysis.id, **ind))
    for finding in se_findings:
        db.add(SEFinding(analysis_id=analysis.id, technique=finding["technique"],
                         intensity=finding["intensity"], evidence=finding.get("evidence")))

    # ---------- 11. Campaign correlation ----------
    campaign_signature = campaign_detector.build_signature(text, entities)
    if campaign_signature:
        analysis.campaign_signature = campaign_signature
        db.flush()  # make the row visible to the distinct-user count query
        _persist_campaign(db, analysis, campaign_signature, verdict)

    db.commit()
    logger.info("Analysis %d (%s) → %s %d/100 in %.1fms",
                analysis.id, input_type, analysis.risk_level, analysis.risk_score, latency_ms)
    return analysis


