# app/schemas/stage_day.py
from __future__ import annotations
from typing import Optional
from datetime import date, datetime

from typing import Any
from pydantic import BaseModel, field_validator, model_validator


# ── Create ────────────────────────────────────────────────────────────────────

class StageDayCreate(BaseModel):
    stage_id: int
    day_number: int
    date: date
    lineup_close_at: Optional[datetime] = None

    @field_validator("day_number")
    @classmethod
    def day_positive(cls, v: int) -> int:
        if v < 1:
            raise ValueError("day_number must be >= 1")
        return v


# ── Update ────────────────────────────────────────────────────────────────────

class StageDayUpdate(BaseModel):
    day_number: Optional[int] = None
    date: Optional[date] = None
    lineup_close_at: Optional[datetime] = None

    @field_validator("day_number")
    @classmethod
    def day_positive(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v < 1:
            raise ValueError("day_number must be >= 1")
        return v


# ── Response ──────────────────────────────────────────────────────────────────

class StageDayResponse(BaseModel):
    id: int
    stage_id: int
    day_number: int
    date: date
    lineup_close_at: Optional[datetime]
    match_schedule: Optional[list[Any]] = None
    last_import_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}
