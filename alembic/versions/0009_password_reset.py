"""0009_password_reset

Revision ID: 0009
Revises: 0008
Create Date: 2026-04-10
"""
from alembic import op
import sqlalchemy as sa

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("user", sa.Column(
        "password_reset_token",
        sa.String(64),
        nullable=True,
    ))
    op.add_column("user", sa.Column(
        "password_reset_expires_at",
        sa.DateTime(timezone=True),
        nullable=True,
    ))
    op.create_index("ix_user_password_reset_token", "user", ["password_reset_token"])


def downgrade() -> None:
    op.drop_index("ix_user_password_reset_token", "user")
    op.drop_column("user", "password_reset_expires_at")
    op.drop_column("user", "password_reset_token")
