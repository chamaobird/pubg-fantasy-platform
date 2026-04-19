"""add live to lineup_status check constraint

Revision ID: 0017
Revises: 0016
Create Date: 2026-04-19
"""
from alembic import op

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_stage_lineup_status", "stage", type_="check")
    op.create_check_constraint(
        "ck_stage_lineup_status",
        "stage",
        "lineup_status IN ('closed', 'open', 'locked', 'preview', 'live')",
    )


def downgrade() -> None:
    # Atenção: se houver rows com lineup_status='live' o downgrade falhará
    op.drop_constraint("ck_stage_lineup_status", "stage", type_="check")
    op.create_check_constraint(
        "ck_stage_lineup_status",
        "stage",
        "lineup_status IN ('closed', 'open', 'locked', 'preview')",
    )
