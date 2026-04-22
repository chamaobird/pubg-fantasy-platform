# app/models/team.py
from __future__ import annotations
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, DateTime, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.team_member import TeamMember


class Team(Base):
    __tablename__ = "team"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    tag: Mapped[str] = mapped_column(String(10), nullable=False, unique=True)
    region: Mapped[str] = mapped_column(String(50), nullable=False)
    logo_path: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    members: Mapped[List["TeamMember"]] = relationship(
        "TeamMember", back_populates="team", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<Team id={self.id} tag={self.tag!r} region={self.region!r}>"
