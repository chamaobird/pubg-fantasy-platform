# app/models/stage.py
from __future__ import annotations
from typing import TYPE_CHECKING, List, Optional
from decimal import Decimal

from sqlalchemy import (
    Boolean, DateTime, ForeignKey, Integer, Numeric, SmallInteger,
    String, text, ARRAY
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.championship import Championship
    from app.models.stage_day import StageDay
    from app.models.roster import Roster
    from app.models.person_stage_stat import PersonStageStat


class Stage(Base):
    __tablename__ = "stage"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    championship_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("championship.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    short_name: Mapped[str] = mapped_column(String(30), nullable=False)
    shard: Mapped[str] = mapped_column(
        String(30), nullable=False, comment="steam | pc-tournament"
    )

    # Stats inheritance
    carries_stats_from: Mapped[Optional[List[int]]] = mapped_column(
        ARRAY(Integer),
        nullable=True,
        comment="List of stage_ids whose stats feed pricing for this stage",
    )
    roster_source_stage_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("stage.id", ondelete="SET NULL"),
        nullable=True,
        comment="Stage from which to copy the base roster",
    )

    # Lineup control
    lineup_open_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    lineup_close_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    lineup_status: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        server_default="'closed'",
        comment="closed | open | locked",
    )
    lineup_size: Mapped[int] = mapped_column(
        SmallInteger,
        nullable=False,
        server_default="4",
        comment="Number of starters per lineup (reserves excluded)",
    )

    # Captain multiplier — configurável por torneio
    captain_multiplier: Mapped[Decimal] = mapped_column(
        Numeric(4, 2),
        nullable=False,
        server_default="1.30",
        comment="Points multiplier applied to the captain's score (e.g. 1.3 = ×1.3)",
    )

    # Pricing configuration
    price_min: Mapped[int] = mapped_column(
        SmallInteger,
        nullable=False,
        server_default="12",
        comment="Cost assigned to the lowest-performing player on the roster",
    )
    price_max: Mapped[int] = mapped_column(
        SmallInteger,
        nullable=False,
        server_default="35",
        comment="Cost assigned to the highest-performing player on the roster",
    )
    pricing_distribution: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        server_default="'linear'",
        comment="Distribution model: linear | (future: sqrt, quadratic)",
    )
    pricing_n_matches: Mapped[int] = mapped_column(
        SmallInteger,
        nullable=False,
        server_default="20",
        comment="How many recent MatchStats to average for pts_per_match_effective",
    )
    pricing_newcomer_cost: Mapped[int] = mapped_column(
        SmallInteger,
        nullable=False,
        server_default="15",
        comment="Default cost for players with newcomer_to_tier=true or no match history",
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
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

    def __repr__(self) -> str:
        return f"<Stage id={self.id} short_name={self.short_name!r} status={self.lineup_status!r}>"