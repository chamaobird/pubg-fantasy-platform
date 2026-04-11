# app/models/roster.py
from __future__ import annotations
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.stage import Stage
    from app.models.person import Person
    from app.models.stage_day import StageDay
    from app.models.lineup import LineupPlayer


class Roster(Base):
    __tablename__ = "roster"
    __table_args__ = (
        UniqueConstraint("stage_id", "person_id", name="uq_roster_stage_person"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    stage_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("stage.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    person_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("person.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    team_name: Mapped[Optional[str]] = mapped_column(
        String(80), nullable=True, comment="Team name at the time of this stage"
    )
    fantasy_cost: Mapped[Optional[float]] = mapped_column(
        Numeric(6, 2), nullable=True, comment="Calculated automatically by pricing service"
    )
    cost_override: Mapped[Optional[float]] = mapped_column(
        Numeric(6, 2),
        nullable=True,
        comment="Manual override — used for display, does not block future calcs",
    )
    newcomer_to_tier: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("false"),
        comment="True = no history at this level, cap = championship.pricing_cap_newcomer",
    )
    is_available: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    # relationships
    stage: Mapped["Stage"] = relationship("Stage", back_populates="roster_entries")
    person: Mapped["Person"] = relationship("Person", back_populates="roster_entries")
    price_history: Mapped[List["RosterPriceHistory"]] = relationship(
        "RosterPriceHistory", back_populates="roster", lazy="select"
    )
    lineup_entries: Mapped[List["LineupPlayer"]] = relationship(
        "LineupPlayer", back_populates="roster", lazy="select"
    )

    @property
    def effective_cost(self) -> Optional[float]:
        """Returns cost_override if set, otherwise fantasy_cost."""
        return self.cost_override if self.cost_override is not None else self.fantasy_cost

    def __repr__(self) -> str:
        return (
            f"<Roster id={self.id} stage_id={self.stage_id} "
            f"person_id={self.person_id} cost={self.effective_cost}>"
        )


class RosterPriceHistory(Base):
    __tablename__ = "roster_price_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    roster_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("roster.id", ondelete="CASCADE"), nullable=False, index=True
    )
    stage_day_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("stage_day.id", ondelete="SET NULL"), nullable=True
    )
    cost: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)
    source: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="auto | override"
    )
    recorded_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    # relationships
    roster: Mapped["Roster"] = relationship("Roster", back_populates="price_history")
    stage_day: Mapped[Optional["StageDay"]] = relationship(
        "StageDay", back_populates="price_history"
    )

    def __repr__(self) -> str:
        return (
            f"<RosterPriceHistory id={self.id} roster_id={self.roster_id} "
            f"cost={self.cost} source={self.source!r}>"
        )
