# app/schemas/stage.py
from __future__ import annotations
from typing import Optional, List
from datetime import datetime

from pydantic import BaseModel, field_validator, model_validator


# ── Create ────────────────────────────────────────────────────────────────────

class StageCreate(BaseModel):
    championship_id: int
    name: str
    shard: str
    lineup_open_at: datetime
    lineup_close_at: Optional[datetime] = None
    carries_stats_from: Optional[List[int]] = None
    roster_source_stage_id: Optional[int] = None

    @field_validator("shard")
    @classmethod
    def valid_shard(cls, v: str) -> str:
        allowed = {"steam", "pc-tournament"}
        if v not in allowed:
            raise ValueError(f"shard must be one of: {', '.join(sorted(allowed))}")
        return v

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name cannot be empty")
        return v

    @model_validator(mode="after")
    def close_after_open(self) -> "StageCreate":
        if self.lineup_close_at and self.lineup_open_at:
            if self.lineup_close_at <= self.lineup_open_at:
                raise ValueError("lineup_close_at must be after lineup_open_at")
        return self


# ── Update ────────────────────────────────────────────────────────────────────

class StageUpdate(BaseModel):
    name: Optional[str] = None
    shard: Optional[str] = None
    lineup_open_at: Optional[datetime] = None
    lineup_close_at: Optional[datetime] = None
    lineup_status: Optional[str] = None
    carries_stats_from: Optional[List[int]] = None
    roster_source_stage_id: Optional[int] = None

    @field_validator("shard")
    @classmethod
    def valid_shard(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        allowed = {"steam", "pc-tournament"}
        if v not in allowed:
            raise ValueError(f"shard must be one of: {', '.join(sorted(allowed))}")
        return v

    @field_validator("lineup_status")
    @classmethod
    def valid_status(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        allowed = {"closed", "open", "locked"}
        if v not in allowed:
            raise ValueError(f"lineup_status must be one of: {', '.join(sorted(allowed))}")
        return v


# ── Response ──────────────────────────────────────────────────────────────────

class StageResponse(BaseModel):
    id: int
    championship_id: int
    name: str
    shard: str
    lineup_open_at: Optional[datetime]
    lineup_close_at: Optional[datetime]
    lineup_status: str
    carries_stats_from: Optional[List[int]]
    roster_source_stage_id: Optional[int]
    created_at: datetime

    model_config = {"from_attributes": True}
