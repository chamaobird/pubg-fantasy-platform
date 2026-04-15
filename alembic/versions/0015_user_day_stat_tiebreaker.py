"""user_day_stat tiebreaker columns

Adds survival_secs and captain_pts to user_day_stat for flexible
combined leaderboard queries.

Revision ID: 0015
Revises: 0014
Create Date: 2026-04-15
"""
from alembic import op
import sqlalchemy as sa

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_day_stat",
        sa.Column("survival_secs", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "user_day_stat",
        sa.Column("captain_pts", sa.Numeric(10, 2), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("user_day_stat", "captain_pts")
    op.drop_column("user_day_stat", "survival_secs")
