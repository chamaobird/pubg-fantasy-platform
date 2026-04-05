"""users table

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-05

"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user",
        sa.Column("id", sa.String(36), nullable=False, comment="UUID v4"),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("username", sa.String(40), nullable=True),
        sa.Column("password_hash", sa.String(128), nullable=True, comment="null for Google-only accounts"),
        sa.Column("google_id", sa.String(128), nullable=True),
        sa.Column("avatar_url", sa.String(512), nullable=True),
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("email_verified", sa.Boolean(), nullable=False, server_default=sa.text("false"),
                  comment="Reserved for task #013 - email confirmation"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email", name="uq_user_email"),
        sa.UniqueConstraint("username", name="uq_user_username"),
        sa.UniqueConstraint("google_id", name="uq_user_google_id"),
    )
    op.create_index("ix_user_email", "user", ["email"])

    # Update FK-like columns in existing tables from String(60) to String(36)
    # (no actual FK to keep flexibility for future auth providers)
    op.alter_column("lineup", "user_id", type_=sa.String(36), existing_nullable=False)
    op.alter_column("user_stage_stat", "user_id", type_=sa.String(36), existing_nullable=False)
    op.alter_column("user_day_stat", "user_id", type_=sa.String(36), existing_nullable=False)


def downgrade() -> None:
    op.alter_column("user_day_stat", "user_id", type_=sa.String(60), existing_nullable=False)
    op.alter_column("user_stage_stat", "user_id", type_=sa.String(60), existing_nullable=False)
    op.alter_column("lineup", "user_id", type_=sa.String(60), existing_nullable=False)
    op.drop_index("ix_user_email", table_name="user")
    op.drop_table("user")
