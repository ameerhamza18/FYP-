"""Tests for production-readiness guarantees: probes, hardening headers,
SOC feed endpoint, and the fail-fast configuration guard."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import Settings, assert_production_ready  # noqa: E402


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


def test_admin_analyses_returns_paginated_envelope(client, admin_headers):
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