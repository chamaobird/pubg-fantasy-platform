# app/schemas/championship.py
from __future__ import annotations
from typing import Optional
from datetime import datetime

from pydantic import BaseModel, Field, field_validator


# ── Create ────────────────────────────────────────────────────────────────────

class ChampionshipCreate(BaseModel):
    name: str
    short_name: str
    shard: str
    tier_weight: float = Field(
        default=1.0,
        ge=0.1,
        le=2.0,
        description="Pricing weight: PGS/PGC=1.00, regional (PAS)=0.70, etc.",
    )

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


# ── Update ────────────────────────────────────────────────────────────────────

class ChampionshipUpdate(BaseModel):
    name: Optional[str] = None
    short_name: Optional[str] = None
    shard: Optional[str] = None
    is_active: Optional[bool] = None
    tier_weight: Optional[float] = Field(
        default=None,
        ge=0.1,
        le=2.0,
        description="Pricing weight: PGS/PGC=1.00, regional (PAS)=0.70, etc.",
    )

    @field_validator("shard")
    @classmethod
    def valid_shard(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        allowed = {"steam", "pc-tournament"}
        if v not in allowed:
            raise ValueError(f"shard must be one of: {', '.join(sorted(allowed))}")
        return v


# ── Response ──────────────────────────────────────────────────────────────────

class ChampionshipResponse(BaseModel):
    id: int
    name: str
    short_name: str
    shard: str
    is_active: bool
    tier_weight: float
    created_at: datetime

    model_config = {"from_attributes": True}
