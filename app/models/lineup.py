# app/models/lineup.py
from __future__ import annotations
from typing import TYPE_CHECKING, List, Optional
from decimal import Decimal
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

if TYPE_CHECKING:
    from app.models.stage_day import StageDay
    from app.models.roster import Roster


class Lineup(Base):
    __tablename__ = "lineup"
    __table_args__ = (
        UniqueConstraint("user_id", "stage_day_id", name="uq_lineup_user_day"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(60), nullable=False, index=True,
        comment="Auth user identifier (UUID string)"
    )
    stage_day_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("stage_day.id", ondelete="RESTRICT"),
        nullable=False, index=True
    )
    is_auto_replicated: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    is_valid: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true"),
        comment="False if any player was removed after submission",
    )
    total_cost: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True,
        comment="Sum of locked costs at lineup_close_at"
    )
    total_points: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True,
        comment="Filled after day scoring"
    )
    submitted_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    # relationships
    stage_day: Mapped["StageDay"] = relationship("StageDay", back_populates="lineups")
    players: Mapped[List["LineupPlayer"]] = relationship(
        "LineupPlayer", back_populates="lineup",
        cascade="all, delete-orphan", lazy="select"
    )

    def __repr__(self) -> str:
        return (
            f"<Lineup id={self.id} user_id={self.user_id!r} "
            f"stage_day_id={self.stage_day_id} valid={self.is_valid}>"
        )


class LineupPlayer(Base):
    __tablename__ = "lineup_player"
    __table_args__ = (
        UniqueConstraint("lineup_id", "roster_id", name="uq_lineup_player"),
        CheckConstraint(
            "slot_type IN ('titular', 'reserve')",
            name="ck_lineup_player_slot_type",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lineup_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("lineup.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    roster_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("roster.id", ondelete="RESTRICT"), nullable=False
    )
    slot_type: Mapped[str] = mapped_column(
        String(10), nullable=False, comment="titular | reserve"
    )
    is_captain: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false"),
        comment="True para o titular escolhido como capitão (multiplicador ×1.3)",
    )
    locked_cost: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, comment="Cost at the moment of lock"
    )
    points_earned: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(8, 2), nullable=True,
        comment="Points credited to user from this player"
    )

    # relationships
    lineup: Mapped["Lineup"] = relationship("Lineup", back_populates="players")
    roster: Mapped["Roster"] = relationship("Roster", back_populates="lineup_entries")

    def __repr__(self) -> str:
        cap = " [C]" if self.is_captain else ""
        return (
            f"<LineupPlayer lineup_id={self.lineup_id} "
            f"roster_id={self.roster_id} slot={self.slot_type!r}{cap}>"
        )
