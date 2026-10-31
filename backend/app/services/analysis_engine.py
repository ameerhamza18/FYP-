"""Trust Engine orchestrator (Multimodal Parallel Pipeline & Zero-Storage Persistence).

Runs the full multimodal analysis pipeline for one piece of content:
    text/url/screenshot -> 4-step preprocess -> parallel 4-engine scoring
    (ML + Static URL + 16-Rule/8-SE + Threat/Sender Intel) -> score fusion
    & deterministic escalation floors -> forensic-JSON LLM/template explanation
    -> zero-storage redacted persistence + campaign correlation.
"""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import logging
import time
from typing import Dict, List, Optional, Tuple

from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Analysis, Campaign, Indicator, SEFinding
from app.security.llm_guard import detect_prompt_injection
from services.llm.explainer import generate_explanation
from services.nlp import preprocessing, se_techniques
from services.nlp.classifier import get_classifier
from services.threat_engine import (
    campaign_detector,
    risk_scoring,
    rule_engine,
    sender_intel,
    threat_intel,
)
from services.url_intelligence.analyzer import analyze_url

logger = logging.getLogger("trustlayer.engine")

# Shared worker pool for parallel 4-engine scoring (Section 2.6.1 / NFR-01)
_ENGINE_POOL = ThreadPoolExecutor(max_workers=4, thread_name_prefix="trust-engine")


def content_hash(text: str) -> str:
    """Stable SHA-256 hash of normalized content (dedup + zero-storage audit)."""
    normalized = preprocessing.normalize(text or "")
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def _run_url_channel(text: str) -> Tuple[Optional[float], float, List[Dict], List[str]]:
    """Analyze every URL embedded in the text; return (url_score, url_intel_score, indicators, domains)."""
    urls = preprocessing.extract_urls(text)
    if not urls:
        return None, 0.0, [], []
    best_score: Optional[float] = None
    best_intel_score = 0.0
    indicators: List[Dict] = []
    domains: List[str] = []
    seen_domain_matches = set()

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
                "detail": preprocessing.redact_sensitive_text(str(ind.get("detail") or ""), 160) or None,
            })
        if host:
            intel = threat_intel.check_domain(host)
            best_intel_score = max(best_intel_score, float(intel["score"]))
            for m in intel["matches"]:
                if m["value"] not in seen_domain_matches:
                    seen_domain_matches.add(m["value"])
                    indicators.append({
                        "category": "Threat Intel",
                        "severity": "HIGH",
                        "title": f"Known-malicious domain: {m['value']}",
                        "detail": m["description"],
                    })
    return best_score, best_intel_score, indicators, domains


def _collect_indicators(
    rule_result: Dict,
    intel_result: Dict,
    url_indicators: List[Dict],
    ml_prob: Optional[float],
    injection: Dict,
    sender_result: Optional[Dict] = None,
) -> List[Dict]:
    """Merge all evidence channels into one redacted indicator list."""
    indicators: List[Dict] = []
    url_intel_titles = {
        ind["title"].split(": ", 1)[-1]
        for ind in url_indicators
        if ind.get("category") == "Threat Intel" and ": " in ind.get("title", "")
    }

    for hit in rule_result["hits"]:
        indicators.append({
            "category": hit["category"],
            "severity": hit["severity"],
            "title": hit["title"],
            "detail": preprocessing.redact_sensitive_text(str(hit.get("detail") or ""), 120) or None,
        })
    for m in intel_result["matches"]:
        if m["type"] == "domain" and m["value"] in url_intel_titles:
            continue
        indicators.append({
            "category": "Threat Intel",
            "severity": "HIGH",
            "title": f"Threat-intel match: {m['value']}",
            "detail": m["description"],
        })
    if sender_result:
        indicators += sender_result["indicators"]
    indicators += url_indicators
    if injection["injection_detected"]:
        indicators.append({
            "category": "Security",
            "severity": "MEDIUM",
            "title": "Prompt-injection attempt detected",
            "detail": "The message contains instructions targeting AI systems; ignored by the engine.",
        })
    if ml_prob is not None and ml_prob >= 0.6:
        indicators.append({
            "category": "ML",
            "severity": "HIGH" if ml_prob >= 0.8 else "MEDIUM",
            "title": "ML scam classifier flagged content",
            "detail": f"P(scam) = {ml_prob:.2f}",
        })
    elif ml_prob is not None and ml_prob <= 0.15 and not indicators:
        indicators.append({
            "category": "ML",
            "severity": "INFO",
            "title": "ML classifier found no scam signals",
            "detail": f"P(scam) = {ml_prob:.2f}",
        })
    return indicators


def _persist_campaign(
    db: Session,
    analysis: Analysis,
    campaign_signature: Optional[str],
    verdict: Dict,
    stored_descriptor: str,
    background_tasks: Optional[BackgroundTasks] = None,
) -> None:
    """Correlate this analysis against known IOC or normalized-template campaign signatures."""
    if not campaign_signature:
        return
    campaign = db.query(Campaign).filter(Campaign.signature == campaign_signature).first()
    if campaign is None:
        db.add(Campaign(
            signature=campaign_signature,
            hits=1,
            distinct_users=1,
            sample_snippet=stored_descriptor[:300],
            severity=verdict["risk_level"],
        ))
        return
    campaign.hits += 1
    severity_ranks = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}
    if severity_ranks.get(verdict["risk_level"], 0) > severity_ranks.get(campaign.severity, 0):
        campaign.severity = verdict["risk_level"]

    from app.models import Analysis as _A
    campaign.distinct_users = (
        db.query(_A.user_id).filter(_A.campaign_signature == campaign_signature).distinct().count()
    )
    if campaign_detector.should_flag_campaign(campaign.hits, campaign.distinct_users):
        analysis.campaign_flagged = True
        try:
            cfg = get_settings()
            webhook_url = cfg.campaign_webhook_url or None
            if webhook_url:
                snippet_arg = campaign.sample_snippet if cfg.campaign_webhook_include_snippet else None
                if background_tasks is not None:
                    background_tasks.add_task(
                        campaign_detector.trigger_campaign_webhook,
                        webhook_url=webhook_url,
                        campaign_signature=campaign_signature,
                        hits=campaign.hits,
                        users=campaign.distinct_users,
                        snippet=snippet_arg,
                    )
                else:
                    import threading
                    threading.Thread(
                        target=campaign_detector.trigger_campaign_webhook,
                        kwargs={
                            "webhook_url": webhook_url,
                            "campaign_signature": campaign_signature,
                            "hits": campaign.hits,
                            "users": campaign.distinct_users,
                            "snippet": snippet_arg,
                        },
                        daemon=True,
                    ).start()
        except Exception as _wh_exc:
            logger.debug("Webhook dispatch skipped: %s", _wh_exc)


def analyze_content(
    user_id: int,
    input_type: str,
    text: str,
    source: str,
    db: Session,
    client_ip: Optional[str] = None,
    sender: Optional[str] = None,
    background_tasks: Optional[BackgroundTasks] = None,
    client_request_id: Optional[str] = None,
) -> Analysis:
    """Execute the full Trust Engine pipeline and persist zero-storage redacted telemetry."""
    clean_req_id = (client_request_id or "").strip()[:64] or None
    if clean_req_id:
        existing = (
            db.query(Analysis)
            .filter(Analysis.user_id == user_id, Analysis.client_request_id == clean_req_id)
            .first()
        )
        if existing is not None:
            logger.info(
                "Idempotent analysis hit for user=%d client_request_id=%s -> analysis=%d",
                user_id, clean_req_id, existing.id,
            )
            return existing

    started = time.perf_counter()
    cfg = get_settings()

    # ---------- 1. 4-Step Preprocessing & Entity Extraction ----------
    prep = preprocessing.preprocess_pipeline(text)
    entities = preprocessing.extract_entities(text)
    msg_hash = content_hash(text)

    # ---------- 2-6. Parallel 4-Engine Scoring (Section 2.6.1) ----------
    fut_ml = _ENGINE_POOL.submit(get_classifier().predict_proba, text)
    fut_url = _ENGINE_POOL.submit(_run_url_channel, text)
    fut_rules_se = _ENGINE_POOL.submit(
        lambda t: (rule_engine.run_rules(t), se_techniques.evaluate_taxonomy(t)),
        text,
    )
    fut_intel = _ENGINE_POOL.submit(
        lambda t, s: (threat_intel.check_text(t), sender_intel.check_sender(s)),
        text,
        sender,
    )

    ml_prob = fut_ml.result()
    url_score, url_intel_score, url_indicators, _url_domains = fut_url.result()
    rule_result, se_taxonomy = fut_rules_se.result()
    intel_result, sender_result = fut_intel.result()

    se_findings = [f for f in se_taxonomy if f["score"] > 0]
    se_score = se_techniques.se_risk_score(se_findings)

    # Include URL host threat-intel score so FR-07 domain floor (>=55) triggers reliably
    intel_score = max(intel_result["score"], sender_result["score"], url_intel_score)

    # ---------- 7. Prompt-injection security scan ----------
    injection = detect_prompt_injection(text)

    # SE findings reinforce rule evidence
    fused_rule_score = min(100.0, rule_result["score"] + se_score * 0.4)

    # ---------- 8. Deterministic score fusion & Escalation Floors (FR-06, FR-07) ----------
    verdict = risk_scoring.fuse_scores(
        ml_prob=ml_prob,
        rule_score=fused_rule_score,
        intel_score=intel_score,
        url_score=url_score,
        rule_result=rule_result,
    )

    indicators = _collect_indicators(
        rule_result, intel_result, url_indicators, ml_prob, injection, sender_result
    )

    # ---------- 9. Decoupled Explainable AI from Forensic JSON (FR-08) ----------
    explanation, explanation_source = generate_explanation(verdict, indicators, se_findings)

    # ---------- 10. Zero-Storage Redacted Persistence (NFR-02) ----------
    if cfg.zero_storage_mode:
        stored_snippet = (
            f"[REDACTED sha256:{msg_hash[:16]} "
            f"words:{preprocessing.word_count(text)} "
            f"urls:{len(entities['urls'])} phones:{len(entities['phones'])}]"
        )
    else:
        stored_snippet = preprocessing.redact_sensitive_text(text, max_len=300)

    redacted_rule_hits = [
        {
            "rule_id": h["rule_id"],
            "title": h["title"],
            "category": h["category"],
            "threat_type": h["threat_type"],
            "severity": h["severity"],
            "detail": preprocessing.redact_sensitive_text(str(h.get("detail") or ""), 120),
        }
        for h in rule_result["hits"]
    ]
    redacted_se_taxonomy = [
        {
            "technique": item["technique"],
            "intensity": item["intensity"],
            "score": item["score"],
        }
        for item in se_taxonomy
    ]

    latency_ms = (time.perf_counter() - started) * 1000.0
    analysis = Analysis(
        user_id=user_id,
        input_type=input_type,
        content_hash=msg_hash,
        content_snippet=stored_snippet,
        client_request_id=clean_req_id,
        risk_score=verdict["risk_score"],
        risk_level=verdict["risk_level"],
        threat_type=verdict["threat_type"],
        ml_score=ml_prob,
        rule_score=round(fused_rule_score, 2),
        intel_score=round(intel_score, 2),
        url_score=url_score,
        recommendation=verdict["recommendation"],
        explanation=explanation,
        explanation_source=explanation_source,
        engine_breakdown={
            "verdict": verdict["breakdown"],
            "weights": verdict["weights_used"],
            "se_score": round(se_score, 2),
            "se_taxonomy": redacted_se_taxonomy,
            "rules": {"hits": redacted_rule_hits, "evaluated": rule_result["rules_evaluated"]},
            "intel_matches": intel_result["matches"],
            "sender_intel": {
                "sender_masked": sender_result["sender_masked"],
                "score": sender_result["score"],
                "level": sender_result["level"],
                "matches": sender_result["matches"],
            },
            "entities": preprocessing.redact_entities_for_storage(entities),
            "preprocessing": {
                "nfkc_homoglyph_folded": True,
                "tokens_sanitized": True,
                "urgency_punct_count": prep["urgency_punct_count"],
            },
            "zero_storage": cfg.zero_storage_mode,
            "prompt_injection": {
                "injection_detected": injection["injection_detected"],
                "signatures": [
                    preprocessing.redact_sensitive_text(s, 80) for s in injection["signatures"]
                ],
            },
            "source": source,
        },
        latency_ms=round(latency_ms, 2),
    )
    db.add(analysis)
    db.flush()

    for ind in indicators:
        db.add(Indicator(analysis_id=analysis.id, **ind))
    for finding in se_findings:
        safe_ev = (
            preprocessing.redact_sensitive_text(str(finding["evidence"]), 120)
            if finding.get("evidence")
            else None
        )
        db.add(
            SEFinding(
                analysis_id=analysis.id,
                technique=finding["technique"],
                intensity=finding["intensity"],
                evidence=safe_ev,
            )
        )

    # ---------- 11. Cross-User Campaign Correlation (FR-09) ----------
    campaign_signature = campaign_detector.build_signature(text, entities)
    if campaign_signature:
        analysis.campaign_signature = campaign_signature
        db.flush()
        _persist_campaign(
            db,
            analysis,
            campaign_signature,
            verdict,
            stored_snippet,
            background_tasks=background_tasks,
        )

    db.commit()
    logger.info(
        "Analysis %d (%s) -> %s %d/100 in %.1fms",
        analysis.id, input_type, analysis.risk_level, analysis.risk_score, latency_ms,
    )
    return analysis
