"""add_hmac_audit_and_threat_iocs

Revision ID: c8f91a23d4e5
Revises: 525910f96c52
Create Date: 2026-10-30 22:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c8f91a23d4e5"
down_revision: Union[str, None] = "525910f96c52"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

GENESIS = "0" * 64


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "audit_logs" in tables:
        cols = {c["name"] for c in inspector.get_columns("audit_logs")}
        with op.batch_alter_table("audit_logs", schema=None) as batch_op:
            if "prev_hash" not in cols:
                batch_op.add_column(
                    sa.Column("prev_hash", sa.String(length=64), nullable=False, server_default=GENESIS)
                )
            if "hmac_signature" not in cols:
                batch_op.add_column(
                    sa.Column("hmac_signature", sa.String(length=64), nullable=False, server_default="")
                )

    if "threat_iocs" not in tables:
        op.create_table(
            "threat_iocs",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("ioc_type", sa.String(length=32), nullable=False),
            sa.Column("value", sa.String(length=255), nullable=False),
            sa.Column("severity", sa.String(length=16), nullable=False, server_default="HIGH"),
            sa.Column("description", sa.String(length=500), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("created_by", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("ioc_type", "value", name="uq_threat_ioc_type_value"),
        )
        with op.batch_alter_table("threat_iocs", schema=None) as batch_op:
            batch_op.create_index(batch_op.f("ix_threat_iocs_id"), ["id"], unique=False)
            batch_op.create_index(batch_op.f("ix_threat_iocs_ioc_type"), ["ioc_type"], unique=False)
            batch_op.create_index(batch_op.f("ix_threat_iocs_value"), ["value"], unique=False)
            batch_op.create_index(batch_op.f("ix_threat_iocs_created_at"), ["created_at"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "threat_iocs" in tables:
        indices = {idx["name"] for idx in inspector.get_indexes("threat_iocs")}
        with op.batch_alter_table("threat_iocs", schema=None) as batch_op:
            for idx_name in (
                "ix_threat_iocs_created_at",
                "ix_threat_iocs_value",
                "ix_threat_iocs_ioc_type",
                "ix_threat_iocs_id",
            ):
                if idx_name in indices:
                    batch_op.drop_index(idx_name)
        op.drop_table("threat_iocs")

    if "audit_logs" in tables:
        cols = {c["name"] for c in inspector.get_columns("audit_logs")}
        with op.batch_alter_table("audit_logs", schema=None) as batch_op:
            if "hmac_signature" in cols:
                batch_op.drop_column("hmac_signature")
            if "prev_hash" in cols:
                batch_op.drop_column("prev_hash")

