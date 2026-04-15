# app/schemas/auth.py
from __future__ import annotations
from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator


# -- Register ------------------------------------------------------------------

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    username: Optional[str] = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

    @field_validator("username")
    @classmethod
    def username_format(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Username must be at least 3 characters")
        if len(v) > 15:
            raise ValueError("Username must be at most 15 characters")
        if not v.replace("_", "").replace("-", "").replace(".", "").isalnum():
            raise ValueError("Username can only contain letters, numbers, _, - and .")
        return v


# -- Login ---------------------------------------------------------------------

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# -- Token ---------------------------------------------------------------------

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# -- User responses ------------------------------------------------------------

class UserResponse(BaseModel):
    id: str
    email: str
    username: Optional[str]
    avatar_url: Optional[str]
    is_admin: bool
    email_verified: bool
    has_password: bool = False  # True se conta tem senha definida (nao Google-only)

    @classmethod
    def from_orm(cls, obj):
        return cls(
            id=obj.id,
            email=obj.email,
            username=obj.username,
            avatar_url=obj.avatar_url,
            is_admin=obj.is_admin,
            email_verified=obj.email_verified,
            has_password=bool(obj.password_hash),
        )

    model_config = {"from_attributes": True}


class UserUpdateRequest(BaseModel):
    username: Optional[str] = None
    avatar_url: Optional[str] = None

    @field_validator("username")
    @classmethod
    def username_format(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Username must be at least 3 characters")
        if len(v) > 15:
            raise ValueError("Username must be at most 15 characters")
        if not v.replace("_", "").replace("-", "").replace(".", "").isalnum():
            raise ValueError("Username can only contain letters, numbers, _, - and .")
        return v
