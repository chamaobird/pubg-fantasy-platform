# app/schemas/championship_group.py
from __future__ import annotations
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── Create ────────────────────────────────────────────────────────────────────

class ChampionshipGroupCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=120)
    short_name: str = Field(..., min_length=2, max_length=30)
    display_order: int = Field(default=0, ge=0)


# ── Update ────────────────────────────────────────────────────────────────────

class ChampionshipGroupUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=3, max_length=120)
    short_name: Optional[str] = Field(default=None, min_length=2, max_length=30)
    is_active: Optional[bool] = None
    display_order: Optional[int] = Field(default=None, ge=0)


# ── Member management ─────────────────────────────────────────────────────────

class ChampionshipGroupMemberAdd(BaseModel):
    championship_id: int
    display_order: int = Field(default=0, ge=0)


# ── Response ──────────────────────────────────────────────────────────────────

class ChampionshipGroupResponse(BaseModel):
    id: int
    name: str
    short_name: str
    is_active: bool
    display_order: int
    championship_ids: list[int] = []
    created_at: datetime

    model_config = {"from_attributes": True}
