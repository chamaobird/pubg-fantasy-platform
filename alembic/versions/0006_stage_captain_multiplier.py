"""0006 — add captain_multiplier to stage

Revision ID: 0006
Revises: 0005
Create Date: 2026-04-07
"""
from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "stage",
        sa.Column(
            "captain_multiplier",
            sa.Numeric(4, 2),
            nullable=False,
            server_default="1.30",
            comment="Points multiplier applied to the captain's score (e.g. 1.3 = ×1.3)",
        ),
    )


def downgrade() -> None:
    op.drop_column("stage", "captain_multiplier")
