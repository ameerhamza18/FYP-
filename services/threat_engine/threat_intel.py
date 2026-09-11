"""Local threat-intelligence feed.

v1 ships with an offline curated feed of known-bad indicators so the platform
works without any external dependency. The interface is deliberately designed
to be swappable with live feeds (Google Safe Browsing, PhishTank, MISP) later.

Indicators: (pattern, kind, description)
"""
from typing import Dict, List, Tuple

KNOWN_MALICIOUS_DOMAINS: Dict[str, str] = {
    "verify-account-alert.xyz": "Phishing kit — account-verification lure",
    "secure-login-update.top": "Phishing kit — fake login page",
    "bank-alerts-notice.cf": "Banking phishing template",
    "prize-claim-center.tk": "Prize/lottery scam infrastructure",
    "easy-job-offers.ml": "Fake job scam infrastructure",
    "crypto-doubler.ga": "Investment doubling scam",
    "paypa1-secure.com": "PayPal typosquat",
    "easypaisa-rewards.xyz": "Easypaisa reward scam",
    "jazzcash-win.top": "JazzCash prize scam",
}

KNOWN_MALICIOUS_KEYWORDS: List[Tuple[str, str]] = [
    ("verify your account immediately", "Account-verification phishing lure"),
    ("your account will be blocked", "Account-suspension social engineering"),
    ("click here to reactivate", "Credential-harvesting lure"),
    ("claim your prize", "Prize scam lure"),
    ("guaranteed profit", "Investment scam claim"),
    ("whatsapp group earning", "Task/earning scam lure"),
    ("registration fee", "Job scam fee request"),
]

SUSPICIOUS_SENDER_TLDS = {"tk", "ml", "ga", "cf", "gq", "xyz", "top"}


def check_text(text: str) -> Dict:
    """Check free text against the local intel feed.

    Returns score (0-100), matched indicators list.
    """
    lowered = (text or "").lower()
    matches: List[Dict] = []
    score = 0.0

    for domain, desc in KNOWN_MALICIOUS_DOMAINS.items():
        if domain in lowered:
            matches.append({"type": "domain", "value": domain, "description": desc})
            score += 30

    for phrase, desc in KNOWN_MALICIOUS_KEYWORDS:
        if phrase in lowered:
            matches.append({"type": "keyword", "value": phrase, "description": desc})
            score += 12

    return {"score": min(100.0, score), "matches": matches}


def check_domain(domain: str) -> Dict:
    """Check a specific domain against the feed."""
    domain = (domain or "").lower().strip(".")
    if domain in KNOWN_MALICIOUS_DOMAINS:
        return {
            "score": 85.0,
            "matches": [{
                "type": "domain", "value": domain,
                "description": KNOWN_MALICIOUS_DOMAINS[domain],
            }],
        }
    score = 15.0 if domain.rsplit(".", 1)[-1] in SUSPICIOUS_SENDER_TLDS else 0.0
    return {"score": score, "matches": []}
