# app/models/email_log.py
from __future__ import annotations
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Integer, String, JSON, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class EmailLog(Base):
    __tablename__ = "email_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    template_key: Mapped[str] = mapped_column(String(60), nullable=False)
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    recipient_group: Mapped[str] = mapped_column(String(50), nullable=False)
    stage_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    sent_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    variables: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    triggered_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    def __repr__(self) -> str:
        return (
            f"<EmailLog id={self.id} template={self.template_key!r} "
            f"sent={self.sent_count} failed={self.failed_count}>"
        )
