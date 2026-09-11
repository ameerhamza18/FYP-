"""TrustLayer FastAPI application entrypoint.

Security posture (OWASP API Top 10 alignment):
- JWT authentication + RBAC on all /api routes
- Strict CORS allow-list
- Sliding-window rate limiting middleware
- Pydantic input validation everywhere
- Secure in-memory file upload handling
- Audit logging of security-relevant events
- Prompt-injection defenses + LLM output validation in the LLM channel
"""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.database import init_db
from app.models import User
from app.routers import admin, analyze, auth
from app.security.auth import hash_password
from app.security.rate_limit import RateLimitMiddleware

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s %(levelname)s %(name)s: %(message)s")
settings = get_settings()

app = FastAPI(
    title="TrustLayer API",
    description="AI-Powered Scam, Phishing & Social-Engineering Detection Platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# --- CORS allow-list (never use '*' with credentials) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)
app.add_middleware(RateLimitMiddleware)

app.mount("/static", StaticFiles(directory="app/static"), name="static")

app.include_router(auth.router)
app.include_router(analyze.router)
app.include_router(admin.router)


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    _bootstrap_admin()


def _bootstrap_admin() -> None:
    """Create the admin account from configured bootstrap secrets (first run)."""
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        if not db.query(User).filter(User.role == "admin").first():
            db.add(User(email=settings.admin_email.lower(),
                        password_hash=hash_password(settings.admin_password),
                        role="admin"))
            db.commit()
            logging.getLogger("trustlayer").info("Bootstrap admin created: %s", settings.admin_email)
    finally:
        db.close()


@app.get("/health")
def health():
    return {"status": "ok", "app": settings.app_name, "environment": settings.app_env}


@app.get("/", include_in_schema=False)
def dashboard():
    """Serve the SOC-style admin dashboard (client-side auth via JWT)."""
    static_dir = __import__("pathlib").Path(__file__).parent / "static"
    return FileResponse(static_dir / "dashboard.html")
