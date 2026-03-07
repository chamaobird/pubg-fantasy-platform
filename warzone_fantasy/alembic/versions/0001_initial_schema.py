"""initial schema: users, tournaments, teams, players

Revision ID: 0001
Revises: 
Create Date: 2024-01-01 00:00:00.000000

Esta migration representa o estado inicial do banco —
as tabelas que já existiam antes da integração com a PUBG API
e do sistema de campeonatos.

Se o seu banco JÁ TEM essas tabelas (deploy anterior com create_all),
o Alembic vai pular este upgrade automaticamente porque marcamos
cada operação com checkfirst=True / IF NOT EXISTS.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── users ──────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id",              sa.Integer(),                              nullable=False),
        sa.Column("email",           sa.String(),                               nullable=False),
        sa.Column("username",        sa.String(),                               nullable=False),
        sa.Column("hashed_password", sa.String(),                               nullable=False),
        sa.Column("is_active",       sa.Boolean(),     server_default="true",   nullable=True),
        sa.Column("is_admin",        sa.Boolean(),     server_default="false",  nullable=True),
        sa.Column("created_at",      sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        if_not_exists=True,
    )
    op.create_index("ix_users_id",       "users", ["id"],       unique=False, if_not_exists=True)
    op.create_index("ix_users_email",    "users", ["email"],    unique=True,  if_not_exists=True)
    op.create_index("ix_users_username", "users", ["username"], unique=True,  if_not_exists=True)

    # ── tournaments ────────────────────────────────────────────────
    op.create_table(
        "tournaments",
        sa.Column("id",         sa.Integer(),                nullable=False),
        sa.Column("name",       sa.String(),                 nullable=False),
        sa.Column("pubg_id",    sa.String(),                 nullable=True),
        sa.Column("region",     sa.String(),                 nullable=True),
        sa.Column("start_date", sa.DateTime(timezone=True),  nullable=True),
        sa.Column("end_date",   sa.DateTime(timezone=True),  nullable=True),
        sa.Column("status",     sa.String(), server_default="upcoming", nullable=True),
        sa.Column("max_teams",  sa.Integer(), server_default="16",      nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        if_not_exists=True,
    )
    op.create_index("ix_tournaments_id",      "tournaments", ["id"],      unique=False, if_not_exists=True)
    op.create_index("ix_tournaments_pubg_id", "tournaments", ["pubg_id"], unique=True,  if_not_exists=True)

    # ── teams ──────────────────────────────────────────────────────
    op.create_table(
        "teams",
        sa.Column("id",            sa.Integer(), nullable=False),
        sa.Column("name",          sa.String(),  nullable=False),
        sa.Column("tournament_id", sa.Integer(), nullable=True),
        sa.Column("created_at",    sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["tournament_id"], ["tournaments.id"]),
        sa.PrimaryKeyConstraint("id"),
        if_not_exists=True,
    )
    op.create_index("ix_teams_id", "teams", ["id"], unique=False, if_not_exists=True)

    # ── players ────────────────────────────────────────────────────
    op.create_table(
        "players",
        sa.Column("id",             sa.Integer(), nullable=False),
        sa.Column("name",           sa.String(),  nullable=False),
        sa.Column("pubg_id",        sa.String(),  nullable=True),
        sa.Column("region",         sa.String(),  nullable=True),
        sa.Column("team_id",        sa.Integer(), nullable=True),
        sa.Column("fantasy_cost",   sa.Float(),   server_default="10.0", nullable=True),
        sa.Column("position",       sa.String(),  nullable=True),
        sa.Column("avg_kills",      sa.Float(),   server_default="0.0",  nullable=True),
        sa.Column("avg_damage",     sa.Float(),   server_default="0.0",  nullable=True),
        sa.Column("avg_placement",  sa.Float(),   server_default="0.0",  nullable=True),
        sa.Column("matches_played", sa.Integer(), server_default="0",    nullable=True),
        sa.Column("raw_stats",      sa.JSON(),    nullable=True),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at",     sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"]),
        sa.PrimaryKeyConstraint("id"),
        if_not_exists=True,
    )
    op.create_index("ix_players_id",      "players", ["id"],      unique=False, if_not_exists=True)
    op.create_index("ix_players_name",    "players", ["name"],    unique=False, if_not_exists=True)
    op.create_index("ix_players_pubg_id", "players", ["pubg_id"], unique=True,  if_not_exists=True)


def downgrade() -> None:
    op.drop_table("players")
    op.drop_table("teams")
    op.drop_table("tournaments")
    op.drop_table("users")
