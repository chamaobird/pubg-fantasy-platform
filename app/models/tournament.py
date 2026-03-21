from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text, func, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Tournament(Base):
    __tablename__ = "tournaments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    pubg_id: Mapped[str | None] = mapped_column(
        String(255), unique=True, index=True, nullable=True
    )
    region: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="upcoming")
    scoring_rules_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    end_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    max_teams: Mapped[int] = mapped_column(Integer, default=16)
    budget_limit: Mapped[float] = mapped_column(Numeric(8, 2), default=100.0)
    lineup_open: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    creator: Mapped["User | None"] = relationship("User", back_populates="tournaments")
    matches: Mapped[list["Match"]] = relationship("Match", back_populates="tournament")
    fantasy_teams: Mapped[list["FantasyTeam"]] = relationship("FantasyTeam", back_populates="tournament")
    players: Mapped[list["Player"]] = relationship("Player", back_populates="tournament")
    lineups: Mapped[list["Lineup"]] = relationship("Lineup", back_populates="tournament")
    scoring_rule: Mapped["ScoringRule | None"] = relationship(
        "ScoringRule", back_populates="tournament", uselist=False
    )


class ScoringRule(Base):
    __tablename__ = "scoring_rules"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    tournament_id: Mapped[int] = mapped_column(
        ForeignKey("tournaments.id"), nullable=False, unique=True, index=True
    )
    kill_points: Mapped[float] = mapped_column(Numeric(5, 2), default=15.0)
    damage_per_100: Mapped[float] = mapped_column(Numeric(5, 2), default=5.0)
    survival_points: Mapped[float] = mapped_column(Numeric(5, 2), default=1.0)
    early_death_penalty: Mapped[float] = mapped_column(Numeric(5, 2), default=-5.0)
    placement_multiplier_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    tournament: Mapped["Tournament"] = relationship("Tournament", back_populates="scoring_rule")
