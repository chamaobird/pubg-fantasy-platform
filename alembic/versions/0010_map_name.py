"""add map_name to match

Revision ID: 0010
Revises: 0009
Create Date: 2026-04-11
"""
from alembic import op
import sqlalchemy as sa

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "match",
        sa.Column("map_name", sa.String(60), nullable=True, comment="Map name from PUBG API (e.g. Baltic_Main)"),
    )


def downgrade() -> None:
    op.drop_column("match", "map_name")
