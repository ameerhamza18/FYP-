"""Text preprocessing utilities shared by the ML model and the rule engine."""
import re
from typing import Dict, List

PHONE_RE = re.compile(r"(?:\+?92|0)?[\s\-]?\d{3}[\s\-]?\d{7}|\+?\d{2}[\s\-]?\d{4}[\s\-]?\d{6,}")
AMOUNT_RE = re.compile(r"(?:rs\.?|pkr|usd|\$|€|£)\s?\d[\d,\.]*", re.I)
URL_RE = re.compile(r"https?://[^\s<>\"']+|(?:www\.)[a-z0-9\-]+\.[a-z]{2,}[^\s<>\"']*", re.I)
OTP_RE = re.compile(r"\b(?:otp|one[\s\-]?time\s+(?:code|password)|verification\s+code|pin)\b[:\s]*(?:is\s*[:=]?\s*)?\d{3,8}", re.I)
EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")


def normalize(text: str) -> str:
    """Lowercase + collapse whitespace (keeps digits/punctuation for features)."""
    return re.sub(r"\s+", " ", (text or "").strip().lower())


def extract_entities(text: str) -> Dict[str, List[str]]:
    """Extract IOCs and structured entities from free text."""
    return {
        "phones": sorted(set(PHONE_RE.findall(text))),
        "amounts": sorted(set(m.group(0) for m in AMOUNT_RE.finditer(text))),
        "urls": sorted(set(m.group(0) for m in URL_RE.finditer(text))),
        "emails": sorted(set(EMAIL_RE.findall(text))),
        "otp_codes": sorted(set(m.group(0) for m in OTP_RE.finditer(text))),
    }


def extract_urls(text: str) -> List[str]:
    return extract_entities(text)["urls"]


def extract_phones(text: str) -> List[str]:
    return extract_entities(text)["phones"]


def word_count(text: str) -> int:
    return len((text or "").split())
