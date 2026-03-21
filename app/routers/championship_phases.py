# app/routers/championship_phases.py
"""
Endpoints para Championships — agrupamento de fases de um campeonato.

Rotas públicas:
  GET  /championship-phases/                        → lista campeonatos
  GET  /championship-phases/{id}                    → detalhes + fases
  GET  /championship-phases/{id}/player-stats       → stats acumuladas de todas as fases

Rotas admin:
  POST /championship-phases/                        → cria campeonato
  POST /championship-phases/{id}/tournaments        → adiciona fase ao campeonato
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func as sql_func
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin
from app.models import Player, Team, Tournament
from app.models.championship import Championship, ChampionshipTournament
from app.models.match import Match, MatchPlayerStat
from app.models.user import User

router = APIRouter(prefix="/championship-phases", tags=["Championship Phases"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class ChampionshipCreate(BaseModel):
    name: str
    short_name: Optional[str] = None
    region: Optional[str] = None
    status: str = "active"


class AddTournamentBody(BaseModel):
    tournament_id: int
    phase: Optional[str] = None
    phase_order: int = 0


class PhaseOut(BaseModel):
    tournament_id: int
    phase: Optional[str]
    phase_order: int
    tournament_name: Optional[str]


class ChampionshipOut(BaseModel):
    id: int
    name: str
    short_name: Optional[str]
    region: Optional[str]
    status: str
    phases: list[PhaseOut]


class PlayerChampionshipStats(BaseModel):
    player_id:             int
    name:                  str
    team:                  Optional[str] = None
    region:                Optional[str] = None
    fantasy_cost:          float
    matches_played:        int
    total_kills:           int
    total_assists:         int
    total_damage:          float
    avg_placement:         float
    total_knocks:          int
    surv_total_secs:       float
    total_fantasy_points:  float
    pts_per_match:         float
    total_late_game_bonus: float
    total_penalty_count:   int


# ── Public endpoints ──────────────────────────────────────────────────────────

@router.get("/", response_model=list[ChampionshipOut], summary="Lista campeonatos")
def list_championships(db: Session = Depends(get_db)):
    champs = db.query(Championship).order_by(Championship.id.desc()).all()
    result = []
    for c in champs:
        phases = []
        for ct in c.phases:
            t = db.query(Tournament).filter(Tournament.id == ct.tournament_id).first()
            phases.append(PhaseOut(
                tournament_id=ct.tournament_id,
                phase=ct.phase,
                phase_order=ct.phase_order,
                tournament_name=t.name if t else None,
            ))
        result.append(ChampionshipOut(
            id=c.id, name=c.name, short_name=c.short_name,
            region=c.region, status=c.status, phases=phases,
        ))
    return result


@router.get("/{championship_id}/player-stats",
    response_model=list[PlayerChampionshipStats],
    summary="Stats acumuladas de todas as fases do campeonato")
def championship_player_stats(
    championship_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    champ = db.query(Championship).filter(Championship.id == championship_id).first()
    if not champ:
        raise HTTPException(status_code=404, detail="Championship not found")

    # Coleta todos os tournament_ids do campeonato
    tournament_ids = [ct.tournament_id for ct in champ.phases]
    if not tournament_ids:
        return []

    # Agrega stats de todos os matches de todas as fases
    rows = (
        db.query(
            Player,
            Team.name.label("team_name"),
            sql_func.count(MatchPlayerStat.id).label("matches_played"),
            sql_func.sum(MatchPlayerStat.kills).label("total_kills"),
            sql_func.sum(MatchPlayerStat.assists).label("total_assists"),
            sql_func.sum(MatchPlayerStat.damage_dealt).label("total_damage"),
            sql_func.avg(MatchPlayerStat.placement).label("avg_placement"),
            sql_func.sum(MatchPlayerStat.knocks).label("total_knocks"),
            sql_func.sum(MatchPlayerStat.survival_secs).label("surv_total_secs"),
            sql_func.sum(MatchPlayerStat.fantasy_points).label("total_fantasy_points"),
            sql_func.sum(MatchPlayerStat.late_game_bonus).label("total_late_game_bonus"),
            sql_func.sum(MatchPlayerStat.penalty_count).label("total_penalty_count"),
        )
        .join(MatchPlayerStat, MatchPlayerStat.player_id == Player.id)
        .join(Match, MatchPlayerStat.match_id == Match.id)
        .outerjoin(Team, Player.team_id == Team.id)
        .filter(Match.tournament_id.in_(tournament_ids))
        .filter(Player.is_active == True)
        .group_by(Player.id, Team.name)
        .order_by(sql_func.sum(MatchPlayerStat.fantasy_points).desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    result = []
    for r in rows:
        mp = r.matches_played or 1
        tfp = float(r.total_fantasy_points or 0.0)
        result.append(PlayerChampionshipStats(
            player_id=r.Player.id,
            name=r.Player.name,
            team=r.team_name,
            region=r.Player.region,
            fantasy_cost=round(float(r.Player.fantasy_cost or 0.0), 2),
            matches_played=mp,
            total_kills=int(r.total_kills or 0),
            total_assists=int(r.total_assists or 0),
            total_damage=round(float(r.total_damage or 0.0), 1),
            avg_placement=round(float(r.avg_placement or 0.0), 1),
            total_knocks=int(r.total_knocks or 0),
            surv_total_secs=round(float(r.surv_total_secs or 0.0), 0),
            total_fantasy_points=round(tfp, 2),
            pts_per_match=round(tfp / mp, 2),
            total_late_game_bonus=round(float(r.total_late_game_bonus or 0.0), 2),
            total_penalty_count=int(r.total_penalty_count or 0),
        ))
    return result


# ── Admin endpoints ───────────────────────────────────────────────────────────

@router.post("/", summary="[Admin] Cria campeonato")
async def create_championship(
    body: ChampionshipCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    champ = Championship(
        name=body.name,
        short_name=body.short_name,
        region=body.region,
        status=body.status,
    )
    db.add(champ)
    db.commit()
    db.refresh(champ)
    return {"id": champ.id, "name": champ.name}


@router.post("/{championship_id}/tournaments", summary="[Admin] Adiciona fase ao campeonato")
async def add_tournament_to_championship(
    championship_id: int,
    body: AddTournamentBody,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    champ = db.query(Championship).filter(Championship.id == championship_id).first()
    if not champ:
        raise HTTPException(status_code=404, detail="Championship not found")

    tournament = db.query(Tournament).filter(Tournament.id == body.tournament_id).first()
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    existing = db.query(ChampionshipTournament).filter(
        ChampionshipTournament.championship_id == championship_id,
        ChampionshipTournament.tournament_id == body.tournament_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Tournament already in championship")

    ct = ChampionshipTournament(
        championship_id=championship_id,
        tournament_id=body.tournament_id,
        phase=body.phase,
        phase_order=body.phase_order,
    )
    db.add(ct)
    db.commit()
    return {"championship_id": championship_id, "tournament_id": body.tournament_id, "phase": body.phase}