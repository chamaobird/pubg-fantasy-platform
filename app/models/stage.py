# app/models/stage.py
from __future__ import annotations
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.championship import Championship
    from app.models.stage_day import StageDay
    from app.models.roster import Roster
    from app.models.person_stage_stat import PersonStageStat
    from app.models.user_stat import UserStageStat


class Stage(Base):
    __tablename__ = "stage"
    __table_args__ = (
        CheckConstraint(
            "lineup_status IN ('closed', 'open', 'locked')",
            name="ck_stage_lineup_status",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    championship_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("championship.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    shard: Mapped[str] = mapped_column(
        String(30), nullable=False, comment="steam | pc-tournament"
    )
    carries_stats_from: Mapped[Optional[List[int]]] = mapped_column(
        ARRAY(Integer),
        nullable=True,
        comment="stage_ids whose stats feed pricing for this stage",
    )
    lineup_open_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    lineup_close_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    lineup_status: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        server_default="closed",
        comment="closed | open | locked",
    )
    roster_source_stage_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("stage.id", ondelete="SET NULL"),
        nullable=True,
        comment="Stage to copy base roster from",
    )
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    # relationships
    championship: Mapped["Championship"] = relationship(
        "Championship", back_populates="stages"
    )
    days: Mapped[List["StageDay"]] = relationship(
        "StageDay", back_populates="stage", lazy="select"
    )
    roster_entries: Mapped[List["Roster"]] = relationship(
        "Roster", back_populates="stage", lazy="select"
    )
    person_stats: Mapped[List["PersonStageStat"]] = relationship(
        "PersonStageStat", back_populates="stage", lazy="select"
    )
    user_stats: Mapped[List["UserStageStat"]] = relationship(
        "UserStageStat", back_populates="stage", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<Stage id={self.id} name={self.name!r} status={self.lineup_status!r}>"
