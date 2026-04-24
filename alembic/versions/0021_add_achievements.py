"""add achievements

Revision ID: 0021
Revises: 0020
Create Date: 2026-04-24
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0021"
down_revision = "0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_achievement",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("user.id", ondelete="CASCADE"), nullable=False),
        sa.Column("key", sa.String(50), nullable=False, comment="chave do achievement"),
        sa.Column("context", JSONB, nullable=True, comment="contexto opcional"),
        sa.Column("unlocked_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("user_id", "key", name="uq_user_achievement_key"),
    )
    op.create_index("ix_user_achievement_user_id", "user_achievement", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_user_achievement_user_id", table_name="user_achievement")
    op.drop_table("user_achievement")
