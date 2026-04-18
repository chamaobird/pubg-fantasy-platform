# app/models/stage_day.py
from __future__ import annotations
from typing import TYPE_CHECKING, List, Optional
import datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, SmallInteger, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.stage import Stage
    from app.models.match import Match
    from app.models.lineup import Lineup
    from app.models.user_stat import UserDayStat
    from app.models.roster import RosterPriceHistory


class StageDay(Base):
    __tablename__ = "stage_day"
    __table_args__ = (
        UniqueConstraint("stage_id", "day_number", name="uq_stage_day"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    stage_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("stage.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    day_number: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    lineup_close_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Matches first match start time for this day",
    )
    match_schedule: Mapped[Optional[list]] = mapped_column(
        JSONB,
        nullable=True,
        comment="[{match_number, import_after, pubg_match_id?, processed_at?}, ...]",
    )
    last_import_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp do último import automático bem-sucedido neste dia",
    )
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    # relationships
    stage: Mapped["Stage"] = relationship("Stage", back_populates="days")
    matches: Mapped[List["Match"]] = relationship(
        "Match", back_populates="stage_day", lazy="select"
    )
    lineups: Mapped[List["Lineup"]] = relationship(
        "Lineup", back_populates="stage_day", lazy="select"
    )
    user_day_stats: Mapped[List["UserDayStat"]] = relationship(
        "UserDayStat", back_populates="stage_day", lazy="select"
    )
    price_history: Mapped[List["RosterPriceHistory"]] = relationship(
        "RosterPriceHistory", back_populates="stage_day", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<StageDay id={self.id} stage_id={self.stage_id} day={self.day_number}>"
