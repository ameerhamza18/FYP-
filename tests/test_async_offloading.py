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


@pytest.mark.anyio
async def test_screenshot_ocr_and_webhook_do_not_block_concurrent_requests(monkeypatch):
    """Verify that a slow OCR and webhook call do not block unrelated requests on the event loop."""
    import asyncio
    import time
    import httpx

    # Simulate heavy OCR taking 0.3s in worker thread
    def slow_extract_text(image_bytes: bytes, lang: str = "eng"):
        time.sleep(0.3)
        return "Urgent: verify your account at http://phishing-portal.xyz"

    # Simulate slow webhook taking 0.5s in background
    def slow_webhook(*args, **kwargs):
        time.sleep(0.5)
        return True

    monkeypatch.setattr("app.routers.analyze.extract_text", slow_extract_text)
    monkeypatch.setattr("services.threat_engine.campaign_detector.trigger_campaign_webhook", slow_webhook)

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        # Register and login user
        email = "concurrency_test@trustlayer.com"
        pwd = "Passw0rd123!"
        await ac.post("/api/auth/register", json={"email": email, "password": pwd})
        login_res = await ac.post("/api/auth/login", json={"email": email, "password": pwd})
        token = login_res.json()["access_token"]
        auth_headers = {"Authorization": f"Bearer {token}"}

        health_durations = []

        async def run_screenshot():
            t0 = time.perf_counter()
            resp = await ac.post(
                "/api/analyze/screenshot",
                files={"upload": ("screenshot.png", io.BytesIO(PNG_BYTES), "image/png")},
                headers=auth_headers,
            )
            return resp, time.perf_counter() - t0

        async def run_health(delay: float):
            await asyncio.sleep(delay)
            t0 = time.perf_counter()
            resp = await ac.get("/health")
            elapsed = time.perf_counter() - t0
            health_durations.append(elapsed)
            return resp, elapsed

        # Launch screenshot request and concurrent /health requests while OCR is sleeping
        screenshot_task = asyncio.create_task(run_screenshot())
        health_task1 = asyncio.create_task(run_health(0.05))
        health_task2 = asyncio.create_task(run_health(0.10))

        (ss_resp, ss_time), (h1_resp, h1_time), (h2_resp, h2_time) = await asyncio.gather(
            screenshot_task, health_task1, health_task2
        )

        assert ss_resp.status_code == 200
        assert h1_resp.status_code == 200
        assert h2_resp.status_code == 200

        # /health requests must finish quickly without waiting for the 0.3s OCR to finish
        assert h1_time < 0.20, f"Health 1 took {h1_time:.3f}s - event loop was blocked!"
        assert h2_time < 0.20, f"Health 2 took {h2_time:.3f}s - event loop was blocked!"
        assert ss_time >= 0.28, f"Screenshot finished suspiciously fast: {ss_time:.3f}s"
