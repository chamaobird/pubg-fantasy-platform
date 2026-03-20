"""add_penalty_count_to_match_player_stats

Revision ID: 94e72870a73d
Revises: c7a47c0e5c41
Create Date: 2026-03-20 23:28:40

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = '94e72870a73d'
down_revision: Union[str, None] = 'c7a47c0e5c41'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('match_player_stats')]
    if 'penalty_count' not in columns:
        op.add_column('match_player_stats', sa.Column(
            'penalty_count',
            sa.Integer(),
            nullable=False,
            server_default=sa.text('0')
        ))


def downgrade() -> None:
    op.drop_column('match_player_stats', 'penalty_count')