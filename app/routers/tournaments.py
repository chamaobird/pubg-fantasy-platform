from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Lineup, Player, Team, Tournament, User, lineup_players
from app.schemas.lineup import LineupCreate

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
    is_active: bool

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
            is_active=(t.status == "active"),
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
        is_active=(tournament.status == "active"),
    )


class TournamentPlayerResponse(BaseModel):
    id: int
    name: str
    team: Optional[str] = None
    nationality: Optional[str] = None
    region: Optional[str] = None
    fantasy_cost: float


@router.get(
    "/{tournament_id}/players",
    response_model=list[TournamentPlayerResponse],
    summary="Lista jogadores do torneio",
)
def list_tournament_players(
    tournament_id: int,
    name: Optional[str] = Query(None),
    team: Optional[str] = Query(None),
    nationality: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    tournament = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    query = db.query(Player, Team.name).outerjoin(Team, Player.team_id == Team.id)
    query = query.filter(Player.tournament_id == tournament_id)

    if name:
        query = query.filter(Player.name.ilike(f"%{name}%"))
    if team:
        query = query.filter(Team.name.ilike(f"%{team}%"))
    if nationality:
        query = query.filter(Player.nationality.ilike(f"%{nationality}%"))

    rows = (
        query.order_by(Player.fantasy_cost.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return [
        TournamentPlayerResponse(
            id=p.id,
            name=p.name,
            team=team_name,
            nationality=p.nationality,
            region=p.region,
            fantasy_cost=float(p.fantasy_cost or 0.0),
        )
        for p, team_name in rows
    ]


class LineupPlayerBasicOut(BaseModel):
    id: int
    name: str
    team_id: Optional[int] = None
    fantasy_cost: float


class LineupOut(BaseModel):
    id: int
    name: str
    tournament_id: int
    captain_id: int
    created_at: str
    players: list[LineupPlayerBasicOut]


@router.post(
    "/{tournament_id}/lineups",
    response_model=LineupOut,
    status_code=status.HTTP_201_CREATED,
    summary="Cria lineup do usuário no torneio",
)
def create_lineup(
    tournament_id: int,
    body: LineupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tournament = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    player_ids = body.player_ids
    if len(player_ids) != 4:
        raise HTTPException(status_code=400, detail="Lineup must have exactly 4 players")

    if len(set(player_ids)) != len(player_ids):
        raise HTTPException(status_code=400, detail="Duplicate players are not allowed")

    if body.captain_id not in player_ids:
        raise HTTPException(status_code=400, detail="captain_id must be in player_ids")

    players = (
        db.query(Player)
        .filter(Player.id.in_(player_ids), Player.tournament_id == tournament_id)
        .all()
    )
    if len(players) != len(player_ids):
        raise HTTPException(status_code=400, detail="One or more players not found in this tournament")

    budget = float(tournament.budget_limit)
    total_cost = sum(float(p.fantasy_cost or 0.0) for p in players)
    if total_cost > budget:
        raise HTTPException(
            status_code=400,
            detail=f"Lineup cost {total_cost:.2f} exceeds budget {budget:.2f}",
        )

    team_ids = [p.team_id for p in players if p.team_id is not None]
    if len(team_ids) != len(set(team_ids)):
        raise HTTPException(status_code=400, detail="Only one player per team is allowed")

    lineup = Lineup(
        user_id=current_user.id,
        tournament_id=tournament_id,
        name=body.name,
        captain_player_id=body.captain_id,
    )
    db.add(lineup)
    db.flush()

    for idx, pid in enumerate(player_ids, start=1):
        db.execute(
            lineup_players.insert().values(
                lineup_id=lineup.id,
                player_id=pid,
                slot=idx,
            )
        )

    db.commit()
    db.refresh(lineup)

    players_by_id = {p.id: p for p in players}
    ordered_players = [players_by_id[pid] for pid in player_ids]

    return LineupOut(
        id=lineup.id,
        name=lineup.name,
        tournament_id=lineup.tournament_id,
        captain_id=lineup.captain_player_id,
        created_at=lineup.created_at.isoformat() if lineup.created_at else "",
        players=[
            LineupPlayerBasicOut(
                id=p.id,
                name=p.name,
                team_id=p.team_id,
                fantasy_cost=float(p.fantasy_cost or 0.0),
            )
            for p in ordered_players
        ],
    )


@router.get(
    "/{tournament_id}/lineups/me",
    response_model=list[LineupOut],
    summary="Lista lineups do usuário no torneio",
)
def my_lineups(
    tournament_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tournament = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    lineups = (
        db.query(Lineup)
        .options(joinedload(Lineup.players))
        .filter(Lineup.tournament_id == tournament_id, Lineup.user_id == current_user.id)
        .order_by(Lineup.created_at.desc())
        .all()
    )

    result: list[LineupOut] = []
    for lineup in lineups:
        result.append(
            LineupOut(
                id=lineup.id,
                name=lineup.name,
                tournament_id=lineup.tournament_id,
                captain_id=lineup.captain_player_id,
                created_at=lineup.created_at.isoformat() if lineup.created_at else "",
                players=[
                    LineupPlayerBasicOut(
                        id=p.id,
                        name=p.name,
                        team_id=p.team_id,
                        fantasy_cost=float(p.fantasy_cost or 0.0),
                    )
                    for p in lineup.players
                ],
            )
        )

    return result
