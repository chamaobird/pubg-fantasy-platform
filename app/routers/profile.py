# app/routers/profile.py
"""
Endpoints públicos de perfil de usuário.

GET /profile/{user_id}/history
    Retorna o histórico de stages disputadas pelo usuário,
    com pontos totais, colocação e dias jogados.
    Endpoint público — permite ver perfil de outros usuários.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from fastapi.params import Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models.championship import Championship
from app.models.stage import Stage
from app.models.user import User
from app.models.user_stat import UserStageStat

router = APIRouter(prefix="/profile", tags=["Profile"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class StageHistoryEntry(BaseModel):
    stage_id: int
    stage_name: str
    stage_short_name: Optional[str]
    championship_id: int
    championship_name: str
    championship_short_name: Optional[str]
    total_points: float
    rank: Optional[int]
    days_played: int

    model_config = {"from_attributes": True}


class UserProfileOut(BaseModel):
    user_id: str
    username: Optional[str]
    avatar_url: Optional[str]
    history: list[StageHistoryEntry]

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/{user_id}/history",
    response_model=list[StageHistoryEntry],
    summary="Histórico de temporadas de um usuário",
)
def get_user_history(
    user_id: str,
    db: Session = Depends(get_db),
) -> list[StageHistoryEntry]:
    """
    Retorna todas as stages em que o usuário participou,
    ordenadas da mais recente para a mais antiga.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Usuário {user_id} não encontrado",
        )

    stats = (
        db.query(UserStageStat)
        .filter(UserStageStat.user_id == user_id)
        .all()
    )

    if not stats:
        return []

    # Carrega stages e championships em lote
    stage_ids = [s.stage_id for s in stats]
    stages = {s.id: s for s in db.query(Stage).filter(Stage.id.in_(stage_ids)).all()}

    champ_ids = list({s.championship_id for s in stages.values()})
    champs = {c.id: c for c in db.query(Championship).filter(Championship.id.in_(champ_ids)).all()}

    result = []
    for stat in stats:
        stage = stages.get(stat.stage_id)
        if not stage:
            continue
        champ = champs.get(stage.championship_id)
        if not champ:
            continue
        result.append(StageHistoryEntry(
            stage_id=stat.stage_id,
            stage_name=stage.name,
            stage_short_name=stage.short_name,
            championship_id=stage.championship_id,
            championship_name=champ.name,
            championship_short_name=getattr(champ, "short_name", None),
            total_points=float(stat.total_points or 0),
            rank=stat.rank,
            days_played=int(stat.days_played or 0),
        ))

    # Ordena por stage_id descendente (mais recente primeiro)
    result.sort(key=lambda x: x.stage_id, reverse=True)
    return result
