"""fase3_match_stats
Revision ID: 4bfb4ef75223
Revises: 0002
Create Date: 2026-04-06 01:29:16.014835+00:00
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '4bfb4ef75223'
down_revision: Union[str, None] = '0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('match_stat', sa.Column('base_points', sa.Numeric(8, 4), nullable=False, server_default='0'))
    op.add_column('match_stat', sa.Column('late_game_bonus', sa.Numeric(8, 4), nullable=False, server_default='0'))

    op.create_index('idx_player_account_account_id', 'player_account', ['account_id'])
    op.create_index('idx_match_stat_match_id', 'match_stat', ['match_id'])
    op.create_index('idx_person_stage_stat_stage', 'person_stage_stat', ['stage_id', 'person_id'])


def downgrade() -> None:
    op.drop_index('idx_person_stage_stat_stage', table_name='person_stage_stat')
    op.drop_index('idx_match_stat_match_id', table_name='match_stat')
    op.drop_index('idx_player_account_account_id', table_name='player_account')
    op.drop_column('match_stat', 'late_game_bonus')
    op.drop_column('match_stat', 'base_points')