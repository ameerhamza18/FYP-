"""Deterministic rule engine.

Encodes expert security knowledge as explainable, weighted rules. This is a
deliberate defense-in-depth design decision: the deterministic layer catches
attacks even when the ML model has never seen the pattern (zero-day scam
templates) and produces human-readable reasons for every decision.
"""
import re
from typing import Dict, List

# Rule: (id, regex, category, threat_type, severity, weight, title)
RULES: List[Dict] = [
    {
        "id": "R001", "category": "Credential", "threat_type": "Phishing",
        "severity": "CRITICAL", "weight": 25, "title": "Credential request",
        "pattern": r"\b(enter|provide|share|confirm|update|verify)\s+(your\s+)?(password|pin|otp|cvv|card\s+(number|details)|account\s+(number|details)|login\s+(details|credentials))\b",
    },
    {
        "id": "R002", "category": "Urgency", "threat_type": "Phishing",
        "severity": "HIGH", "weight": 15, "title": "Urgency-based pressure",
        "pattern": r"\b(act\s+now|immediately|within\s+\d+\s*(minutes?|hours?|hrs?)|asap|right\s+away|expires?\s+today|last\s+chance)\b",
    },
    {
        "id": "R003", "category": "Financial", "threat_type": "Financial Fraud",
        "severity": "CRITICAL", "weight": 25, "title": "Financial impersonation",
        "pattern": r"\b(bank|atm|debit\s+card|credit\s+card|account)\b.{0,60}\b(blocked|suspended|frozen|limited|deactivated)\b",
    },
    {
        "id": "R004", "category": "Financial", "threat_type": "Financial Fraud",
        "severity": "HIGH", "weight": 18, "title": "Upfront payment request",
        "pattern": r"\b(pay|send|deposit|transfer)\b.{0,40}\b(registration\s+fee|processing\s+fee|advance|security\s+deposit|tax|charges?)\b",
    },
    {
        "id": "R005", "category": "Employment", "threat_type": "Job Scam",
        "severity": "HIGH", "weight": 20, "title": "Fake job offer pattern",
        "pattern": r"\b(congratulations.{0,60}(selected|hired|shortlisted)|remote\s+job|work\s+from\s+home.{0,40}(earn|salary)|daily\s+(payout|income|payment))\b",
    },
    {
        "id": "R006", "category": "Investment", "threat_type": "Investment Scam",
        "severity": "HIGH", "weight": 20, "title": "Unrealistic investment claim",
        "pattern": r"\b(guaranteed\s+(profit|return|income|roi)|double\s+your\s+money|\d+%\s+(daily|weekly|monthly)\s+(profit|return)|risk[\s\-]?free\s+(profit|income))\b",
    },
    {
        "id": "R007", "category": "Reward", "threat_type": "Prize Scam",
        "severity": "HIGH", "weight": 18, "title": "Prize / lottery claim",
        "pattern": r"\b(you\s+have\s+won|you'?ve\s+won|lucky\s+(draw|winner)|prize|lottery|giveaway|claim\s+your\s+(prize|reward|gift))\b",
    },
    {
        "id": "R008", "category": "Impersonation", "threat_type": "Impersonation",
        "severity": "HIGH", "weight": 18, "title": "Authority impersonation",
        "pattern": r"\b(i\s+am\s+calling\s+from|this\s+is\s+.{0,30}(bank|police|fbr|nadra|courier)|from\s+(hbl|ubl|meezan|jazzcash|easypaisa|telenor|jazz|zong|ufone))\b",
    },
    {
        "id": "R009", "category": "Verification", "threat_type": "Phishing",
        "severity": "HIGH", "weight": 16, "title": "Suspicious verification link",
        "pattern": r"\b(verify|confirm|reactivate|unlock|restore)\s+(your\s+)?(account|identity|card|number|details|now)\b.{0,60}(link|here|below|http)",
    },
    {
        "id": "R010", "category": "OTPFraud", "threat_type": "Financial Fraud",
        "severity": "CRITICAL", "weight": 28, "title": "OTP sharing solicitation",
        "pattern": r"\b(share|send|tell\s+me|provide)\s+(the\s+)?(otp|one\s+time\s+(password|code)|verification\s+code)\b",
    },
    {
        "id": "R011", "category": "SimSwap", "threat_type": "Financial Fraud",
        "severity": "HIGH", "weight": 15, "title": "SIM-swap style request",
        "pattern": r"\b(sim\s+(swap|replacement|update)|update\s+your\s+sim|re[- ]?register\s+your\s+sim)\b",
    },
    {
        "id": "R012", "category": "Reward", "threat_type": "Prize Scam",
        "severity": "MEDIUM", "weight": 10, "title": "Suspicious giveaway bait",
        "pattern": r"\b(free\s+(iphone|data|mbs|gb|bundle|gift)|scratch\s+card|spin\s+to\s+win)\b",
    },
    {
        "id": "R013", "category": "Impersonation", "threat_type": "Impersonation",
        "severity": "MEDIUM", "weight": 10, "title": "Generic mass-message greeting",
        "pattern": r"\bdear\s+(customer|valued\s+customer|user|account\s+holder)\b",
    },
    {
        "id": "R014", "category": "Financial", "threat_type": "Financial Fraud",
        "severity": "HIGH", "weight": 15, "title": "Direct money transfer demand",
        "pattern": r"\b(send|transfer|deposit)\s+(rs\.?\s?\d|pkr|money|funds)\b",
    },
    {
        "id": "R015", "category": "Financial", "threat_type": "Financial Fraud",
        "severity": "CRITICAL", "weight": 25, "title": "Roman Urdu account blocking threat",
        "pattern": r"\b(account|card|sim|wallet)\s+(block|band)\s+(ho\s+gaya|kar\s+diya|ho\s+jaega|ho\s+jayega)\b",
    },
    {
        "id": "R016", "category": "Reward", "threat_type": "Prize Scam",
        "severity": "HIGH", "weight": 20, "title": "Roman Urdu lottery/BISP scam bait",
        "pattern": r"\b(bisp|ehsaas|benazir|inam|lottery)\b.{0,40}\b(jeet|mil\s+gaya|mubarak|paise)\b",
    },
]

SEVERITY_WEIGHT_MULTIPLIER = {"LOW": 0.5, "MEDIUM": 0.75, "HIGH": 1.0, "CRITICAL": 1.2}


def run_rules(text: str) -> Dict:
    """Run deterministic rules over text.

    Returns rule hits, a 0-100 normalized rule score, threat-type votes and
    the highest severity seen.
    """
    lowered = (text or "").lower()
    hits: List[Dict] = []
    raw_score = 0.0
    threat_votes: Dict[str, int] = {}
    severities = []

    for rule in RULES:
        m = re.search(rule["pattern"], lowered)
        if m:
            hits.append({
                "rule_id": rule["id"],
                "title": rule["title"],
                "category": rule["category"],
                "threat_type": rule["threat_type"],
                "severity": rule["severity"],
                "detail": m.group(0)[:120],
            })
            raw_score += rule["weight"] * SEVERITY_WEIGHT_MULTIPLIER[rule["severity"]]
            threat_votes[rule["threat_type"]] = threat_votes.get(rule["threat_type"], 0) + 1
            severities.append(rule["severity"])

    # 2+ independent rules indicate strongly malicious content — reinforce.
    if len(hits) >= 2:
        raw_score *= 1.15
    if len(hits) >= 4:
        raw_score *= 1.1

    order = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    highest = max((order.index(s) for s in severities), default=-1)
    return {
        "hits": hits,
        "score": min(100.0, raw_score),
        "threat_votes": threat_votes,
        "highest_severity": order[highest] if highest >= 0 else None,
        "rules_evaluated": len(RULES),
    }

