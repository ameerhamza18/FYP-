"""TrustLayer FastAPI application entrypoint.

Security posture (OWASP API Top 10 alignment):
- JWT authentication + RBAC on all /api routes
- Strict CORS allow-list
- Sliding-window rate limiting middleware
- Pydantic input validation everywhere
- Secure in-memory file upload handling
- Audit logging of security-relevant events
- Prompt-injection defenses + LLM output validation in the LLM channel
- Hardened response headers + fail-fast production configuration checks
"""
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.config import assert_production_ready, get_settings
from app.database import SessionLocal, init_db
from app.models import User
from app.routers import admin, analyze, auth
from app.security.auth import hash_password
from app.security.rate_limit import RateLimitMiddleware

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("trustlayer")
settings = get_settings()

# Absolute path so the app boots identically from any working directory
# (repo root, backend/, a container, or a test runner).
STATIC_DIR = Path(__file__).resolve().parent / "static"


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Startup/shutdown. Replaces the deprecated @app.on_event hooks."""
    assert_production_ready(settings)
    init_db()
    _bootstrap_admin()
    logger.info("TrustLayer API ready (env=%s)", settings.app_env)
    yield


app = FastAPI(
    title="TrustLayer API",
    description="AI-Powered Scam, Phishing & Social-Engineering Detection Platform",
    version="1.0.0",
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    lifespan=lifespan,
)

import uuid
from fastapi.responses import JSONResponse

# --- Middleware LIFO execution: RateLimitMiddleware first, then CORSMiddleware so CORS headers wrap 429s ---
app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)


@app.middleware("http")
async def request_id_and_security_headers(request: Request, call_next):
    """Attach correlation X-Request-ID and hardening headers to every response."""
    req_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    request.state.request_id = req_id

    try:
        response = await call_next(request)
    except Exception as exc:
        logger.exception("Unhandled error on %s %s [req_id=%s]: %s",
                         request.method, request.url.path, req_id, exc)
        if settings.is_production:
            response = JSONResponse(
                status_code=500,
                content={"detail": "An internal server error occurred.", "request_id": req_id},
            )
        else:
            raise

    response.headers["X-Request-ID"] = req_id
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
    response.headers.setdefault(
        "Content-Security-Policy",
        "default-src 'self'; style-src 'self' 'unsafe-inline' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; img-src 'self' data: blob: https:; font-src 'self' data: https:; connect-src 'self' http: https: ws: wss:"
    )
    if settings.is_production:
        response.headers.setdefault(
            "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
        )
    return response


# Legacy static dashboard assets are optional (the Next.js app is the UI).
if STATIC_DIR.is_dir():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

from app.routers import notifications

app.include_router(auth.router)
app.include_router(analyze.router)
app.include_router(admin.router)
app.include_router(notifications.router)


def _bootstrap_admin() -> None:

    """Create the admin account from configured bootstrap secrets (first run)."""
    db = SessionLocal()
    try:
        if not db.query(User).filter(User.role == "admin").first():
            db.add(User(email=settings.admin_email.lower(),
                        password_hash=hash_password(settings.admin_password),
                        role="admin"))
            db.commit()
            logger.info("Bootstrap admin created: %s", settings.admin_email)
    finally:
        db.close()


@app.get("/health", tags=["ops"])
def health():
    """Liveness probe: reports app state and ML model availability."""
    from services.nlp.classifier import get_classifier
    classifier = get_classifier()
    return {
        "status": "ok",
        "app": settings.app_name,
        "ml_model": "loaded" if classifier.available else "rules-only",
        "environment": settings.app_env,
    }


@app.get("/ready", tags=["ops"])
def ready():
    """Readiness probe: verifies the database is actually reachable."""
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001 - report, don't leak driver detail
        logger.error("Readiness check failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable",
        )
    finally:
        db.close()
    return {"status": "ready", "database": "ok", "environment": settings.app_env}


@app.get("/", include_in_schema=False)
def root():
    """Serve the legacy static dashboard when present, else a JSON pointer."""
    legacy = STATIC_DIR / "dashboard.html"
    if legacy.is_file():
        return FileResponse(legacy)
    return {"service": settings.app_name, "status": "ok", "docs": "/docs"}
