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
