"""add preview to lineup_status check constraint

Revision ID: 0012
Revises: 0011
Create Date: 2026-04-12
"""
from alembic import op
import sqlalchemy as sa

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Remove constraint antiga (apenas closed | open | locked)
    op.drop_constraint("ck_stage_lineup_status", "stage", type_="check")
    # Adiciona constraint com preview incluído
    op.create_check_constraint(
        "ck_stage_lineup_status",
        "stage",
        "lineup_status IN ('closed', 'open', 'locked', 'preview')",
    )


def downgrade() -> None:
    # Reverte para a constraint sem preview
    # Atenção: se houver rows com lineup_status='preview' o downgrade falhará
    op.drop_constraint("ck_stage_lineup_status", "stage", type_="check")
    op.create_check_constraint(
        "ck_stage_lineup_status",
        "stage",
        "lineup_status IN ('closed', 'open', 'locked')",
    )
