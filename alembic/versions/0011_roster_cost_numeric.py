"""roster cost columns to Numeric(6,2)

Revision ID: 0011
Revises: 0010
Create Date: 2026-04-11
"""
from alembic import op
import sqlalchemy as sa

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # roster.fantasy_cost: Integer → Numeric(6,2)
    op.alter_column(
        "roster", "fantasy_cost",
        existing_type=sa.Integer(),
        type_=sa.Numeric(6, 2),
        existing_nullable=True,
    )
    # roster.cost_override: Integer → Numeric(6,2)
    op.alter_column(
        "roster", "cost_override",
        existing_type=sa.Integer(),
        type_=sa.Numeric(6, 2),
        existing_nullable=True,
    )
    # roster_price_history.cost: Integer → Numeric(6,2)
    op.alter_column(
        "roster_price_history", "cost",
        existing_type=sa.Integer(),
        type_=sa.Numeric(6, 2),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "roster", "fantasy_cost",
        existing_type=sa.Numeric(6, 2),
        type_=sa.Integer(),
        existing_nullable=True,
    )
    op.alter_column(
        "roster", "cost_override",
        existing_type=sa.Numeric(6, 2),
        type_=sa.Integer(),
        existing_nullable=True,
    )
    op.alter_column(
        "roster_price_history", "cost",
        existing_type=sa.Numeric(6, 2),
        type_=sa.Integer(),
        existing_nullable=False,
    )
