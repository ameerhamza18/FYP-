"""Application-layer field encryption — encryption at rest for free-text PII.

Why this exists
---------------
TrustLayer persists the content it analyses: message snippets, OCR output, the
textual evidence a social-engineering technique was spotted in. That content is
personal data — a scam SMS routinely carries names, card fragments, account
numbers and one-time passcodes. Disk-level encryption (EBS/KMS volumes, provider
"encryption at rest") protects a stolen disk, but *not* a database dump, a
copied backup, an over-broad ``SELECT``, or an operator with read access to a
replica. So the sensitive columns are encrypted here, in the application, before
the row is written: a raw dump of ``analyses.content_snippet`` yields ciphertext.

Design
------
* :class:`EncryptedText` is a SQLAlchemy ``TypeDecorator`` over ``Text``. The
  DDL is unchanged (the column stays ``TEXT``), so models gain encryption with
  no schema churn and reads/writes stay transparent to every caller.
* Fernet (AES-128-CBC + HMAC-SHA256, from ``cryptography``), with a version tag
  stored next to the ciphertext: ``enc:v1:<token>``.
* Primary + optional previous keys (``MultiFernet``) make rotation windowless:
  add the new key as primary, keep the old one in ``FIELD_ENCRYPTION_KEY_OLD``
  until the rows are rewritten, then drop it.
* A value with no ``enc:v1:`` prefix is returned unchanged, so rows written
  before encryption was introduced keep working. A value that *is* ciphertext
  but cannot be decrypted (key lost/rotated away) degrades to a redaction
  marker rather than raising — one unreadable row must never take down the
  analysis history or the SOC feed.

Key material
------------
``FIELD_ENCRYPTION_KEY`` is required when ``APP_ENV=production``
(:func:`app.config.assert_production_ready` enforces it). Outside production the
key is derived deterministically from ``SECRET_KEY`` so local development and
the test suite need no extra setup.

Generate a key::

    python -m app.scripts.generate_key
"""
import base64
import hashlib
import logging
from typing import List, Optional

from cryptography.fernet import Fernet, InvalidToken, MultiFernet
from sqlalchemy import Text
from sqlalchemy.types import TypeDecorator

logger = logging.getLogger("trustlayer.crypto")

#: Marker for values written by this module. Bumping it (enc:v2:) would let a
#: future key/cipher change be detected per-row instead of per-deployment.
PREFIX = "enc:v1:"

#: Returned when ciphertext exists but the key that produced it does not.
UNDECRYPTABLE = "[encrypted content unavailable]"

_KDF_SALT = b"trustlayer.field-encryption.v1"
_warned_about_derived_key = False
_fernet: Optional[MultiFernet] = None


# --------------------------------------------------------------------- keys
def derive_key_from_secret(secret: str) -> str:
    """Derive a deterministic Fernet key from ``SECRET_KEY`` (dev/test only)."""
    digest = hashlib.sha256(_KDF_SALT + secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii")


def split_keys(*values: str) -> List[str]:
    """Flatten comma-separated key lists, dropping blanks and duplicates."""
    keys: List[str] = []
    for value in values:
        for candidate in (value or "").split(","):
            candidate = candidate.strip()
            if candidate and candidate not in keys:
                keys.append(candidate)
    return keys


def validate_key_material(primary: str, previous: str = "") -> List[str]:
    """Return the usable key list, or raise ``ValueError`` explaining why not."""
    keys = split_keys(primary, previous)
    if not keys:
        raise ValueError("no key material configured")
    for key in keys:
        try:
            Fernet(key.encode("ascii"))
        except (ValueError, TypeError) as exc:
            raise ValueError(
                "field-encryption keys must be 44-character urlsafe-base64 "
                f"Fernet keys ({exc})"
            ) from exc
    return keys


def _build() -> MultiFernet:
    """Build the cipher from configured key material (primary first)."""
    from app.config import get_settings

    settings = get_settings()
    keys = split_keys(settings.field_encryption_key)
    if not keys:
        # Development/test convenience only; production is blocked by
        # assert_production_ready(), so this branch cannot be reached there.
        global _warned_about_derived_key
        keys = [derive_key_from_secret(settings.secret_key)]
        if not _warned_about_derived_key:
            _warned_about_derived_key = True
            logger.warning(
                "FIELD_ENCRYPTION_KEY is not set: deriving a field key from "
                "SECRET_KEY. Development only — production refuses to start "
                "without an explicit key."
            )
    keys += split_keys(settings.field_encryption_key_old)
    return MultiFernet([Fernet(k.encode("ascii")) for k in keys])


def get_fernet() -> MultiFernet:
    """Return the process-wide cipher (built once from the configured keys)."""
    global _fernet
    if _fernet is None:
        _fernet = _build()
    return _fernet


def reset_cache() -> None:
    """Drop the cached cipher (used by tests after changing key material)."""
    global _fernet
    _fernet = None


def is_encrypted(value: object) -> bool:
    """True when a stored value is ciphertext written by this module."""
    return isinstance(value, str) and value.startswith(PREFIX)


# ----------------------------------------------------------------- encrypt
def encrypt_text(value: Optional[str]) -> Optional[str]:
    """Encrypt a string; ``None``/empty/already-encrypted values pass through."""
    if value is None or value == "":
        return value
    if is_encrypted(value):  # idempotent: re-encrypting must not double-wrap
        return value
    token = get_fernet().encrypt(value.encode("utf-8")).decode("ascii")
    return PREFIX + token


def decrypt_text(value: Optional[str]) -> Optional[str]:
    """Decrypt a stored value, tolerating legacy plaintext and lost keys."""
    if value is None or value == "":
        return value
    if not is_encrypted(value):
        return value  # written before encryption existed
    token = value[len(PREFIX):]
    try:
        return get_fernet().decrypt(token.encode("ascii")).decode("utf-8")
    except InvalidToken:
        logger.warning(
            "Stored field could not be decrypted: it was written with a key "
            "that is no longer configured (put the old key in "
            "FIELD_ENCRYPTION_KEY_OLD to recover it)."
        )
        return UNDECRYPTABLE


class EncryptedText(TypeDecorator):
    """``Text`` column whose contents are Fernet-encrypted at the application."""

    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):  # noqa: D102 - SQLAlchemy hook
        if value is None:
            return None
        return encrypt_text(value if isinstance(value, str) else str(value))

    def process_result_value(self, value, dialect):  # noqa: D102
        if value is None:
            return None
        return decrypt_text(value)
