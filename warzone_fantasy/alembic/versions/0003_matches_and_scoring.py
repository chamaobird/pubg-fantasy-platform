"""matches, match_player_stats, player_scores, fantasy_team_players

Revision ID: 0003
Revises: 0002
Create Date: 2024-01-03 00:00:00.000000

Adiciona o sistema de campeonatos ao vivo (Twire scoring model):

  - matches:               partidas individuais de um torneio
  - match_player_stats:    stats brutas + fantasy_points por jogador por partida
  - player_scores:         ranking acumulado por jogador por liga
  - fantasy_team_players:  associação many-to-many FantasyTeam ↔ Player
                           com slot (1-4) e constraint de capitão único

Scoring model: Twire × PUBG Esports (PNC 2022 – PGC 2024)
  kills × 2 | damage × 0.01 | chicken dinner +5 | early death -3 | captain ×1.3
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── matches ────────────────────────────────────────────────────
    op.create_table(
        "matches",
        sa.Column("id",            sa.Integer(), nullable=False),
        sa.Column("pubg_match_id", sa.String(),  nullable=False),
        sa.Column("tournament_id", sa.Integer(), nullable=True),
        sa.Column("map_name",      sa.String(),  nullable=True),
        sa.Column("played_at",     sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_secs", sa.Integer(), server_default="0", nullable=True),
        sa.Column("synced_at",     sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["tournament_id"], ["tournaments.id"]),
        sa.PrimaryKeyConstraint("id"),
        if_not_exists=True,
    )
    op.create_index("ix_matches_id",            "matches", ["id"],            unique=False, if_not_exists=True)
    op.create_index("ix_matches_pubg_match_id", "matches", ["pubg_match_id"], unique=True,  if_not_exists=True)

    # ── match_player_stats ─────────────────────────────────────────
    # Stats brutas da PUBG API + fantasy_points calculados pelo scoring engine.
    # UniqueConstraint impede duplicação de stats por (match, player).
    op.create_table(
        "match_player_stats",
        sa.Column("id",             sa.Integer(), nullable=False),
        sa.Column("match_id",       sa.Integer(), nullable=False),
        sa.Column("player_id",      sa.Integer(), nullable=False),
        sa.Column("kills",          sa.Integer(), server_default="0",    nullable=True),
        sa.Column("assists",        sa.Integer(), server_default="0",    nullable=True),
        sa.Column("damage_dealt",   sa.Float(),   server_default="0.0",  nullable=True),
        sa.Column("placement",      sa.Integer(), server_default="28",   nullable=True),
        sa.Column("survival_secs",  sa.Integer(), server_default="0",    nullable=True),
        sa.Column("headshots",      sa.Integer(), server_default="0",    nullable=True),
        sa.Column("knocks",         sa.Integer(), server_default="0",    nullable=True),
        sa.Column("fantasy_points", sa.Float(),   server_default="0.0",  nullable=True),
        sa.Column("created_at",     sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["match_id"],  ["matches.id"],  ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["player_id"], ["players.id"],  ondelete="CASCADE"),
        sa.UniqueConstraint("match_id", "player_id", name="uq_match_player"),
        sa.PrimaryKeyConstraint("id"),
        if_not_exists=True,
    )
    op.create_index("ix_match_player_stats_id",             "match_player_stats", ["id"],             unique=False, if_not_exists=True)
    op.create_index("ix_match_player_stats_match_id",       "match_player_stats", ["match_id"],       unique=False, if_not_exists=True)
    op.create_index("ix_match_player_stats_player_id",      "match_player_stats", ["player_id"],      unique=False, if_not_exists=True)
    op.create_index("ix_match_player_stats_fantasy_points", "match_player_stats", ["fantasy_points"], unique=False, if_not_exists=True)

    # ── player_scores ──────────────────────────────────────────────
    # Acumulado por (player, league) — atualizado incrementalmente
    # a cada match processado pelo scoring engine.
    op.create_table(
        "player_scores",
        sa.Column("id",             sa.Integer(), nullable=False),
        sa.Column("player_id",      sa.Integer(), nullable=False),
        sa.Column("league_id",      sa.Integer(), nullable=False),
        sa.Column("total_points",   sa.Float(),   server_default="0.0", nullable=True),
        sa.Column("total_kills",    sa.Integer(), server_default="0",   nullable=True),
        sa.Column("total_assists",  sa.Integer(), server_default="0",   nullable=True),
        sa.Column("total_damage",   sa.Float(),   server_default="0.0", nullable=True),
        sa.Column("matches_scored", sa.Integer(), server_default="0",   nullable=True),
        sa.Column("last_updated",   sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["player_id"], ["players.id"],        ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["league_id"], ["fantasy_leagues.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("player_id", "league_id", name="uq_player_league_score"),
        sa.PrimaryKeyConstraint("id"),
        if_not_exists=True,
    )
    op.create_index("ix_player_scores_id",           "player_scores", ["id"],           unique=False, if_not_exists=True)
    op.create_index("ix_player_scores_player_id",    "player_scores", ["player_id"],    unique=False, if_not_exists=True)
    op.create_index("ix_player_scores_league_id",    "player_scores", ["league_id"],    unique=False, if_not_exists=True)
    op.create_index("ix_player_scores_total_points", "player_scores", ["total_points"], unique=False, if_not_exists=True)

    # ── fantasy_team_players ───────────────────────────────────────
    # Tabela de associação FantasyTeam ↔ Player.
    # slot 1 = Capitão (×1.3 no scoring), slots 2-4 = Titulares.
    # UniqueConstraint impede dois jogadores no mesmo slot do mesmo time.
    op.create_table(
        "fantasy_team_players",
        sa.Column("fantasy_team_id", sa.Integer(), nullable=False),
        sa.Column("player_id",       sa.Integer(), nullable=False),
        sa.Column("slot",            sa.Integer(), nullable=False),
        sa.Column("added_at",        sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["fantasy_team_id"], ["fantasy_teams.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["player_id"],       ["players.id"],       ondelete="CASCADE"),
        sa.UniqueConstraint("fantasy_team_id", "slot", name="uq_fantasy_team_slot"),
        sa.PrimaryKeyConstraint("fantasy_team_id", "player_id"),
        if_not_exists=True,
    )


def downgrade() -> None:
    # Ordem inversa respeita as foreign keys
    op.drop_table("fantasy_team_players")
    op.drop_table("player_scores")
    op.drop_table("match_player_stats")
    op.drop_table("matches")
