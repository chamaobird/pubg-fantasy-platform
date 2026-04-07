# app/models/user_stat.py
from __future__ import annotations
from typing import TYPE_CHECKING, Optional
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, SmallInteger, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.stage import Stage
    from app.models.stage_day import StageDay


class UserStageStat(Base):
    __tablename__ = "user_stage_stat"
    __table_args__ = (
        UniqueConstraint("user_id", "stage_id", name="uq_user_stage_stat"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    stage_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("stage.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    total_points: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, server_default="0"
    )
    days_played: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default="0"
    )
    rank: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, comment="Position in stage leaderboard"
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    # relationships
    stage: Mapped["Stage"] = relationship("Stage")

    def __repr__(self) -> str:
        return (
            f"<UserStageStat user_id={self.user_id!r} "
            f"stage_id={self.stage_id} pts={self.total_points}>"
        )


class UserDayStat(Base):
    __tablename__ = "user_day_stat"
    __table_args__ = (
        UniqueConstraint("user_id", "stage_day_id", name="uq_user_day_stat"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    stage_day_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("stage_day.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    points: Mapped[Decimal] = mapped_column(
        Numeric(8, 2), nullable=False, server_default="0"
    )
    rank: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, comment="Position in day leaderboard"
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    # relationships
    stage_day: Mapped["StageDay"] = relationship("StageDay", back_populates="user_day_stats")

    def __repr__(self) -> str:
        return (
            f"<UserDayStat user_id={self.user_id!r} "
            f"stage_day_id={self.stage_day_id} pts={self.points}>"
        )
