from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    username: str


class UserOut(BaseModel):
    id: int
    username: str
    email: EmailStr
    is_admin: bool
    created_at: datetime
    has_password: bool = False  # True = conta email, False = conta Google

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_with_flags(cls, user):
        # Conta Google tem hashed_password como token hex de 64 chars sem $
        has_pwd = bool(user.hashed_password and '$' in user.hashed_password)
        return cls(
            id=user.id,
            username=user.username,
            email=user.email,
            is_admin=user.is_admin,
            created_at=user.created_at,
            has_password=has_pwd,
        )


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
