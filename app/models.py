# app/models.py
from sqlalchemy import (
    Column, Integer, String, Float, Boolean,
    DateTime, ForeignKey, Text, JSON
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)          # NOVO CAMPO
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    fantasy_teams = relationship("FantasyTeam", back_populates="owner")


class Tournament(Base):
    __tablename__ = "tournaments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    pubg_id = Column(String, unique=True, index=True, nullable=True)   # NOVO
    region = Column(String, nullable=True)                              # NOVO
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    status = Column(String, default="upcoming")   # upcoming | active | finished
    max_teams = Column(Integer, default=16)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    teams = relationship("Team", back_populates="tournament")
    fantasy_leagues = relationship("FantasyLeague", back_populates="tournament")


class Player(Base):
    __tablename__ = "players"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    pubg_id = Column(String, unique=True, index=True, nullable=True)   # NOVO
    region = Column(String, nullable=True)                              # NOVO
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    fantasy_cost = Column(Float, default=10.0)
    position = Column(String, nullable=True)

    # NOVOS CAMPOS DE STATS
    avg_kills = Column(Float, default=0.0)
    avg_damage = Column(Float, default=0.0)
    avg_placement = Column(Float, default=0.0)
    matches_played = Column(Integer, default=0)
    raw_stats = Column(JSON, nullable=True)   # JSON completo da API para auditoria
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    team = relationship("Team", back_populates="players")


class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    tournament_id = Column(Integer, ForeignKey("tournaments.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    tournament = relationship("Tournament", back_populates="teams")
    players = relationship("Player", back_populates="team")


class FantasyLeague(Base):
    __tablename__ = "fantasy_leagues"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    tournament_id = Column(Integer, ForeignKey("tournaments.id"), nullable=True)
    max_fantasy_teams = Column(Integer, default=10)
    budget_per_team = Column(Float, default=100.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    tournament = relationship("Tournament", back_populates="fantasy_leagues")
    fantasy_teams = relationship("FantasyTeam", back_populates="league")


class FantasyTeam(Base):
    __tablename__ = "fantasy_teams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    league_id = Column(Integer, ForeignKey("fantasy_leagues.id"), nullable=False)
    total_points = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="fantasy_teams")
    league = relationship("FantasyLeague", back_populates="fantasy_teams")
