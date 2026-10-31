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


def _parse_env_line(line: str) -> tuple[str, str] | None:
    """Parse a single line from a .env file, handling comments and quotes safely."""
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        return None
    key, _, raw_value = line.partition("=")
    key = key.strip()
    if not key:
        return None

    raw_value = raw_value.strip()
    if raw_value.startswith('"'):
        end_idx = raw_value.find('"', 1)
        val = raw_value[1:end_idx] if end_idx != -1 else raw_value[1:]
    elif raw_value.startswith("'"):
        end_idx = raw_value.find("'", 1)
        val = raw_value[1:end_idx] if end_idx != -1 else raw_value[1:]
    else:
        val = raw_value.partition("#")[0].strip()

    return key, val


def resolve_dotenv_files() -> list[Path]:
    """Discover candidate .env file paths in priority order."""
    candidates: list[Path] = []

    explicit = os.environ.get("ENV_FILE") or os.environ.get("DOTENV_PATH")
    if explicit:
        candidates.append(Path(explicit).resolve())

    backend_env = Path(__file__).resolve().parents[1] / ".env"
    candidates.append(backend_env)

    repo_root_env = Path(__file__).resolve().parents[2] / ".env"
    candidates.append(repo_root_env)

    cwd_env = Path.cwd().resolve() / ".env"
    candidates.append(cwd_env)

    existing: list[Path] = []
    seen = set()
    for p in candidates:
        try:
            resolved = p.resolve()
            if resolved not in seen and resolved.is_file():
                seen.add(resolved)
                existing.append(resolved)
        except OSError:
            continue
    return existing


def _load_dotenv() -> None:
    """Load configuration from .env files without overwriting os.environ."""
    for env_file in resolve_dotenv_files():
        try:
            content = env_file.read_text(encoding="utf-8")
        except OSError:
            continue
        for line in content.splitlines():
            parsed = _parse_env_line(line)
            if parsed is not None:
                key, value = parsed
                os.environ.setdefault(key, value)


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


def _env_float(key: str, default: float) -> float:
    try:
        return float(os.environ.get(key, default))
    except (TypeError, ValueError):
        return default


@dataclass(frozen=True)
class Settings:
    """Immutable application settings."""

    app_name: str = field(default_factory=lambda: _env("APP_NAME", "TrustLayer API"))
    app_env: str = field(default_factory=lambda: _env("APP_ENV", "development"))
    debug: bool = field(default_factory=lambda: _env_bool("DEBUG", True))

    # --- Security / secrets ---
    secret_key: str = field(
        default_factory=lambda: _env("SECRET_KEY") or secrets.token_urlsafe(48),
        repr=False,
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
            o.strip()
            for o in _env(
                "CORS_ORIGINS",
                "http://localhost:3000,http://127.0.0.1:3000,http://localhost:8080,http://127.0.0.1:8080,http://localhost:3001,http://127.0.0.1:3001",
            ).split(",")
            if o.strip()
        ]
    )

    # --- Rate limiting (Token Bucket — NFR-03) ---
    rate_limit_enabled: bool = field(
        default_factory=lambda: _env_bool("RATE_LIMIT_ENABLED", True)
    )
    rate_limit_analyze_per_minute: int = field(
        default_factory=lambda: _env_int("RATE_LIMIT_ANALYZE_PER_MINUTE", 10)
    )
    rate_limit_default_per_minute: int = field(
        default_factory=lambda: _env_int("RATE_LIMIT_DEFAULT_PER_MINUTE", 60)
    )

    # --- Uploads (FR-01) ---
    max_upload_size_mb: int = field(
        default_factory=lambda: _env_int("MAX_UPLOAD_SIZE_MB", 8)
    )

    # --- LLM (Google Gemini — NFR-01 <= 2.5s budget) ---
    gemini_api_key: str = field(
        default_factory=lambda: _env("GEMINI_API_KEY") or _env("GOOGLE_API_KEY", ""),
        repr=False,
    )
    gemini_base_url: str = field(
        default_factory=lambda: _env(
            "GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta"
        )
    )
    gemini_model: str = field(
        default_factory=lambda: _env("GEMINI_MODEL", "gemini-1.5-flash")
    )
    llm_timeout_seconds: float = field(
        default_factory=lambda: _env_float("LLM_TIMEOUT_SECONDS", 2.0)
    )

    # Backwards-compatibility aliases (deprecated)
    openai_api_key: str = field(default_factory=lambda: _env("OPENAI_API_KEY", ""), repr=False)
    openai_base_url: str = field(
        default_factory=lambda: _env("OPENAI_BASE_URL", "https://api.openai.com/v1")
    )
    openai_model: str = field(default_factory=lambda: _env("OPENAI_MODEL", "gpt-4o-mini"))

    # --- Admin bootstrap ---
    admin_email: str = field(
        default_factory=lambda: _env("ADMIN_EMAIL", "admin@trustlayer.com")
    )
    admin_password: str = field(
        default_factory=lambda: _env("ADMIN_PASSWORD", "Admin@12345"),
        repr=False,
    )

    # --- Encryption at rest & Zero-Storage Data Minimisation (NFR-02 & FR-10) ---
    field_encryption_key: str = field(
        default_factory=lambda: _env("FIELD_ENCRYPTION_KEY", ""),
        repr=False,
    )
    field_encryption_key_old: str = field(
        default_factory=lambda: _env("FIELD_ENCRYPTION_KEY_OLD", ""),
        repr=False,
    )
    zero_storage_mode: bool = field(
        default_factory=lambda: _env_bool("ZERO_STORAGE_MODE", True)
    )
    audit_log_append_only: bool = field(
        default_factory=lambda: _env_bool("AUDIT_LOG_APPEND_ONLY", True)
    )

    def __repr__(self) -> str:
        """Safe representation masking sensitive credentials."""
        secret_mask = "***" if self.secret_key else ""
        admin_pw_mask = "***" if self.admin_password else ""
        gemini_mask = "***" if self.gemini_api_key else ""
        openai_mask = "***" if self.openai_api_key else ""
        field_enc_mask = "***" if self.field_encryption_key else ""
        return (
            f"Settings("
            f"app_name={self.app_name!r}, "
            f"app_env={self.app_env!r}, "
            f"debug={self.debug!r}, "
            f"secret_key={secret_mask!r}, "
            f"database_url={self.database_url!r}, "
            f"admin_email={self.admin_email!r}, "
            f"admin_password={admin_pw_mask!r}, "
            f"gemini_api_key={gemini_mask!r}, "
            f"openai_api_key={openai_mask!r}, "
            f"field_encryption_key={field_enc_mask!r})"
        )

    def to_safe_dict(self) -> dict:
        """Return non-sensitive configuration parameters for logging/diagnostics."""
        return {
            "app_name": self.app_name,
            "app_env": self.app_env,
            "debug": self.debug,
            "database_url": self.database_url,
            "rate_limit_enabled": self.rate_limit_enabled,
            "zero_storage_mode": self.zero_storage_mode,
            "audit_log_append_only": self.audit_log_append_only,
            "retention_analysis_days": self.retention_analysis_days,
            "retention_audit_days": self.retention_audit_days,
            "max_upload_size_mb": self.max_upload_size_mb,
            "is_production": self.is_production,
        }

    # --- Data retention (storage limitation / GDPR-PDPA) ---
    retention_analysis_days: int = field(
        default_factory=lambda: _env_int("RETENTION_ANALYSIS_DAYS", 90)
    )
    retention_audit_days: int = field(
        default_factory=lambda: _env_int("RETENTION_AUDIT_DAYS", 365)
    )

    # --- Login lockout (per-account brute-force backoff) ---
    login_max_failures: int = field(
        default_factory=lambda: _env_int("LOGIN_MAX_FAILURES", 5)
    )
    login_lockout_seconds: int = field(
        default_factory=lambda: _env_int("LOGIN_LOCKOUT_SECONDS", 900)
    )

    # --- Distributed rate limiting (optional; memory backend when unset) ---
    redis_url: str = field(default_factory=lambda: _env("REDIS_URL", ""))

    # --- Error tracking (optional) ---
    sentry_dsn: str = field(default_factory=lambda: _env("SENTRY_DSN", ""))
    sentry_traces_sample_rate: float = field(
        default_factory=lambda: _env_float("SENTRY_TRACES_SAMPLE_RATE", 0.0)
    )

    # --- Campaign webhook alert ---
    campaign_webhook_url: str = field(
        default_factory=lambda: _env("CAMPAIGN_WEBHOOK_URL", "")
    )
    campaign_webhook_include_snippet: bool = field(
        default_factory=lambda: _env_bool("CAMPAIGN_WEBHOOK_INCLUDE_SNIPPET", False)
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
_INSECURE_SECRET_KEYS = {
    "", "change-me-in-production", "changeme", "secret", "dev", "test",
    "test-secret-key-not-for-production", "your-secret-key",
}
_INSECURE_ADMIN_PASSWORDS = {
    "", "admin", "admin123", "admin@12345", "password", "passw0rd123",
    "changeme", "change-me-in-production",
}


def assert_production_ready(settings: Settings) -> None:
    """Fail fast when a production deployment is insecurely configured."""
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

    if not settings.field_encryption_key:
        problems.append(
            "FIELD_ENCRYPTION_KEY must be set (generate with: "
            "python -m app.scripts.generate_key). It protects stored message "
            "content; losing it makes existing rows unreadable."
        )
    else:
        try:
            from app.security.crypto import validate_key_material

            validate_key_material(settings.field_encryption_key,
                                  settings.field_encryption_key_old)
        except ValueError as exc:
            problems.append(f"FIELD_ENCRYPTION_KEY is unusable: {exc}")

    if settings.retention_analysis_days <= 0 or settings.retention_audit_days <= 0:
        problems.append(
            "RETENTION_ANALYSIS_DAYS and RETENTION_AUDIT_DAYS must be positive "
            "so stored personal data is actually expired."
        )

    if settings.campaign_webhook_url and not settings.campaign_webhook_url.startswith("https://"):
        problems.append("CAMPAIGN_WEBHOOK_URL must use HTTPS (it leaves the deployment).")

    if settings.sentry_dsn and not settings.sentry_dsn.startswith("https://"):
        problems.append("SENTRY_DSN must use HTTPS.")

    if problems:
        raise RuntimeError(
            "Refusing to start: insecure production configuration.\n  - "
            + "\n  - ".join(problems)
            + "\nSee .env.example for the required variables."
        )
