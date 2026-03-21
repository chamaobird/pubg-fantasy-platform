# app/models/championship.py
from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship
from app.database import Base


class Championship(Base):
    __tablename__ = "championships"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String(200), nullable=False)
    short_name = Column(String(50), nullable=True)
    region     = Column(String(50), nullable=True)
    status     = Column(String(20), nullable=False, default='active')
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    phases = relationship("ChampionshipTournament", back_populates="championship", order_by="ChampionshipTournament.phase_order")


class ChampionshipTournament(Base):
    __tablename__ = "championship_tournaments"

    championship_id = Column(Integer, ForeignKey("championships.id", ondelete="CASCADE"), primary_key=True)
    tournament_id   = Column(Integer, ForeignKey("tournaments.id",   ondelete="CASCADE"), primary_key=True)
    phase           = Column(String(100), nullable=True)
    phase_order     = Column(Integer, nullable=False, default=0)

    championship = relationship("Championship", back_populates="phases")
    tournament   = relationship("Tournament")