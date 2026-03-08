from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

TournamentType = Enum("official", "custom", name="tournament_type")
TournamentStatus = Enum("upcoming", "active", "finished", "cancelled", name="tournament_status")


class Tournament(Base):
    __tablename__ = "tournaments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    pubg_id: Mapped[str | None] = mapped_column(
        String(255), unique=True, index=True, nullable=True
    )
    region: Mapped[str] = mapped_column(String(50), nullable=False)
    type: Mapped[str] = mapped_column(TournamentType, nullable=False, default="official")
    status: Mapped[str] = mapped_column(TournamentStatus, nullable=False, default="upcoming")
    # JSON blob for any extra scoring configuration not covered by ScoringRule
    scoring_rules_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    end_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    max_teams: Mapped[int] = mapped_column(Integer, default=16)
    budget_limit: Mapped[float] = mapped_column(Numeric(8, 2), default=100.0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    creator: Mapped["User | None"] = relationship("User", back_populates="tournaments")
    matches: Mapped[list["Match"]] = relationship("Match", back_populates="tournament")
    fantasy_teams: Mapped[list["FantasyTeam"]] = relationship("FantasyTeam", back_populates="tournament")
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
    # JSON: {"1": 1.5, "2": 1.3, "3": 1.1, "4-10": 1.0, "11+": 0.8}
    placement_multiplier_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    tournament: Mapped["Tournament"] = relationship("Tournament", back_populates="scoring_rule")
