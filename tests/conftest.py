
"""Pytest configuration: sys.path bootstrap, isolated test DB, HTTP client."""
import os
import sys
import tempfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "backend"))

_TMP = tempfile.mkdtemp(prefix="trustlayer_test_")

# Configure environment BEFORE importing app modules (config is cached).
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP}/test.db"
os.environ["SECRET_KEY"] = "test-secret-key-not-for-production"
os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ["OPENAI_API_KEY"] = ""
os.environ["GEMINI_API_KEY"] = ""
os.environ["GOOGLE_API_KEY"] = ""
os.environ["ADMIN_EMAIL"] = "admin@trustlayer.com"
os.environ["ADMIN_PASSWORD"] = "Admin@12345"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


def _register_and_login(client: TestClient, email: str, password: str = "Passw0rd123") -> dict:
    client.post("/api/auth/register", json={"email": email, "password": password})
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def user_headers(client):
    return _register_and_login(client, "user1@example.com")


@pytest.fixture(scope="session")
def user2_headers(client):
    return _register_and_login(client, "user2@example.com")


@pytest.fixture(scope="session")
def admin_headers(client):
    return _register_and_login(client, "admin@trustlayer.com", "Admin@12345")


SCAM_MSG = (
    "Dear customer, your HBL account will be blocked within 24 hours. "
    "Verify immediately: http://verify-acct-alert.xyz/login — enter your password and OTP."
)
HAM_MSG = ("Hi, are we still meeting for lunch tomorrow? Let me know what time works for you.")
