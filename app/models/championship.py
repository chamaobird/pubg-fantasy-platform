# app/models/championship.py
from __future__ import annotations
from decimal import Decimal
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, DateTime, Integer, Numeric, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.stage import Stage


class Championship(Base):
    __tablename__ = "championship"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    short_name: Mapped[str] = mapped_column(String(30), nullable=False)
    shard: Mapped[str] = mapped_column(
        String(30), nullable=False, comment="steam | pc-tournament"
    )
    pricing_weight: Mapped[Decimal] = mapped_column(
        Numeric(5, 4),
        nullable=False,
        server_default="1.0",
        comment="Weight applied when this championship's stats feed future pricing",
    )
    pricing_cap_newcomer: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        comment="Max fantasy cost for players with newcomer_to_tier=true",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    # relationships
    stages: Mapped[List["Stage"]] = relationship(
        "Stage", back_populates="championship", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<Championship id={self.id} short_name={self.short_name!r}>"
