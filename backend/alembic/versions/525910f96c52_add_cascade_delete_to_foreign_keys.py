"""add_cascade_delete_to_foreign_keys

Revision ID: 525910f96c52
Revises: 075035851dee
Create Date: 2026-10-12 23:25:44.271383

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '525910f96c52'
down_revision: Union[str, None] = '075035851dee'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        inspector = sa.inspect(bind)

        def get_fk_names(table):
            return {fk["name"] for fk in inspector.get_foreign_keys(table) if fk.get("name")}

        analyses_fks = get_fk_names("analyses")
        if "analyses_user_id_fkey" in analyses_fks:
            op.drop_constraint("analyses_user_id_fkey", "analyses", type_="foreignkey")
        op.create_foreign_key(
            "analyses_user_id_fkey", "analyses", "users", ["user_id"], ["id"], ondelete="CASCADE"
        )

        indicators_fks = get_fk_names("indicators")
        if "indicators_analysis_id_fkey" in indicators_fks:
            op.drop_constraint("indicators_analysis_id_fkey", "indicators", type_="foreignkey")
        op.create_foreign_key(
            "indicators_analysis_id_fkey", "indicators", "analyses", ["analysis_id"], ["id"], ondelete="CASCADE"
        )

        se_fks = get_fk_names("se_findings")
        if "se_findings_analysis_id_fkey" in se_fks:
            op.drop_constraint("se_findings_analysis_id_fkey", "se_findings", type_="foreignkey")
        op.create_foreign_key(
            "se_findings_analysis_id_fkey", "se_findings", "analyses", ["analysis_id"], ["id"], ondelete="CASCADE"
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        inspector = sa.inspect(bind)

        def get_fk_names(table):
            return {fk["name"] for fk in inspector.get_foreign_keys(table) if fk.get("name")}

        se_fks = get_fk_names("se_findings")
        if "se_findings_analysis_id_fkey" in se_fks:
            op.drop_constraint("se_findings_analysis_id_fkey", "se_findings", type_="foreignkey")
        op.create_foreign_key(
            "se_findings_analysis_id_fkey", "se_findings", "analyses", ["analysis_id"], ["id"]
        )

        indicators_fks = get_fk_names("indicators")
        if "indicators_analysis_id_fkey" in indicators_fks:
            op.drop_constraint("indicators_analysis_id_fkey", "indicators", type_="foreignkey")
        op.create_foreign_key(
            "indicators_analysis_id_fkey", "indicators", "analyses", ["analysis_id"], ["id"]
        )

        analyses_fks = get_fk_names("analyses")
        if "analyses_user_id_fkey" in analyses_fks:
            op.drop_constraint("analyses_user_id_fkey", "analyses", type_="foreignkey")
        op.create_foreign_key(
            "analyses_user_id_fkey", "analyses", "users", ["user_id"], ["id"]
        )
