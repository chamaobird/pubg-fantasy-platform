from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    twitch_username: Optional[str] = None
    krafton_id: Optional[str] = None
    discord_username: Optional[str] = None


class UserOut(BaseModel):
    id: int
    username: str
    email: EmailStr
    display_name: Optional[str] = None
    twitch_username: Optional[str] = None
    krafton_id: Optional[str] = None
    discord_username: Optional[str] = None
    created_at: datetime
    is_admin: bool

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
