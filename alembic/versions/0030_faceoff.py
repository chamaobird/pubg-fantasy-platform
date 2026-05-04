"""add faceoff and faceoff_vote tables

Revision ID: 0030
Revises: 0029
Create Date: 2026-05-04
"""
from alembic import op
import sqlalchemy as sa

revision = "0030"
down_revision = "0029"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "faceoff",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("championship_id", sa.Integer(), sa.ForeignKey("championship.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("team_a_name", sa.String(80), nullable=False),
        sa.Column("team_b_name", sa.String(80), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="draft",
                  comment="draft | open | closed | resolved"),
        sa.Column("winner_team_name", sa.String(80), nullable=True),
        sa.Column("seed_a", sa.SmallInteger(), nullable=True, comment="Seed do time A no ranking de performance"),
        sa.Column("seed_b", sa.SmallInteger(), nullable=True, comment="Seed do time B no ranking de performance"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "faceoff_vote",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("faceoff_id", sa.Integer(), sa.ForeignKey("faceoff.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("user.id", ondelete="CASCADE"), nullable=False),
        sa.Column("voted_for", sa.String(1), nullable=False, comment="'a' ou 'b'"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("faceoff_id", "user_id", name="uq_faceoff_vote_user"),
    )


def downgrade() -> None:
    op.drop_table("faceoff_vote")
    op.drop_table("faceoff")
