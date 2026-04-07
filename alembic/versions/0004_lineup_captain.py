"""add is_captain to lineup_player

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-06
"""
from alembic import op
import sqlalchemy as sa

revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'lineup_player',
        sa.Column(
            'is_captain',
            sa.Boolean(),
            nullable=False,
            server_default=sa.text('false'),
            comment='True para o titular escolhido como capitão (multiplicador ×1.3)',
        ),
    )


def downgrade() -> None:
    op.drop_column('lineup_player', 'is_captain')
