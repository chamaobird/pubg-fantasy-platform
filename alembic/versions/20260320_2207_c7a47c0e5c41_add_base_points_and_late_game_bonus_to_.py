"""add_base_points_and_late_game_bonus_to_match_player_stats

Revision ID: c7a47c0e5c41
Revises: b67417853848
Create Date: 2026-03-20 22:07:03

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = 'c7a47c0e5c41'
down_revision: Union[str, None] = 'b67417853848'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('match_player_stats')]
    
    if 'base_points' not in columns:
        op.add_column('match_player_stats', sa.Column(
            'base_points',
            sa.Float(),
            nullable=False,
            server_default=sa.text('0.0')
        ))
    
    if 'late_game_bonus' not in columns:
        op.add_column('match_player_stats', sa.Column(
            'late_game_bonus',
            sa.Float(),
            nullable=False,
            server_default=sa.text('0.0')
        ))


def downgrade() -> None:
    op.drop_column('match_player_stats', 'late_game_bonus')
    op.drop_column('match_player_stats', 'base_points')