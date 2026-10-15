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
RIFF_MAGIC = b"RIFF"
WEBP_MAGIC = b"WEBP"
WEBP_CHUNK_TYPES = (b"VP8 ", b"VP8L", b"VP8X")

CSV_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def sanitize_csv_cell(value: object) -> object:
    """Safely sanitize a cell value to prevent CSV formula injection (CSV injection).

    If the value is a string beginning with any spreadsheet formula trigger character
    (=, +, -, @, tab, or carriage return), either directly or after leading whitespace,
    prepend a single quote (') to force spreadsheet applications (Excel, Calc, Sheets)
    to treat it as plain text instead of executing it as a formula or command.
    Non-string values or safe strings are returned unmodified.
    """
    if value is None:
        return ""
    if isinstance(value, str):
        stripped = value.lstrip(" ")
        if value.startswith(CSV_FORMULA_PREFIXES) or (stripped and stripped.startswith(CSV_FORMULA_PREFIXES)):
            return f"'{value}"
    return value


def sanitize_csv_row(row: object) -> list:
    """Sanitize all values in a CSV row or sequence to prevent formula injection."""
    return [sanitize_csv_cell(cell) for cell in row]


def is_valid_webp(data: bytes) -> bool:
    """Validate WebP file signature and internal structure.

    A valid WebP container has:
    - Bytes 0..3: 'RIFF'
    - Bytes 4..7: 32-bit little-endian size of file minus 8 bytes
    - Bytes 8..11: 'WEBP'
    - Bytes 12..15: FourCC chunk type ('VP8 ', 'VP8L', or 'VP8X')
    - Bytes 16..19: 32-bit little-endian chunk size

    Rejects non-RIFF, non-WEBP, truncated files, invalid chunk types,
    and size inconsistencies.
    """
    if len(data) < 16:
        return False
    if not data.startswith(RIFF_MAGIC) or data[8:12] != WEBP_MAGIC:
        return False

    chunk_type = data[12:16]
    if chunk_type not in WEBP_CHUNK_TYPES:
        return False

    riff_size = int.from_bytes(data[4:8], byteorder="little", signed=False)
    # The minimum RIFF size for a valid WebP is 12 (4 bytes 'WEBP' + 8 bytes chunk header)
    if riff_size < 12:
        return False

    # Check for truncated file (must contain at least riff_size + 8 bytes)
    if len(data) < riff_size + 8:
        return False

    if len(data) >= 20:
        chunk_size = int.from_bytes(data[16:20], byteorder="little", signed=False)
        # Chunk payload cannot exceed available RIFF payload
        if chunk_size > riff_size - 12:
            return False

    # Bitstream integrity check with Pillow if available
    try:
        from PIL import Image

        with Image.open(io.BytesIO(data)) as img:
            img.verify()
            if img.format != "WEBP":
                return False
    except ImportError:
        pass
    except Exception:
        return False

    return True


def validate_image_bytes(data: bytes) -> str:
    """Validate image magic bytes, signatures, and structure.

    Returns detected format ('png', 'jpeg', or 'webp') on success.
    Raises ValueError with a descriptive message if unsupported or malformed.
    """
    if not data:
        raise ValueError("Image payload is empty")

    if data.startswith(PNG_MAGIC):
        return "png"

    if data.startswith(JPEG_MAGIC):
        return "jpeg"

    if is_valid_webp(data):
        return "webp"

    raise ValueError("Unsupported or malformed image: only PNG, JPEG, and WebP are accepted")


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

    try:
        validate_image_bytes(data)
    except ValueError:
        raise HTTPException(
            status_code=415,
            detail="Unsupported or malformed image: only PNG, JPEG, and WebP are accepted",
        )
    return data


def check_sql_injection_patterns(value: str) -> bool:
    """Heuristic detector used by the security-test suite, not a security control."""
    patterns = ("'; --", "' or '1'='1", "union select", "drop table", "1=1--")
    lowered = value.lower()
    return any(p in lowered for p in patterns)
