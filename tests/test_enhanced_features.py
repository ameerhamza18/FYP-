"""Tests for enhanced enterprise and production-readiness capabilities:
- User self-service password management
- In-app notification lifecycle & threat-triggered notifications
- Admin user controls (toggle status, change role, delete account, protections)
- Forensic incident report export
- Operational telemetry and metrics
- Request ID tracing propagation
"""
import pytest
from fastapi.testclient import TestClient

from app.database import Base, SessionLocal, engine
from app.main import app
from app.models import Analysis, Indicator, Notification, SEFinding, User


from conftest import _register_and_login


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield



def _auth_header(client: TestClient, email: str = "enhanced@test.com", password: str = "TestPass123") -> dict:
    return _register_and_login(client, email, password)


def _admin_header(client: TestClient) -> dict:
    # First try login; if not yet registered, register with role
    r = client.post("/api/auth/login", json={"email": "admin@trustlayer.com", "password": "Admin@12345"})
    if r.status_code == 200:
        return {"Authorization": f"Bearer {r.json()['access_token']}"}
    client.post("/api/auth/register", json={"email": "admin@trustlayer.com", "password": "Admin@12345"})
    db = SessionLocal()
    try:
        u = db.query(User).filter(User.email == "admin@trustlayer.com").first()
        if u:
            u.role = "admin"
            db.commit()
    finally:
        db.close()
    r = client.post("/api/auth/login", json={"email": "admin@trustlayer.com", "password": "Admin@12345"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}



def test_request_id_tracing():
    client = TestClient(app)
    # Provided header
    res = client.get("/health", headers={"X-Request-ID": "test-trace-999"})
    assert res.status_code == 200
    assert res.headers.get("X-Request-ID") == "test-trace-999"

    # Auto-generated header
    res2 = client.get("/health")
    assert res2.status_code == 200
    assert "X-Request-ID" in res2.headers
    assert len(res2.headers["X-Request-ID"]) > 10


def test_change_password_workflow():
    client = TestClient(app)
    headers = _auth_header(client, "pwdtest@test.com", "OldPassword123")

    # Incorrect current password rejected
    bad_res = client.post(
        "/api/auth/password",
        json={"old_password": "WrongPassword999", "new_password": "NewPassword123"},
        headers=headers,
    )
    assert bad_res.status_code == 400
    assert "Current password is incorrect" in bad_res.json()["detail"]

    # Weak new password rejected
    weak_res = client.post(
        "/api/auth/password",
        json={"old_password": "OldPassword123", "new_password": "weak"},
        headers=headers,
    )
    assert weak_res.status_code == 422

    # Successful change
    good_res = client.post(
        "/api/auth/password",
        json={"old_password": "OldPassword123", "new_password": "NewPassword123"},
        headers=headers,
    )
    assert good_res.status_code == 200
    assert good_res.json()["status"] == "success"

    # Verify old password no longer works
    fail_login = client.post("/api/auth/login", json={"email": "pwdtest@test.com", "password": "OldPassword123"})
    assert fail_login.status_code == 401

    # Verify new password works
    succ_login = client.post("/api/auth/login", json={"email": "pwdtest@test.com", "password": "NewPassword123"})
    assert succ_login.status_code == 200


def test_notifications_lifecycle():
    client = TestClient(app)
    headers = _auth_header(client, "notif@test.com", "NotifPass123")

    # Trigger an analysis that flags high risk
    res_scan = client.post(
        "/api/analyze/text",
        json={
            "text": "URGENT: Your bank account is suspended immediately. Confirm password at http://fake-login-bank.xyz",
            "source": "sms",
        },
        headers=headers,
    )
    assert res_scan.status_code == 200
    assert res_scan.json()["risk_level"] in ("HIGH", "CRITICAL")

    # Check unread count
    count_res = client.get("/api/notifications/unread-count", headers=headers)
    assert count_res.status_code == 200
    assert count_res.json()["unread_count"] >= 1

    # List notifications
    list_res = client.get("/api/notifications", headers=headers)
    assert list_res.status_code == 200
    notifications = list_res.json()
    assert len(notifications) >= 1
    target = notifications[0]
    assert "Threat Flagged" in target["title"] or "Risk" in target["title"]
    assert target["is_read"] is False

    # Mark as read
    read_res = client.patch(f"/api/notifications/{target['id']}/read", headers=headers)
    assert read_res.status_code == 200
    assert read_res.json()["is_read"] is True

    # Mark all read
    read_all = client.post("/api/notifications/read-all", headers=headers)
    assert read_all.status_code == 200

    # Delete notification
    del_res = client.delete(f"/api/notifications/{target['id']}", headers=headers)
    assert del_res.status_code == 200


def test_admin_user_management():
    client = TestClient(app)
    user_headers = _auth_header(client, "targetuser@test.com", "UserPass123")
    admin_headers = _admin_header(client)

    # Get user list
    users_res = client.get("/api/admin/users", headers=admin_headers)
    assert users_res.status_code == 200
    target_user = next((u for u in users_res.json() if u["email"] == "targetuser@test.com"), None)
    assert target_user is not None
    target_id = target_user["id"]

    # Admin deactivates user
    deact_res = client.patch(
        f"/api/admin/users/{target_id}/status",
        json={"is_active": False},
        headers=admin_headers,
    )
    assert deact_res.status_code == 200
    assert deact_res.json()["is_active"] is False

    # Deactivated user cannot log in
    blocked_login = client.post(
        "/api/auth/login",
        json={"email": "targetuser@test.com", "password": "UserPass123"},
    )
    assert blocked_login.status_code == 401

    # Admin re-activates user
    react_res = client.patch(
        f"/api/admin/users/{target_id}/status",
        json={"is_active": True},
        headers=admin_headers,
    )
    assert react_res.status_code == 200
    assert react_res.json()["is_active"] is True

    # Admin updates role
    role_res = client.patch(
        f"/api/admin/users/{target_id}/role",
        json={"role": "admin"},
        headers=admin_headers,
    )
    assert role_res.status_code == 200
    assert role_res.json()["role"] == "admin"

    # Admin self-deactivation protection
    admin_self = next(u for u in users_res.json() if u["email"] == "admin@trustlayer.com")
    self_block = client.patch(
        f"/api/admin/users/{admin_self['id']}/status",
        json={"is_active": False},
        headers=admin_headers,
    )
    assert self_block.status_code == 400
    assert "cannot deactivate their own" in self_block.json()["detail"]


def test_export_incident_report():
    client = TestClient(app)
    headers = _auth_header(client, "reporter@test.com", "ReportPass123")

    res = client.post(
        "/api/analyze/text",
        json={"text": "Exclusive gift reward! Claim $10,000 cash now at http://win-bonus.top", "source": "web"},
        headers=headers,
    )
    assert res.status_code == 200
    analysis_id = res.json()["id"]

    # Export report
    report_res = client.get(f"/api/analyze/{analysis_id}/export-report", headers=headers)
    assert report_res.status_code == 200
    data = report_res.json()

    assert data["report_id"].startswith("TL-IR-")
    assert "integrity_hash" in data
    assert bool(data["threat_assessment"]["threat_type"])
    assert "forensic_breakdown" in data
    assert "verdict_summary" in data
    assert "disclaimer" in data



def test_admin_metrics():
    client = TestClient(app)
    admin_headers = _admin_header(client)

    res = client.get("/api/admin/metrics", headers=admin_headers)
    assert res.status_code == 200
    metrics = res.json()
    assert metrics["status"] == "healthy"
    assert "performance" in metrics
    assert "ml_engine" in metrics
    assert "database" in metrics


def test_user_delete_me_cascade():
    client = TestClient(app)
    headers = _auth_header(client, "deleteme_cascade@test.com", "CascadePass123")

    # Perform analysis that triggers indicators and SE findings
    scam_text = (
        "Urgent: Your Meezan Bank account is suspended! Update details now at "
        "http://meezan-secure-update.com within 15 minutes or your account will be closed."
    )
    res = client.post(
        "/api/analyze/text",
        json={"text": scam_text, "source": "web"},
        headers=headers,
    )
    assert res.status_code == 200
    analysis_id = res.json()["id"]

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "deleteme_cascade@test.com").first()
        assert user is not None
        user_id = user.id

        # Verify analysis, indicator, and se_finding records exist
        analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
        assert analysis is not None
        assert len(analysis.indicators) > 0
        assert len(analysis.se_techniques) > 0

        # Create a notification for the user
        db.add(Notification(
            user_id=user_id,
            title="Security Alert",
            message="Test notification for cascade deletion",
            notification_type="alert",
        ))
        db.commit()

        notifs_before = db.query(Notification).filter(Notification.user_id == user_id).count()
        assert notifs_before >= 1
    finally:
        db.close()

    # User deletes their account
    del_res = client.delete("/api/auth/me", headers=headers)
    assert del_res.status_code == 200
    assert "permanently deleted" in del_res.json()["message"]

    # Verify all related records are cleanly deleted
    db = SessionLocal()
    try:
        assert db.query(User).filter(User.id == user_id).first() is None
        assert db.query(Analysis).filter(Analysis.user_id == user_id).count() == 0
        assert db.query(Indicator).filter(Indicator.analysis_id == analysis_id).count() == 0
        assert db.query(SEFinding).filter(SEFinding.analysis_id == analysis_id).count() == 0
        assert db.query(Notification).filter(Notification.user_id == user_id).count() == 0
    finally:
        db.close()


def test_admin_delete_user_cascade():
    client = TestClient(app)
    admin_headers = _admin_header(client)
    user_headers = _auth_header(client, "admin_delete_cascade@test.com", "CascadePass123")

    # Perform analysis that triggers indicators and SE findings
    scam_text = (
        "Police notice: Pay your pending fine immediately at http://police-fine-portal.xyz "
        "or face arrest within 24 hours."
    )
    res = client.post(
        "/api/analyze/text",
        json={"text": scam_text, "source": "web"},
        headers=user_headers,
    )
    assert res.status_code == 200
    analysis_id = res.json()["id"]

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "admin_delete_cascade@test.com").first()
        assert user is not None
        user_id = user.id

        # Verify analysis, indicator, and se_finding records exist
        analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
        assert analysis is not None
        assert len(analysis.indicators) > 0

        # Create a notification for the user
        db.add(Notification(
            user_id=user_id,
            title="Warning Notice",
            message="Test admin delete cascade notification",
            notification_type="alert",
        ))
        db.commit()
    finally:
        db.close()

    # Admin deletes the user
    del_res = client.delete(f"/api/admin/users/{user_id}", headers=admin_headers)
    assert del_res.status_code == 200
    assert "removed" in del_res.json()["message"]

    # Verify all related records are cleanly deleted
    db = SessionLocal()
    try:
        assert db.query(User).filter(User.id == user_id).first() is None
        assert db.query(Analysis).filter(Analysis.user_id == user_id).count() == 0
        assert db.query(Indicator).filter(Indicator.analysis_id == analysis_id).count() == 0
        assert db.query(SEFinding).filter(SEFinding.analysis_id == analysis_id).count() == 0
        assert db.query(Notification).filter(Notification.user_id == user_id).count() == 0
    finally:
        db.close()
