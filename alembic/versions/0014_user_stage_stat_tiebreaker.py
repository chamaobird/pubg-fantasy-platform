"""user_stage_stat tiebreaker columns

Adds survival_secs and captain_pts to user_stage_stat for championship
leaderboard tiebreaking (survival points first, then captain points).

Revision ID: 0014
Revises: 0013
Create Date: 2026-04-15
"""
from alembic import op
import sqlalchemy as sa

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_stage_stat",
        sa.Column("survival_secs", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "user_stage_stat",
        sa.Column("captain_pts", sa.Numeric(10, 2), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("user_stage_stat", "captain_pts")
    op.drop_column("user_stage_stat", "survival_secs")
