"""add short_name and is_active to stage

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-06
"""
from alembic import op
import sqlalchemy as sa

revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'stage',
        sa.Column(
            'short_name',
            sa.String(30),
            nullable=False,
            server_default='',
            comment='Short display name for the stage',
        ),
    )
    op.add_column(
        'stage',
        sa.Column(
            'is_active',
            sa.Boolean(),
            nullable=False,
            server_default=sa.text('true'),
            comment='Soft delete flag',
        ),
    )


def downgrade() -> None:
    op.drop_column('stage', 'is_active')
    op.drop_column('stage', 'short_name')
