"""Coordinated attack-campaign detection (FR-09).

Correlates coordinated scam waves across distinct users using:
1. Order-independent cryptographic hashing of extracted IOCs (URLs, bare
   domains, phone numbers, and email addresses).
2. Normalized message-structure template hashing (SimHash/skeleton SHA-256)
   for IOC-less social-engineering campaigns where scammers vary numbers,
   names, or amounts while reusing the same structural lure template.
"""
import hashlib
import re
from typing import Dict, List, Optional

from services.nlp.preprocessing import fold_homoglyphs, sanitize_tokens

CAMPAIGN_HIT_THRESHOLD = 3          # reports needed to flag a campaign
DISTINCT_USER_THRESHOLD = 2         # distinct users needed to flag a campaign

PHONE_RE = re.compile(r"\+?\d[\d\s\-]{8,14}\d")
DOMAIN_RE = re.compile(r"(?:https?://|(?:www\.))([a-z0-9\-\.]+\.[a-z]{2,})", re.I)

# Structural cues required before hashing IOC-less message templates so short
# everyday greetings ("hello world", "ok thanks") never form false campaigns.
_TEMPLATE_CUE_RE = re.compile(
    r"\b(account|bank|card|wallet|raast|easypaisa|jazzcash|hbl|ubl|meezan|"
    r"bisp|ehsaas|nadra|fbr|pta|otp|pin|password|blocked|suspended|verify|"
    r"prize|lottery|inam|inaam|imdad|wazifa|urgent|immediately|fori|band|"
    r"transfer|fee|deposit|guaranteed|profit)\b",
    re.I,
)


def build_template_signature(text: str) -> Optional[str]:
    """Hash the normalized structural skeleton of a scam template (FR-09)."""
    if not text:
        return None
    folded = fold_homoglyphs(text).lower()
    if not _TEMPLATE_CUE_RE.search(folded):
        return None
    sanitized = sanitize_tokens(folded)
    # Replace remaining numbers and strip punctuation to capture structural skeleton
    skeleton = re.sub(r"\b\d+\b", "#", sanitized)
    skeleton = re.sub(r"[^a-z0-9#\[\]\s]", " ", skeleton)
    tokens = [t for t in skeleton.split() if t]
    if len(tokens) < 6:
        return None
    canonical = " ".join(tokens)
    return hashlib.sha256(f"tpl:{canonical}".encode("utf-8")).hexdigest()[:64]


def build_signature(text: str, entities: Dict[str, List[str]]) -> Optional[str]:
    """Deterministic campaign signature from IOCs or normalized message structure."""
    artifacts: List[str] = []
    artifacts += [u.lower() for u in entities.get("urls", [])]
    artifacts += [d.lower() for d in DOMAIN_RE.findall(text or "")]  # bare domains
    artifacts += [re.sub(r"[\s\-]", "", p) for p in entities.get("phones", [])]
    artifacts += [e.lower() for e in entities.get("emails", [])]

    # Deduplicate + sort for order-independent IOC hashing.
    unique = sorted(set(a for a in artifacts if a))
    if unique:
        return hashlib.sha256("|".join(unique).encode("utf-8")).hexdigest()[:64]

    # Fallback: normalized message-structure template hash (FR-09).
    return build_template_signature(text)


def should_flag_campaign(hits: int, distinct_users: int) -> bool:
    return hits >= CAMPAIGN_HIT_THRESHOLD and distinct_users >= DISTINCT_USER_THRESHOLD


def trigger_campaign_webhook(
    webhook_url: Optional[str],
    campaign_signature: str,
    hits: int,
    users: int,
    snippet: Optional[str] = None,
) -> bool:
    """Trigger real-time webhook alert (e.g. Slack/Discord/SOC SIEM) when a campaign is flagged."""
    if not webhook_url:
        return False
    import json
    import logging
    import urllib.request

    logger = logging.getLogger("trustlayer.campaign")
    payload = {
        "event": "COORDINATED_CAMPAIGN_DETECTED",
        "signature": campaign_signature,
        "total_hits": hits,
        "distinct_users": users,
        "sample_snippet": snippet or "",
    }
    try:
        req = urllib.request.Request(
            webhook_url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status < 400
    except Exception as exc:
        logger.warning("Failed to dispatch campaign webhook to %s: %s", webhook_url, exc)
        return False


async def async_trigger_campaign_webhook(
    webhook_url: Optional[str],
    campaign_signature: str,
    hits: int,
    users: int,
    snippet: Optional[str] = None,
) -> bool:
    """Async variant to dispatch campaign webhook alert without blocking the event loop."""
    from starlette.concurrency import run_in_threadpool
    return await run_in_threadpool(
        trigger_campaign_webhook,
        webhook_url=webhook_url,
        campaign_signature=campaign_signature,
        hits=hits,
        users=users,
        snippet=snippet,
    )
