"""stage_day: add lineup_open_at, first_match_at, last_match_at per day

Revision ID: 0037
Revises: 0036
Create Date: 2026-05-31
"""
from alembic import op
import sqlalchemy as sa

revision = "0037"
down_revision = "0036"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("stage_day", sa.Column(
        "lineup_open_at", sa.DateTime(timezone=True), nullable=True,
        comment="When users can start editing lineup for this day",
    ))
    op.add_column("stage_day", sa.Column(
        "first_match_at", sa.DateTime(timezone=True), nullable=True,
        comment="Expected start of first match — sync lower bound for this day",
    ))
    op.add_column("stage_day", sa.Column(
        "last_match_at", sa.DateTime(timezone=True), nullable=True,
        comment="Expected end of last match — informational + display",
    ))


def downgrade() -> None:
    op.drop_column("stage_day", "last_match_at")
    op.drop_column("stage_day", "first_match_at")
    op.drop_column("stage_day", "lineup_open_at")
