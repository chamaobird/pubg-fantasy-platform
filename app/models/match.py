from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Match(Base):
    __tablename__ = "matches"

    id            = Column(Integer, primary_key=True, index=True)
    pubg_match_id = Column(String, nullable=False, unique=True, index=True)
    tournament_id = Column(Integer, ForeignKey("tournaments.id"), nullable=True)
    map_name      = Column(String, nullable=True)
    match_number  = Column(Integer, nullable=True)     # game # within tournament (1, 2, 3 …)
    phase         = Column(String(50), nullable=True)  # "group", "finals", etc.
    day           = Column(Integer, nullable=True)     # day within tournament
    played_at     = Column(DateTime(timezone=True), nullable=True)
    duration_secs = Column(Integer, server_default="0", nullable=True)
    results_json  = Column(Text, nullable=True)        # raw JSON blob (optional ingestion path)
    synced_at     = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)

    tournament    = relationship("Tournament", back_populates="matches")
    player_stats  = relationship("MatchPlayerStat", back_populates="match")
    lineup_scores = relationship("LineupScore", back_populates="match", cascade="all, delete-orphan")


class MatchPlayerStat(Base):
    __tablename__ = "match_player_stats"

    id             = Column(Integer, primary_key=True, index=True)
    match_id       = Column(Integer, ForeignKey("matches.id",  ondelete="CASCADE"), nullable=False, index=True)
    player_id      = Column(Integer, ForeignKey("players.id",  ondelete="CASCADE"), nullable=False, index=True)
    kills          = Column(Integer, server_default="0",   nullable=True)
    assists        = Column(Integer, server_default="0",   nullable=True)
    damage_dealt   = Column(Float,   server_default="0.0", nullable=True)
    placement      = Column(Integer, server_default="28",  nullable=True)
    survival_secs  = Column(Integer, server_default="0",   nullable=True)
    headshots      = Column(Integer, server_default="0",   nullable=True)
    knocks         = Column(Integer, server_default="0",   nullable=True)
    fantasy_points = Column(Float,   server_default="0.0", nullable=True, index=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)

    match  = relationship("Match", back_populates="player_stats")
    player = relationship("Player")


class PlayerScore(Base):
    __tablename__ = "player_scores"

    id             = Column(Integer, primary_key=True, index=True)
    player_id      = Column(Integer, ForeignKey("players.id",         ondelete="CASCADE"), nullable=False, index=True)
    league_id      = Column(Integer, ForeignKey("fantasy_leagues.id", ondelete="CASCADE"), nullable=False, index=True)
    total_points   = Column(Float,   server_default="0.0", nullable=True, index=True)
    total_kills    = Column(Integer, server_default="0",   nullable=True)
    total_assists  = Column(Integer, server_default="0",   nullable=True)
    total_damage   = Column(Float,   server_default="0.0", nullable=True)
    matches_scored = Column(Integer, server_default="0",   nullable=True)
    last_updated   = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)

    player = relationship("Player")
    league = relationship("FantasyLeague")


class LineupScore(Base):
    """
    Cached per-Lineup per-Match fantasy score.

    Populated by the scoring service after each match is processed.
    Safe to delete and recompute — Lineup.total_points is always rebuilt
    as the sum of all LineupScore.final_points for that lineup.

    Breakdown:
      base_points    = sum of 4 starters' MatchPlayerStat.fantasy_points
      captain_bonus  = captain's fantasy_points again (net: captain earns 2×)
      reserve_points = reserve's fantasy_points, only when reserve_activated
      final_points   = base_points + captain_bonus + reserve_points
    """
    __tablename__ = "lineup_scores"
    __table_args__ = (
        UniqueConstraint("lineup_id", "match_id", name="uq_lineup_match_score"),
    )

    id                = Column(Integer, primary_key=True, index=True)
    lineup_id         = Column(Integer, ForeignKey("lineups.id", ondelete="CASCADE"), nullable=False, index=True)
    match_id          = Column(Integer, ForeignKey("matches.id", ondelete="CASCADE"), nullable=False, index=True)

    base_points       = Column(Numeric(10, 2), server_default="0.0",   nullable=False)
    captain_bonus     = Column(Numeric(10, 2), server_default="0.0",   nullable=False)
    reserve_points    = Column(Numeric(10, 2), server_default="0.0",   nullable=False)
    reserve_activated = Column(Boolean,        server_default="false", nullable=False)
    final_points      = Column(Numeric(10, 2), server_default="0.0",   nullable=False, index=True)

    scored_at         = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    lineup = relationship("Lineup", back_populates="scores")
    match  = relationship("Match",  back_populates="lineup_scores")
