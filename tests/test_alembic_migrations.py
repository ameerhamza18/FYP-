"""Regression tests for Alembic database migrations.

Verifies:
1. Migration upgrade from empty database to initial schema (b4d7525065b0).
2. Existing data preservation when upgrading to head (075035851dee_add_notification_model).
3. Notifications table structure and indexes after upgrade.
4. Clean downgrade back to initial schema without data corruption on base tables.
5. Re-upgrade back to head.
"""
import os
import sys
import tempfile
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text


@pytest.fixture
def temp_alembic_db(monkeypatch):
    from app.config import get_settings

    temp_dir = tempfile.mkdtemp(prefix="trustlayer_alembic_test_")
    db_path = Path(temp_dir) / "test_migration.db"
    db_url = f"sqlite:///{db_path.as_posix()}"

    monkeypatch.setenv("DATABASE_URL", db_url)
    get_settings.cache_clear()

    backend_dir = Path(__file__).resolve().parents[1] / "backend"
    alembic_ini = backend_dir / "alembic.ini"

    cfg = Config(str(alembic_ini))
    cfg.set_main_option("script_location", str(backend_dir / "alembic"))
    cfg.set_main_option("version_locations", str(backend_dir / "alembic" / "versions"))
    cfg.set_main_option("sqlalchemy.url", db_url)

    yield {"cfg": cfg, "db_url": db_url, "db_path": db_path}

    get_settings.cache_clear()
    # Cleanup
    if db_path.exists():
        try:
            db_path.unlink()
        except OSError:
            pass


def test_notification_migration_lifecycle(temp_alembic_db):
    cfg = temp_alembic_db["cfg"]
    db_url = temp_alembic_db["db_url"]
    engine = create_engine(db_url)

    # 1. Upgrade to initial schema (b4d7525065b0)
    command.upgrade(cfg, "b4d7525065b0")

    with engine.connect() as conn:
        inspector = inspect(conn)
        tables_v1 = inspector.get_table_names()
        assert "users" in tables_v1
        assert "analyses" in tables_v1
        assert "audit_logs" in tables_v1
        assert "notifications" not in tables_v1

        # Insert sample user to test data preservation across migrations
        conn.execute(
            text(
                "INSERT INTO users (id, email, password_hash, role, is_active, created_at) "
                "VALUES (1, 'mig_test@example.com', 'hash123', 'user', 1, '2026-10-12 12:00:00')"
            )
        )
        conn.commit()

    # 2. Upgrade to head (applies 075035851dee_add_notification_model)
    command.upgrade(cfg, "head")

    with engine.connect() as conn:
        inspector = inspect(conn)
        tables_v2 = inspector.get_table_names()
        assert "notifications" in tables_v2

        # Verify existing user data is intact
        user_row = conn.execute(text("SELECT email FROM users WHERE id = 1")).fetchone()
        assert user_row is not None
        assert user_row[0] == "mig_test@example.com"

        # Verify notifications columns and indexes
        columns = [c["name"] for c in inspector.get_columns("notifications")]
        assert "id" in columns
        assert "user_id" in columns
        assert "title" in columns
        assert "message" in columns
        assert "notification_type" in columns
        assert "is_read" in columns
        assert "created_at" in columns

        index_names = [idx["name"] for idx in inspector.get_indexes("notifications")]
        assert "ix_notifications_user_read" in index_names

        # Insert a notification
        conn.execute(
            text(
                "INSERT INTO notifications (id, user_id, title, message, notification_type, is_read, created_at) "
                "VALUES (1, 1, 'Test Title', 'Test Message', 'alert', 0, '2026-10-12 12:05:00')"
            )
        )
        conn.commit()

        notif_row = conn.execute(text("SELECT title FROM notifications WHERE id = 1")).fetchone()
        assert notif_row[0] == "Test Title"

    # 3. Downgrade to b4d7525065b0
    command.downgrade(cfg, "b4d7525065b0")

    with engine.connect() as conn:
        inspector = inspect(conn)
        tables_down = inspector.get_table_names()
        assert "notifications" not in tables_down
        assert "users" in tables_down

        # Base data must remain preserved
        user_row = conn.execute(text("SELECT email FROM users WHERE id = 1")).fetchone()
        assert user_row is not None
        assert user_row[0] == "mig_test@example.com"

    # 4. Re-upgrade to head
    command.upgrade(cfg, "head")

    with engine.connect() as conn:
        inspector = inspect(conn)
        tables_reup = inspector.get_table_names()
        assert "notifications" in tables_reup
        user_row = conn.execute(text("SELECT email FROM users WHERE id = 1")).fetchone()
        assert user_row is not None
        assert user_row[0] == "mig_test@example.com"


def test_incompatible_schema_stamping_rejected(temp_alembic_db):
    """Verify that a partial / incompatible schema cannot be silently stamped as up to date."""
    from app.database import run_migrations

    cfg = temp_alembic_db["cfg"]
    db_url = temp_alembic_db["db_url"]
    engine = create_engine(db_url)

    # Create only audit_logs table (incompatible schema missing users, analyses, etc.)
    with engine.connect() as conn:
        conn.execute(
            text(
                "CREATE TABLE audit_logs ("
                "id INTEGER PRIMARY KEY, "
                "action VARCHAR(64) NOT NULL, "
                "created_at DATETIME NOT NULL)"
            )
        )
        conn.commit()

    # Attempting to run migrations must fail fast and refuse to stamp
    with pytest.raises(RuntimeError, match="incompatible database schema detected"):
        run_migrations(target_engine=engine, cfg=cfg)

    # Ensure alembic_version was NOT silently stamped
    with engine.connect() as conn:
        inspector = inspect(conn)
        tables = inspector.get_table_names()
        assert "alembic_version" not in tables


def test_full_legacy_schema_stamped_and_migrated(temp_alembic_db):
    """Verify that a genuine legacy database with all 6 initial tables is safely stamped and upgraded."""
    from app.database import run_migrations, REQUIRED_INITIAL_TABLES

    cfg = temp_alembic_db["cfg"]
    db_url = temp_alembic_db["db_url"]
    engine = create_engine(db_url)

    # First upgrade to initial schema b4d7525065b0
    command.upgrade(cfg, "b4d7525065b0")

    # Drop alembic_version table to simulate a legacy unversioned database with full initial schema
    with engine.connect() as conn:
        conn.execute(text("DROP TABLE alembic_version"))
        conn.commit()
        inspector = inspect(conn)
        tables = set(inspector.get_table_names())
        assert REQUIRED_INITIAL_TABLES.issubset(tables)
        assert "alembic_version" not in tables

    # run_migrations should detect full legacy schema, stamp b4d7525065b0, and upgrade to head
    run_migrations(target_engine=engine, cfg=cfg)

    with engine.connect() as conn:
        inspector = inspect(conn)
        tables = inspector.get_table_names()
        assert "notifications" in tables
        assert "alembic_version" in tables
