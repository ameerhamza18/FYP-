"""Local threat-intelligence feed & dynamic SOC IOC blocklist store.

Ships with an offline curated feed of known-bad indicators (including regional
Pakistani banking, EasyPaisa, JazzCash, Raast, and BISP phishing kits) AND
supports live SOC analyst blocklist additions/removals persisted in the DB.
"""
import logging
import threading
from typing import Dict, List, Tuple

from services.nlp.preprocessing import fold_homoglyphs

logger = logging.getLogger("trustlayer.threat_intel")
_intel_lock = threading.Lock()

BUILTIN_MALICIOUS_DOMAINS: Dict[str, str] = {
    "verify-account-alert.xyz": "Phishing kit — account-verification lure",
    "secure-login-update.top": "Phishing kit — fake login page",
    "bank-alerts-notice.cf": "Banking phishing template",
    "prize-claim-center.tk": "Prize/lottery scam infrastructure",
    "easy-job-offers.ml": "Fake job scam infrastructure",
    "crypto-doubler.ga": "Investment doubling scam",
    "paypa1-secure.com": "PayPal typosquat",
    "easypaisa-rewards.xyz": "Easypaisa reward scam",
    "jazzcash-win.top": "JazzCash prize scam",
    "raast-subsidy-claim.xyz": "Raast / SBP instant payment phishing lure",
    "sbp-raast-verify.top": "Fake State Bank Raast ID verification portal",
}

BUILTIN_MALICIOUS_KEYWORDS: List[Tuple[str, str]] = [
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
    ("raast subsidy", "Fake Raast government subsidy lure"),
    ("raast id block", "Raast ID suspension phishing lure"),
]

# Active dictionaries mutated thread-safely when SOC admins manage IOCs
KNOWN_MALICIOUS_DOMAINS: Dict[str, str] = dict(BUILTIN_MALICIOUS_DOMAINS)
KNOWN_MALICIOUS_KEYWORDS: List[Tuple[str, str]] = list(BUILTIN_MALICIOUS_KEYWORDS)

SUSPICIOUS_SENDER_TLDS = {"tk", "ml", "ga", "cf", "gq", "xyz", "top"}


def add_malicious_domain(domain: str, description: str) -> None:
    """Dynamically register a newly discovered phishing/scam domain."""
    cleaned = (domain or "").lower().strip().strip(".")
    if cleaned:
        with _intel_lock:
            KNOWN_MALICIOUS_DOMAINS[cleaned] = description


def remove_malicious_domain(domain: str) -> bool:
    """Remove a domain from the active blocklist (unless built-in)."""
    cleaned = (domain or "").lower().strip().strip(".")
    with _intel_lock:
        if cleaned in KNOWN_MALICIOUS_DOMAINS and cleaned not in BUILTIN_MALICIOUS_DOMAINS:
            del KNOWN_MALICIOUS_DOMAINS[cleaned]
            return True
    return False


def add_malicious_keyword(phrase: str, description: str) -> None:
    """Dynamically register a new scam lure or social engineering keyword."""
    cleaned = (phrase or "").lower().strip()
    if cleaned:
        with _intel_lock:
            existing = {k for k, _ in KNOWN_MALICIOUS_KEYWORDS}
            if cleaned not in existing:
                KNOWN_MALICIOUS_KEYWORDS.append((cleaned, description))


def remove_malicious_keyword(phrase: str) -> bool:
    """Remove a custom keyword from the active blocklist."""
    cleaned = (phrase or "").lower().strip()
    builtin_keys = {k for k, _ in BUILTIN_MALICIOUS_KEYWORDS}
    if cleaned in builtin_keys:
        return False
    with _intel_lock:
        before = len(KNOWN_MALICIOUS_KEYWORDS)
        KNOWN_MALICIOUS_KEYWORDS[:] = [
            (k, d) for k, d in KNOWN_MALICIOUS_KEYWORDS if k != cleaned
        ]
        return len(KNOWN_MALICIOUS_KEYWORDS) < before


def reset_and_sync_custom_iocs(domains: Dict[str, str], keywords: List[Tuple[str, str]]) -> None:
    """Rebuild active in-memory IOC sets from built-in seeds + DB-persisted custom IOCs."""
    with _intel_lock:
        KNOWN_MALICIOUS_DOMAINS.clear()
        KNOWN_MALICIOUS_DOMAINS.update(BUILTIN_MALICIOUS_DOMAINS)
        for dom, desc in domains.items():
            cleaned = (dom or "").lower().strip().strip(".")
            if cleaned:
                KNOWN_MALICIOUS_DOMAINS[cleaned] = desc

        KNOWN_MALICIOUS_KEYWORDS[:] = list(BUILTIN_MALICIOUS_KEYWORDS)
        existing = {k for k, _ in KNOWN_MALICIOUS_KEYWORDS}
        for kw, desc in keywords:
            cleaned = (kw or "").lower().strip()
            if cleaned and cleaned not in existing:
                KNOWN_MALICIOUS_KEYWORDS.append((cleaned, desc))
                existing.add(cleaned)


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

    Confirmed malicious domain IOCs produce >= 85.0 so FR-07's deterministic
    escalation floor (>= 55 Medium Risk) engages reliably.
    """
    lowered = fold_homoglyphs(text or "").lower()
    matches: List[Dict] = []
    score = 0.0

    with _intel_lock:
        domains_snapshot = list(KNOWN_MALICIOUS_DOMAINS.items())
        keywords_snapshot = list(KNOWN_MALICIOUS_KEYWORDS)

    for domain, desc in domains_snapshot:
        if domain in lowered:
            matches.append({"type": "domain", "value": domain, "description": desc})
            score = max(score, 85.0) + (5.0 if score >= 85.0 else 0.0)

    for phrase, desc in keywords_snapshot:
        if phrase in lowered:
            matches.append({"type": "keyword", "value": phrase, "description": desc})
            score += 12.0

    return {"score": min(100.0, score), "matches": matches}


def check_domain(domain: str) -> Dict:
    """Check a specific domain against the feed."""
    domain = (domain or "").lower().strip(".")
    with _intel_lock:
        desc = KNOWN_MALICIOUS_DOMAINS.get(domain)
    if desc is not None:
        return {
            "score": 85.0,
            "matches": [{
                "type": "domain", "value": domain,
                "description": desc,
            }],
        }
    score = 15.0 if domain.rsplit(".", 1)[-1] in SUSPICIOUS_SENDER_TLDS else 0.0
    return {"score": score, "matches": []}
