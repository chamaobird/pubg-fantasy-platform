"""add match_schedule to stage_day

Revision ID: 0016
Revises: 0015
Create Date: 2026-04-18
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "stage_day",
        sa.Column(
            "match_schedule",
            JSONB,
            nullable=True,
            comment=(
                "Lista de janelas de import por partida. "
                "Ex: [{match_number: 1, import_after: '2026-04-18T23:25:00Z'}, ...]"
            ),
        ),
    )
    op.add_column(
        "stage_day",
        sa.Column(
            "last_import_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Timestamp do último import automático bem-sucedido neste dia",
        ),
    )


def downgrade() -> None:
    op.drop_column("stage_day", "last_import_at")
    op.drop_column("stage_day", "match_schedule")
