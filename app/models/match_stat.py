# app/models/match_stat.py
from __future__ import annotations
from typing import TYPE_CHECKING, Optional
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, SmallInteger, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.match import Match
    from app.models.person import Person


class MatchStat(Base):
    __tablename__ = "match_stat"
    __table_args__ = (
        UniqueConstraint("match_id", "person_id", name="uq_match_stat_match_person"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    match_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("match.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    person_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("person.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    account_id_used: Mapped[Optional[str]] = mapped_column(
        String(80), nullable=True, comment="Traceability: which player_account was resolved"
    )
    # raw stats
    kills: Mapped[int] = mapped_column(SmallInteger, nullable=False, server_default="0")
    assists: Mapped[int] = mapped_column(SmallInteger, nullable=False, server_default="0")
    damage: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False, server_default="0")
    placement: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    survival_time: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, comment="Seconds"
    )
    knocks: Mapped[int] = mapped_column(SmallInteger, nullable=False, server_default="0")
    # computed
    base_points: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(8, 2), nullable=True, comment="Base points before late game bonus"
    )
    late_game_bonus: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(8, 2), nullable=True, comment="Late game bonus points"
    )
    xama_points: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(8, 2), nullable=True, comment="Total points (base + late game bonus)"
    )
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    # relationships
    match: Mapped["Match"] = relationship("Match", back_populates="stats")
    person: Mapped["Person"] = relationship("Person", back_populates="match_stats")

    def __repr__(self) -> str:
        return (
            f"<MatchStat id={self.id} match_id={self.match_id} "
            f"person_id={self.person_id} pts={self.xama_points}>"
        )
