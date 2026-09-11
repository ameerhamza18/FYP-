"""Database engine, session factory and base model for TrustLayer.

Development uses SQLite by default; production should point DATABASE_URL at
PostgreSQL. Sensitive columns (user contact data, analysis payload snippets)
are encrypted at rest by the application layer before persistence.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import get_settings

settings = get_settings()

_connect_args = {}
if settings.database_url.startswith("sqlite"):
    # Allow usage from FastAPI's threadpool workers.
    _connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.database_url,
    connect_args=_connect_args,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency yielding a scoped database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all tables (dev bootstrap; use Alembic migrations in production)."""
    from app import models  # noqa: F401  (register mappers)

    Base.metadata.create_all(bind=engine)
