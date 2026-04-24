# app/models/league.py
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, List

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    pass


class League(Base):
    __tablename__ = "league"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    owner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("user.id", ondelete="RESTRICT"),
        nullable=False, index=True,
    )
    championship_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("championship.id", ondelete="RESTRICT"),
        nullable=False, index=True,
    )
    invite_code: Mapped[str] = mapped_column(
        String(8), nullable=False, unique=True, index=True,
        comment="código de convite gerado aleatoriamente (8 chars alfanumérico)",
    )
    max_members: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("50"),
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()"),
    )

    members: Mapped[List["LeagueMember"]] = relationship(
        "LeagueMember", back_populates="league", cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<League id={self.id} name={self.name!r} code={self.invite_code!r}>"


class LeagueMember(Base):
    __tablename__ = "league_member"
    __table_args__ = (
        UniqueConstraint("league_id", "user_id", name="uq_league_member"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    league_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("league.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("user.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()"),
    )

    league: Mapped["League"] = relationship("League", back_populates="members")

    def __repr__(self) -> str:
        return f"<LeagueMember league_id={self.league_id} user_id={self.user_id!r}>"
