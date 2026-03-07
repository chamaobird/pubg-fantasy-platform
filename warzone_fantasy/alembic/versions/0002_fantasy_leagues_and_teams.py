"""fantasy leagues and teams

Revision ID: 0002
Revises: 0001
Create Date: 2024-01-02 00:00:00.000000

Adiciona o sistema de ligas fantasy:
  - fantasy_leagues: ligas vinculadas a torneios
  - fantasy_teams:   times montados por usuários
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── fantasy_leagues ────────────────────────────────────────────
    op.create_table(
        "fantasy_leagues",
        sa.Column("id",                sa.Integer(), nullable=False),
        sa.Column("name",              sa.String(),  nullable=False),
        sa.Column("tournament_id",     sa.Integer(), nullable=True),
        sa.Column("max_fantasy_teams", sa.Integer(), server_default="10",    nullable=True),
        sa.Column("budget_per_team",   sa.Float(),   server_default="100.0", nullable=True),
        sa.Column("created_at",        sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["tournament_id"], ["tournaments.id"]),
        sa.PrimaryKeyConstraint("id"),
        if_not_exists=True,
    )
    op.create_index("ix_fantasy_leagues_id", "fantasy_leagues", ["id"], unique=False, if_not_exists=True)

    # ── fantasy_teams ──────────────────────────────────────────────
    op.create_table(
        "fantasy_teams",
        sa.Column("id",           sa.Integer(), nullable=False),
        sa.Column("name",         sa.String(),  nullable=False),
        sa.Column("owner_id",     sa.Integer(), nullable=False),
        sa.Column("league_id",    sa.Integer(), nullable=False),
        sa.Column("total_points", sa.Float(),   server_default="0.0", nullable=True),
        sa.Column("created_at",   sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["owner_id"],  ["users.id"]),
        sa.ForeignKeyConstraint(["league_id"], ["fantasy_leagues.id"]),
        sa.PrimaryKeyConstraint("id"),
        if_not_exists=True,
    )
    op.create_index("ix_fantasy_teams_id",           "fantasy_teams", ["id"],           unique=False, if_not_exists=True)
    op.create_index("ix_fantasy_teams_total_points", "fantasy_teams", ["total_points"], unique=False, if_not_exists=True)


def downgrade() -> None:
    op.drop_table("fantasy_teams")
    op.drop_table("fantasy_leagues")
