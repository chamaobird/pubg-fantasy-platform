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
from datetime import datetime
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
    start_date: Optional[datetime] = None


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
    start_date: Optional[datetime] = None
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
    total_wins:            int = 0


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
            region=c.region, status=c.status, start_date=c.start_date, phases=phases,
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
    from collections import defaultdict

    champ = db.query(Championship).filter(Championship.id == championship_id).first()
    if not champ:
        raise HTTPException(status_code=404, detail="Championship not found")

    # Coleta todos os tournament_ids do campeonato e mapeia id → tournament_id
    # para identificar qual fase é mais recente por player
    tournament_ids = [ct.tournament_id for ct in champ.phases]
    if not tournament_ids:
        return []

    # Busca todos os registros sem limit/skip — dedup ocorre em Python
    q = (
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
            sql_func.sum(MatchPlayerStat.wins_count).label("total_wins"),
        )
        .join(MatchPlayerStat, MatchPlayerStat.player_id == Player.id)
        .join(Match, MatchPlayerStat.match_id == Match.id)
        .outerjoin(Team, Player.team_id == Team.id)
        .filter(Match.tournament_id.in_(tournament_ids))
        .filter(Player.is_active == True)
    )

    # Filtra partidas anteriores à data de início do campeonato.
    # Isso impede que dados de edições anteriores poluam o "Campeonato completo".
    # Prioridade:
    #   1. champ.start_date (definido manualmente via PATCH /championship-phases/{id})
    #   2. Fallback automático: janela rolling de 180 dias a partir do match mais recente
    #      (mesma lógica usada no endpoint individual de torneio — impede dados de anos anteriores)
    from datetime import timedelta

    effective_start = champ.start_date
    if not effective_start:
        latest_played = (
            db.query(sql_func.max(Match.played_at))
            .filter(Match.tournament_id.in_(tournament_ids))
            .scalar()
        )
        if latest_played:
            effective_start = latest_played - timedelta(days=180)

    if effective_start:
        q = q.filter(Match.played_at >= effective_start)

    rows = q.group_by(Player.id, Team.name).all()

    # ── Dedup por nome normalizado (sem prefixo do time) ──────────────────────
    # Jogadores que mudaram de time entre fases aparecem com player IDs distintos
    # e team tags diferentes. Agrupamos pelo nome sem prefixo ("TIA_Foo" → "Foo"),
    # somamos as stats de todos os registros e usamos o time do torneio mais recente.
    groups = defaultdict(list)
    for r in rows:
        name = r.Player.name
        # "TEAM_PlayerName" → "PlayerName"; sem underscore → usa o nome inteiro
        norm = name.split("_", 1)[1] if "_" in name else name
        groups[norm].append(r)

    merged = []
    for norm_name, grp in groups.items():
        # Ordena pelo tournament_id DESC → primeiro elemento = equipe atual
        grp.sort(key=lambda r: r.Player.tournament_id or 0, reverse=True)
        primary = grp[0]

        total_mp   = sum(r.matches_played or 0 for r in grp)
        total_tfp  = sum(float(r.total_fantasy_points or 0) for r in grp)

        # Colocação média: média ponderada pelo número de partidas
        weighted_pl = sum(float(r.avg_placement or 0) * (r.matches_played or 0) for r in grp)
        avg_pl = weighted_pl / total_mp if total_mp > 0 else 0.0

        merged.append({
            "player":               primary.Player,
            "team_name":            primary.team_name,
            "matches_played":       total_mp,
            "total_kills":          sum(int(r.total_kills or 0) for r in grp),
            "total_assists":        sum(int(r.total_assists or 0) for r in grp),
            "total_damage":         sum(float(r.total_damage or 0) for r in grp),
            "avg_placement":        avg_pl,
            "total_knocks":         sum(int(r.total_knocks or 0) for r in grp),
            "surv_total_secs":      sum(float(r.surv_total_secs or 0) for r in grp),
            "total_fantasy_points": total_tfp,
            "total_late_game_bonus":sum(float(r.total_late_game_bonus or 0) for r in grp),
            "total_penalty_count":  sum(int(r.total_penalty_count or 0) for r in grp),
            "total_wins":           sum(int(r.total_wins or 0) for r in grp),
        })

    # Ordena por total_fantasy_points desc e aplica skip/limit pós-dedup
    merged.sort(key=lambda x: x["total_fantasy_points"], reverse=True)
    merged = merged[skip : skip + limit]

    result = []
    for m in merged:
        mp  = m["matches_played"] or 1
        tfp = m["total_fantasy_points"]
        result.append(PlayerChampionshipStats(
            player_id=             m["player"].id,
            name=                  m["player"].name,
            team=                  m["team_name"],
            region=                m["player"].region,
            fantasy_cost=          round(float(m["player"].fantasy_cost or 0), 2),
            matches_played=        mp,
            total_kills=           m["total_kills"],
            total_assists=         m["total_assists"],
            total_damage=          round(m["total_damage"], 1),
            avg_placement=         round(m["avg_placement"], 1),
            total_knocks=          m["total_knocks"],
            surv_total_secs=       round(m["surv_total_secs"], 0),
            total_fantasy_points=  round(tfp, 2),
            pts_per_match=         round(tfp / mp, 2),
            total_late_game_bonus= round(m["total_late_game_bonus"], 2),
            total_penalty_count=   m["total_penalty_count"],
            total_wins=            m["total_wins"],
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
        start_date=body.start_date,
    )
    db.add(champ)
    db.commit()
    db.refresh(champ)
    return {"id": champ.id, "name": champ.name}


class ChampionshipUpdate(BaseModel):
    name: Optional[str] = None
    short_name: Optional[str] = None
    region: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[datetime] = None


@router.patch("/{championship_id}", summary="[Admin] Atualiza campeonato")
async def update_championship(
    championship_id: int,
    body: ChampionshipUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    champ = db.query(Championship).filter(Championship.id == championship_id).first()
    if not champ:
        raise HTTPException(status_code=404, detail="Championship not found")
    if body.name is not None:
        champ.name = body.name
    if body.short_name is not None:
        champ.short_name = body.short_name
    if body.region is not None:
        champ.region = body.region
    if body.status is not None:
        champ.status = body.status
    if body.start_date is not None:
        champ.start_date = body.start_date
    db.commit()
    db.refresh(champ)
    return {"id": champ.id, "name": champ.name, "start_date": champ.start_date}


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