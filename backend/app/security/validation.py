"""Input validation & secure file-upload handling.

- Text sanitization and length caps (OWASP API3/4)
- Magic-byte validation of uploaded images (malware-safe handling: the file is
  never executed, stored outside the web root is not required because OCR is
  performed in-memory and the bytes are discarded immediately)
"""
import io
import re
from typing import Optional, Tuple

from fastapi import HTTPException, UploadFile

CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")

PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
JPEG_MAGIC = b"\xff\xd8\xff"


def sanitize_text(value: str, max_length: int = 10000) -> str:
    value = CONTROL_CHARS_RE.sub(" ", value)
    return value[:max_length].strip()


def validate_text_payload(text: Optional[str]) -> str:
    if not text or not text.strip():
        raise HTTPException(status_code=422, detail="Text payload must not be empty")
    return sanitize_text(text)


async def validate_image_upload(upload: UploadFile, max_bytes: int) -> bytes:
    """Read, size-limit and magic-byte-check an uploaded screenshot.

    The image bytes are processed fully in memory and never written to disk,
    which removes entire classes of upload vulnerabilities (path traversal,
    stored-XSS via SVG, arbitrary file write, webshell persistence).
    """
    if upload.content_type and not upload.content_type.startswith("image/"):
        raise HTTPException(status_code=415, detail="Only image uploads are supported")

    buf = io.BytesIO()
    total = 0
    while chunk := await upload.read(65536):
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(status_code=413, detail="Uploaded file exceeds size limit")
        buf.write(chunk)
    data = buf.getvalue()

    if not (data.startswith(PNG_MAGIC) or data.startswith(JPEG_MAGIC)):
        raise HTTPException(
            status_code=415,
            detail="Unsupported or malformed image: only PNG and JPEG are accepted",
        )
    return data


def check_sql_injection_patterns(value: str) -> bool:
    """Heuristic detector used by the security-test suite, not a security control."""
    patterns = ("'; --", "' or '1'='1", "union select", "drop table", "1=1--")
    lowered = value.lower()
    return any(p in lowered for p in patterns)
