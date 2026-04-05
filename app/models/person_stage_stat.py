# app/models/person_stage_stat.py
from __future__ import annotations
from typing import TYPE_CHECKING, Optional
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, SmallInteger, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.person import Person
    from app.models.stage import Stage


class PersonStageStat(Base):
    __tablename__ = "person_stage_stat"
    __table_args__ = (
        UniqueConstraint("person_id", "stage_id", name="uq_person_stage_stat"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    person_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("person.id", ondelete="RESTRICT"), nullable=False
    )
    stage_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("stage.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    total_xama_points: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, server_default="0"
    )
    matches_played: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default="0"
    )
    pts_per_match: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(8, 4),
        nullable=True,
        comment="Main pricing metric: total_xama_points / matches_played",
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    # relationships
    person: Mapped["Person"] = relationship("Person", back_populates="stage_stats")
    stage: Mapped["Stage"] = relationship("Stage", back_populates="person_stats")

    def __repr__(self) -> str:
        return (
            f"<PersonStageStat person_id={self.person_id} "
            f"stage_id={self.stage_id} ppm={self.pts_per_match}>"
        )
