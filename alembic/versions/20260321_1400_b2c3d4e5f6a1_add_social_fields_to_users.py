"""add_social_fields_to_users

Revision ID: b2c3d4e5f6a1
Revises: a1b2c3d4e5f6
Create Date: 2026-03-21 14:00:00
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = 'b2c3d4e5f6a1'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('users')]
    for col_name, col_type in [
        ('twitch_username', sa.String(100)),
        ('krafton_id',      sa.String(100)),
        ('discord_username', sa.String(100)),
    ]:
        if col_name not in columns:
            op.add_column('users', sa.Column(col_name, col_type, nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'discord_username')
    op.drop_column('users', 'krafton_id')
    op.drop_column('users', 'twitch_username')
