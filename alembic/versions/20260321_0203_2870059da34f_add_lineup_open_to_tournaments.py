"""add_lineup_open_to_tournaments

Revision ID: 2870059da34f
Revises: 8b8910765b18
Create Date: 2026-03-21 02:03:27

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = '2870059da34f'
down_revision: Union[str, None] = '8b8910765b18'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('tournaments')]
    if 'lineup_open' not in columns:
        op.add_column('tournaments', sa.Column(
            'lineup_open',
            sa.Boolean(),
            nullable=False,
            server_default=sa.text('false')
        ))


def downgrade() -> None:
    op.drop_column('tournaments', 'lineup_open')