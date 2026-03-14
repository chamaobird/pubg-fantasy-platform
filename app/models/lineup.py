from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Table, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


lineup_players = Table(
    "lineup_players",
    Base.metadata,
    Column("lineup_id", Integer, ForeignKey("lineups.id", ondelete="CASCADE"), primary_key=True),
    Column("player_id", Integer, ForeignKey("players.id", ondelete="CASCADE"), primary_key=True),
    Column("slot", Integer, nullable=False),
    Column("added_at", DateTime(timezone=True), server_default=func.now()),
    UniqueConstraint("lineup_id", "slot", name="uq_lineup_slot"),
)


class Lineup(Base):
    __tablename__ = "lineups"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    tournament_id: Mapped[int] = mapped_column(ForeignKey("tournaments.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    captain_player_id: Mapped[int] = mapped_column(ForeignKey("players.id"), nullable=False)
    reserve_player_id: Mapped[int | None] = mapped_column(ForeignKey("players.id"), nullable=True)
    total_points: Mapped[float] = mapped_column(Numeric(10, 2), server_default="0", nullable=False, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship("User", back_populates="lineups")
    tournament: Mapped["Tournament"] = relationship("Tournament", back_populates="lineups")
    captain: Mapped["Player"] = relationship("Player", foreign_keys=[captain_player_id])
    reserve_player: Mapped["Player | None"] = relationship(
        "Player", foreign_keys=[reserve_player_id]
    )
    players: Mapped[list["Player"]] = relationship(
        "Player",
        secondary=lineup_players,
        backref="lineups_assoc",
        order_by=lineup_players.c.slot,
    )
    scores: Mapped[list["LineupScore"]] = relationship(
        "LineupScore", back_populates="lineup", cascade="all, delete-orphan"
    )
