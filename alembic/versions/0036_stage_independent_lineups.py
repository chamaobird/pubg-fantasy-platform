"""stage: add independent_lineups flag

Revision ID: 0036
Revises: 0035
Create Date: 2026-05-26
"""
from alembic import op
import sqlalchemy as sa

revision = "0036"
down_revision = "0035"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "stage",
        sa.Column(
            "independent_lineups",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
            comment="True = cada StageDay exige lineup próprio (sem replicação automática). Usar em Finals multi-dia.",
        ),
    )


def downgrade() -> None:
    op.drop_column("stage", "independent_lineups")
