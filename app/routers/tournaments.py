# app/routers/tournaments.py
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Tournament

router = APIRouter(prefix="/tournaments", tags=["Tournaments"])


# ------------------------------------------------------------------
# SCHEMAS
# ------------------------------------------------------------------

class TournamentResponse(BaseModel):
    id: int
    name: str
    pubg_id: Optional[str] = None
    region: Optional[str] = None
    status: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    max_teams: int

    class Config:
        from_attributes = True


# ------------------------------------------------------------------
# GET /tournaments
# ------------------------------------------------------------------

@router.get(
    "/",
    response_model=list[TournamentResponse],
    summary="Lista torneios com status e detalhes",
    description="Retorna todos os torneios cadastrados. Suporta filtro por status e região.",
)
def list_tournaments(
    status_filter: Optional[str] = Query(
        None,
        alias="status",
        description="Filtrar por status: upcoming | active | finished",
    ),
    region: Optional[str] = Query(None, description="Filtrar por região (ex: NA, EU)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    query = db.query(Tournament)

    if status_filter:
        query = query.filter(Tournament.status == status_filter)
    if region:
        query = query.filter(Tournament.region == region.upper())

    tournaments = (
        query.order_by(Tournament.start_date.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return [
        TournamentResponse(
            id=t.id,
            name=t.name,
            pubg_id=t.pubg_id,
            region=t.region,
            status=t.status,
            start_date=t.start_date.isoformat() if t.start_date else None,
            end_date=t.end_date.isoformat() if t.end_date else None,
            max_teams=t.max_teams,
        )
        for t in tournaments
    ]


# ------------------------------------------------------------------
# GET /tournaments/{tournament_id}
# ------------------------------------------------------------------

@router.get(
    "/{tournament_id}",
    response_model=TournamentResponse,
    summary="Detalhes de um torneio específico",
)
def get_tournament(tournament_id: int, db: Session = Depends(get_db)):
    tournament = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not tournament:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tournament with id {tournament_id} not found.",
        )
    return TournamentResponse(
        id=tournament.id,
        name=tournament.name,
        pubg_id=tournament.pubg_id,
        region=tournament.region,
        status=tournament.status,
        start_date=tournament.start_date.isoformat() if tournament.start_date else None,
        end_date=tournament.end_date.isoformat() if tournament.end_date else None,
        max_teams=tournament.max_teams,
    )
