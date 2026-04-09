"""0007_championship_tier_weight

Adiciona tier_weight à tabela championship.
Peso relativo do campeonato para fins de pricing histórico cross-stage.
  PGS, PGC → 1.00 (padrão)
  PAS (regional) → configurar manualmente (ex: 0.70)

Revision ID: 0007
Revises: 0006_stage_captain_multiplier
"""
from alembic import op
import sqlalchemy as sa

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "championship",
        sa.Column(
            "tier_weight",
            sa.Numeric(4, 2),
            nullable=False,
            server_default="1.00",
            comment="Pricing weight: PGS/PGC=1.00, regional=0.70, etc.",
        ),
    )


def downgrade() -> None:
    op.drop_column("championship", "tier_weight")
