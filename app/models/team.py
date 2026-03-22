from typing import Optional

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Team(Base):
    __tablename__ = "teams"

    id:       Mapped[int]           = mapped_column(primary_key=True, index=True)
    name:     Mapped[str]           = mapped_column(String(100), unique=True, nullable=False)
    logo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    players: Mapped[list["Player"]] = relationship("Player", back_populates="team")