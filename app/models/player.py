from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Player(Base):
    __tablename__ = "players"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    team_id: Mapped[int | None] = mapped_column(ForeignKey("teams.id"), nullable=True)
    role: Mapped[str | None] = mapped_column(String(50), nullable=True)  # e.g. fragger, IGL, support
    price: Mapped[float] = mapped_column(Numeric(6, 2), default=10.0)
    price_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    team: Mapped["Team | None"] = relationship("Team", back_populates="players")
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
