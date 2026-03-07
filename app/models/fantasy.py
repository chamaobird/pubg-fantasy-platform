from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class FantasyTeam(Base):
    __tablename__ = "fantasy_teams"
    __table_args__ = (
        UniqueConstraint("user_id", "tournament_id", name="uq_user_tournament"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    tournament_id: Mapped[int] = mapped_column(ForeignKey("tournaments.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    total_points: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    captain_player_id: Mapped[int | None] = mapped_column(ForeignKey("players.id"), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="fantasy_teams")
    tournament: Mapped["Tournament"] = relationship("Tournament", back_populates="fantasy_teams")
    captain: Mapped["Player | None"] = relationship("Player", foreign_keys=[captain_player_id])
    entries: Mapped[list["FantasyEntry"]] = relationship(
        "FantasyEntry", back_populates="fantasy_team", cascade="all, delete-orphan"
    )


class FantasyEntry(Base):
    __tablename__ = "fantasy_entries"
    __table_args__ = (
        UniqueConstraint("fantasy_team_id", "player_id", name="uq_team_player"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    fantasy_team_id: Mapped[int] = mapped_column(ForeignKey("fantasy_teams.id"), nullable=False, index=True)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id"), nullable=False, index=True)
    is_captain: Mapped[bool] = mapped_column(Boolean, default=False)

    fantasy_team: Mapped["FantasyTeam"] = relationship("FantasyTeam", back_populates="entries")
    player: Mapped["Player"] = relationship("Player", back_populates="fantasy_entries")


class FantasyLeague(Base):
    __tablename__ = "fantasy_leagues"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    tournament_id: Mapped[int] = mapped_column(ForeignKey("tournaments.id"), nullable=False, index=True)
    max_fantasy_teams: Mapped[int] = mapped_column(default=10)
    budget_per_team: Mapped[float] = mapped_column(Numeric(8, 2), default=100.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    tournament: Mapped["Tournament"] = relationship("Tournament")
