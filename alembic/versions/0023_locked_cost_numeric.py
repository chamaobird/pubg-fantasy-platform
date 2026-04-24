"""locked_cost: Integer → Numeric(6,2) para preservar centavos

Revision ID: 0023
Revises: 0022
Create Date: 2026-04-24
"""
from alembic import op
import sqlalchemy as sa

revision = "0023"
down_revision = "0022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "lineup_player", "locked_cost",
        existing_type=sa.Integer(),
        type_=sa.Numeric(precision=6, scale=2),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "lineup_player", "locked_cost",
        existing_type=sa.Numeric(precision=6, scale=2),
        type_=sa.Integer(),
        existing_nullable=True,
    )
