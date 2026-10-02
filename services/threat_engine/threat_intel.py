"""Local threat-intelligence feed.

v1 ships with an offline curated feed of known-bad indicators so the platform
works without any external dependency. The interface is deliberately designed
to be swappable with live feeds (Google Safe Browsing, PhishTank, MISP) later.

Indicators: (pattern, kind, description)
"""
import logging
import threading
from typing import Dict, List, Tuple

logger = logging.getLogger("trustlayer.threat_intel")
_intel_lock = threading.Lock()

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
    ("account block ho gaya", "Roman Urdu account-suspension threat"),
    ("inam jeet liya", "Roman Urdu prize scam lure"),
    ("bisp scheme inam", "Roman Urdu BISP/government grant lure"),
]

SUSPICIOUS_SENDER_TLDS = {"tk", "ml", "ga", "cf", "gq", "xyz", "top"}


def add_malicious_domain(domain: str, description: str) -> None:
    """Dynamically register a newly discovered phishing/scam domain."""
    cleaned = (domain or "").lower().strip().strip(".")
    if cleaned:
        with _intel_lock:
            KNOWN_MALICIOUS_DOMAINS[cleaned] = description


def add_malicious_keyword(phrase: str, description: str) -> None:
    """Dynamically register a new scam lure or social engineering keyword."""
    cleaned = (phrase or "").lower().strip()
    if cleaned:
        with _intel_lock:
            KNOWN_MALICIOUS_KEYWORDS.append((cleaned, description))


def sync_threat_feed_data(feed_dict: Dict[str, str]) -> int:
    """Batch-import threat indicators from an external feed or SIEM."""
    count = 0
    with _intel_lock:
        for domain, desc in feed_dict.items():
            cleaned = (domain or "").lower().strip().strip(".")
            if cleaned and cleaned not in KNOWN_MALICIOUS_DOMAINS:
                KNOWN_MALICIOUS_DOMAINS[cleaned] = desc
                count += 1
    logger.info("Threat intel feed synced: %d new domains added", count)
    return count


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
