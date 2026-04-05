# app/schemas/person.py
from __future__ import annotations
from typing import Optional, List
from datetime import datetime

from pydantic import BaseModel, field_validator


# ── PlayerAccount schemas ─────────────────────────────────────────────────────

class PlayerAccountCreate(BaseModel):
    account_id: str
    shard: str
    alias: Optional[str] = None

    @field_validator("shard")
    @classmethod
    def valid_shard(cls, v: str) -> str:
        allowed = {"steam", "pc-tournament"}
        if v not in allowed:
            raise ValueError(f"shard must be one of: {', '.join(sorted(allowed))}")
        return v

    @field_validator("account_id")
    @classmethod
    def account_id_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("account_id cannot be empty")
        return v


class PlayerAccountCloseRequest(BaseModel):
    active_until: datetime


class PlayerAccountResponse(BaseModel):
    id: int
    person_id: int
    account_id: str
    shard: str
    alias: Optional[str]
    active_from: datetime
    active_until: Optional[datetime]

    model_config = {"from_attributes": True}


# ── Person schemas ────────────────────────────────────────────────────────────

class PersonCreate(BaseModel):
    display_name: str

    @field_validator("display_name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("display_name cannot be empty")
        return v


class PersonUpdate(BaseModel):
    display_name: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("display_name")
    @classmethod
    def name_not_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("display_name cannot be empty")
        return v


class PersonResponse(BaseModel):
    id: int
    display_name: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class PersonDetailResponse(PersonResponse):
    accounts: List[PlayerAccountResponse] = []
