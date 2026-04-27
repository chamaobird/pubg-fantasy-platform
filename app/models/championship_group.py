# app/models/championship_group.py
from __future__ import annotations
from typing import TYPE_CHECKING, List

from sqlalchemy import (
    Boolean, DateTime, ForeignKey, Integer, SmallInteger, String,
    UniqueConstraint, text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.championship import Championship


class ChampionshipGroup(Base):
    __tablename__ = "championship_group"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    short_name: Mapped[str] = mapped_column(String(30), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )
    display_order: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default="0",
        comment="Lower values appear first in listings",
    )
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    # relationships
    members: Mapped[List["ChampionshipGroupMember"]] = relationship(
        "ChampionshipGroupMember",
        back_populates="group",
        cascade="all, delete-orphan",
        lazy="select",
        order_by="ChampionshipGroupMember.display_order",
    )

    def __repr__(self) -> str:
        return f"<ChampionshipGroup id={self.id} short_name={self.short_name!r}>"


class ChampionshipGroupMember(Base):
    __tablename__ = "championship_group_member"
    __table_args__ = (
        UniqueConstraint("group_id", "championship_id", name="uq_group_championship"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    group_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("championship_group.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    championship_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("championship.id", ondelete="CASCADE"),
        nullable=False,
    )
    display_order: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default="0",
        comment="Order of this championship within the group",
    )

    # relationships
    group: Mapped["ChampionshipGroup"] = relationship(
        "ChampionshipGroup", back_populates="members"
    )
    championship: Mapped["Championship"] = relationship("Championship")

    def __repr__(self) -> str:
        return (
            f"<ChampionshipGroupMember group_id={self.group_id} "
            f"championship_id={self.championship_id}>"
        )
