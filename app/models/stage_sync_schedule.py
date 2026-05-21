# app/models/stage_sync_schedule.py
from __future__ import annotations
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, SmallInteger, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.stage import Stage


class StageSyncSchedule(Base):
    __tablename__ = "stage_sync_schedule"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    stage_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("stage.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tournament_id: Mapped[str] = mapped_column(
        String(40), nullable=False,
        comment="Snapshot de stage.pubg_tournament_id no momento da criação"
    )
    interval_min: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default="15",
        comment="Intervalo em minutos entre cada run do sync"
    )
    run_from: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
        comment="NULL = começa imediatamente; futuro = janela de torneio futuro"
    )
    run_until: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        comment="Horário em que o scheduler para automaticamente"
    )
    last_run_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    runs_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0"
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="'pending'",
        comment="pending | active | completed | cancelled"
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    stage: Mapped["Stage"] = relationship("Stage", lazy="select")

    def __repr__(self) -> str:
        return (
            f"<StageSyncSchedule id={self.id} stage={self.stage_id} "
            f"tid={self.tournament_id!r} status={self.status!r}>"
        )
