"""add live_pubg_id to players

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
Create Date: 2026-03-26 01:00:00.000000

live_pubg_id stores the player's personal Steam account ID for matching
against Live Server (steam shard) match data. This is separate from
pubg_id which stores the tournament server account ID.
"""
from alembic import op
import sqlalchemy as sa

revision = 'f2a3b4c5d6e7'
down_revision = 'e1f2a3b4c5d6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    cols = [row[0] for row in conn.execute(
        sa.text("SELECT column_name FROM information_schema.columns WHERE table_name='players'")
    ).fetchall()]
    if 'live_pubg_id' not in cols:
        op.add_column('players', sa.Column('live_pubg_id', sa.String(255), nullable=True))
        op.create_index('ix_players_live_pubg_id', 'players', ['live_pubg_id'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_players_live_pubg_id', table_name='players')
    op.drop_column('players', 'live_pubg_id')
