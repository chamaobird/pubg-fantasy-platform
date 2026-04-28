# app/routers/stages.py
"""
Router público — Stages / Fase 6 + Fase 7

Endpoints de usuário (sem autenticação obrigatória):
  GET /stages/                                              → Listar stages ativas
  GET /stages/{stage_id}                                    → Detalhe de uma stage
  GET /stages/{stage_id}/days                               → Stage days
  GET /stages/{stage_id}/days/{stage_day_id}/matches        → Partidas de um dia (#074)
  GET /stages/{stage_id}/roster                             → Jogadores com effective_cost
  GET /stages/{stage_id}/roster/{roster_id}/price-history   → Histórico de preços
  GET /stages/{stage_id}/player-stats                       → Stats dos jogadores (#074)
  GET /stages/{stage_id}/leaderboard                        → Ranking geral (#073)
  GET /stages/{stage_id}/days/{stage_day_id}/leaderboard    → Ranking do dia (#073)
"""
from __future__ import annotations

from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.lineup import Lineup
from app.models.match import Match
from app.models.match_stat import MatchStat
from app.models.person import Person
from app.models.person_alias import PersonAlias
from app.models.roster import Roster, RosterPriceHistory
from app.models.stage import Stage
from app.models.stage_day import StageDay
from app.models.user import User
from app.models.user_stat import UserDayStat, UserStageStat

router = APIRouter(prefix="/stages", tags=["Stages"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class StageOut(BaseModel):
    id: int
    championship_id: int
    championship_name: Optional[str] = None
    championship_short_name: Optional[str] = None
    name: str
    short_name: str
    shard: str
    lineup_status: str
    stage_phase: str
    lineup_size: int
    captain_multiplier: float
    price_min: int
    price_max: int
    pricing_newcomer_cost: int
    is_active: bool
    lineup_open: bool
    lineup_open_at: Optional[datetime] = None
    lineup_close_at: Optional[datetime] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    stage_days: list["StageDayOut"] = []

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_stage(cls, s: Stage) -> "StageOut":
        champ = s.championship
        days = sorted(s.days, key=lambda d: d.day_number) if s.days else []
        return cls(
            id=s.id,
            championship_id=s.championship_id,
            championship_name=champ.name if champ else None,
            championship_short_name=champ.short_name if champ else None,
            name=s.name,
            short_name=s.short_name,
            shard=s.shard,
            lineup_status=s.lineup_status,
            stage_phase=s.stage_phase,
            lineup_size=s.lineup_size,
            captain_multiplier=float(s.captain_multiplier),
            price_min=s.price_min,
            price_max=s.price_max,
            pricing_newcomer_cost=s.pricing_newcomer_cost,
            is_active=s.is_active,
            lineup_open=(s.lineup_status == "open"),
            lineup_open_at=s.lineup_open_at,
            lineup_close_at=s.lineup_close_at,
            start_date=s.start_date,
            end_date=s.end_date,
            stage_days=[StageDayOut.model_validate(d) for d in days],
        )


class StageDayOut(BaseModel):
    id: int
    stage_id: int
    day_number: int
    date: Optional[datetime]
    is_active: bool = True

    model_config = {"from_attributes": True}


class MatchOut(BaseModel):
    id: int
    pubg_match_id: str
    played_at: Optional[datetime]
    map_name: Optional[str]
    match_number: int
    total_players: int

    model_config = {"from_attributes": True}


class RosterPlayerOut(BaseModel):
    id: int
    person_id: int
    person_name: Optional[str]
    team_name: Optional[str]
    fantasy_cost: Optional[float]
    cost_override: Optional[float]
    effective_cost: Optional[float]
    newcomer_to_tier: bool
    is_available: bool
    aliases: list[str] = []
    trend: Optional[str] = None   # "up" | "down" | "neutral" | None (dados insuficientes)

    model_config = {"from_attributes": True}


class PriceHistoryOut(BaseModel):
    id: int
    roster_id: int
    stage_day_id: Optional[int]
    cost: float
    source: str
    recorded_at: datetime

    model_config = {"from_attributes": True}


class PlayerStatOut(BaseModel):
    """
    Stats agregados de um jogador no escopo solicitado
    (stage completa, dia específico ou partida específica).
    """
    person_id: int
    person_name: Optional[str]
    team_name: Optional[str]

    matches_played: int
    total_xama_points: float
    pts_per_match: float

    total_kills: int
    total_assists: int
    total_damage: float
    total_knocks: int
    total_wins: int
    avg_placement: Optional[float]
    avg_survival_secs: Optional[float]

    # Badge: melhor partida individual da stage
    best_match_pts: Optional[float]
    best_match_id: Optional[int]

    # Preço atual na stage (sempre corrente, não histórico)
    fantasy_cost: Optional[float]

    # Sparkline: evolução diária — preenchida apenas no escopo completo da stage
    pts_by_day: list[dict]  # [{"day": 1, "pts": 42.5}, ...]
    aliases: list[str] = []

    model_config = {"from_attributes": True}


class PriorStatsOut(BaseModel):
    """
    Stats dos dias anteriores do mesmo championship (stages locked/live)
    filtradas aos jogadores do roster atual.
    Métricas por jogo (per-game) para exibição no LineupBuilder.
    """
    person_id: int
    matches_played: int
    pts_per_match: float              # xama médio por game
    kills_per_match: float            # kills por game
    damage_per_match: float           # dano por game
    assists_per_match: float          # assists por game
    total_wins: int                   # chicken dinners
    late_game_pts_per_match: float    # bônus late game médio por game (top-8 survival)

    model_config = {"from_attributes": True}


class LeaderboardEntryOut(BaseModel):
    rank: Optional[int]
    user_id: str
    username: Optional[str]
    total_points: float
    days_played: int

    model_config = {"from_attributes": True}


class DayLeaderboardEntryOut(BaseModel):
    rank: Optional[int]
    user_id: str
    username: Optional[str]
    points: float

    model_config = {"from_attributes": True}


class SubmissionEntryOut(BaseModel):
    rank: int
    user_id: str
    username: Optional[str]
    submitted_at: datetime

    model_config = {"from_attributes": True}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_stage_or_404(db: Session, stage_id: int) -> Stage:
    stage = db.get(Stage, stage_id)
    if stage is None or not stage.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Stage {stage_id} não encontrada ou inativa.",
        )
    return stage


def _get_username_map(db: Session, user_ids: list[str]) -> dict[str, Optional[str]]:
    if not user_ids:
        return {}
    from app.models.user import User
    users = db.query(User).filter(User.id.in_(user_ids)).all()
    return {u.id: u.username for u in users}


def _resolve_team(person) -> Optional[str]:
    """
    Extrai team_name da Person.
    Tenta campo direto primeiro; fallback para padrão TEAM_PlayerName.
    """
    if person is None:
        return None
    if hasattr(person, "team_name") and person.team_name:
        return person.team_name
    if person.display_name and "_" in person.display_name:
        return person.display_name.split("_")[0]
    return None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[StageOut], summary="Listar stages ativas")
def list_stages(
    open_only: bool = Query(False),
    championship_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
) -> list[StageOut]:
    q = db.query(Stage).filter(Stage.is_active == True)  # noqa: E712
    if open_only:
        q = q.filter(Stage.lineup_status == "open")
    if championship_id is not None:
        q = q.filter(Stage.championship_id == championship_id)
    return [StageOut.from_orm_stage(s) for s in q.order_by(Stage.id.desc()).all()]


@router.get("/{stage_id}", response_model=StageOut, summary="Detalhe de uma stage")
def get_stage(stage_id: int, db: Session = Depends(get_db)) -> StageOut:
    return StageOut.from_orm_stage(_get_stage_or_404(db, stage_id))


@router.get("/{stage_id}/days", response_model=list[StageDayOut], summary="Stage days")
def list_stage_days(stage_id: int, db: Session = Depends(get_db)) -> list[StageDayOut]:
    _get_stage_or_404(db, stage_id)
    return (
        db.query(StageDay)
        .filter(StageDay.stage_id == stage_id)
        .order_by(StageDay.day_number)
        .all()
    )


@router.get(
    "/{stage_id}/days/{stage_day_id}/matches",
    response_model=list[MatchOut],
    summary="Partidas de um dia",
    description="Lista as partidas de um StageDay ordenadas por horário.",
)
def list_day_matches(
    stage_id: int,
    stage_day_id: int,
    db: Session = Depends(get_db),
) -> list[MatchOut]:
    _get_stage_or_404(db, stage_id)

    stage_day = (
        db.query(StageDay)
        .filter(StageDay.id == stage_day_id, StageDay.stage_id == stage_id)
        .first()
    )
    if not stage_day:
        raise HTTPException(status_code=404, detail=f"StageDay {stage_day_id} não encontrado.")

    matches = (
        db.query(Match)
        .filter(Match.stage_day_id == stage_day_id)
        .order_by(Match.played_at.asc().nullslast(), Match.id.asc())
        .all()
    )

    counts = (
        dict(
            db.query(MatchStat.match_id, func.count(MatchStat.id))
            .filter(MatchStat.match_id.in_([m.id for m in matches]))
            .group_by(MatchStat.match_id)
            .all()
        )
        if matches else {}
    )

    return [
        MatchOut(
            id=m.id,
            pubg_match_id=m.pubg_match_id,
            played_at=m.played_at,
            map_name=m.map_name,
            match_number=idx + 1,
            total_players=counts.get(m.id, 0),
        )
        for idx, m in enumerate(matches)
    ]


def _compute_trend_map(db: Session, person_ids: list[int]) -> dict[int, Optional[str]]:
    """
    Computa tendência de forma para cada person_id com base nas últimas 10 partidas.
    Compara média das últimas 3 (recente) vs média das 10 (histórico).
    Requer ≥ 4 partidas; retorna None se dados insuficientes.
    """
    if not person_ids:
        return {}

    # Window function: rank cada MatchStat por played_at DESC dentro de cada person
    ranked = (
        db.query(
            MatchStat.person_id.label("person_id"),
            MatchStat.xama_points.label("xama_points"),
            func.row_number().over(
                partition_by=MatchStat.person_id,
                order_by=Match.played_at.desc(),
            ).label("rn"),
        )
        .join(Match, MatchStat.match_id == Match.id)
        .filter(MatchStat.person_id.in_(person_ids))
        .subquery()
    )

    rows = db.query(ranked).filter(ranked.c.rn <= 10).all()

    # Agrupa por person — lista já ordenada por rn (1 = mais recente)
    from collections import defaultdict
    pts_map: dict[int, list[float]] = defaultdict(list)
    for row in sorted(rows, key=lambda r: r.rn):
        pts_map[row.person_id].append(float(row.xama_points or 0.0))

    def _trend(pts: list[float]) -> Optional[str]:
        if len(pts) < 4:
            return None
        avg_all = sum(pts) / len(pts)
        if avg_all == 0:
            return None
        avg_recent = sum(pts[:3]) / 3
        ratio = avg_recent / avg_all
        if ratio > 1.15:
            return "up"
        if ratio < 0.85:
            return "down"
        return "neutral"

    return {pid: _trend(pts) for pid, pts in pts_map.items()}


@router.get(
    "/{stage_id}/roster",
    response_model=list[RosterPlayerOut],
    summary="Jogadores disponíveis da stage com custo",
)
def list_stage_roster(stage_id: int, db: Session = Depends(get_db)) -> list[RosterPlayerOut]:
    _get_stage_or_404(db, stage_id)
    rosters = (
        db.query(Roster)
        .options(joinedload(Roster.person))
        .filter(Roster.stage_id == stage_id, Roster.is_available == True)  # noqa: E712
        .order_by(Roster.id)
        .all()
    )
    person_ids = [r.person_id for r in rosters]
    alias_rows = db.query(PersonAlias).filter(PersonAlias.person_id.in_(person_ids)).all()
    alias_map: dict[int, list[str]] = {}
    for row in alias_rows:
        alias_map.setdefault(row.person_id, []).append(row.alias)

    trend_map = _compute_trend_map(db, person_ids)

    return [
        RosterPlayerOut(
            id=r.id,
            person_id=r.person_id,
            person_name=r.person.display_name if r.person else None,
            team_name=r.team_name,
            fantasy_cost=r.fantasy_cost,
            cost_override=r.cost_override,
            effective_cost=r.effective_cost,
            newcomer_to_tier=r.newcomer_to_tier,
            is_available=r.is_available,
            aliases=alias_map.get(r.person_id, []),
            trend=trend_map.get(r.person_id),
        )
        for r in rosters
    ]


@router.get(
    "/{stage_id}/roster/{roster_id}/price-history",
    response_model=list[PriceHistoryOut],
    summary="Histórico de preços de um jogador",
)
def get_price_history(
    stage_id: int,
    roster_id: int,
    limit: int = Query(30, ge=1, le=200),
    db: Session = Depends(get_db),
) -> list[PriceHistoryOut]:
    _get_stage_or_404(db, stage_id)
    roster = (
        db.query(Roster)
        .filter(Roster.id == roster_id, Roster.stage_id == stage_id)
        .first()
    )
    if not roster:
        raise HTTPException(status_code=404, detail=f"Roster {roster_id} não encontrado.")
    return (
        db.query(RosterPriceHistory)
        .filter(RosterPriceHistory.roster_id == roster_id)
        .order_by(RosterPriceHistory.recorded_at.desc())
        .limit(limit)
        .all()
    )


@router.get(
    "/{stage_id}/player-stats",
    response_model=list[PlayerStatOut],
    summary="Estatísticas dos jogadores",
    description=(
        "Retorna stats agregados de todos os jogadores da stage. "
        "Sem filtros = acumulado completo (inclui sparkline de pontos por dia). "
        "?stage_day_id=X = acumulado do dia. "
        "?match_id=X = stats de uma partida específica."
    ),
)
def get_player_stats(
    stage_id: int,
    stage_day_id: Optional[int] = Query(None),
    match_id: Optional[int] = Query(None),
    limit: int = Query(200, ge=1, le=500),
    db: Session = Depends(get_db),
) -> list[PlayerStatOut]:
    _get_stage_or_404(db, stage_id)

    base_q = (
        db.query(MatchStat)
        .join(Match, MatchStat.match_id == Match.id)
        .join(StageDay, Match.stage_day_id == StageDay.id)
        .filter(StageDay.stage_id == stage_id)
    )

    if match_id is not None:
        base_q = base_q.filter(Match.id == match_id)
    elif stage_day_id is not None:
        base_q = base_q.filter(StageDay.id == stage_day_id)

    stats_rows = base_q.options(
        joinedload(MatchStat.person),
        joinedload(MatchStat.match).joinedload(Match.stage_day),
    ).all()

    if not stats_rows:
        return []

    from collections import defaultdict

    agg: dict[int, dict] = defaultdict(lambda: {
        "person": None,
        "matches": 0,
        "xama_points": 0.0,
        "kills": 0,
        "assists": 0,
        "damage": 0.0,
        "knocks": 0,
        "wins": 0,
        "placements": [],
        "survival_times": [],
        "best_pts": None,
        "best_match_id": None,
        "pts_by_day": defaultdict(float),
    })

    for ms in stats_rows:
        a = agg[ms.person_id]
        if a["person"] is None:
            a["person"] = ms.person

        pts = float(ms.xama_points or 0)
        day_num = ms.match.stage_day.day_number if ms.match and ms.match.stage_day else 0

        a["matches"] += 1
        a["xama_points"] += pts
        a["kills"] += int(ms.kills or 0)
        a["assists"] += int(ms.assists or 0)
        a["damage"] += float(ms.damage or 0)
        a["knocks"] += int(ms.knocks or 0)
        if ms.placement == 1:
            a["wins"] += 1
        if ms.placement is not None:
            a["placements"].append(ms.placement)
        if ms.survival_time is not None:
            a["survival_times"].append(ms.survival_time)
        if a["best_pts"] is None or pts > a["best_pts"]:
            a["best_pts"] = pts
            a["best_match_id"] = ms.match_id
        a["pts_by_day"][day_num] += pts

    # Carrega fantasy_cost atual e aliases
    person_ids = list(agg.keys())
    rosters = (
        db.query(Roster)
        .filter(Roster.stage_id == stage_id, Roster.person_id.in_(person_ids))
        .all()
    )
    cost_map = {r.person_id: r.effective_cost for r in rosters}
    team_map = {r.person_id: r.team_name for r in rosters if r.team_name}

    alias_rows = db.query(PersonAlias).filter(PersonAlias.person_id.in_(person_ids)).all()
    alias_map: dict[int, list[str]] = {}
    for row in alias_rows:
        alias_map.setdefault(row.person_id, []).append(row.alias)

    is_full_stage = match_id is None and stage_day_id is None

    result = []
    for person_id, a in agg.items():
        person = a["person"]
        matches = a["matches"]
        total_pts = round(a["xama_points"], 2)

        pts_by_day = []
        if is_full_stage:
            pts_by_day = [
                {"day": day, "pts": round(pts, 2)}
                for day, pts in sorted(a["pts_by_day"].items())
            ]

        result.append(PlayerStatOut(
            person_id=person_id,
            person_name=person.display_name if person else None,
            team_name=team_map.get(person_id) or _resolve_team(person),
            matches_played=matches,
            total_xama_points=total_pts,
            pts_per_match=round(total_pts / matches, 2) if matches > 0 else 0.0,
            total_kills=a["kills"],
            total_assists=a["assists"],
            total_damage=round(a["damage"], 1),
            total_knocks=a["knocks"],
            total_wins=a["wins"],
            avg_placement=round(sum(a["placements"]) / len(a["placements"]), 1) if a["placements"] else None,
            avg_survival_secs=round(sum(a["survival_times"]) / len(a["survival_times"]), 0) if a["survival_times"] else None,
            best_match_pts=round(a["best_pts"], 2) if a["best_pts"] is not None else None,
            best_match_id=a["best_match_id"],
            fantasy_cost=cost_map.get(person_id),
            pts_by_day=pts_by_day,
            aliases=alias_map.get(person_id, []),
        ))

    result.sort(key=lambda x: x.total_xama_points, reverse=True)
    return result[:limit]


@router.get(
    "/{stage_id}/prior-stats",
    response_model=list[PriorStatsOut],
    summary="Stats dos dias anteriores do mesmo championship",
    description=(
        "Retorna stats agregados das stages locked/live do mesmo championship, "
        "filtradas aos jogadores do roster atual. "
        "Inclui match_pts (xama por partida, ordem cronológica) para exibição por jogo."
    ),
)
def get_prior_stats(
    stage_id: int,
    db: Session = Depends(get_db),
) -> list[PriorStatsOut]:
    stage = _get_stage_or_404(db, stage_id)

    # Stages encerradas ou em andamento do mesmo championship (exceto a stage atual)
    prior_stages = (
        db.query(Stage)
        .filter(
            Stage.championship_id == stage.championship_id,
            Stage.id != stage_id,
            Stage.stage_phase.in_(["live", "finished"]),
            Stage.is_active == True,  # noqa: E712
        )
        .all()
    )

    if not prior_stages:
        return []

    prior_stage_ids = [s.id for s in prior_stages]

    # Stage days dessas stages (usando [0] pois query de coluna única retorna tuples)
    stage_day_ids = [
        row[0]
        for row in db.query(StageDay.id)
        .filter(StageDay.stage_id.in_(prior_stage_ids))
        .all()
    ]

    if not stage_day_ids:
        return []

    # Jogadores do roster atual
    current_person_ids = [
        row[0]
        for row in db.query(Roster.person_id)
        .filter(Roster.stage_id == stage_id, Roster.is_available == True)  # noqa: E712
        .all()
    ]

    if not current_person_ids:
        return []

    # Match stats dos jogadores nas stages anteriores
    stats_rows = (
        db.query(MatchStat)
        .join(Match, MatchStat.match_id == Match.id)
        .filter(
            Match.stage_day_id.in_(stage_day_ids),
            MatchStat.person_id.in_(current_person_ids),
            MatchStat.xama_points.isnot(None),
        )
        .order_by(Match.played_at.asc(), Match.id.asc())
        .all()
    )

    if not stats_rows:
        return []

    from collections import defaultdict

    agg: dict[int, dict] = defaultdict(lambda: {
        "matches": 0,
        "xama_points": 0.0,
        "kills": 0,
        "assists": 0,
        "damage": 0.0,
        "wins": 0,
        "late_game_pts": 0.0,
    })

    for ms in stats_rows:
        a = agg[ms.person_id]
        a["matches"] += 1
        a["xama_points"] += float(ms.xama_points or 0)
        a["kills"] += int(ms.kills or 0)
        a["assists"] += int(ms.assists or 0)
        a["damage"] += float(ms.damage or 0)
        if ms.placement == 1:
            a["wins"] += 1
        a["late_game_pts"] += float(ms.late_game_bonus or 0)

    result = []
    for person_id, a in agg.items():
        matches = a["matches"]
        total_pts = round(a["xama_points"], 2)
        result.append(PriorStatsOut(
            person_id=person_id,
            matches_played=matches,
            pts_per_match=round(total_pts / matches, 1) if matches > 0 else 0.0,
            kills_per_match=round(a["kills"] / matches, 1) if matches > 0 else 0.0,
            damage_per_match=round(a["damage"] / matches, 0) if matches > 0 else 0.0,
            assists_per_match=round(a["assists"] / matches, 1) if matches > 0 else 0.0,
            total_wins=a["wins"],
            late_game_pts_per_match=round(a["late_game_pts"] / matches, 1) if matches > 0 else 0.0,
        ))

    return result


@router.get(
    "/{stage_id}/leaderboard",
    response_model=list[LeaderboardEntryOut],
    summary="Leaderboard geral da stage",
)
def get_stage_leaderboard(
    stage_id: int,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> list[LeaderboardEntryOut]:
    _get_stage_or_404(db, stage_id)
    stats = (
        db.query(UserStageStat)
        .filter(UserStageStat.stage_id == stage_id)
        .order_by(UserStageStat.total_points.desc())
        .limit(limit)
        .all()
    )
    username_map = _get_username_map(db, [s.user_id for s in stats])
    return [
        LeaderboardEntryOut(
            rank=s.rank,
            user_id=s.user_id,
            username=username_map.get(s.user_id),
            total_points=float(s.total_points),
            days_played=s.days_played,
        )
        for s in stats
    ]


@router.get(
    "/{stage_id}/days/{stage_day_id}/leaderboard",
    response_model=list[DayLeaderboardEntryOut],
    summary="Leaderboard de um dia da stage",
)
def get_day_leaderboard(
    stage_id: int,
    stage_day_id: int,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> list[DayLeaderboardEntryOut]:
    _get_stage_or_404(db, stage_id)
    stage_day = (
        db.query(StageDay)
        .filter(StageDay.id == stage_day_id, StageDay.stage_id == stage_id)
        .first()
    )
    if not stage_day:
        raise HTTPException(status_code=404, detail=f"StageDay {stage_day_id} não encontrado.")
    stats = (
        db.query(UserDayStat)
        .filter(UserDayStat.stage_day_id == stage_day_id)
        .order_by(UserDayStat.points.desc())
        .limit(limit)
        .all()
    )
    username_map = _get_username_map(db, [s.user_id for s in stats])
    return [
        DayLeaderboardEntryOut(
            rank=s.rank,
            user_id=s.user_id,
            username=username_map.get(s.user_id),
            points=float(s.points),
        )
        for s in stats
    ]


@router.get(
    "/{stage_id}/days/{stage_day_id}/submissions",
    response_model=list[SubmissionEntryOut],
    summary="Quem já submeteu lineup no dia (ordenado por envio)",
    description=(
        "Retorna a lista de usuários que já submeteram lineup para o dia informado, "
        "ordenada por submitted_at (quem enviou primeiro aparece primeiro). "
        "Não expõe a composição do lineup — apenas username e ordem de envio. "
        "Usado no Leaderboard quando a stage está aberta (dia 1 sem pontuação)."
    ),
)
def get_day_submissions(
    stage_id: int,
    stage_day_id: int,
    db: Session = Depends(get_db),
) -> list[SubmissionEntryOut]:
    _get_stage_or_404(db, stage_id)
    stage_day = (
        db.query(StageDay)
        .filter(StageDay.id == stage_day_id, StageDay.stage_id == stage_id)
        .first()
    )
    if not stage_day:
        raise HTTPException(status_code=404, detail=f"StageDay {stage_day_id} não encontrado.")

    rows = (
        db.query(Lineup, User)
        .join(User, Lineup.user_id == User.id)
        .filter(Lineup.stage_day_id == stage_day_id, Lineup.is_valid == True)  # noqa: E712
        .order_by(Lineup.submitted_at.asc())
        .all()
    )

    return [
        SubmissionEntryOut(
            rank=idx + 1,
            user_id=lineup.user_id,
            username=user.username,
            submitted_at=lineup.submitted_at,
        )
        for idx, (lineup, user) in enumerate(rows)
    ]


# ── Histórico de partidas por jogador ─────────────────────────────────────────

class MatchHistoryEntry(BaseModel):
    match_id: int
    played_at: Optional[datetime]
    xama_points: float
    kills: int
    assists: int
    damage: float
    placement: Optional[int]
    map_name: Optional[str]
    stage_name: str
    stage_short_name: str
    day_number: int

    model_config = {"from_attributes": True}


@router.get(
    "/persons/{person_id}/match-history",
    response_model=list[MatchHistoryEntry],
    summary="Histórico de partidas de um jogador",
)
def get_person_match_history(
    person_id: int,
    limit: int = Query(15, ge=1, le=50),
    before_date: Optional[datetime] = Query(None, description="Filtrar partidas até esta data (ISO 8601)"),
    db: Session = Depends(get_db),
) -> list[MatchHistoryEntry]:
    """
    Retorna as últimas N partidas de um jogador com pontos, stats e contexto
    (stage, dia, mapa) — usado para o gráfico de histórico no frontend.
    Se before_date for informado, retorna apenas partidas até aquela data.
    """
    person = db.get(Person, person_id)
    if person is None:
        raise HTTPException(status_code=404, detail=f"Person {person_id} não encontrada.")

    q = (
        db.query(MatchStat, Match, StageDay, Stage)
        .join(Match, MatchStat.match_id == Match.id)
        .join(StageDay, Match.stage_day_id == StageDay.id)
        .join(Stage, StageDay.stage_id == Stage.id)
        .filter(
            MatchStat.person_id == person_id,
            MatchStat.xama_points.isnot(None),
            Match.played_at.isnot(None),
        )
    )

    if before_date is not None:
        from datetime import timezone as tz
        if before_date.tzinfo is None:
            before_date = before_date.replace(tzinfo=tz.utc)
        q = q.filter(Match.played_at <= before_date)

    rows = q.order_by(Match.played_at.desc()).limit(limit).all()

    return [
        MatchHistoryEntry(
            match_id=ms.id,
            played_at=m.played_at,
            xama_points=float(ms.xama_points),
            kills=int(ms.kills or 0),
            assists=int(ms.assists or 0),
            damage=float(ms.damage or 0),
            placement=ms.placement,
            map_name=m.map_name,
            stage_name=s.name,
            stage_short_name=s.short_name,
            day_number=sd.day_number,
        )
        for ms, m, sd, s in rows
    ]
