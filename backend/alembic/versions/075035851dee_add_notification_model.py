"""add_notification_model

Revision ID: 075035851dee
Revises: b4d7525065b0
Create Date: 2026-10-12 23:20:12.569007

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '075035851dee'
down_revision: Union[str, None] = 'b4d7525065b0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()
    if 'notifications' not in tables:
        op.create_table(
            'notifications',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('title', sa.String(length=255), nullable=False),
            sa.Column('message', sa.String(length=1000), nullable=False),
            sa.Column('notification_type', sa.String(length=32), nullable=False, server_default='alert'),
            sa.Column('is_read', sa.Boolean(), nullable=False, server_default=sa.text('false')),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
        )
        with op.batch_alter_table('notifications', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_notifications_created_at'), ['created_at'], unique=False)
            batch_op.create_index(batch_op.f('ix_notifications_id'), ['id'], unique=False)
            batch_op.create_index(batch_op.f('ix_notifications_user_id'), ['user_id'], unique=False)
            batch_op.create_index('ix_notifications_user_read', ['user_id', 'is_read'], unique=False)
    else:
        if bind.dialect.name == "postgresql":
            fks = inspector.get_foreign_keys('notifications')
            for fk in fks:
                if fk.get('name') == 'notifications_user_id_fkey':
                    op.drop_constraint('notifications_user_id_fkey', 'notifications', type_='foreignkey')
                    op.create_foreign_key(
                        'notifications_user_id_fkey', 'notifications', 'users', ['user_id'], ['id'], ondelete='CASCADE'
                    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()
    if 'notifications' in tables:
        indices = {idx["name"] for idx in inspector.get_indexes('notifications')}
        with op.batch_alter_table('notifications', schema=None) as batch_op:
            if 'ix_notifications_user_read' in indices:
                batch_op.drop_index('ix_notifications_user_read')
            if 'ix_notifications_user_id' in indices:
                batch_op.drop_index(batch_op.f('ix_notifications_user_id'))
            if 'ix_notifications_id' in indices:
                batch_op.drop_index(batch_op.f('ix_notifications_id'))
            if 'ix_notifications_created_at' in indices:
                batch_op.drop_index(batch_op.f('ix_notifications_created_at'))

        op.drop_table('notifications')
