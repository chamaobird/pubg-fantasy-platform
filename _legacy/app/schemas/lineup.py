from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class LineupCreate(BaseModel):
    name: str
    player_ids: list[int]
    captain_id: int
    reserve_player_id: int


class LineupPlayerOut(BaseModel):
    id: int
    name: str
    team_id: Optional[int] = None
    fantasy_cost: float
    model_config = {"from_attributes": True}


class LineupOut(BaseModel):
    id: int
    name: str
    tournament_id: int
    captain_id: int
    reserve_player_id: Optional[int] = None
    total_points: float = 0.0
    created_at: datetime
    players: list[LineupPlayerOut]
    model_config = {"from_attributes": True}
