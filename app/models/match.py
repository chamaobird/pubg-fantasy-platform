from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    tournament_id: Mapped[int] = mapped_column(ForeignKey("tournaments.id"), nullable=False, index=True)
    match_number: Mapped[int] = mapped_column(Integer, nullable=False)
    played_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Full match results as JSON: list of {player_id, kills, damage, placement, survival_minutes}
    results_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    tournament: Mapped["Tournament"] = relationship("Tournament", back_populates="matches")
