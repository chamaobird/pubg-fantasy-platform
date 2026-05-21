# app/schemas/stage_sync.py
from __future__ import annotations
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator


class StageSyncCreate(BaseModel):
    stage_id: int
    tournament_id: str
    interval_min: int = 15
    run_from: Optional[datetime] = None
    run_until: datetime
    notes: Optional[str] = None

    @field_validator("interval_min")
    @classmethod
    def validate_interval(cls, v: int) -> int:
        if v < 5 or v > 1440:
            raise ValueError("interval_min deve estar entre 5 e 1440 minutos")
        return v


class StageSyncUpdate(BaseModel):
    interval_min: Optional[int] = None
    run_until: Optional[datetime] = None
    notes: Optional[str] = None
    status: Optional[str] = None   # só "cancelled" é aceito via PATCH


class StageSyncResponse(BaseModel):
    id: int
    stage_id: int
    tournament_id: str
    interval_min: int
    run_from: Optional[datetime]
    run_until: datetime
    last_run_at: Optional[datetime]
    runs_count: int
    status: str
    notes: Optional[str]
    created_at: datetime
    stage_name: Optional[str] = None

    model_config = {"from_attributes": True}
