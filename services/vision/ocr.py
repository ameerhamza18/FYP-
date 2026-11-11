"""OCR service for screenshot analysis.

Uses Tesseract (via pytesseract) over an in-memory image. The uploaded bytes
never touch disk (malware-safe file handling). Supports bilingual English + Urdu
(`eng+urd`) extraction when the Urdu language pack (`tesseract-ocr-urd`) is
installed, falling back automatically to `eng`. If Tesseract is not available
the caller receives a structured error and the API responds with 503 so the
client can fall back to text input.
"""
import io
import logging
from functools import lru_cache
from typing import Optional

logger = logging.getLogger("trustlayer.vision.ocr")


class OCRUnavailableError(RuntimeError):
    """Raised when Tesseract/the OCR stack is not installed."""


def ocr_available() -> bool:
    try:
        import pytesseract

        pytesseract.get_tesseract_version()
        return True
    except Exception:  # noqa: BLE001
        return False


@lru_cache(maxsize=4)
def _resolve_ocr_lang(requested_lang: str = "eng") -> str:
    """Resolve the best available Tesseract language pack (auto-enabling `eng+urd` when present)."""
    try:
        import pytesseract

        installed = set(pytesseract.get_languages(config=""))
        if requested_lang in ("eng", "auto", "eng+urd"):
            if "eng" in installed and "urd" in installed:
                return "eng+urd"
            if "eng" in installed:
                return "eng"
        return requested_lang
    except Exception:  # noqa: BLE001
        return "eng"


def extract_text(image_bytes: bytes, lang: str = "eng") -> Optional[str]:
    """Run OCR over raw image bytes in RAM and return extracted text."""
    try:
        from PIL import Image
        import pytesseract
    except ImportError as exc:
        raise OCRUnavailableError(f"OCR dependencies missing: {exc}") from exc

    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("L")
    except Exception as exc:  # noqa: BLE001
        raise ValueError(f"Could not decode image: {exc}") from exc

    effective_lang = _resolve_ocr_lang(lang)
    try:
        text = pytesseract.image_to_string(image, lang=effective_lang)
    except pytesseract.TesseractNotFoundError as exc:
        raise OCRUnavailableError("Tesseract binary is not installed") from exc
    except Exception:
        # Graceful fallback to English-only if a secondary language pack fails
        if effective_lang != "eng":
            text = pytesseract.image_to_string(image, lang="eng")
        else:
            raise

    cleaned = " ".join((text or "").split())
    logger.info("OCR extracted %d characters (lang=%s)", len(cleaned), effective_lang)
    return cleaned if cleaned else None


async def async_extract_text(image_bytes: bytes, lang: str = "eng") -> Optional[str]:
    """Run OCR over raw image bytes in a worker thread to avoid blocking the event loop."""
    from starlette.concurrency import run_in_threadpool
    return await run_in_threadpool(extract_text, image_bytes, lang=lang)
