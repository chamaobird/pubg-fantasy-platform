# app/models/match.py
from __future__ import annotations
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.stage_day import StageDay
    from app.models.match_stat import MatchStat


class Match(Base):
    __tablename__ = "match"
    __table_args__ = (
        UniqueConstraint("pubg_match_id", "shard", name="uq_match_pubg_shard"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    stage_day_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("stage_day.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    pubg_match_id: Mapped[str] = mapped_column(
        String(60), nullable=False, comment="UUID from PUBG API"
    )
    shard: Mapped[str] = mapped_column(
        String(30), nullable=False, comment="Inherited from Stage at import time"
    )
    played_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    # relationships
    stage_day: Mapped["StageDay"] = relationship("StageDay", back_populates="matches")
    stats: Mapped[List["MatchStat"]] = relationship(
        "MatchStat", back_populates="match", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<Match id={self.id} pubg_match_id={self.pubg_match_id!r}>"
