"""Tests for production-readiness guarantees: probes, hardening headers,
SOC feed endpoint, fail-fast configuration guard, per-account login lockout,
idempotent analysis requests (client_request_id), key generator script,
Sentry telemetry initialization, and automated retention worker."""
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import Settings, assert_production_ready  # noqa: E402
from app.main import _run_retention_once, init_sentry  # noqa: E402
from app.scripts.generate_key import generate_keys  # noqa: E402
from app.security.auth import reset_login_lockouts  # noqa: E402
from app.security.crypto import validate_key_material  # noqa: E402


# ------------------------------------------------------------------ probes
def test_health_is_liveness_only(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_ready_verifies_database(client):
    r = client.get("/ready")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ready"
    assert body["database"] == "ok"


def test_root_responds(client):
    """The root route must not 500 when the legacy static asset is absent."""
    assert client.get("/").status_code == 200


# ------------------------------------------------------ hardening headers
def test_security_headers_present(client):
    r = client.get("/health")
    assert r.headers["X-Content-Type-Options"] == "nosniff"
    assert r.headers["X-Frame-Options"] == "DENY"
    assert r.headers["Referrer-Policy"] == "no-referrer"


# ------------------------------------------------------------- SOC feed
def test_admin_analyses_requires_auth(client):
    assert client.get("/api/admin/analyses").status_code == 401


def test_admin_analyses_forbidden_for_user(client, user_headers):
    assert client.get("/api/admin/analyses", headers=user_headers).status_code == 403


def test_admin_analyses_returns_paginated_envelope(client, user_headers, admin_headers):
    client.post(
        "/api/analyze/text",
        json={"text": "Urgent: verify account at http://evil-bank-verify.xyz", "source": "sms"},
        headers=user_headers,
    )
    r = client.get("/api/admin/analyses?limit=5", headers=admin_headers)
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"total", "limit", "offset", "items"}
    assert body["limit"] == 5
    assert body["offset"] == 0
    assert body["total"] >= 1
    assert len(body["items"]) <= 5

    first = body["items"][0]
    # Row shape required by the SOC table (owner email is joined in).
    for field in ("id", "user_id", "user_email", "input_type", "risk_score",
                  "risk_level", "threat_type", "campaign_flagged",
                  "content_snippet", "created_at"):
        assert field in first, f"missing {field}"
    assert "@" in first["user_email"]


def test_admin_analyses_filters_by_risk_level(client, admin_headers):
    r = client.get("/api/admin/analyses?risk_level=HIGH&limit=50", headers=admin_headers)
    assert r.status_code == 200
    assert all(i["risk_level"] == "HIGH" for i in r.json()["items"])


def test_admin_analyses_filter_by_input_type(client, admin_headers):
    r = client.get("/api/admin/analyses?input_type=text&limit=50", headers=admin_headers)
    assert r.status_code == 200
    assert all(i["input_type"] == "text" for i in r.json()["items"])


def test_admin_analyses_ignores_unknown_filters(client, admin_headers):
    """Unknown filter values must be ignored, never interpolated into SQL."""
    r = client.get("/api/admin/analyses?risk_level=BOGUS&limit=1", headers=admin_headers)
    assert r.status_code == 200


def test_admin_analyses_clamps_limit(client, admin_headers):
    r = client.get("/api/admin/analyses?limit=9999", headers=admin_headers)
    assert r.status_code == 200 and r.json()["limit"] == 200


# ------------------------------------------------- configuration guard
def _settings(**overrides) -> Settings:
    base = dict(
        app_name="TrustLayer API",
        app_env="production",
        debug=False,
        secret_key="a" * 64,
        field_encryption_key="k3Zf84pZ1L0v9X1Y2Z3A4B5C6D7E8F9G0H1I2J3K4L5=",
        database_url="postgresql://user:pw@db:5432/trustlayer",
        cors_origins=["http://localhost:3000"],
        rate_limit_enabled=True,
        admin_email="admin@trustlayer.com",
        admin_password="Str0ng-Unique-Passphrase-2026",
    )
    base.update(overrides)
    return Settings(**base)


def test_guard_accepts_secure_production_config():
    assert_production_ready(_settings())  # must not raise


def test_guard_is_skipped_outside_production():
    assert_production_ready(_settings(app_env="development", secret_key="weak",
                                      admin_password="weak"))  # must not raise


@pytest.mark.parametrize("overrides", [
    {"secret_key": "short"},
    {"secret_key": "change-me-in-production"},
    {"admin_password": "Admin@12345"},
    {"admin_password": "short1"},
    {"database_url": "sqlite:///./dev.db"},
    {"cors_origins": ["*"]},
    {"debug": True},
    {"rate_limit_enabled": False},
])
def test_guard_rejects_insecure_production_config(overrides):
    with pytest.raises(RuntimeError, match="insecure production configuration"):
        assert_production_ready(_settings(**overrides))


# -------------------------------------- per-account login lockout
def test_per_account_login_lockout_and_reset(client):
    reset_login_lockouts()
    email = "lockout_target@example.com"
    client.post("/api/auth/register", json={"email": email, "password": "ValidPassword123"})

    # 5 failed attempts return 401 and trigger account lockout on the 5th failure
    for _ in range(5):
        r = client.post("/api/auth/login", json={"email": email, "password": "WrongPassword999"})
        assert r.status_code == 401

    # 6th attempt is blocked with 429 Too Many Requests + Retry-After header
    r_locked = client.post("/api/auth/login", json={"email": email, "password": "ValidPassword123"})
    assert r_locked.status_code == 429
    assert "Retry-After" in r_locked.headers
    assert "locked" in r_locked.json()["detail"].lower()

    # Resetting lockouts allows valid sign-in again
    reset_login_lockouts()
    r_ok = client.post("/api/auth/login", json={"email": email, "password": "ValidPassword123"})
    assert r_ok.status_code == 200


# -------------------------------------- idempotent client_request_id
def test_analyze_text_idempotency_with_client_request_id(client, user_headers):
    req_id = "mobile-retry-idemp-001"
    payload = {
        "text": "Urgent: Your bank account will be suspended. Click http://verify-bank-now.xyz",
        "source": "sms",
        "client_request_id": req_id,
    }
    r1 = client.post("/api/analyze/text", json=payload, headers=user_headers)
    assert r1.status_code == 200
    first_body = r1.json()
    assert first_body["client_request_id"] == req_id

    # Retry with the exact same client_request_id must return the same analysis ID
    r2 = client.post("/api/analyze/text", json=payload, headers=user_headers)
    assert r2.status_code == 200
    second_body = r2.json()
    assert second_body["id"] == first_body["id"]
    assert second_body["client_request_id"] == req_id


def test_analyze_url_idempotency_via_header(client, user_headers):
    req_id = "header-idemp-url-002"
    headers = {**user_headers, "X-Client-Request-ID": req_id}
    r1 = client.post("/api/analyze/url", json={"url": "http://login-update-alert.xyz"}, headers=headers)
    assert r1.status_code == 200
    r2 = client.post("/api/analyze/url", json={"url": "http://login-update-alert.xyz"}, headers=headers)
    assert r2.status_code == 200
    assert r1.json()["id"] == r2.json()["id"]


# -------------------------------------- key generator & Sentry/retention helpers
def test_generate_key_script_produces_valid_keys():
    keys = generate_keys()
    assert len(keys["SECRET_KEY"]) >= 48
    validated = validate_key_material(keys["FIELD_ENCRYPTION_KEY"])
    assert validated == [keys["FIELD_ENCRYPTION_KEY"]]


def test_sentry_init_and_retention_worker():
    from types import SimpleNamespace
    from unittest.mock import MagicMock

    # Without DSN, init_sentry is a no-op returning False
    assert init_sentry(_settings(sentry_dsn="")) is False

    # With DSN configured, sentry_sdk.init is invoked (even when sentry_sdk is lazy-loaded)
    fake_sentry = SimpleNamespace(init=MagicMock())
    with patch.dict(sys.modules, {"sentry_sdk": fake_sentry}):
        assert init_sentry(_settings(sentry_dsn="https://public@sentry.example.com/1")) is True
        fake_sentry.init.assert_called_once()

    # Retention helper executes cleanly against the active DB
    res = _run_retention_once()
    assert res["status"] == "success"
