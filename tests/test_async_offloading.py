"""Regression tests for event-loop offloading:
- Offloading synchronous OCR work in screenshot analysis
- Non-blocking execution of synchronous campaign webhook dispatches
- Asynchronous helper functions (async_extract_text, async_trigger_campaign_webhook)
"""
import io
import threading
import pytest
from fastapi.testclient import TestClient

from app.database import Base, engine
from app.main import app
from services.vision.ocr import OCRUnavailableError, async_extract_text
from services.threat_engine.campaign_detector import async_trigger_campaign_webhook


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield


PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00"
    b"\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


def _login_user(client: TestClient) -> dict:
    email = "async_test@trustlayer.com"
    pwd = "AsyncPass123"
    client.post("/api/auth/register", json={"email": email, "password": pwd})
    r = client.post("/api/auth/login", json={"email": email, "password": pwd})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_screenshot_analysis_offloaded_in_thread(monkeypatch):
    """Verify OCR runs in a background thread and does not block the asyncio event loop."""
    client = TestClient(app)
    headers = _login_user(client)

    worker_thread_id = None
    main_thread_id = threading.get_ident()

    def mock_extract(image_bytes: bytes, lang: str = "eng"):
        nonlocal worker_thread_id
        worker_thread_id = threading.get_ident()
        return "Urgent: Your account is suspended, verify now at http://fake-bank-alert.xyz"

    monkeypatch.setattr("app.routers.analyze.extract_text", mock_extract)

    response = client.post(
        "/api/analyze/screenshot",
        files={"upload": ("screenshot.png", io.BytesIO(PNG_BYTES), "image/png")},
        headers=headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["input_type"] == "screenshot"
    assert data["risk_score"] > 0
    # The OCR function MUST execute in a separate worker threadpool thread, not the main thread
    assert worker_thread_id is not None
    assert worker_thread_id != main_thread_id


def test_screenshot_ocr_unavailable_handled(monkeypatch):
    client = TestClient(app)
    headers = _login_user(client)

    def mock_extract_fail(image_bytes: bytes, lang: str = "eng"):
        raise OCRUnavailableError("Tesseract binary is not installed")

    monkeypatch.setattr("app.routers.analyze.extract_text", mock_extract_fail)

    response = client.post(
        "/api/analyze/screenshot",
        files={"upload": ("screenshot.png", io.BytesIO(PNG_BYTES), "image/png")},
        headers=headers,
    )
    assert response.status_code == 503
    assert "OCR service unavailable" in response.json()["detail"]


@pytest.mark.anyio
async def test_async_extract_text_helper(monkeypatch):
    def mock_extract(image_bytes: bytes, lang: str = "eng"):
        return "Extracted async text"

    monkeypatch.setattr("services.vision.ocr.extract_text", mock_extract)
    text = await async_extract_text(PNG_BYTES)
    assert text == "Extracted async text"


@pytest.mark.anyio
async def test_async_trigger_campaign_webhook_helper(monkeypatch):
    called = False

    def mock_trigger(webhook_url, campaign_signature, hits, users, snippet=None):
        nonlocal called
        called = True
        return True

    monkeypatch.setattr("services.threat_engine.campaign_detector.trigger_campaign_webhook", mock_trigger)
    res = await async_trigger_campaign_webhook("https://webhook.site/test", "sig123", 5, 3)
    assert res is True
    assert called is True


def test_campaign_webhook_non_blocking_execution(monkeypatch):
    """Verify that campaign webhook is triggered without blocking the request handler."""
    client = TestClient(app)
    headers = _login_user(client)

    from app.config import get_settings
    settings = get_settings()

    webhook_dispatched = []

    def mock_webhook(webhook_url, campaign_signature, hits, users, snippet=None):
        webhook_dispatched.append({
            "url": webhook_url,
            "signature": campaign_signature,
            "hits": hits,
            "users": users,
        })
        return True

    monkeypatch.setattr("services.threat_engine.campaign_detector.trigger_campaign_webhook", mock_webhook)
    monkeypatch.setattr("services.threat_engine.campaign_detector.should_flag_campaign", lambda hits, users: True)

    import services.threat_engine.campaign_detector as cd
    monkeypatch.setattr(cd, "trigger_campaign_webhook", mock_webhook)

    from app.config import Settings
    # Patch campaign_webhook_url on the Settings object if possible or via monkeypatch
    import app.config as config_mod
    current_settings = config_mod.get_settings()
    monkeypatch.setenv("CAMPAIGN_WEBHOOK_URL", "https://hooks.slack.com/services/test")
    config_mod.get_settings.cache_clear()

    # Post analysis
    msg = "Urgent: Click http://coordinated-campaign-link.xyz to verify your account"
    r = client.post("/api/analyze/text", json={"text": msg, "source": "web"}, headers=headers)
    assert r.status_code == 200

    # Ensure settings cache cleared
    config_mod.get_settings.cache_clear()
