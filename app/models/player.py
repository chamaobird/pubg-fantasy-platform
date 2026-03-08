from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, Numeric, String, Text, func, true
from sqlalchemy.orm import Mapped, column_property, mapped_column, relationship, synonym

from app.database import Base


class Player(Base):
    __tablename__ = "players"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    pubg_id: Mapped[str | None] = mapped_column(String(255), unique=True, index=True, nullable=True)
    region: Mapped[str | None] = mapped_column(String(50), nullable=True)
    nationality: Mapped[str | None] = mapped_column(String(50), nullable=True)
    tournament_id: Mapped[int | None] = mapped_column(ForeignKey("tournaments.id"), nullable=True, index=True)
    team_id: Mapped[int | None] = mapped_column(ForeignKey("teams.id"), nullable=True)
    fantasy_cost: Mapped[float] = mapped_column(Float, default=10.0)
    position: Mapped[str | None] = mapped_column(String(50), nullable=True)
    avg_kills: Mapped[float | None] = mapped_column(Float, default=0.0)
    avg_damage: Mapped[float | None] = mapped_column(Float, default=0.0)
    avg_placement: Mapped[float | None] = mapped_column(Float, default=0.0)
    matches_played: Mapped[int | None] = mapped_column(Integer, default=0)
    raw_stats: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    price: Mapped[float] = synonym("fantasy_cost")
    role: Mapped[str | None] = synonym("position")
    is_active: Mapped[bool] = column_property(true())

    team: Mapped["Team | None"] = relationship("Team", back_populates="players")
    tournament: Mapped["Tournament | None"] = relationship("Tournament", back_populates="players")
    price_history: Mapped[list["PlayerPriceHistory"]] = relationship(
        "PlayerPriceHistory", back_populates="player", order_by="PlayerPriceHistory.changed_at.desc()"
    )
    fantasy_entries: Mapped[list["FantasyEntry"]] = relationship("FantasyEntry", back_populates="player")


class PlayerPriceHistory(Base):
    __tablename__ = "player_price_history"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id"), nullable=False, index=True)
    old_price: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)
    new_price: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Stores the full PriceComponents dict so users can see exactly how price was derived
    formula_components_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    player: Mapped["Player"] = relationship("Player", back_populates="price_history")
