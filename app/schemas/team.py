# app/schemas/team.py
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── Team ──────────────────────────────────────────────────────────────────────

class TeamCreate(BaseModel):
    name: str = Field(..., max_length=100)
    tag: str = Field(..., max_length=10)
    region: str = Field(..., max_length=50)
    logo_path: Optional[str] = Field(None, max_length=200)


class TeamUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    tag: Optional[str] = Field(None, max_length=10)
    region: Optional[str] = Field(None, max_length=50)
    logo_path: Optional[str] = Field(None, max_length=200)
    is_active: Optional[bool] = None


class TeamMemberInfo(BaseModel):
    person_id: int
    person_name: str
    joined_at: datetime
    left_at: Optional[datetime]

    model_config = {"from_attributes": True}


class TeamResponse(BaseModel):
    id: int
    name: str
    tag: str
    region: str
    logo_path: Optional[str]
    is_active: bool
    created_at: datetime
    active_member_count: int = 0
    active_members: list[TeamMemberInfo] = []

    model_config = {"from_attributes": True}


# ── Member management ─────────────────────────────────────────────────────────

class AddMemberRequest(BaseModel):
    person_id: int
    joined_at: Optional[datetime] = Field(
        None, description="Data de entrada no time. Padrão: agora."
    )


# ── Import team → roster ──────────────────────────────────────────────────────

class ImportTeamRequest(BaseModel):
    team_id: int


class ImportedPlayer(BaseModel):
    person_id: int
    person_name: str


class SkippedPlayer(BaseModel):
    person_id: int
    person_name: str
    reason: str


class ImportTeamResponse(BaseModel):
    team_id: int
    team_name: str
    stage_id: int
    added: list[ImportedPlayer]
    skipped: list[SkippedPlayer]
