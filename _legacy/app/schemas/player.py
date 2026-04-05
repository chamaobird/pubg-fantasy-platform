from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel


class PlayerCreate(BaseModel):
    name: str
    team_id: Optional[int] = None
    role: Optional[str] = None
    price: float = 10.0


class PlayerUpdate(BaseModel):
    name: Optional[str] = None
    team_id: Optional[int] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class PlayerOut(BaseModel):
    id: int
    name: str
    team_id: Optional[int]
    role: Optional[str]
    price: float
    price_updated_at: Optional[datetime]
    is_active: bool
    model_config = {"from_attributes": True}


class PriceHistoryOut(BaseModel):
    id: int
    old_price: float
    new_price: float
    changed_at: datetime
    reason: Optional[str]
    formula_components_json: Optional[str]
    model_config = {"from_attributes": True}


class RecalculatePriceRequest(BaseModel):
    avg_kills: float = 0.0
    avg_damage: float = 0.0
    avg_survival_minutes: float = 0.0
    avg_placement: float = 16.0
    total_teams: int = 16
    games_considered: int = 10
    reason: Optional[str] = "Manual recalculation"
