"""stage_sync_schedule: scheduler de sync de partidas por tournament ID

Revision ID: 0034
Revises: 0033
Create Date: 2026-05-21
"""
from alembic import op
import sqlalchemy as sa

revision = "0034"
down_revision = "0033"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "stage_sync_schedule",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "stage_id",
            sa.Integer,
            sa.ForeignKey("stage.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("tournament_id", sa.String(40), nullable=False),
        sa.Column("interval_min", sa.SmallInteger, nullable=False, server_default="15"),
        sa.Column("run_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("run_until", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("runs_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("status", sa.String(20), nullable=False, server_default="'pending'"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )


def downgrade() -> None:
    op.drop_table("stage_sync_schedule")
