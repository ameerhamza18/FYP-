"""OCR service for screenshot analysis.

Uses Tesseract (via pytesseract) over an in-memory image. The uploaded bytes
never touch disk (malware-safe file handling). If Tesseract is not available
the caller receives a structured error and the API responds with 503 so the
client can fall back to text input.
"""
import io
import logging
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


def extract_text(image_bytes: bytes, lang: str = "eng") -> Optional[str]:
    """Run OCR over raw image bytes and return extracted text."""
    try:
        from PIL import Image
        import pytesseract
    except ImportError as exc:
        raise OCRUnavailableError(f"OCR dependencies missing: {exc}") from exc

    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("L")
    except Exception as exc:  # noqa: BLE001
        raise ValueError(f"Could not decode image: {exc}") from exc

    try:
        text = pytesseract.image_to_string(image, lang=lang)
    except pytesseract.TesseractNotFoundError as exc:
        raise OCRUnavailableError("Tesseract binary is not installed") from exc

    cleaned = " ".join((text or "").split())
    logger.info("OCR extracted %d characters", len(cleaned))
    return cleaned if cleaned else None
