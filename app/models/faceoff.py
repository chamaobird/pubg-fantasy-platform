# app/models/faceoff.py
from __future__ import annotations
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, SmallInteger, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.championship import Championship
    from app.models.user import User


class Faceoff(Base):
    __tablename__ = "faceoff"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    championship_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("championship.id", ondelete="CASCADE"), nullable=False, index=True
    )
    team_a_name: Mapped[str] = mapped_column(String(80), nullable=False)
    team_b_name: Mapped[str] = mapped_column(String(80), nullable=False)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default=text("'draft'"),
        comment="draft | open | closed | resolved"
    )
    winner_team_name: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    seed_a: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    seed_b: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    championship: Mapped["Championship"] = relationship("Championship", back_populates="faceoffs")
    votes: Mapped[List["FaceoffVote"]] = relationship(
        "FaceoffVote", back_populates="faceoff", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Faceoff id={self.id} {self.team_a_name} vs {self.team_b_name} [{self.status}]>"


class FaceoffVote(Base):
    __tablename__ = "faceoff_vote"
    __table_args__ = (
        UniqueConstraint("faceoff_id", "user_id", name="uq_faceoff_vote_user"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    faceoff_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("faceoff.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("user.id", ondelete="CASCADE"), nullable=False
    )
    voted_for: Mapped[str] = mapped_column(String(1), nullable=False, comment="'a' ou 'b'")
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    faceoff: Mapped["Faceoff"] = relationship("Faceoff", back_populates="votes")
    user: Mapped["User"] = relationship("User")

    def __repr__(self) -> str:
        return f"<FaceoffVote faceoff={self.faceoff_id} user={self.user_id} voted={self.voted_for}>"
