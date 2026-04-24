# app/models/person_alias.py
from __future__ import annotations
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.person import Person


class PersonAlias(Base):
    __tablename__ = "person_alias"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    person_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("person.id", ondelete="CASCADE"), nullable=False, index=True
    )
    alias: Mapped[str] = mapped_column(
        String(80), nullable=False, unique=True,
        comment="Alternative name/nick used to find this player in searches",
    )
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    person: Mapped["Person"] = relationship("Person", back_populates="aliases")

    def __repr__(self) -> str:
        return f"<PersonAlias person_id={self.person_id} alias={self.alias!r}>"
