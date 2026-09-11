"""Integration tests: full API security + functionality."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from conftest import HAM_MSG, SCAM_MSG


# ------------------------------------------------------------------ auth
def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"


def test_register_login_me(client):
    r = client.post("/api/auth/register",
                    json={"email": "authflow@example.com", "password": "Passw0rd123"})
    assert r.status_code == 201
    r = client.post("/api/auth/login",
                    json={"email": "authflow@example.com", "password": "Passw0rd123"})
    assert r.status_code == 200
    token = r.json()["access_token"]
    r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200 and r.json()["email"] == "authflow@example.com"


def test_duplicate_register_rejected(client):
    client.post("/api/auth/register", json={"email": "dup@example.com", "password": "Passw0rd123"})
    r = client.post("/api/auth/register", json={"email": "dup@example.com", "password": "Passw0rd123"})
    assert r.status_code == 409


def test_weak_password_rejected(client):
    r = client.post("/api/auth/register", json={"email": "weak@example.com", "password": "abc12345"})
    assert r.status_code == 422


def test_invalid_token_rejected(client):
    r = client.get("/api/auth/me", headers={"Authorization": "Bearer not.a.jwt"})
    assert r.status_code == 401


def test_missing_token_rejected(client):
    assert client.get("/api/analyze/history").status_code == 401


def test_wrong_password_rejected(client):
    r = client.post("/api/auth/login", json={"email": "authflow@example.com", "password": "WrongPass1"})
    assert r.status_code == 401


# ------------------------------------------------------------------ analysis
def test_analyze_scam_text(client, user_headers):
    r = client.post("/api/analyze/text", json={"text": SCAM_MSG, "source": "sms"},
                    headers=user_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["risk_score"] >= 60
    assert body["risk_level"] in ("HIGH", "CRITICAL")
    assert body["indicators"], "expected indicators"
    assert body["se_techniques"], "expected SE techniques"
    assert "Why this is risky" in body["explanation"]
    assert body["recommendation"]


def test_analyze_ham_text(client, user_headers):
    r = client.post("/api/analyze/text", json={"text": HAM_MSG, "source": "sms"},
                    headers=user_headers)
    body = r.json()
    assert body["risk_score"] < 30
    assert body["risk_level"] == "LOW"


def test_analyze_url(client, user_headers):
    r = client.post("/api/analyze/url",
                    json={"url": "http://prize-claim-center.tk/claim?user=1"},
                    headers=user_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["url_score"] is not None and body["url_score"] > 0
    assert any(i["category"] == "URL" for i in body["indicators"])


def test_empty_text_rejected(client, user_headers):
    r = client.post("/api/analyze/text", json={"text": "   "}, headers=user_headers)
    assert r.status_code == 422


def test_oversized_text_rejected(client, user_headers):
    r = client.post("/api/analyze/text", json={"text": "a" * 20000}, headers=user_headers)
    assert r.status_code == 422


def test_history_returns_own_analyses(client, user_headers):
    r = client.get("/api/analyze/history", headers=user_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list) and len(r.json()) >= 1


# ------------------------------------------------------------------ BOLA (API1)
def test_object_level_authorization(client, user_headers, user2_headers):
    created = client.post("/api/analyze/text", json={"text": SCAM_MSG},
                          headers=user_headers).json()
    r = client.get(f"/api/analyze/{created['id']}", headers=user2_headers)
    assert r.status_code == 403
    r = client.get(f"/api/analyze/{created['id']}", headers=user_headers)
    assert r.status_code == 200


# ------------------------------------------------------------------ RBAC (API5)
def test_admin_stats_forbidden_for_user(client, user_headers):
    assert client.get("/api/admin/stats", headers=user_headers).status_code == 403


def test_admin_stats_ok_for_admin(client, admin_headers):
    r = client.get("/api/admin/stats", headers=admin_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["total_analyses"] >= 1
    assert body["high_risk"] >= 1
    assert "threat_trend" in body and "top_techniques" in body


def test_admin_campaigns(client, admin_headers):
    r = client.get("/api/admin/campaigns", headers=admin_headers)
    assert r.status_code == 200


def test_admin_audit_logs(client, admin_headers):
    r = client.get("/api/admin/audit-logs", headers=admin_headers)
    assert r.status_code == 200
    actions = [l["action"] for l in r.json()]
    assert "LOGIN" in actions or "ANALYZE" in actions


# ------------------------------------------------------------------ SQLi hygiene (API3)
def test_sqli_payload_does_not_crash(client, user_headers):
    r = client.post("/api/analyze/text",
                    json={"text": "'; DROP TABLE users; -- ' OR '1'='1"},
                    headers=user_headers)
    assert r.status_code == 200  # treated as content, not executed
    assert client.get("/health").status_code == 200

