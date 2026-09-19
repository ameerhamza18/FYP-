"""Central configuration and secrets management for TrustLayer.

All secrets are read from environment variables (12-factor style).
A `.env` file is loaded opportunistically for local development, but the
canonical source of truth in production MUST be the process environment
or a secrets manager (AWS Secrets Manager / Vault / Docker secrets).
"""
import os
import secrets
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path


def _load_dotenv() -> None:
    """Load a .env file if python-dotenv is available (dev convenience only)."""
    env_file = Path(__file__).resolve().parents[1] / ".env"
    if not env_file.exists():
        return
    try:
        for raw in env_file.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())
    except OSError:
        pass


_load_dotenv()


def _env(key: str, default: str = "") -> str:
    return os.environ.get(key, default)


def _env_int(key: str, default: int) -> int:
    try:
        return int(os.environ.get(key, default))
    except (TypeError, ValueError):
        return default


def _env_bool(key: str, default: bool) -> bool:
    return os.environ.get(key, str(default)).strip().lower() in ("1", "true", "yes", "on")


@dataclass(frozen=True)
class Settings:
    """Immutable application settings."""

    app_name: str = field(default_factory=lambda: _env("APP_NAME", "TrustLayer API"))
    app_env: str = field(default_factory=lambda: _env("APP_ENV", "development"))
    debug: bool = field(default_factory=lambda: _env_bool("DEBUG", True))

    # --- Security / secrets ---
    secret_key: str = field(
        default_factory=lambda: _env("SECRET_KEY") or secrets.token_urlsafe(48)
    )
    jwt_algorithm: str = field(default_factory=lambda: _env("JWT_ALGORITHM", "HS256"))
    access_token_expire_minutes: int = field(
        default_factory=lambda: _env_int("ACCESS_TOKEN_EXPIRE_MINUTES", 60)
    )

    # --- Database ---
    database_url: str = field(
        default_factory=lambda: _env("DATABASE_URL", "sqlite:///./trustlayer.db")
    )

    # --- CORS ---
    cors_origins: list = field(
        default_factory=lambda: [
            o.strip() for o in _env("CORS_ORIGINS", "http://localhost:3000,http://localhost:8080").split(",") if o.strip()
        ]
    )

    # --- Rate limiting ---
    rate_limit_enabled: bool = field(
        default_factory=lambda: _env_bool("RATE_LIMIT_ENABLED", True)
    )
    rate_limit_analyze_per_minute: int = field(
        default_factory=lambda: _env_int("RATE_LIMIT_ANALYZE_PER_MINUTE", 10)
    )
    rate_limit_default_per_minute: int = field(
        default_factory=lambda: _env_int("RATE_LIMIT_DEFAULT_PER_MINUTE", 60)
    )

    # --- Uploads ---
    max_upload_size_mb: int = field(
        default_factory=lambda: _env_int("MAX_UPLOAD_SIZE_MB", 8)
    )

    # --- LLM ---
    openai_api_key: str = field(default_factory=lambda: _env("OPENAI_API_KEY", ""))
    openai_base_url: str = field(
        default_factory=lambda: _env("OPENAI_BASE_URL", "https://api.openai.com/v1")
    )
    openai_model: str = field(default_factory=lambda: _env("OPENAI_MODEL", "gpt-4o-mini"))
    llm_timeout_seconds: int = field(
        default_factory=lambda: _env_int("LLM_TIMEOUT_SECONDS", 20)
    )

    # --- Admin bootstrap ---
    admin_email: str = field(
        default_factory=lambda: _env("ADMIN_EMAIL", "admin@trustlayer.com")
    )
    admin_password: str = field(
        default_factory=lambda: _env("ADMIN_PASSWORD", "Admin@12345")
    )

    # --- Campaign webhook alert ---
    campaign_webhook_url: str = field(
        default_factory=lambda: _env("CAMPAIGN_WEBHOOK_URL", "")
    )


    @property
    def max_upload_size_bytes(self) -> int:
        return self.max_upload_size_mb * 1024 * 1024

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached singleton Settings instance."""
    return Settings()


# ------------------------------------------------------- production readiness
# Values that must never reach a production deployment.
_INSECURE_SECRET_KEYS = {
    "", "change-me-in-production", "changeme", "secret", "dev", "test",
    "test-secret-key-not-for-production", "your-secret-key",
}
_INSECURE_ADMIN_PASSWORDS = {
    "", "admin", "admin123", "admin@12345", "password", "passw0rd123",
    "changeme", "change-me-in-production",
}


def assert_production_ready(settings: Settings) -> None:
    """Fail fast when a production deployment is insecurely configured.

    A misconfigured production stack is far more dangerous than one that
    refuses to boot, so this raises instead of merely logging a warning.
    Only enforced when APP_ENV=production; development and test are exempt.
    """
    if not settings.is_production:
        return

    problems: list[str] = []

    if not _env("SECRET_KEY"):
        problems.append(
            "SECRET_KEY must be set explicitly (the auto-generated fallback "
            "changes on every restart and invalidates all sessions)."
        )
    elif settings.secret_key.lower() in _INSECURE_SECRET_KEYS or len(settings.secret_key) < 32:
        problems.append("SECRET_KEY is a well-known/weak value or shorter than 32 characters.")

    if not _env("ADMIN_PASSWORD"):
        problems.append("ADMIN_PASSWORD must be set explicitly.")
    elif settings.admin_password.lower() in _INSECURE_ADMIN_PASSWORDS or len(settings.admin_password) < 12:
        problems.append("ADMIN_PASSWORD is a known default or shorter than 12 characters.")

    if settings.database_url.startswith("sqlite"):
        problems.append("DATABASE_URL must point at PostgreSQL in production (SQLite is development-only).")

    if "*" in settings.cors_origins:
        problems.append("CORS_ORIGINS must not contain '*' while credentials are enabled.")

    if settings.debug:
        problems.append("DEBUG must be false in production (it leaks stack traces).")

    if not settings.rate_limit_enabled:
        problems.append("RATE_LIMIT_ENABLED must stay on in production.")

    if problems:
        raise RuntimeError(
            "Refusing to start: insecure production configuration.\n  - "
            + "\n  - ".join(problems)
            + "\nSee .env.example for the required variables."
        )

