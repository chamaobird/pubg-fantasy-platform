"""add oauth_code table for secure OAuth callback

Revision ID: 0028
Revises: 0027
Create Date: 2026-04-30
"""
from alembic import op
import sqlalchemy as sa

revision = "0028"
down_revision = "0027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "oauth_code",
        sa.Column("code", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("is_admin", sa.Boolean(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("oauth_code")
