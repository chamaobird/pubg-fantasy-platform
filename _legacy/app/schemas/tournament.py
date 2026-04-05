from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel


class ScoringRuleBase(BaseModel):
    kill_points: float = 15.0
    damage_per_100: float = 5.0
    survival_points: float = 1.0
    early_death_penalty: float = -5.0
    placement_multiplier_json: Optional[str] = None


class ScoringRuleCreate(ScoringRuleBase):
    pass


class ScoringRuleOut(ScoringRuleBase):
    id: int
    tournament_id: int
    model_config = {"from_attributes": True}


class TournamentCreate(BaseModel):
    name: str
    region: str
    scoring_rules_json: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    budget_limit: float = 100.0


class TournamentUpdate(BaseModel):
    name: Optional[str] = None
    region: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    budget_limit: Optional[float] = None


class TournamentOut(BaseModel):
    id: int
    name: str
    region: str
    status: str
    start_date: Optional[datetime]
    end_date: Optional[datetime]
    budget_limit: float
    created_by: Optional[int]
    scoring_rule: Optional[ScoringRuleOut]
    model_config = {"from_attributes": True}
