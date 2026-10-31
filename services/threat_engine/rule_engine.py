"""Deterministic 16-rule engine (FR-04).

Encodes expert security knowledge as 16 pre-compiled, explainable, weighted
regex rules covering English and Roman Urdu fraud patterns (including HBL, UBL,
Meezan, JazzCash, EasyPaisa, Raast, BISP, Ehsaas, NADRA, FBR, and PTA lures).
"""
import re
from typing import Dict, List

from services.nlp.preprocessing import fold_homoglyphs

# Rule: (id, regex, category, threat_type, severity, weight, title)
RULES: List[Dict] = [
    {
        "id": "R001", "category": "Credential", "threat_type": "Phishing",
        "severity": "CRITICAL", "weight": 25, "title": "Credential request",
        "pattern": r"\b(enter|provide|share|confirm|update|verify)\s+(your\s+)?(password|pin|otp|cvv|raast\s+pin|card\s+(number|details)|account\s+(number|details)|login\s+(details|credentials))\b",
    },
    {
        "id": "R002", "category": "Urgency", "threat_type": "Phishing",
        "severity": "HIGH", "weight": 15, "title": "Urgency-based pressure",
        "pattern": r"\b(act\s+now|immediately|within\s+\d+\s*(minutes?|hours?|hrs?)|asap|right\s+away|expires?\s+today|last\s+chance|fori\s+tor\s+par|foran)\b",
    },
    {
        "id": "R003", "category": "Financial", "threat_type": "Financial Fraud",
        "severity": "CRITICAL", "weight": 25, "title": "Financial impersonation",
        "pattern": r"\b(bank|atm|debit\s+card|credit\s+card|account|raast\s+id|wallet)\b.{0,60}\b(blocked|suspended|frozen|limited|deactivated)\b",
    },
    {
        "id": "R004", "category": "Financial", "threat_type": "Financial Fraud",
        "severity": "HIGH", "weight": 18, "title": "Upfront payment request",
        "pattern": r"\b(pay|send|deposit|transfer)\b.{0,40}\b(registration\s+fee|processing\s+fee|advance|security\s+deposit|tax|customs\s+duty|charges?)\b",
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
        "pattern": r"\b(i\s+am\s+calling\s+from|this\s+is\s+.{0,30}(bank|sbp|raast|police|fbr|nadra|pta|courier)|from\s+(hbl|ubl|meezan|jazzcash|easypaisa|raast|sadapay|nayapay|telenor|jazz|zong|ufone))\b",
    },
    {
        "id": "R009", "category": "Verification", "threat_type": "Phishing",
        "severity": "HIGH", "weight": 16, "title": "Suspicious verification link",
        "pattern": r"\b(verify|confirm|reactivate|unlock|restore)\s+(your\s+)?(account|raast\s+id|identity|card|number|details|now)\b.{0,60}(link|here|below|http)",
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
        "pattern": r"\b(dear\s+(customer|valued\s+customer|user|account\s+holder)|mohtaram\s+sarif)\b",
    },
    {
        "id": "R014", "category": "Financial", "threat_type": "Financial Fraud",
        "severity": "HIGH", "weight": 15, "title": "Direct money transfer demand",
        "pattern": r"\b(send|transfer|deposit|bhej\s+dein|bhejen)\s+(rs\.?\s?\d|pkr|money|funds|via\s+raast|on\s+raast)\b",
    },
    {
        "id": "R015", "category": "Financial", "threat_type": "Financial Fraud",
        "severity": "CRITICAL", "weight": 25, "title": "Roman Urdu account blocking threat",
        "pattern": r"\b(account|card|sim|wallet|raast)\s+(block|band)\s+(ho\s+gaya|ho\s+chuka|kar\s+diya|ho\s+jaega|ho\s+jayega)\b",
    },
    {
        "id": "R016", "category": "Reward", "threat_type": "Prize Scam",
        "severity": "HIGH", "weight": 20, "title": "Roman Urdu lottery/BISP/Raast scam bait",
        "pattern": r"\b(bisp|ehsaas|benazir|raast|inam|inaam|lottery)\b.{0,45}\b(jeet|mil\s+gaya|manzoor|wazifa|imdad|mubarak|paise)\b",
    },
]

# Pre-compile all 16 regexes once at module import time (FR-04)
for _rule in RULES:
    _rule["compiled"] = re.compile(_rule["pattern"], re.I)

SEVERITY_WEIGHT_MULTIPLIER = {"LOW": 0.5, "MEDIUM": 0.75, "HIGH": 1.0, "CRITICAL": 1.2}


def run_rules(text: str) -> Dict:
    """Run the 16 pre-compiled deterministic rules over text.

    Returns rule hits, a 0-100 normalized rule score, threat-type votes and
    the highest severity seen.
    """
    lowered = fold_homoglyphs(text or "").lower()
    hits: List[Dict] = []
    raw_score = 0.0
    threat_votes: Dict[str, int] = {}
    severities = []

    for rule in RULES:
        m = rule["compiled"].search(lowered)
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
