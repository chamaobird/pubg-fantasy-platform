# app/schemas/roster.py
from __future__ import annotations
from typing import Optional
from datetime import datetime

from pydantic import BaseModel, field_validator


# ── Create ────────────────────────────────────────────────────────────────────

class RosterCreate(BaseModel):
    person_id: int
    team_name: Optional[str] = None
    fantasy_cost: Optional[int] = None
    cost_override: Optional[int] = None
    newcomer_to_tier: bool = False

    @field_validator("fantasy_cost", "cost_override")
    @classmethod
    def cost_positive(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v <= 0:
            raise ValueError("Cost must be greater than 0")
        return v


# ── Update ────────────────────────────────────────────────────────────────────

class RosterUpdate(BaseModel):
    team_name: Optional[str] = None
    fantasy_cost: Optional[int] = None
    cost_override: Optional[int] = None
    newcomer_to_tier: Optional[bool] = None
    is_available: Optional[bool] = None

    @field_validator("fantasy_cost", "cost_override")
    @classmethod
    def cost_positive(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v <= 0:
            raise ValueError("Cost must be greater than 0")
        return v


# ── Response ──────────────────────────────────────────────────────────────────

class RosterResponse(BaseModel):
    id: int
    stage_id: int
    person_id: int
    person_name: Optional[str] = None
    team_name: Optional[str]
    fantasy_cost: Optional[float]
    cost_override: Optional[float]
    effective_cost: Optional[float]
    newcomer_to_tier: bool
    is_available: bool
    created_at: datetime

    model_config = {"from_attributes": True}
