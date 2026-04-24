# app/models/achievement.py
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class UserAchievement(Base):
    __tablename__ = "user_achievement"
    __table_args__ = (
        UniqueConstraint("user_id", "key", name="uq_user_achievement_key"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("user.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    key: Mapped[str] = mapped_column(
        String(50), nullable=False,
        comment="chave do achievement, ex: first_lineup, top1_day",
    )
    context: Mapped[Optional[dict]] = mapped_column(
        JSONB, nullable=True,
        comment="contexto opcional, ex: {stage_id: 24, stage_name: 'PAS1 D3'}",
    )
    unlocked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    def __repr__(self) -> str:
        return f"<UserAchievement user_id={self.user_id!r} key={self.key!r}>"
