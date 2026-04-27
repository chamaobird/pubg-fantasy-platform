"""add championship_group tables

Revision ID: 0026
Revises: 0025
Create Date: 2026-04-26
"""
from alembic import op
import sqlalchemy as sa

revision = "0026"
down_revision = "0025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "championship_group",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("short_name", sa.String(30), nullable=False),
        sa.Column(
            "is_active",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "display_order",
            sa.SmallInteger,
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    op.create_table(
        "championship_group_member",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "group_id",
            sa.Integer,
            sa.ForeignKey("championship_group.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "championship_id",
            sa.Integer,
            sa.ForeignKey("championship.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "display_order",
            sa.SmallInteger,
            nullable=False,
            server_default="0",
        ),
        sa.UniqueConstraint(
            "group_id", "championship_id", name="uq_group_championship"
        ),
    )


def downgrade() -> None:
    op.drop_table("championship_group_member")
    op.drop_table("championship_group")
