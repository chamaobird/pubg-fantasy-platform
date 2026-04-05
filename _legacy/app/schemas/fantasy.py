from typing import Optional

from pydantic import BaseModel

from app.schemas.player import PlayerOut


class FantasyEntryOut(BaseModel):
    id: int
    player_id: int
    is_captain: bool
    player: PlayerOut
    model_config = {"from_attributes": True}


class FantasyTeamCreate(BaseModel):
    tournament_id: int
    name: str
    player_ids: list[int]       # exactly the players to include
    captain_player_id: int


class FantasyTeamUpdate(BaseModel):
    name: Optional[str] = None
    player_ids: Optional[list[int]] = None
    captain_player_id: Optional[int] = None


class FantasyTeamOut(BaseModel):
    id: int
    user_id: int
    tournament_id: int
    name: str
    total_points: float
    captain_player_id: Optional[int]
    entries: list[FantasyEntryOut]
    model_config = {"from_attributes": True}
