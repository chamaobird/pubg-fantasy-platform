"""stage_substitution: rastreia substituições de jogadores por stage

Revision ID: 0035
Revises: 0034
Create Date: 2026-05-23
"""
from alembic import op
import sqlalchemy as sa

revision = "0035"
down_revision = "0034"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "stage_substitution",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("stage_id", sa.Integer, sa.ForeignKey("stage.id", ondelete="CASCADE"), nullable=False),
        sa.Column("out_person_id", sa.Integer, sa.ForeignKey("person.id", ondelete="CASCADE"), nullable=False),
        sa.Column("in_person_id", sa.Integer, sa.ForeignKey("person.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_stage_substitution_stage_id", "stage_substitution", ["stage_id"])
    op.create_unique_constraint("uq_sub_stage_out", "stage_substitution", ["stage_id", "out_person_id"])


def downgrade() -> None:
    op.drop_table("stage_substitution")
