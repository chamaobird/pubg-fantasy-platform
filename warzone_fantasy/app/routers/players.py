# app/routers/players.py
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Player

router = APIRouter(prefix="/players", tags=["Players"])


# ------------------------------------------------------------------
# SCHEMAS
# ------------------------------------------------------------------

class PlayerResponse(BaseModel):
    id: int
    name: str
    pubg_id: Optional[str] = None
    region: Optional[str] = None
    position: Optional[str] = None
    fantasy_cost: float
    avg_kills: float
    avg_damage: float
    avg_placement: float
    matches_played: int
    last_synced_at: Optional[str] = None

    class Config:
        from_attributes = True


class PlayerDetailResponse(PlayerResponse):
    raw_stats: Optional[dict] = None
    team_id: Optional[int] = None


# ------------------------------------------------------------------
# GET /players
# ------------------------------------------------------------------

@router.get(
    "/",
    response_model=list[PlayerResponse],
    summary="Lista jogadores com stats e fantasy_cost",
    description=(
        "Retorna todos os jogadores cadastrados com suas estatísticas "
        "e fantasy_cost calculado. Suporta filtros por região e ordenação."
    ),
)
def list_players(
    region: Optional[str] = Query(None, description="Filtrar por região (ex: NA, EU, AS)"),
    min_cost: Optional[float] = Query(None, description="Custo mínimo de fantasy"),
    max_cost: Optional[float] = Query(None, description="Custo máximo de fantasy"),
    sort_by: str = Query(
        "fantasy_cost",
        description="Campo de ordenação: fantasy_cost | avg_kills | avg_damage | name",
    ),
    order: str = Query("desc", description="Direção: asc | desc"),
    skip: int = Query(0, ge=0, description="Offset para paginação"),
    limit: int = Query(50, ge=1, le=200, description="Limite de resultados"),
    db: Session = Depends(get_db),
):
    query = db.query(Player)

    if region:
        query = query.filter(Player.region == region.upper())
    if min_cost is not None:
        query = query.filter(Player.fantasy_cost >= min_cost)
    if max_cost is not None:
        query = query.filter(Player.fantasy_cost <= max_cost)

    sort_field_map = {
        "fantasy_cost": Player.fantasy_cost,
        "avg_kills": Player.avg_kills,
        "avg_damage": Player.avg_damage,
        "name": Player.name,
    }
    sort_field = sort_field_map.get(sort_by, Player.fantasy_cost)

    if order == "asc":
        query = query.order_by(sort_field.asc())
    else:
        query = query.order_by(sort_field.desc())

    players = query.offset(skip).limit(limit).all()

    return [
        PlayerResponse(
            id=p.id,
            name=p.name,
            pubg_id=p.pubg_id,
            region=p.region,
            position=p.position,
            fantasy_cost=p.fantasy_cost,
            avg_kills=p.avg_kills or 0.0,
            avg_damage=p.avg_damage or 0.0,
            avg_placement=p.avg_placement or 0.0,
            matches_played=p.matches_played or 0,
            last_synced_at=(
                p.last_synced_at.isoformat() if p.last_synced_at else None
            ),
        )
        for p in players
    ]


# ------------------------------------------------------------------
# GET /players/{player_id}
# ------------------------------------------------------------------

@router.get(
    "/{player_id}",
    response_model=PlayerDetailResponse,
    summary="Detalhes de um jogador específico",
)
def get_player(player_id: int, db: Session = Depends(get_db)):
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Player with id {player_id} not found.",
        )
    return PlayerDetailResponse(
        id=player.id,
        name=player.name,
        pubg_id=player.pubg_id,
        region=player.region,
        position=player.position,
        fantasy_cost=player.fantasy_cost,
        avg_kills=player.avg_kills or 0.0,
        avg_damage=player.avg_damage or 0.0,
        avg_placement=player.avg_placement or 0.0,
        matches_played=player.matches_played or 0,
        last_synced_at=(
            player.last_synced_at.isoformat() if player.last_synced_at else None
        ),
        raw_stats=player.raw_stats,
        team_id=player.team_id,
    )
