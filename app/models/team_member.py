# app/models/team_member.py
from __future__ import annotations
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, Index, Integer, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.team import Team
    from app.models.person import Person


class TeamMember(Base):
    __tablename__ = "team_member"
    __table_args__ = (
        # Garante que uma Person só tem UMA membership ativa (left_at IS NULL) por vez.
        # Índice parcial — PostgreSQL-specific, ignorado silenciosamente em outros SGBDs.
        Index(
            "uq_team_member_active_person",
            "person_id",
            unique=True,
            postgresql_where=text("left_at IS NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    team_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("team.id"), nullable=False, index=True
    )
    person_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("person.id"), nullable=False, index=True
    )
    joined_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    left_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    team: Mapped["Team"] = relationship("Team", back_populates="members")
    person: Mapped["Person"] = relationship("Person")

    def __repr__(self) -> str:
        return (
            f"<TeamMember team_id={self.team_id} person_id={self.person_id} "
            f"active={self.left_at is None}>"
        )
