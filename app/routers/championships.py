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

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models.championship import Championship
from app.models.stage import Stage
from app.models.stage_day import StageDay
from app.models.user import User
from app.models.user_stat import UserDayStat, UserStageStat

router = APIRouter(prefix="/championships", tags=["Championships"])


# ---------------------------------------------------------------------------
# Schemas de resposta
# ---------------------------------------------------------------------------

class ChampionshipLeaderboardEntryOut(BaseModel):
    rank: int
    user_id: str
    username: Optional[str]
    total_points: float
    stages_played: int
    survival_secs: int
    captain_pts: float

    model_config = {"from_attributes": True}


class StagePublic(BaseModel):
    id: int
    name: str
    short_name: Optional[str] = None
    lineup_status: str
    stage_phase: str
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
            stage_phase=s.stage_phase,
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


@router.get(
    "/{championship_id}/leaderboard",
    response_model=list[ChampionshipLeaderboardEntryOut],
    summary="Leaderboard acumulado do campeonato",
)
def get_championship_leaderboard(
    championship_id: int,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> list[ChampionshipLeaderboardEntryOut]:
    """
    Retorna o ranking acumulado de todos os usuários no campeonato,
    somando pontos de todas as stages.

    Desempate: survival_secs DESC → captain_pts DESC.
    """
    championship = db.query(Championship).filter(
        Championship.id == championship_id
    ).first()
    if not championship:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Championship {championship_id} not found",
        )

    # IDs das stages do campeonato
    stage_ids = [
        s.id for s in db.query(Stage.id).filter(Stage.championship_id == championship_id).all()
    ]
    if not stage_ids:
        return []

    # Agrega por usuário somando pontos de todas as stages
    rows = (
        db.query(
            UserStageStat.user_id.label("user_id"),
            func.sum(UserStageStat.total_points).label("total_points"),
            func.count(UserStageStat.stage_id).label("stages_played"),
            func.sum(UserStageStat.survival_secs).label("survival_secs"),
            func.sum(UserStageStat.captain_pts).label("captain_pts"),
        )
        .filter(UserStageStat.stage_id.in_(stage_ids))
        .group_by(UserStageStat.user_id)
        .order_by(
            func.sum(UserStageStat.total_points).desc(),
            func.sum(UserStageStat.survival_secs).desc(),
            func.sum(UserStageStat.captain_pts).desc(),
        )
        .limit(limit)
        .all()
    )

    # Busca usernames em lote
    user_ids = [r.user_id for r in rows]
    username_map = {
        u.id: u.username
        for u in db.query(User).filter(User.id.in_(user_ids)).all()
    }

    return [
        ChampionshipLeaderboardEntryOut(
            rank=idx + 1,
            user_id=r.user_id,
            username=username_map.get(r.user_id),
            total_points=float(r.total_points or 0),
            stages_played=int(r.stages_played or 0),
            survival_secs=int(r.survival_secs or 0),
            captain_pts=float(r.captain_pts or 0),
        )
        for idx, r in enumerate(rows)
    ]


@router.get(
    "/{championship_id}/leaderboard/combined",
    response_model=list[ChampionshipLeaderboardEntryOut],
    summary="Leaderboard combinado — dias arbitrários",
)
def get_combined_leaderboard(
    championship_id: int,
    stage_day_ids: str = Query(..., description="IDs de stage_days separados por vírgula, ex: 1,2,5"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> list[ChampionshipLeaderboardEntryOut]:
    """
    Soma UserDayStat dos stage_day_ids especificados.
    Permite combinações arbitrárias (dias de stages diferentes).
    Desempate: survival_secs DESC → captain_pts DESC.
    """
    championship = db.query(Championship).filter(
        Championship.id == championship_id
    ).first()
    if not championship:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Championship {championship_id} not found",
        )

    try:
        day_ids = [int(x.strip()) for x in stage_day_ids.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="stage_day_ids inválidos")

    if not day_ids:
        return []

    # Valida que os days pertencem ao campeonato
    valid_day_ids = [
        row[0] for row in (
            db.query(StageDay.id)
            .join(Stage, StageDay.stage_id == Stage.id)
            .filter(
                Stage.championship_id == championship_id,
                StageDay.id.in_(day_ids),
            )
            .all()
        )
    ]
    if not valid_day_ids:
        return []

    rows = (
        db.query(
            UserDayStat.user_id.label("user_id"),
            func.sum(UserDayStat.points).label("total_points"),
            func.count(UserDayStat.id).label("stages_played"),
            func.sum(UserDayStat.survival_secs).label("survival_secs"),
            func.sum(UserDayStat.captain_pts).label("captain_pts"),
        )
        .filter(UserDayStat.stage_day_id.in_(valid_day_ids))
        .group_by(UserDayStat.user_id)
        .order_by(
            func.sum(UserDayStat.points).desc(),
            func.sum(UserDayStat.survival_secs).desc(),
            func.sum(UserDayStat.captain_pts).desc(),
        )
        .limit(limit)
        .all()
    )

    user_ids = [r.user_id for r in rows]
    username_map = {
        u.id: u.username
        for u in db.query(User).filter(User.id.in_(user_ids)).all()
    }

    return [
        ChampionshipLeaderboardEntryOut(
            rank=idx + 1,
            user_id=r.user_id,
            username=username_map.get(r.user_id),
            total_points=float(r.total_points or 0),
            stages_played=int(r.stages_played or 0),
            survival_secs=int(r.survival_secs or 0),
            captain_pts=float(r.captain_pts or 0),
        )
        for idx, r in enumerate(rows)
    ]
