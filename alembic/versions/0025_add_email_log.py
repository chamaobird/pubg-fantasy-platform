"""add email_log table

Revision ID: 0025
Revises: 0024
Create Date: 2026-04-25
"""
from alembic import op
import sqlalchemy as sa

revision = "0025"
down_revision = "0024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "email_log",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("template_key", sa.String(60), nullable=False),
        sa.Column("subject", sa.String(255), nullable=False),
        sa.Column("recipient_group", sa.String(50), nullable=False),
        sa.Column("stage_id", sa.Integer, nullable=True),
        sa.Column("sent_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("failed_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("variables", sa.JSON, nullable=True),
        sa.Column("triggered_by", sa.String(100), nullable=True),
        sa.Column(
            "sent_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )


def downgrade() -> None:
    op.drop_table("email_log")
