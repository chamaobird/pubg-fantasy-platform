# app/models/substitution.py
from __future__ import annotations
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.stage import Stage
    from app.models.person import Person


class StageSubstitution(Base):
    """Registra substituições: jogador titular que não jogou vs. sub que entrou."""
    __tablename__ = "stage_substitution"
    __table_args__ = (
        UniqueConstraint("stage_id", "out_person_id", name="uq_sub_stage_out"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    stage_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("stage.id", ondelete="CASCADE"), nullable=False, index=True
    )
    out_person_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("person.id", ondelete="CASCADE"), nullable=False
    )
    in_person_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("person.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    stage: Mapped["Stage"] = relationship("Stage")
    out_person: Mapped["Person"] = relationship("Person", foreign_keys=[out_person_id])
    in_person: Mapped["Person"] = relationship("Person", foreign_keys=[in_person_id])

    def __repr__(self) -> str:
        return f"<StageSubstitution stage={self.stage_id} out={self.out_person_id} in={self.in_person_id}>"
