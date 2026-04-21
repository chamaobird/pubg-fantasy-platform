# app/models/user.py
from __future__ import annotations
from typing import Optional
from sqlalchemy import Boolean, DateTime, String, text
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class User(Base):
    __tablename__ = "user"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, comment="UUID v4"
    )
    email: Mapped[str] = mapped_column(String(254), nullable=False, unique=True, index=True)
    username: Mapped[Optional[str]] = mapped_column(String(40), nullable=True, unique=True)
    password_hash: Mapped[Optional[str]] = mapped_column(
        String(128), nullable=True, comment="null for Google-only accounts"
    )
    google_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, unique=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    is_admin: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )
    email_verified: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    email_verify_token: Mapped[Optional[str]] = mapped_column(
        String(64), nullable=True, index=True
    )
    email_verify_expires_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    password_reset_token: Mapped[Optional[str]] = mapped_column(
        String(64), nullable=True, index=True
    )
    password_reset_expires_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    def __repr__(self) -> str:
        return f"<User id={self.id!r} email={self.email!r} is_admin={self.is_admin}>"
