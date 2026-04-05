# app/schemas/championship.py
from __future__ import annotations
from decimal import Decimal
from typing import Optional
from datetime import datetime

from pydantic import BaseModel, field_validator


# ── Create ────────────────────────────────────────────────────────────────────

class ChampionshipCreate(BaseModel):
    name: str
    short_name: str
    shard: str
    pricing_weight: Decimal = Decimal("1.0")
    pricing_cap_newcomer: Optional[int] = None

    @field_validator("shard")
    @classmethod
    def valid_shard(cls, v: str) -> str:
        allowed = {"steam", "pc-tournament"}
        if v not in allowed:
            raise ValueError(f"shard must be one of: {', '.join(sorted(allowed))}")
        return v

    @field_validator("short_name")
    @classmethod
    def short_name_length(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("short_name must be at least 2 characters")
        return v

    @field_validator("pricing_weight")
    @classmethod
    def weight_range(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("pricing_weight must be greater than 0")
        return v

    @field_validator("pricing_cap_newcomer")
    @classmethod
    def cap_positive(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v <= 0:
            raise ValueError("pricing_cap_newcomer must be greater than 0")
        return v


# ── Update ────────────────────────────────────────────────────────────────────

class ChampionshipUpdate(BaseModel):
    name: Optional[str] = None
    short_name: Optional[str] = None
    shard: Optional[str] = None
    pricing_weight: Optional[Decimal] = None
    pricing_cap_newcomer: Optional[int] = None
    is_active: Optional[bool] = None

    @field_validator("shard")
    @classmethod
    def valid_shard(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        allowed = {"steam", "pc-tournament"}
        if v not in allowed:
            raise ValueError(f"shard must be one of: {', '.join(sorted(allowed))}")
        return v

    @field_validator("pricing_weight")
    @classmethod
    def weight_range(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None and v <= 0:
            raise ValueError("pricing_weight must be greater than 0")
        return v

    @field_validator("pricing_cap_newcomer")
    @classmethod
    def cap_positive(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v <= 0:
            raise ValueError("pricing_cap_newcomer must be greater than 0")
        return v


# ── Response ──────────────────────────────────────────────────────────────────

class ChampionshipResponse(BaseModel):
    id: int
    name: str
    short_name: str
    shard: str
    pricing_weight: Decimal
    pricing_cap_newcomer: Optional[int]
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
