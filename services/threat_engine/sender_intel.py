"""Sender-identity reputation intelligence.

Real-world smishing is decided as much by *who* sent the message as by what it
says. Production anti-scam apps score the sending identity itself: spoofed
alphanumeric brand IDs, unregistered bulk short codes, foreign premium-rate
numbers, IDN/homograph sender names and known scam MSISDNs.

The mobile interceptor forwards the originating address it observed, so the
Trust Engine can fuse sender reputation into the same explainable verdict.

Interface mirrors ``threat_intel``: a pure function returning
``{"score", "level", "matches", "indicators"}`` with no I/O, so it stays
testable and swappable for a live reputation feed later.
"""
import difflib
import re
from typing import Dict, List, Optional

# Curated scam senders (offline v1 feed — swap for a live reputation API later).
KNOWN_SCAM_SENDERS: Dict[str, str] = {
    "+441234567890": "Smishing originator — fake bank KYC lure",
    "07001234567": "Premium-rate social-engineering originator",
    "SCAM-ALERT": "Unregistered sender ID used for prize scams",
    "BISPPAKISTAN": "Impersonates BISP — government-grant scam sender ID",
}

# Brands whose identity is routinely spoofed in smishing campaigns.
IMPERSONATED_BRANDS = (
    "HBL", "UBL", "MCB", "MEEZAN", "ALFALAH", "ASKARI", "FAYSAL",
    "EASYPAISA", "JAZZCASH", "SADAPAY", "NAYAPAY", "JAZZ", "TELENOR",
    "UFONE", "ZONG", "NADRA", "PTA", "FBR", "BISP", "EHSAAS",
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


def mask_sender(sender: Optional[str]) -> Optional[str]:
    """Privacy-preserving form of the sender for persistence/logging.

    Full MSISDNs are personal data; only enough is retained to let the user (and
    an auditor) recognise which sender was scored, e.g. ``+92301***890``.
    """
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
    """Return the brand a sender ID is imitating, if any.

    Unicode homographs (e.g. Cyrillic ``а`` inside ``JАZZ``) defeat byte
    equality, so a fuzzy ratio is used rather than a dictionary lookup.
    """
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
        # Masked value only: the raw MSISDN/sender ID never leaves this module.
        matches.append({"type": kind, "value": mask_sender(normalized),
                        "severity": severity, "description": detail})
        indicators.append({"category": "Sender Reputation", "severity": severity,
                           "title": title, "detail": detail})

    if not normalized:
        return {"score": 0.0, "level": "LOW", "matches": [], "indicators": [],
                "sender": None, "sender_masked": None, "provided": False}

    # --- 1. Known-bad sender IOC (highest-confidence signal) ---------------
    # When the feed already knows this sender, its heuristic category is
    # irrelevant: the IOC is authoritative and must not be double-counted.
    known = KNOWN_SCAM_SENDERS.get(normalized)
    if known:
        add("sender", "CRITICAL",
            f"Known scam sender: {mask_sender(normalized)}", known, 85.0)
        return _summary(normalized, score, matches, indicators)

    digits = _digits_only(normalized)
    has_letters = any(ch.isalpha() for ch in normalized)

    # --- 2. Alphanumeric sender ID (brand-spoofing surface) ---------------
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

    # --- 3. Numeric senders ------------------------------------------------
    elif digits:
        if _LOCAL_MOBILE.match(normalized):
            # Ordinary local mobile number: no reputation signal on its own.
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

