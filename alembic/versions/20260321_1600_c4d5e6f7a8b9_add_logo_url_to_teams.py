"""add logo_url to teams

Revision ID: c4d5e6f7a8b9
Revises: b3f1a2c4d5e6
Create Date: 2026-03-21 16:00:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = 'c4d5e6f7a8b9'
down_revision = 'b3f1a2c4d5e6'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [col['name'] for col in inspector.get_columns('teams')]

    if 'logo_url' not in columns:
        op.add_column(
            'teams',
            sa.Column('logo_url', sa.String(500), nullable=True),
        )


def downgrade():
    op.drop_column('teams', 'logo_url')
