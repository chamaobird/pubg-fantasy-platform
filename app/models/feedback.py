# app/models/feedback.py
from __future__ import annotations
from typing import Optional
from sqlalchemy import DateTime, Integer, SmallInteger, String, Text, ForeignKey, text
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Feedback(Base):
    __tablename__ = "feedback"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("user.id", ondelete="SET NULL"), nullable=True, index=True
    )
    page: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    rating: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    def __repr__(self) -> str:
        return f"<Feedback id={self.id} user_id={self.user_id!r} rating={self.rating}>"
