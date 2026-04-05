# app/models/player_account.py
from __future__ import annotations
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.person import Person


class PlayerAccount(Base):
    __tablename__ = "player_account"
    __table_args__ = (
        UniqueConstraint(
            "account_id", "shard", "active_from", name="uq_player_account_shard_from"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    person_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("person.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    account_id: Mapped[str] = mapped_column(
        String(80), nullable=False, comment="PUBG account_id from the API"
    )
    shard: Mapped[str] = mapped_column(
        String(30), nullable=False, comment="steam | pc-tournament"
    )
    alias: Mapped[Optional[str]] = mapped_column(
        String(80), nullable=True, comment="Steam name or in-game alias at that time"
    )
    active_from: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    active_until: Mapped[Optional[DateTime]] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="null = still active"
    )

    # relationships
    person: Mapped["Person"] = relationship("Person", back_populates="accounts")

    def __repr__(self) -> str:
        return (
            f"<PlayerAccount id={self.id} account_id={self.account_id!r} "
            f"shard={self.shard!r} alias={self.alias!r}>"
        )
