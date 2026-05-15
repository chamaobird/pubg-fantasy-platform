"""stage: add pubg_tournament_id for PUBG API tournament match discovery

Revision ID: 0032
Revises: 0031
Create Date: 2026-05-15
"""
from alembic import op
import sqlalchemy as sa

revision = "0032"
down_revision = "0031"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "stage",
        sa.Column(
            "pubg_tournament_id",
            sa.String(40),
            nullable=True,
            comment="ID do torneio na PUBG API (ex: am-pas126). Usado para pc-tournament match discovery.",
        ),
    )


def downgrade() -> None:
    op.drop_column("stage", "pubg_tournament_id")
