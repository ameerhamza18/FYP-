"""Database engine, session factory, base model and schema bootstrap.

Development uses SQLite by default; production must point DATABASE_URL at
PostgreSQL. Encryption at rest for persisted message content is performed by the
application before rows are written — see ``app.security.crypto`` and the column
mappings in ``app.models``.

Schema management
-----------------
Production applies the Alembic migration chain (``alembic upgrade head``), which
is versioned, reviewable and reversible. ``Base.metadata.create_all()`` remains
a development/test convenience only: it cannot express an ``ALTER``, so a model
change would silently be ignored on an existing database.
"""
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import get_settings

settings = get_settings()

_connect_args = {}
if settings.database_url.startswith("sqlite"):
    _connect_args = {"check_same_thread": False}

_engine_kwargs = {
    "connect_args": _connect_args,
    "pool_pre_ping": True,
}
if not settings.database_url.startswith("sqlite"):
    _engine_kwargs.update({
        "pool_size": 10,
        "max_overflow": 20,
        "pool_recycle": 3600,
    })

engine = create_engine(settings.database_url, **_engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency yielding a scoped database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def alembic_config():
    """Build an Alembic config pointing at this deployment's database."""
    from alembic.config import Config as AlembicConfig

    alembic_dir = Path(__file__).resolve().parents[1] / "alembic"
    cfg = AlembicConfig()
    cfg.set_main_option("script_location", str(alembic_dir))
    cfg.set_main_option("version_locations", str(alembic_dir / "versions"))
    # configparser treats '%' as interpolation, so a URL-encoded password must
    # be escaped before it is handed to Alembic.
    cfg.set_main_option("sqlalchemy.url", settings.database_url.replace("%", "%%"))
    return cfg


def run_migrations() -> None:
    """Apply every pending migration (``alembic upgrade head``).

    Called on startup when ``APP_ENV=production``. A failure here is fatal on
    purpose: serving traffic against a schema the code does not expect is worse
    than not starting.
    """
    from alembic import command

    command.upgrade(alembic_config(), "head")


def init_db() -> None:
    """Prepare the schema: migrate in production, create in development."""
    if settings.is_production:
        run_migrations()
        return

    from app import models  # noqa: F401  (register mappers)

    Base.metadata.create_all(bind=engine)

