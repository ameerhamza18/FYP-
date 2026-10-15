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

from sqlalchemy import create_engine, event
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

if settings.database_url.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

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


REQUIRED_INITIAL_TABLES = {
    "users", "analyses", "indicators", "se_findings", "campaigns", "audit_logs"
}


def run_migrations(target_engine=None, cfg=None) -> None:
    """Apply every pending migration (``alembic upgrade head``).

    Called on startup when ``APP_ENV=production``. A failure here is fatal on
    purpose: serving traffic against a schema the code does not expect is worse
    than not starting.
    """
    from alembic import command
    from sqlalchemy import inspect, text

    active_engine = target_engine or engine
    active_cfg = cfg or alembic_config()

    with active_engine.connect() as conn:
        inspector = inspect(conn)
        tables = set(inspector.get_table_names())

        has_version = False
        if "alembic_version" in tables:
            res = conn.execute(text("SELECT version_num FROM alembic_version")).fetchall()
            if res:
                has_version = True

        if not has_version and tables:
            missing = REQUIRED_INITIAL_TABLES - tables
            present = REQUIRED_INITIAL_TABLES & tables
            if not missing:
                # Complete initial schema: stamp b4d7525065b0 so pending migrations apply cleanly
                command.stamp(active_cfg, "b4d7525065b0")
            elif present:
                # Incompatible / partial schema: refuse to silently stamp or mark as up to date
                raise RuntimeError(
                    f"Refusing to start: incompatible database schema detected. "
                    f"Found initial tables {sorted(present)}, but missing required tables {sorted(missing)}. "
                    f"Database cannot be safely stamped or migrated automatically."
                )

    command.upgrade(active_cfg, "head")


def init_db() -> None:
    """Prepare the schema: migrate in production, create in development."""
    if settings.is_production:
        run_migrations()
        return

    from app import models  # noqa: F401  (register mappers)

    Base.metadata.create_all(bind=engine)

