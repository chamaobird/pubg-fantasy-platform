# app/models/person.py
from __future__ import annotations
from typing import TYPE_CHECKING, List

from sqlalchemy import Boolean, DateTime, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.player_account import PlayerAccount
    from app.models.roster import Roster
    from app.models.match_stat import MatchStat
    from app.models.person_stage_stat import PersonStageStat


class Person(Base):
    __tablename__ = "person"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    display_name: Mapped[str] = mapped_column(
        String(80), nullable=False, comment="Canonical name shown in the platform"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("true"),
        comment="Never deleted, only deactivated",
    )
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    # relationships
    accounts: Mapped[List["PlayerAccount"]] = relationship(
        "PlayerAccount", back_populates="person", lazy="select"
    )
    roster_entries: Mapped[List["Roster"]] = relationship(
        "Roster", back_populates="person", lazy="select"
    )
    match_stats: Mapped[List["MatchStat"]] = relationship(
        "MatchStat", back_populates="person", lazy="select"
    )
    stage_stats: Mapped[List["PersonStageStat"]] = relationship(
        "PersonStageStat", back_populates="person", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<Person id={self.id} display_name={self.display_name!r}>"
