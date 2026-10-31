"""Database engine, session factory, base model and schema bootstrap."""
from pathlib import Path

from sqlalchemy import create_engine, event, inspect, text
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
    cfg.set_main_option("path_separator", "os")
    cfg.set_main_option("sqlalchemy.url", settings.database_url.replace("%", "%%"))
    return cfg


REQUIRED_INITIAL_TABLES = {
    "users", "analyses", "indicators", "se_findings", "campaigns", "audit_logs"
}


def run_migrations(target_engine=None, cfg=None) -> None:
    """Apply every pending migration (``alembic upgrade head``)."""
    from alembic import command

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
                command.stamp(active_cfg, "b4d7525065b0")
            elif present:
                raise RuntimeError(
                    f"Refusing to start: incompatible database schema detected. "
                    f"Found initial tables {sorted(present)}, but missing required tables {sorted(missing)}. "
                    f"Database cannot be safely stamped or migrated automatically."
                )

    command.upgrade(active_cfg, "head")


def _ensure_dev_columns(target_engine) -> None:
    """Idempotently backfill newly added columns on pre-existing local SQLite dev DBs."""
    with target_engine.begin() as conn:
        inspector = inspect(conn)
        if "audit_logs" in inspector.get_table_names():
            cols = {c["name"] for c in inspector.get_columns("audit_logs")}
            if "prev_hash" not in cols:
                conn.execute(
                    text("ALTER TABLE audit_logs ADD COLUMN prev_hash VARCHAR(64) NOT NULL DEFAULT '0000000000000000000000000000000000000000000000000000000000000000'")
                )
            if "hmac_signature" not in cols:
                conn.execute(
                    text("ALTER TABLE audit_logs ADD COLUMN hmac_signature VARCHAR(64) NOT NULL DEFAULT ''")
                )


def init_db() -> None:
    """Prepare the schema: migrate in production, create in development."""
    if settings.is_production:
        run_migrations()
        return

    from app import models  # noqa: F401  (register mappers)

    Base.metadata.create_all(bind=engine)
    _ensure_dev_columns(engine)
