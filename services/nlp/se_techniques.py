"""Social-engineering technique classifier.

Detects the psychological manipulation techniques used by scammers:
Authority, Urgency, Fear, Reward, Scarcity, Trust (impersonation),
Financial Pressure, and Credential Harvesting.

Each technique has graded lexicons; intensity is derived from the number and
strength of matched evidence. This is deterministic (explainable) and runs
before — and independently of — the ML model.
"""
import re
from typing import Dict, List, Tuple

TECHNIQUES: Dict[str, List[Tuple[str, int]]] = {
    # pattern, weight
    "authority": [
        (r"\b(i[' ]?m|i am|this is) (from|calling from|the head of)\s+(your\s+)?(bank|fbr|police|nadra|customs|courier|company)\b", 3),
        (r"\b(bank|fbr|police|nadra|hbl|ubl|meezan|jazzcash|easypaisa|easy paisa|telenor|jazz|zong|ufone|ptcl|ssgc|wapda|leo|fia)\s+(official|officer|team|department|head)\b", 2),
        (r"\b(main|hum)\s+(bank|fbr|police|nadra|easypaisa|jazzcash|head\s+office)\s+(se|sy)\s+(bol\s+raha|rabta)\b", 3),
        (r"\bcustomer\s+(service|care|support)\s+(representative|agent)\b", 1),
        (r"\b(ceo|director|manager|chairman|principal|professor)\s+(of|at)\b", 1),
        (r"\bgovernment|court|federal|central\s+(bank|authority)\b", 2),
    ],
    "urgency": [
        (r"\b(within|in)\s+\d+\s*(minutes?|mins?|hours?|hrs?|days?)\b", 3),
        (r"\b(act|respond|verify|confirm|call|click|pay|renew|register)\s+(now|immediately|right away|today)\b", 3),
        (r"\b(fori|abhi|fauran|jald\s+se\s+jald)\s+(verify|confirm|rabta|call|bhejen|karain|karein)\b", 3),
        (r"\b(urgent|urgently|asap|last\s+chance|final\s+(notice|warning|reminder)|expires?\s+(today|tomorrow|soon)|time\s+sensitive)\b", 2),
        (r"\b\d+\s*(hours?|hrs?|ghantay)\s*(left|remaining|me|main|andar)\b", 2),
    ],
    "fear": [
        (r"\b(account|card|sim|wallet|id)\s+(will\s+be|has\s+been|is)\s+(blocked|blocked!|suspended|suspended!|closed|deactivated|frozen|terminated)\b", 3),
        (r"\b(account|card|sim|wallet)\s+(block|band|suspend)\s+(ho\s+gaya|kar\s+diya|ho\s+jayega|ho\s+jaega)\b", 3),
        (r"\b(legal\s+)?action\s+(will\s+be\s+)?taken\s+against\s+you\b", 3),
        (r"\b(qanooni\s+karwai|police\s+case|fir|warrant)\b", 3),
        (r"\b(arrest|arrested|warrant|fir|case\s+(registered|filed)|jail|police\s+station)\b", 2),
        (r"\b(fine|penalty|charges?\s+of)\b.{0,30}\b(rs|pkr|\d)", 1),
    ],
    "reward": [
        (r"\b(you('?ve| have)?\s+(won|been\s+selected\s+(for|to\s+receive)))\b", 3),
        (r"\b(inam|lottery|prize|cashback)\s+(jeet\s+liya|mubarak|mil\s+gaya)\b", 3),
        (r"\b(bisp|ehsaas|benazir|jeeto\s+pakistan)\s+(scheme|program|inam|money)\b", 3),
        (r"\b(prize|lottery|giveaway|lucky\s+(draw|winner)|reward|cashback\s+offer)\b", 2),
        (r"\b(free|claim\s+your|gift)\b.{0,25}\b(iphone|prize|voucher|coupon|data|mbs|bundle)\b", 2),
        (r"\bcongratulations\b", 1),
    ],
    "scarcity": [
        (r"\bonly\s+\d+\s*(spots?|slots?|positions?|seats?|accounts?)\s+(left|remaining|available)\b", 3),
        (r"\b(limited\s+(time|offer|slots?|stock)|while\s+supplies\s+last|hurry)\b", 2),
        (r"\b(first\s+\d+\s+(people|users|customers|responders))\b", 2),
    ],
    "trust_impersonation": [
        (r"\b(official|authorized|verified|genuine|authentic)\s+(app|website|link|portal|account)\b", 2),
        (r"\bfrom\s+the\s+desk\s+of\b", 2),
        (r"\b(dear\s+(customer|valued\s+customer|user|account\s+holder))\b", 2),
        (r"\bsincerely\b.{0,40}\b(bank|team|support|management)\b", 1),
    ],
    "financial_pressure": [
        (r"\b(pay|send|transfer|deposit|submit)\s+(the\s+)?(fee|amount|money|rs\.?\s?\d|pkr|cash|advance|registration\s+fee|processing\s+fee|tax|security\s+deposit)\b", 3),
        (r"\b(pese|paise|fees?|amount|tax|advance)\s+(send|bhejen|transfer|jama)\s+(karein|karain|karo)\b", 3),
        (r"\b(jazzcash|easypaisa|easy\s+paisa|bank\s+transfer|wallet|tcs|premium\s+number)\b.{0,30}\b\d{4,}\b", 2),
        (r"\b(invest)\s+(rs|pkr|\$)?\s?\d[\d,\.]*\b", 2),
        (r"\b(send|transfer)\s+money\s+(to|at)\b", 2),
    ],
    "credential_harvesting": [
        (r"\b(enter|provide|share|confirm|update|verify)\s+(your\s+)?(password|pin|otp|cvv|cvc|card\s+number|account\s+(number|details)|login\s+(details|credentials)|credentials)\b", 3),
        (r"\b(otp|pin|password|code)\s+(share|send|bataen|batao|batai|bhejen)\s+(karein|karain|karo)?\b", 3),
        (r"\b(otp|one[\s\-]?time\s+(password|code)|pin)\b.{0,30}\b(share|send|tell|provide)\b", 3),
        (r"\b(cvv|cvc|atm\s+pin|card\s+pin|internet\s+banking\s+password)\b", 2),
        (r"\blogin\s+(via|through)\s+the\s+(link|portal)\b", 1),
    ],
}

INTENSITY_THRESHOLDS = [(0, "LOW"), (3, "MEDIUM"), (6, "HIGH")]


def _intensity(score: int) -> str:
    if score >= 6:
        return "HIGH"
    if score >= 3:
        return "MEDIUM"
    return "LOW"


def detect_techniques(text: str) -> List[Dict]:
    """Return detected SE techniques with intensity + evidence snippets."""
    findings: List[Dict] = []
    if not text:
        return findings
    lowered = text.lower()
    for technique, patterns in TECHNIQUES.items():
        score = 0
        evidence: List[str] = []
        for pattern, weight in patterns:
            m = re.search(pattern, lowered)
            if m:
                score += weight
                snippet = m.group(0)
                if snippet not in evidence:
                    evidence.append(snippet)
        if score > 0:
            findings.append(
                {
                    "technique": technique.replace("_", " ").title(),
                    "intensity": _intensity(score),
                    "score": score,
                    "evidence": "; ".join(evidence[:3]),
                }
            )
    # Sort strongest manipulation first.
    findings.sort(key=lambda f: f["score"], reverse=True)
    return findings


def se_risk_score(findings: List[Dict]) -> float:
    """0-100 risk contribution of the social-engineering findings."""
    if not findings:
        return 0.0
    intensity_weight = {"LOW": 6, "MEDIUM": 14, "HIGH": 25}
    return min(100.0, sum(intensity_weight[f["intensity"]] for f in findings))
