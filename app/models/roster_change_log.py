# app/models/roster_change_log.py
from __future__ import annotations
from typing import Optional
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class RosterChangeLog(Base):
    __tablename__ = "roster_change_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    roster_id: Mapped[int] = mapped_column(Integer, ForeignKey("roster.id", ondelete="CASCADE"), nullable=False, index=True)
    stage_id: Mapped[int] = mapped_column(Integer, ForeignKey("stage.id", ondelete="CASCADE"), nullable=False, index=True)
    person_id: Mapped[int] = mapped_column(Integer, ForeignKey("person.id", ondelete="CASCADE"), nullable=False)
    change_type: Mapped[str] = mapped_column(String(30), nullable=False)
    field_name: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    old_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    new_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    changed_by_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    changed_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    note: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
