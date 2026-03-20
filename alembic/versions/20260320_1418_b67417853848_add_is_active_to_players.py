"""add_is_active_to_players

Revision ID: b67417853848
Revises: 0007
Create Date: 2026-03-20 14:18:54.260640+00:00

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b67417853848'
down_revision: Union[str, None] = '0007'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('players', sa.Column(
        'is_active',
        sa.Boolean(),
        nullable=False,
        server_default=sa.text('true')
    ))


def downgrade() -> None:
    op.drop_column('players', 'is_active')