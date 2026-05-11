"""championship: add has_faceoff and finished_at for faceoff lifecycle

Revision ID: 0031
Revises: 0030
Create Date: 2026-05-10
"""
from alembic import op
import sqlalchemy as sa

revision = "0031"
down_revision = "0030"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "championship",
        sa.Column(
            "has_faceoff",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
            comment="Se True, championship tem Team Faceoff habilitado",
        ),
    )
    op.add_column(
        "championship",
        sa.Column(
            "finished_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Timestamp quando todos os stages foram marcados como finished (auto-set)",
        ),
    )


def downgrade() -> None:
    op.drop_column("championship", "finished_at")
    op.drop_column("championship", "has_faceoff")
