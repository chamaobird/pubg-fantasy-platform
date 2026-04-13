# app/schemas/stage.py
from __future__ import annotations
from typing import Optional, List
from datetime import datetime

from pydantic import BaseModel, field_validator, model_validator


# ── Create ────────────────────────────────────────────────────────────────────

class StageCreate(BaseModel):
    championship_id: int
    name: str
    short_name: str
    shard: str
    lineup_open_at: Optional[datetime] = None
    lineup_close_at: Optional[datetime] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    lineup_status: str = "closed"
    lineup_size: int = 4
    carries_stats_from: Optional[List[int]] = None
    roster_source_stage_id: Optional[int] = None
    price_min: int = 12
    price_max: int = 35
    pricing_distribution: str = "linear"
    pricing_newcomer_cost: int = 15
    captain_multiplier: float = 1.30
    # pricing_n_matches removido — substituído por MAX_MATCHES=50 global
    # em app/services/pricing.py (Bloco B). Coluna existe no banco mas não é lida.

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

    @field_validator("lineup_status")
    @classmethod
    def valid_status(cls, v: str) -> str:
        allowed = {"closed", "open", "locked", "preview"}
        if v not in allowed:
            raise ValueError(f"lineup_status must be one of: {', '.join(sorted(allowed))}")
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
    short_name: Optional[str] = None
    shard: Optional[str] = None
    lineup_open_at: Optional[datetime] = None
    lineup_close_at: Optional[datetime] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    lineup_status: Optional[str] = None
    lineup_size: Optional[int] = None
    carries_stats_from: Optional[List[int]] = None
    roster_source_stage_id: Optional[int] = None
    price_min: Optional[int] = None
    price_max: Optional[int] = None
    pricing_distribution: Optional[str] = None
    pricing_newcomer_cost: Optional[int] = None
    captain_multiplier: Optional[float] = None
    is_active: Optional[bool] = None
    # pricing_n_matches removido — não aceita mais atualização via API

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
        allowed = {"closed", "open", "locked", "preview"}
        if v not in allowed:
            raise ValueError(f"lineup_status must be one of: {', '.join(sorted(allowed))}")
        return v


# ── Response ──────────────────────────────────────────────────────────────────

class StageResponse(BaseModel):
    id: int
    championship_id: int
    name: str
    short_name: str
    shard: str
    lineup_open_at: Optional[datetime]
    lineup_close_at: Optional[datetime]
    start_date: Optional[datetime]
    end_date: Optional[datetime]
    lineup_status: str
    lineup_size: int
    captain_multiplier: float
    carries_stats_from: Optional[List[int]]
    roster_source_stage_id: Optional[int]
    price_min: int
    price_max: int
    pricing_distribution: str
    pricing_newcomer_cost: int
    is_active: bool
    created_at: datetime
    # pricing_n_matches excluído da resposta — campo deprecated

    model_config = {"from_attributes": True}
