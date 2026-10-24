"""Cryptographic key material generator for TrustLayer production deployments.

Usage:
    python -m app.scripts.generate_key

Outputs a fresh URL-safe ``SECRET_KEY`` (for JWT signing) and a 44-character
Fernet ``FIELD_ENCRYPTION_KEY`` (for application-layer encryption at rest).
"""
import secrets

from cryptography.fernet import Fernet


def generate_keys() -> dict[str, str]:
    """Generate fresh production SECRET_KEY and FIELD_ENCRYPTION_KEY values."""
    return {
        "SECRET_KEY": secrets.token_urlsafe(48),
        "FIELD_ENCRYPTION_KEY": Fernet.generate_key().decode("ascii"),
    }


def main() -> None:
    keys = generate_keys()
    print("# TrustLayer Production Key Material — keep secret, never commit to git")
    print(f"SECRET_KEY={keys['SECRET_KEY']}")
    print(f"FIELD_ENCRYPTION_KEY={keys['FIELD_ENCRYPTION_KEY']}")


if __name__ == "__main__":
    main()
