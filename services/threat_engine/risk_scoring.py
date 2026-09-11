"""Risk-score fusion engine.

Combines independent evidence channels into a single, explainable risk score
(0-100):

    ML classifier probability   (learned signal)
    Deterministic rule score    (expert security knowledge)
    Threat-intelligence matches (known-bad IOCs)
    URL analyzer score          (multimodal URL evidence)
    Social-engineering findings (psychological manipulation)

Design decision (industry-grade): the LLM is NOT part of the scoring path —
it only explains the already-decided verdict. Scoring is deterministic and
auditable.
"""
from typing import Dict, List, Optional, Tuple

WEIGHTS = {
    "ml": 0.30,
    "rules": 0.35,
    "intel": 0.20,
    "url": 0.15,
}

RISK_LEVELS: List[Tuple[str, int]] = [
    ("CRITICAL", 85),
    ("HIGH", 60),
    ("MEDIUM", 30),
    ("LOW", 0),
]

LEVEL_ACTIONS = {
    "CRITICAL": (
        "Do not interact with this message. Do not click links, share OTP/PIN/"
        "passwords, or send money. Report it (e.g. PTA: report to 9000 / your "
        "bank's fraud line) and delete it."
    ),
    "HIGH": (
        "Do not click links or provide credentials. Verify the sender through "
        "official channels only, and report the message."
    ),
    "MEDIUM": (
        "Be cautious — do not click links. Verify the sender through an "
        "independent official channel before responding."
    ),
    "LOW": (
        "No strong scam indicators found. Stay alert and never share OTPs or "
        "passwords regardless of who asks."
    ),
}


def score_level(score: float) -> str:
    for level, threshold in RISK_LEVELS:
        if score >= threshold:
            return level
    return "LOW"


def _threat_type(rule_result: Dict, ml_label_prob: float) -> str:
    votes = rule_result.get("threat_votes", {})
    if votes:
        return max(votes, key=votes.get)
    if ml_label_prob is not None and ml_label_prob >= 0.6:
        return "Suspicious Message"
    return "Clean / No Strong Threat"


def fuse_scores(
    ml_prob: float,
    rule_score: float,
    intel_score: float,
    url_score: float,
    rule_result: Dict,
) -> Dict:
    """Fuse channel scores into the final risk verdict.

    Channels that produced no evidence are excluded and their weight is
    redistributed, so absence of ML output (cold start) doesn't drag scores.
    """
    components = {"ml": ml_prob, "rules": rule_score, "intel": intel_score}
    if url_score is not None:
        components["url"] = url_score

    active = {k: v for k, v in components.items() if v is not None}
    total_weight = sum(WEIGHTS[k] for k in active)
    final = sum(v * WEIGHTS[k] for k, v in active.items()) / (total_weight or 1.0)

    # Evidence escalation: any CRITICAL rule hit floors the score at 60.
    if rule_result.get("highest_severity") == "CRITICAL":
        final = max(final, 60.0)
    # Known-bad domain from intel floors the score at 55.
    if intel_score >= 85:
        final = max(final, 55.0)

    final = round(min(100.0, max(0.0, final)), 1)
    level = score_level(final)
    threat_type = _threat_type(rule_result, ml_prob)

    return {
        "risk_score": int(round(final)),
        "risk_level": level,
        "threat_type": threat_type,
        "recommendation": LEVEL_ACTIONS[level],
        "breakdown": {k: (round(v, 3) if v is not None else None) for k, v in components.items()},
        "weights_used": {k: WEIGHTS[k] for k in active},
    }
