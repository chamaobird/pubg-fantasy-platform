# app/models.py
from sqlalchemy import (
    Column, Integer, String, Float, Boolean,
    DateTime, ForeignKey, UniqueConstraint, JSON
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


# ---------------------------------------------------------------------------
# ASSOCIATION TABLE — FantasyTeam ↔ Player (many-to-many, máx 4 por squad)
# ---------------------------------------------------------------------------

from sqlalchemy import Table

fantasy_team_players = Table(
    "fantasy_team_players",
    Base.metadata,
    Column("fantasy_team_id", Integer, ForeignKey("fantasy_teams.id", ondelete="CASCADE"), primary_key=True),
    Column("player_id",       Integer, ForeignKey("players.id",       ondelete="CASCADE"), primary_key=True),
    Column("slot",            Integer, nullable=False),   # 1-4 (posição no squad)
    Column("added_at",        DateTime(timezone=True), server_default=func.now()),
    UniqueConstraint("fantasy_team_id", "slot", name="uq_fantasy_team_slot"),
)


# ---------------------------------------------------------------------------
# USER
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    email           = Column(String, unique=True, index=True, nullable=False)
    username        = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active       = Column(Boolean, default=True)
    is_admin        = Column(Boolean, default=False)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    fantasy_teams = relationship("FantasyTeam", back_populates="owner")


# ---------------------------------------------------------------------------
# TOURNAMENT
# ---------------------------------------------------------------------------

class Tournament(Base):
    __tablename__ = "tournaments"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String, nullable=False)
    pubg_id    = Column(String, unique=True, index=True, nullable=True)
    region     = Column(String, nullable=True)
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date   = Column(DateTime(timezone=True), nullable=True)
    status     = Column(String, default="upcoming")  # upcoming | active | finished
    max_teams  = Column(Integer, default=16)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    teams          = relationship("Team",          back_populates="tournament")
    matches        = relationship("Match",         back_populates="tournament")
    fantasy_leagues = relationship("FantasyLeague", back_populates="tournament")


# ---------------------------------------------------------------------------
# TEAM  (equipe profissional de PUBG, ex: Natus Vincere, FaZe)
# ---------------------------------------------------------------------------

class Team(Base):
    __tablename__ = "teams"

    id            = Column(Integer, primary_key=True, index=True)
    name          = Column(String, nullable=False)
    tournament_id = Column(Integer, ForeignKey("tournaments.id"), nullable=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    tournament = relationship("Tournament", back_populates="teams")
    players    = relationship("Player",     back_populates="team")


# ---------------------------------------------------------------------------
# PLAYER
# ---------------------------------------------------------------------------

class Player(Base):
    __tablename__ = "players"

    id            = Column(Integer, primary_key=True, index=True)
    name          = Column(String,  nullable=False, index=True)
    pubg_id       = Column(String,  unique=True, index=True, nullable=True)
    region        = Column(String,  nullable=True)
    team_id       = Column(Integer, ForeignKey("teams.id"), nullable=True)
    fantasy_cost  = Column(Float,   default=10.0)
    position      = Column(String,  nullable=True)   # IGL | Fragger | Sniper | Support

    # Stats agregadas (atualizadas a cada sync)
    avg_kills      = Column(Float,   default=0.0)
    avg_damage     = Column(Float,   default=0.0)
    avg_placement  = Column(Float,   default=0.0)
    matches_played = Column(Integer, default=0)
    raw_stats      = Column(JSON,    nullable=True)
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())

    team             = relationship("Team",            back_populates="players")
    match_stats      = relationship("MatchPlayerStat", back_populates="player")
    fantasy_teams    = relationship("FantasyTeam",     secondary=fantasy_team_players, back_populates="players")


# ---------------------------------------------------------------------------
# MATCH  (partida individual dentro de um torneio)
# ---------------------------------------------------------------------------

class Match(Base):
    __tablename__ = "matches"

    id            = Column(Integer, primary_key=True, index=True)
    pubg_match_id = Column(String,  unique=True, index=True, nullable=False)
    tournament_id = Column(Integer, ForeignKey("tournaments.id"), nullable=True)
    map_name      = Column(String,  nullable=True)   # Erangel | Miramar | Sanhok | Vikendi
    played_at     = Column(DateTime(timezone=True), nullable=True)
    duration_secs = Column(Integer, default=0)       # duração da partida em segundos
    synced_at     = Column(DateTime(timezone=True), server_default=func.now())

    tournament   = relationship("Tournament",      back_populates="matches")
    player_stats = relationship("MatchPlayerStat", back_populates="match", cascade="all, delete-orphan")


# ---------------------------------------------------------------------------
# MATCH PLAYER STAT  (stats individuais de cada jogador em cada partida)
# Fonte primária para cálculo de pontos ao vivo.
# ---------------------------------------------------------------------------

class MatchPlayerStat(Base):
    """
    Armazena as stats brutas de um jogador em uma partida específica.
    O campo `fantasy_points` é calculado e persistido pelo scoring engine
    no momento da ingestão, para consultas rápidas de ranking.

    Fórmula de pontos (ver app/services/scoring.py para detalhes):
        kills        × 10 pts
        assists      ×  4 pts
        damage       ×  0.05 pts  (por ponto de dano)
        placement    → tabela de pontos por posição (1º = 25, 2º = 20 ...)
        survival     ×  0.01 pts  (por segundo vivo)
    """
    __tablename__ = "match_player_stats"
    __table_args__ = (
        UniqueConstraint("match_id", "player_id", name="uq_match_player"),
    )

    id             = Column(Integer, primary_key=True, index=True)
    match_id       = Column(Integer, ForeignKey("matches.id", ondelete="CASCADE"), nullable=False, index=True)
    player_id      = Column(Integer, ForeignKey("players.id", ondelete="CASCADE"), nullable=False, index=True)

    # Stats brutas da PUBG API
    kills          = Column(Integer, default=0)
    assists        = Column(Integer, default=0)
    damage_dealt   = Column(Float,   default=0.0)
    placement      = Column(Integer, default=28)   # 1 = chicken dinner, 28 = último
    survival_secs  = Column(Integer, default=0)    # segundos vivo na partida
    headshots      = Column(Integer, default=0)
    knocks         = Column(Integer, default=0)    # knockdowns causados

    # Calculado pelo scoring engine e persistido para leituras rápidas
    fantasy_points = Column(Float,   default=0.0, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    match  = relationship("Match",  back_populates="player_stats")
    player = relationship("Player", back_populates="match_stats")


# ---------------------------------------------------------------------------
# FANTASY LEAGUE  (liga fantasy vinculada a um torneio)
# ---------------------------------------------------------------------------

class FantasyLeague(Base):
    __tablename__ = "fantasy_leagues"

    id               = Column(Integer, primary_key=True, index=True)
    name             = Column(String,  nullable=False)
    tournament_id    = Column(Integer, ForeignKey("tournaments.id"), nullable=True)
    max_fantasy_teams = Column(Integer, default=10)
    budget_per_team  = Column(Float,   default=100.0)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    tournament    = relationship("Tournament",  back_populates="fantasy_leagues")
    fantasy_teams = relationship("FantasyTeam", back_populates="league")


# ---------------------------------------------------------------------------
# FANTASY TEAM  (time montado por um usuário na liga)
# Regra: exatamente 4 jogadores (squad PUBG padrão), slots 1-4.
# total_points é atualizado ao vivo pelo scoring engine a cada partida.
# ---------------------------------------------------------------------------

class FantasyTeam(Base):
    __tablename__ = "fantasy_teams"

    id           = Column(Integer, primary_key=True, index=True)
    name         = Column(String,  nullable=False)
    owner_id     = Column(Integer, ForeignKey("users.id"),          nullable=False)
    league_id    = Column(Integer, ForeignKey("fantasy_leagues.id"), nullable=False)
    total_points = Column(Float,   default=0.0, index=True)   # indexado para ranking rápido
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    owner   = relationship("User",          back_populates="fantasy_teams")
    league  = relationship("FantasyLeague", back_populates="fantasy_teams")
    players = relationship("Player",        secondary=fantasy_team_players, back_populates="fantasy_teams")


# ---------------------------------------------------------------------------
# PLAYER SCORE  (pontuação acumulada de um jogador em uma liga)
# Atualizado incrementalmente a cada match processado.
# Permite ranking global de jogadores por liga.
# ---------------------------------------------------------------------------

class PlayerScore(Base):
    """
    Placar acumulado de um jogador dentro de uma FantasyLeague.
    Evita recalcular tudo do zero a cada consulta de ranking:
    o scoring engine apenas soma os pontos do match novo ao total.
    """
    __tablename__ = "player_scores"
    __table_args__ = (
        UniqueConstraint("player_id", "league_id", name="uq_player_league_score"),
    )

    id             = Column(Integer, primary_key=True, index=True)
    player_id      = Column(Integer, ForeignKey("players.id",        ondelete="CASCADE"), nullable=False, index=True)
    league_id      = Column(Integer, ForeignKey("fantasy_leagues.id", ondelete="CASCADE"), nullable=False, index=True)

    total_points   = Column(Float,   default=0.0, index=True)
    total_kills    = Column(Integer, default=0)
    total_assists  = Column(Integer, default=0)
    total_damage   = Column(Float,   default=0.0)
    matches_scored = Column(Integer, default=0)   # quantas partidas já contabilizadas
    last_updated   = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    player = relationship("Player")
    league = relationship("FantasyLeague")
