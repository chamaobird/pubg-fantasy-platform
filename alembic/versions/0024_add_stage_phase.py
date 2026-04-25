"""add stage_phase: separate display lifecycle from lineup submission control

Revision ID: 0024
Revises: 0023
Create Date: 2026-04-25

Anteriormente, lineup_status acumulava dois papéis:
  1. controlar se o usuário pode submeter lineup (closed/open/locked)
  2. controlar em qual seção o dashboard exibia a stage (preview/live/locked)

Isso criava conflito: alterar o status para 'locked' na aba de admin
movia a stage para Resultados, mesmo que a partida ainda estivesse acontecendo.

Solução: separar em dois campos com responsabilidades distintas.
  - lineup_status: closed | open | locked  (APScheduler + admin, submissão de lineup)
  - stage_phase:   upcoming | live | finished  (admin manual, exibição no dashboard)

Migração dos dados existentes:
  lineup_status='closed'   → lineup_status='closed',  stage_phase='upcoming'
  lineup_status='preview'  → lineup_status='closed',  stage_phase='upcoming'
  lineup_status='open'     → lineup_status='open',    stage_phase='upcoming'
  lineup_status='live'     → lineup_status='locked',  stage_phase='live'
  lineup_status='locked'   → lineup_status='locked',  stage_phase='finished'
"""
from alembic import op
import sqlalchemy as sa

revision = "0024"
down_revision = "0023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Adiciona coluna stage_phase com default 'upcoming'
    op.add_column(
        "stage",
        sa.Column(
            "stage_phase",
            sa.String(10),
            nullable=False,
            server_default="upcoming",
            comment="upcoming | live | finished — controla exibição no dashboard (admin-only)",
        ),
    )

    # Data migration: deriva stage_phase a partir do lineup_status atual
    op.execute("""
        UPDATE stage
        SET stage_phase = CASE
            WHEN lineup_status = 'live'   THEN 'live'
            WHEN lineup_status = 'locked' THEN 'finished'
            ELSE 'upcoming'
        END
    """)

    # Data migration: normaliza lineup_status para apenas 3 valores
    op.execute("""
        UPDATE stage
        SET lineup_status = CASE
            WHEN lineup_status = 'preview' THEN 'closed'
            WHEN lineup_status = 'live'    THEN 'locked'
            ELSE lineup_status
        END
    """)


def downgrade() -> None:
    # Reconstrói lineup_status combinado a partir dos dois campos
    op.execute("""
        UPDATE stage
        SET lineup_status = CASE
            WHEN stage_phase = 'live'     THEN 'live'
            WHEN stage_phase = 'finished' THEN 'locked'
            ELSE lineup_status  -- closed ou open permanecem
        END
    """)

    op.drop_column("stage", "stage_phase")
