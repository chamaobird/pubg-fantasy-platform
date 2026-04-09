# app/routers/championships.py
"""
Endpoints públicos de Championships.

GET /championships/
    Lista todos os championships ativos com suas stages aninhadas.
    Usado pela página Championships do frontend.

GET /championships/{id}
    Detalhe de um championship com stages.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models.championship import Championship
from app.models.stage import Stage

router = APIRouter(prefix="/championships", tags=["Championships"])


# ---------------------------------------------------------------------------
# Schemas de resposta
# ---------------------------------------------------------------------------

class StagePublic(BaseModel):
    id: int
    name: str
    short_name: Optional[str] = None
    lineup_status: str
    is_active: bool
    lineup_open: bool = False

    model_config = {"from_attributes": True}


class ChampionshipPublic(BaseModel):
    id: int
    name: str
    is_active: bool
    tier_weight: float = 1.0
    stages: list[StagePublic] = []

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_response(championship: Championship, db: Session) -> dict:
    stages = (
        db.query(Stage)
        .filter(Stage.championship_id == championship.id)
        .order_by(Stage.id)
        .all()
    )
    stages_out = [
        StagePublic(
            id=s.id,
            name=s.name,
            short_name=s.short_name,
            lineup_status=s.lineup_status,
            is_active=s.is_active,
            lineup_open=s.lineup_status == "open",
        )
        for s in stages
    ]
    return ChampionshipPublic(
        id=championship.id,
        name=championship.name,
        is_active=championship.is_active,
        tier_weight=float(championship.tier_weight or 1.0),
        stages=stages_out,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=list[ChampionshipPublic])
def list_championships(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
) -> list[ChampionshipPublic]:
    """
    Lista championships com stages aninhadas.
    Por padrão retorna apenas championships ativos.
    """
    q = db.query(Championship)
    if not include_inactive:
        q = q.filter(Championship.is_active == True)  # noqa: E712
    championships = q.order_by(Championship.id.desc()).all()
    return [_build_response(c, db) for c in championships]


@router.get("/{championship_id}", response_model=ChampionshipPublic)
def get_championship(
    championship_id: int,
    db: Session = Depends(get_db),
) -> ChampionshipPublic:
    championship = db.query(Championship).filter(
        Championship.id == championship_id
    ).first()
    if not championship:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Championship {championship_id} not found",
        )
    return _build_response(championship, db)
