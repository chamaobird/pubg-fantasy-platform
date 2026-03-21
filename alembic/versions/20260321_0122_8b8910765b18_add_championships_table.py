"""add_championships_table

Revision ID: 8b8910765b18
Revises: 94e72870a73d
Create Date: 2026-03-21 01:22:54

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = '8b8910765b18'
down_revision: Union[str, None] = '94e72870a73d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    tables = inspector.get_table_names()

    if 'championships' not in tables:
        op.create_table(
            'championships',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('name', sa.String(200), nullable=False),
            sa.Column('short_name', sa.String(50), nullable=True),
            sa.Column('region', sa.String(50), nullable=True),
            sa.Column('status', sa.String(20), nullable=False, server_default='active'),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        )

    if 'championship_tournaments' not in tables:
        op.create_table(
            'championship_tournaments',
            sa.Column('championship_id', sa.Integer(), sa.ForeignKey('championships.id', ondelete='CASCADE'), nullable=False),
            sa.Column('tournament_id', sa.Integer(), sa.ForeignKey('tournaments.id', ondelete='CASCADE'), nullable=False),
            sa.Column('phase', sa.String(100), nullable=True),
            sa.Column('phase_order', sa.Integer(), nullable=False, server_default='0'),
            sa.PrimaryKeyConstraint('championship_id', 'tournament_id'),
        )


def downgrade() -> None:
    op.drop_table('championship_tournaments')
    op.drop_table('championships')