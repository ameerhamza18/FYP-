"""Coordinated attack-campaign detection.

Builds a content signature from the stable artifacts of a message — the
domains, phone numbers and sender addresses it references — rather than the
full free text (which attackers randomize). When enough distinct reports share
the same signature across distinct users, TrustLayer raises a campaign alert
for the SOC dashboard.
"""
import hashlib
import re
from typing import Dict, List, Optional

CAMPAIGN_HIT_THRESHOLD = 3          # reports needed to flag a campaign
DISTINCT_USER_THRESHOLD = 2         # distinct users needed to flag a campaign

PHONE_RE = re.compile(r"\+?\d[\d\s\-]{8,14}\d")
DOMAIN_RE = re.compile(r"(?:https?://|(?:www\.))([a-z0-9\-\.]+\.[a-z]{2,})", re.I)


def build_signature(text: str, entities: Dict[str, List[str]]) -> Optional[str]:
    """Deterministic campaign signature from stable IOCs in the message."""
    artifacts: List[str] = []
    artifacts += [u.lower() for u in entities.get("urls", [])]
    artifacts += [d for d in DOMAIN_RE.findall(text or "")]  # bare domains
    artifacts += [re.sub(r"[\s\-]", "", p) for p in entities.get("phones", [])]
    artifacts += entities.get("emails", [])

    # Deduplicate + sort for order-independent hashing.
    unique = sorted(set(a for a in artifacts if a))
    if not unique:
        return None
    return hashlib.sha256("|".join(unique).encode("utf-8")).hexdigest()[:64]


def should_flag_campaign(hits: int, distinct_users: int) -> bool:
    return hits >= CAMPAIGN_HIT_THRESHOLD and distinct_users >= DISTINCT_USER_THRESHOLD


def trigger_campaign_webhook(webhook_url: Optional[str], campaign_signature: str, hits: int, users: int, snippet: Optional[str] = None) -> bool:
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

