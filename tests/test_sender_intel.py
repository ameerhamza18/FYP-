"""Unit + API tests: sender-identity reputation (smishing sender analysis)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.threat_engine import sender_intel

CLEAN_LOCAL_MOBILE = "+923001234567"


def test_local_mobile_sender_has_no_negative_signal():
    r = sender_intel.check_sender(CLEAN_LOCAL_MOBILE)
    assert r["score"] == 0
    assert r["level"] == "LOW"
    assert r["matches"] == []
    # "Unknown/neutral" is still surfaced to the user rather than silently dropped.
    assert r["indicators"][0]["severity"] == "INFO"


def test_local_mobile_in_pakistani_format_also_clean():
    assert sender_intel.check_sender("03001234567")["score"] == 0


def test_known_scam_sender_is_critical():
    r = sender_intel.check_sender("SCAM-ALERT")
    assert r["level"] == "CRITICAL"
    assert r["score"] >= 85


def test_brand_spoof_sender_id_flagged():
    r = sender_intel.check_sender("HBL-ALERTS")
    assert r["score"] > 0
    assert any("HBL" in m["description"] or "HBL" in m["value"] for m in r["matches"])
    assert r["level"] in ("MEDIUM", "HIGH", "CRITICAL")


def test_typosquatted_sender_id_flagged_high():
    r = sender_intel.check_sender("JAZZCACH")
    assert r["level"] in ("HIGH", "CRITICAL")


def test_foreign_origin_number_flagged():
    r = sender_intel.check_sender("+447700900123")
    assert r["score"] > 0
    assert r["level"] in ("MEDIUM", "HIGH", "CRITICAL")


def test_short_code_is_low_signal_only():
    r = sender_intel.check_sender("8558")
    assert r["level"] == "LOW"
    assert r["score"] < 18


def test_empty_sender_is_neutral():
    r = sender_intel.check_sender(None)
    assert r["provided"] is False
    assert r["score"] == 0
    assert r["indicators"] == []


def test_sender_is_masked_for_privacy():
    mask = sender_intel.mask_sender(CLEAN_LOCAL_MOBILE)
    assert mask is not None
    assert CLEAN_LOCAL_MOBILE not in mask
    assert mask.endswith("567")
    assert "*" in mask


def test_api_accepts_sender_and_returns_sender_indicators(client, user_headers):
    r = client.post("/api/analyze/text",
                    headers=user_headers,
                    json={
                        "text": "Please confirm the delivery of your parcel today.",
                        "source": "sms",
                        "sender": "+447700900123",
                    })
    assert r.status_code == 200, r.text
    body = r.json()
    categories = {i["category"] for i in body["indicators"]}
    assert "Sender Reputation" in categories
    assert body["engine_breakdown"]["sender_intel"]["sender_masked"]
    # The raw number must never be persisted verbatim in the breakdown.
    assert "+447700900123" not in r.text


def test_api_sender_absent_by_default(client, user_headers):
    r = client.post("/api/analyze/text", headers=user_headers,
                    json={"text": "Are we still meeting for lunch tomorrow?"})
    assert r.status_code == 200, r.text
    assert r.json()["engine_breakdown"]["sender_intel"]["sender_masked"] is None


def test_api_rejects_overlong_sender(client, user_headers):
    r = client.post("/api/analyze/text", headers=user_headers,
                    json={"text": "hello there", "sender": "A" * 200})
    assert r.status_code == 422
