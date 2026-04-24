"""add leagues

Revision ID: 0022
Revises: 0021
Create Date: 2026-04-24
"""
from alembic import op
import sqlalchemy as sa

revision = "0022"
down_revision = "0021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "league",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("owner_id", sa.String(36), sa.ForeignKey("user.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("championship_id", sa.Integer(), sa.ForeignKey("championship.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("invite_code", sa.String(8), nullable=False, unique=True, comment="código de convite alfanumérico"),
        sa.Column("max_members", sa.Integer(), nullable=False, server_default="50"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_league_owner_id", "league", ["owner_id"])
    op.create_index("ix_league_championship_id", "league", ["championship_id"])
    op.create_index("ix_league_invite_code", "league", ["invite_code"])

    op.create_table(
        "league_member",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("league_id", sa.Integer(), sa.ForeignKey("league.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("user.id", ondelete="CASCADE"), nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("league_id", "user_id", name="uq_league_member"),
    )
    op.create_index("ix_league_member_league_id", "league_member", ["league_id"])
    op.create_index("ix_league_member_user_id", "league_member", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_league_member_user_id", table_name="league_member")
    op.drop_index("ix_league_member_league_id", table_name="league_member")
    op.drop_table("league_member")

    op.drop_index("ix_league_invite_code", table_name="league")
    op.drop_index("ix_league_championship_id", table_name="league")
    op.drop_index("ix_league_owner_id", table_name="league")
    op.drop_table("league")
