# app/models/championship.py
from __future__ import annotations
from typing import TYPE_CHECKING, List

from typing import Optional

from sqlalchemy import Boolean, DateTime, Integer, Numeric, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.stage import Stage
    from app.models.faceoff import Faceoff


class Championship(Base):
    __tablename__ = "championship"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    short_name: Mapped[str] = mapped_column(String(30), nullable=False)
    shard: Mapped[str] = mapped_column(
        String(30), nullable=False, comment="steam | pc-tournament"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )
    tier_weight: Mapped[float] = mapped_column(
        Numeric(4, 2),
        nullable=False,
        server_default="1.00",
        comment="Pricing weight: PGS/PGC=1.00, regional (PAS)=0.70, etc.",
    )
    has_faceoff: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false"),
        comment="Se True, championship tem Team Faceoff habilitado",
    )
    finished_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
        comment="Setado automaticamente quando todos os stages vão para finished",
    )
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    # relationships
    stages: Mapped[List["Stage"]] = relationship(
        "Stage", back_populates="championship", lazy="select"
    )
    faceoffs: Mapped[List["Faceoff"]] = relationship(
        "Faceoff", back_populates="championship", lazy="select", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Championship id={self.id} short_name={self.short_name!r}>"
