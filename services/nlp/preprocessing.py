"""Text preprocessing & privacy redaction pipeline (Section 2.4.1 & NFR-02).

Implements TrustLayer's four-stage text cleanup pipeline shared by the ML
training/inference service and the deterministic threat engine:
1. Unicode NFKC normalisation & Cyrillic/Greek homoglyph folding.
2. Regex token sanitisation ([URL], [EMAIL], [PHONE], [CURRENCY], [OTP]).
3. Repeated punctuation collapsing (!!!, ??) with urgency punctuation counting.
4. Dual-channel feature readiness (word 1-2 n-grams + char_wb 3-5 n-grams).

Also provides zero-storage PII/message redaction helpers so raw user messages,
OTP codes, phone numbers, and emails are never persisted in plaintext.
"""
import hashlib
import re
import unicodedata
from typing import Any, Dict, List, Tuple
from urllib.parse import urlparse

# Step 1: Common Cyrillic, Greek, and confusable homoglyphs used in smishing
HOMOGLYPH_MAP = str.maketrans({
    "\u0430": "a", "\u0410": "a",  # Cyrillic a
    "\u0435": "e", "\u0415": "e",  # Cyrillic ie
    "\u0456": "i", "\u0406": "i",  # Cyrillic byelorussian-ukrainian i
    "\u043e": "o", "\u041e": "o",  # Cyrillic o
    "\u0440": "p", "\u0420": "p",  # Cyrillic er
    "\u0441": "c", "\u0421": "c",  # Cyrillic es
    "\u0443": "y", "\u0423": "y",  # Cyrillic u
    "\u0445": "x", "\u0425": "x",  # Cyrillic ha
    "\u0455": "s", "\u0405": "s",  # Cyrillic dze
    "\u04bb": "h", "\u041d": "h",  # Cyrillic shha / en
    "\u0412": "b",                 # Cyrillic ve
    "\u041c": "m",                 # Cyrillic em
    "\u0422": "t",                 # Cyrillic te
    "\u041a": "k", "\u043a": "k",  # Cyrillic ka
    "\u03b1": "a",                 # Greek alpha
    "\u03b5": "e",                 # Greek epsilon
    "\u03b9": "i",                 # Greek iota
    "\u03bf": "o",                 # Greek omicron
    "\u03c1": "p",                 # Greek rho
    "\u03ba": "k",                 # Greek kappa
    "\u03bd": "v",                 # Greek nu
    "\u2010": "-", "\u2011": "-", "\u2012": "-", "\u2013": "-", "\u2014": "-",
})

PHONE_RE = re.compile(
    r"(?:\+?92|0)?[\s\-]?3\d{2}[\s\-]?\d{7}\b"
    r"|(?:\+?92|0)\d{2,3}[\s\-]?\d{6,8}\b"
    r"|\+\d{1,3}[\s\-]?\d{3,4}[\s\-]?\d{5,8}\b"
)
AMOUNT_RE = re.compile(
    r"(?:rs\.?|pkr|usd|usdt|btc|\$|€|£)\s?\d[\d,\.]*"
    r"|\b\d[\d,\.]*\s?(?:pkr|usd|usdt|btc|rupees|lakh|lac)\b",
    re.I,
)
URL_RE = re.compile(
    r"https?://[^\s<>\"']+|(?:www\.)[a-z0-9\-]+\.[a-z]{2,}[^\s<>\"']*",
    re.I,
)
OTP_RE = re.compile(
    r"\b(?:otp|one[\s\-]?time\s+(?:code|password)|verification\s+code|delivery\s+pin|atm\s+pin|pin(?:\s+code)?)\b"
    r"[:\s]*(?:is\s*[:=]?\s*)?\d{3,8}\b",
    re.I,
)
EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
CNIC_OR_CARD_RE = re.compile(r"\b\d{5}-\d{7}-\d\b|\b(?:\d[ -]?){13,19}\b")
REPEATED_PUNCT_RE = re.compile(r"([!?])\1+")
MIXED_URGENCY_PUNCT_RE = re.compile(r"[!?]{2,}")


def fold_homoglyphs(text: str) -> str:
    """Apply Unicode NFKC normalisation and fold confusable homoglyphs to Latin."""
    if not text:
        return ""
    nfkc = unicodedata.normalize("NFKC", text)
    return nfkc.translate(HOMOGLYPH_MAP)


def normalize(text: str) -> str:
    """Step 1: NFKC + homoglyph folding + lowercase + whitespace collapse."""
    folded = fold_homoglyphs(text or "")
    return re.sub(r"\s+", " ", folded.strip().lower())


def sanitize_tokens(text: str) -> str:
    """Step 2: Replace dynamic surface entities with canonical structural tokens."""
    if not text:
        return ""
    out = URL_RE.sub(" [URL] ", text)
    out = EMAIL_RE.sub(" [EMAIL] ", out)
    out = OTP_RE.sub(" [OTP] ", out)
    out = AMOUNT_RE.sub(" [CURRENCY] ", out)
    out = PHONE_RE.sub(" [PHONE] ", out)
    return re.sub(r"\s+", " ", out).strip()


def collapse_punctuation(text: str) -> Tuple[str, int]:
    """Step 3: Count repeated urgency punctuation (!!!, ??) and collapse runs."""
    if not text:
        return "", 0
    urgency_runs = len(MIXED_URGENCY_PUNCT_RE.findall(text))
    collapsed = REPEATED_PUNCT_RE.sub(r"\1", text)
    collapsed = re.sub(r"([!?])[!?]+", r"\1", collapsed)
    return collapsed, urgency_runs


def preprocess_pipeline(text: str) -> Dict[str, Any]:
    """Execute Steps 1-3 and return normalized, sanitized text plus metadata."""
    normalized = normalize(text)
    collapsed, urgency_punct_count = collapse_punctuation(normalized)
    sanitized = sanitize_tokens(collapsed)
    ml_ready = f"{sanitized} [URGENCY_PUNCT]" if urgency_punct_count > 0 else sanitized
    return {
        "normalized": normalized,
        "collapsed": collapsed,
        "sanitized": sanitized,
        "ml_text": ml_ready.strip(),
        "urgency_punct_count": urgency_punct_count,
    }


def preprocess_for_ml(text: str) -> str:
    """Transform raw input text through the 4-stage cleanup pipeline for TF-IDF."""
    return preprocess_pipeline(text)["ml_text"]


def extract_entities(text: str) -> Dict[str, List[str]]:
    """Extract IOCs and structured entities from free text (after homoglyph fold)."""
    folded = fold_homoglyphs(text or "")
    return {
        "phones": sorted(set(m.group(0).strip() for m in PHONE_RE.finditer(folded))),
        "amounts": sorted(set(m.group(0).strip() for m in AMOUNT_RE.finditer(folded))),
        "urls": sorted(set(m.group(0).strip() for m in URL_RE.finditer(folded))),
        "emails": sorted(set(EMAIL_RE.findall(folded))),
        "otp_codes": sorted(set(m.group(0).strip() for m in OTP_RE.finditer(folded))),
    }


def extract_urls(text: str) -> List[str]:
    return extract_entities(text)["urls"]


def extract_phones(text: str) -> List[str]:
    return extract_entities(text)["phones"]


def word_count(text: str) -> int:
    return len((text or "").split())


# ---------------------------------------------------------------------------
# Zero-Storage Data Minimisation & Redaction Helpers (NFR-02)
# ---------------------------------------------------------------------------
def redact_sensitive_text(text: str, max_len: int = 240) -> str:
    """Mask PII, OTPs, credentials, phone numbers, emails, and full URLs."""
    if not text:
        return ""
    out = fold_homoglyphs(text)
    out = URL_RE.sub("[URL]", out)
    out = EMAIL_RE.sub("[EMAIL]", out)
    out = OTP_RE.sub("[OTP_REDACTED]", out)
    out = CNIC_OR_CARD_RE.sub("[ID_REDACTED]", out)
    out = PHONE_RE.sub("[PHONE]", out)
    out = AMOUNT_RE.sub("[CURRENCY]", out)
    # Mask standalone 4-8 digit codes that may be raw PINs/OTPs
    out = re.sub(r"\b\d{4,8}\b", "[CODE]", out)
    out = re.sub(r"\s+", " ", out).strip()
    return out[:max_len]


def build_zero_storage_reference(text: str) -> str:
    """Build a non-reversible one-way hash descriptor instead of raw message text."""
    digest = hashlib.sha256(normalize(text).encode("utf-8")).hexdigest()[:16]
    wc = word_count(text)
    return f"[ZERO-STORAGE sha256:{digest} words:{wc}]"


def redact_entities_for_storage(entities: Dict[str, List[str]]) -> Dict[str, Any]:
    """Convert raw extracted entities into privacy-safe hashes/domains/counts."""
    safe_domains: List[str] = []
    for u in entities.get("urls", []):
        candidate = u if u.lower().startswith(("http://", "https://")) else f"http://{u}"
        try:
            host = (urlparse(candidate).hostname or "").lower()
            if host and host not in safe_domains:
                safe_domains.append(host)
        except ValueError:
            continue

    phone_hashes = [
        hashlib.sha256(re.sub(r"\D", "", p).encode("utf-8")).hexdigest()[:12]
        for p in entities.get("phones", [])
        if p
    ]
    email_hashes = [
        hashlib.sha256(e.lower().encode("utf-8")).hexdigest()[:12]
        for e in entities.get("emails", [])
        if e
    ]

    return {
        "url_count": len(entities.get("urls", [])),
        "url_hosts": safe_domains[:5],
        "phone_count": len(entities.get("phones", [])),
        "phone_hashes": phone_hashes[:5],
        "email_count": len(entities.get("emails", [])),
        "email_hashes": email_hashes[:5],
        "amount_count": len(entities.get("amounts", [])),
        "otp_detected": bool(entities.get("otp_codes")),
    }
