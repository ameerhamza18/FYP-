"""Sender-identity reputation intelligence.

Scores sending identities (MSISDNs, short codes, alphanumeric sender IDs) for
spoofed brands (including HBL, UBL, Meezan, EasyPaisa, JazzCash, Raast, SBP,
BISP, NADRA, FBR, PTA), homograph sender IDs, foreign/premium-rate prefixes,
and SOC-managed custom scam sender IOCs.
"""
import difflib
import re
import threading
from typing import Dict, List, Optional

_sender_lock = threading.Lock()

BUILTIN_SCAM_SENDERS: Dict[str, str] = {
    "+441234567890": "Smishing originator — fake bank KYC lure",
    "07001234567": "Premium-rate social-engineering originator",
    "SCAM-ALERT": "Unregistered sender ID used for prize scams",
    "BISPPAKISTAN": "Impersonates BISP — government-grant scam sender ID",
    "RAAST-REWARD": "Impersonates SBP Raast instant payment service",
}

KNOWN_SCAM_SENDERS: Dict[str, str] = dict(BUILTIN_SCAM_SENDERS)

IMPERSONATED_BRANDS = (
    "HBL", "UBL", "MCB", "MEEZAN", "ALFALAH", "ASKARI", "FAYSAL",
    "EASYPAISA", "JAZZCASH", "RAAST", "SBP", "SADAPAY", "NAYAPAY",
    "JAZZ", "TELENOR", "UFONE", "ZONG", "NADRA", "PTA", "FBR", "BISP", "EHSAAS",
    "PAYPAL", "AMAZON", "NETFLIX", "WHATSAPP", "FACEBOOK", "GOOGLE",
    "MICROSOFT", "APPLE", "BINANCE", "METAMASK", "DARAZ", "STRIPE",
)

_LOCAL_MOBILE = re.compile(r"^(?:\+?92|0)?3\d{9}$")
_FOREIGN = re.compile(r"^(?:\+|00)\d{7,15}$")
_PREMIUM_RATE = re.compile(r"^(?:\+|00)?(?:92)?0?9\d{2,3}\d{4,8}$")
_NON_ASCII = re.compile(r"[^\x00-\x7F]")


def _normalize(sender: Optional[str]) -> str:
    """Collapse whitespace/casing so feeds and live traffic compare cleanly."""
    return re.sub(r"\s+", "", (sender or "")).strip().upper()


def _digits_only(value: str) -> str:
    return "".join(ch for ch in value if ch.isdigit())


def add_scam_sender(sender: str, description: str) -> None:
    """Dynamically register a malicious sender ID or MSISDN from SOC admin."""
    cleaned = _normalize(sender)
    if cleaned:
        with _sender_lock:
            KNOWN_SCAM_SENDERS[cleaned] = description


def remove_scam_sender(sender: str) -> bool:
    """Remove a custom sender IOC from the active blocklist."""
    cleaned = _normalize(sender)
    with _sender_lock:
        if cleaned in KNOWN_SCAM_SENDERS and cleaned not in BUILTIN_SCAM_SENDERS:
            del KNOWN_SCAM_SENDERS[cleaned]
            return True
    return False


def reset_and_sync_custom_senders(custom_senders: Dict[str, str]) -> None:
    """Rebuild active scam sender map from built-in seeds + DB custom IOCs."""
    with _sender_lock:
        KNOWN_SCAM_SENDERS.clear()
        KNOWN_SCAM_SENDERS.update(BUILTIN_SCAM_SENDERS)
        for s, desc in custom_senders.items():
            cleaned = _normalize(s)
            if cleaned:
                KNOWN_SCAM_SENDERS[cleaned] = desc


def mask_sender(sender: Optional[str]) -> Optional[str]:
    """Privacy-preserving form of the sender for persistence/logging."""
    normalized = _normalize(sender)
    if not normalized:
        return None
    digits = _digits_only(normalized)
    if len(digits) >= 8:
        head = normalized[:5]
        tail = normalized[-3:]
        return f"{head}{'*' * max(3, len(normalized) - 8)}{tail}"
    return normalized


def _typosquat_of(token: str) -> Optional[str]:
    """Return the brand a sender ID is imitating, if any."""
    if len(token) < 4:
        return None
    for brand in IMPERSONATED_BRANDS:
        if token == brand:
            continue
        if brand in token:
            return brand
        if difflib.SequenceMatcher(None, token, brand).ratio() >= 0.85:
            return brand
    return None


def check_sender(sender: Optional[str]) -> Dict:
    """Score a sender identity (MSISDN, short code or alphanumeric sender ID)."""
    normalized = _normalize(sender)
    matches: List[Dict] = []
    indicators: List[Dict] = []
    score = 0.0
    negative_found = False

    def add(kind: str, severity: str, title: str, detail: str, points: float) -> None:
        nonlocal score, negative_found
        score += points
        negative_found = True
        matches.append({"type": kind, "value": mask_sender(normalized),
                        "severity": severity, "description": detail})
        indicators.append({"category": "Sender Reputation", "severity": severity,
                           "title": title, "detail": detail})

    if not normalized:
        return {"score": 0.0, "level": "LOW", "matches": [], "indicators": [],
                "sender": None, "sender_masked": None, "provided": False}

    with _sender_lock:
        known = KNOWN_SCAM_SENDERS.get(normalized)

    if known:
        add("sender", "CRITICAL",
            f"Known scam sender: {mask_sender(normalized)}", known, 85.0)
        return _summary(normalized, score, matches, indicators)

    digits = _digits_only(normalized)
    has_letters = any(ch.isalpha() for ch in normalized)

    if has_letters:
        if _NON_ASCII.search(normalized):
            add("sender", "HIGH",
                f"Sender ID uses non-Latin characters: {normalized}",
                "Unicode/homograph sender ID — a common trick to impersonate a "
                "brand that users and filters recognise by sight.", 50.0)
        else:
            letters_only = "".join(ch for ch in normalized if ch.isalpha())
            spoofed = _typosquat_of(letters_only)
            if spoofed:
                add("sender", "HIGH",
                    f"Sender ID impersonates {spoofed}: {normalized}",
                    f"The sender ID closely matches the '{spoofed}' brand but is "
                    "not that brand's registered sender ID. Brand impersonation "
                    "is the core of smishing.", 50.0)
            else:
                add("sender", "MEDIUM",
                    f"Generic alphanumeric sender ID: {normalized}",
                    "Bulk/marketing sender IDs are unverified and can be spoofed; "
                    "treat bank or prize claims from them with caution.", 18.0)

    elif digits:
        if _LOCAL_MOBILE.match(normalized):
            pass
        elif _PREMIUM_RATE.match(normalized):
            add("sender", "HIGH",
                f"Premium-rate or off-net prefix: {mask_sender(normalized)}",
                "Premium/shared-revenue number ranges are heavily used for "
                "subscription and refund scams.", 30.0)
        elif _FOREIGN.match(normalized):
            add("sender", "MEDIUM",
                f"Foreign-origin sender: {mask_sender(normalized)}",
                "Message arrived from a foreign number range — common for "
                "international smishing and one-ring/wangiri campaigns.", 20.0)
        elif 4 <= len(digits) <= 6:
            add("sender", "LOW",
                f"Short/bulk sender code: {normalized}",
                "Short codes are shared bulk-SMS routes. They are legitimate for "
                "many banks, but the displayed code alone does not prove identity.",
                8.0)

    if not negative_found:
        indicators.append({
            "category": "Sender Reputation", "severity": "INFO",
            "title": f"Sender reputation unknown: {mask_sender(normalized)}",
            "detail": "No negative reputation data for this sender. Unknown is not "
                      "the same as safe — judge the message content too.",
        })

    return _summary(normalized, score, matches, indicators)


def _summary(normalized: str, score: float, matches: List[Dict],
             indicators: List[Dict]) -> Dict:
    """Shared result envelope, so every exit path returns the same shape."""
    capped = min(100.0, score)
    if capped >= 85:
        level = "CRITICAL"
    elif capped >= 45:
        level = "HIGH"
    elif capped >= 18:
        level = "MEDIUM"
    else:
        level = "LOW"

    return {
        "score": capped,
        "level": level,
        "matches": matches,
        "indicators": indicators,
        "sender": normalized,
        "sender_masked": mask_sender(normalized),
        "provided": True,
    }
