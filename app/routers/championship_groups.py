# app/routers/championship_groups.py
"""
Endpoints públicos de Championship Groups.

GET /championship-groups/
    Lista grupos ativos com os IDs de championships membros.
    Usado pelo frontend para substituir o agrupamento hardcoded.

GET /championship-groups/{id}
    Detalhe de um grupo.

GET /championship-groups/{id}/leaderboard
    Leaderboard combinado — soma UserStageStat de todos os stages de
    todos os championships do grupo.

GET /championship-groups/{id}/player-stats
    Stats combinadas de jogadores — agrega MatchStat de todos os
    stages de todos os championships do grupo.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models.championship_group import ChampionshipGroup, ChampionshipGroupMember
from app.models.championship import Championship
from app.models.match import Match
from app.models.match_stat import MatchStat
from app.models.roster import Roster
from app.models.stage import Stage
from app.models.stage_day import StageDay
from app.models.person import Person
from app.models.user import User
from app.models.user_stat import UserStageStat

router = APIRouter(prefix="/championship-groups", tags=["Championship Groups"])


# ---------------------------------------------------------------------------
# Schemas de resposta
# ---------------------------------------------------------------------------

class ChampionshipGroupPublic(BaseModel):
    id: int
    name: str
    short_name: str
    is_active: bool
    display_order: int
    championship_ids: list[int] = []

    model_config = {"from_attributes": True}


class GroupLeaderboardEntry(BaseModel):
    rank: int
    user_id: str
    username: Optional[str]
    total_points: float
    stages_played: int
    survival_secs: int
    captain_pts: float

    model_config = {"from_attributes": True}


class GroupPlayerStatEntry(BaseModel):
    rank: int
    person_id: int
    display_name: str
    team_name: Optional[str]
    fantasy_cost: Optional[float]
    total_xama_points: float
    matches_played: int
    pts_per_match: Optional[float]
    total_kills: int
    total_assists: int
    total_damage: float
    total_knocks: int
    total_wins: int

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_group_or_404(group_id: int, db: Session) -> ChampionshipGroup:
    group = db.query(ChampionshipGroup).filter(
        ChampionshipGroup.id == group_id,
        ChampionshipGroup.is_active == True,  # noqa: E712
    ).first()
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Championship group {group_id} not found",
        )
    return group


def _group_to_public(group: ChampionshipGroup) -> ChampionshipGroupPublic:
    return ChampionshipGroupPublic(
        id=group.id,
        name=group.name,
        short_name=group.short_name,
        is_active=group.is_active,
        display_order=group.display_order,
        championship_ids=[m.championship_id for m in group.members],
    )


def _get_stage_ids_for_group(group_id: int, db: Session) -> list[int]:
    """Retorna todos os stage IDs pertencentes ao grupo."""
    championship_ids = [
        row[0] for row in (
            db.query(ChampionshipGroupMember.championship_id)
            .filter(ChampionshipGroupMember.group_id == group_id)
            .all()
        )
    ]
    if not championship_ids:
        return []
    stage_ids = [
        row[0] for row in (
            db.query(Stage.id)
            .filter(Stage.championship_id.in_(championship_ids))
            .all()
        )
    ]
    return stage_ids


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=list[ChampionshipGroupPublic])
def list_groups(db: Session = Depends(get_db)) -> list[ChampionshipGroupPublic]:
    """Lista todos os grupos ativos ordenados por display_order."""
    groups = (
        db.query(ChampionshipGroup)
        .filter(ChampionshipGroup.is_active == True)  # noqa: E712
        .order_by(ChampionshipGroup.display_order, ChampionshipGroup.id)
        .all()
    )
    return [_group_to_public(g) for g in groups]


@router.get("/{group_id}", response_model=ChampionshipGroupPublic)
def get_group(group_id: int, db: Session = Depends(get_db)) -> ChampionshipGroupPublic:
    group = _get_group_or_404(group_id, db)
    return _group_to_public(group)


@router.get(
    "/{group_id}/leaderboard",
    response_model=list[GroupLeaderboardEntry],
    summary="Leaderboard combinado do grupo",
)
def get_group_leaderboard(
    group_id: int,
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> list[GroupLeaderboardEntry]:
    """
    Soma UserStageStat de todos os stages de todos os championships do grupo.
    Desempate: survival_secs DESC → captain_pts DESC.
    """
    _get_group_or_404(group_id, db)

    stage_ids = _get_stage_ids_for_group(group_id, db)
    if not stage_ids:
        return []

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

    user_ids = [r.user_id for r in rows]
    username_map = {
        u.id: u.username
        for u in db.query(User).filter(User.id.in_(user_ids)).all()
    }

    return [
        GroupLeaderboardEntry(
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
    "/{group_id}/player-stats",
    response_model=list[GroupPlayerStatEntry],
    summary="Stats combinadas de jogadores no grupo",
)
def get_group_player_stats(
    group_id: int,
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> list[GroupPlayerStatEntry]:
    """
    Agrega MatchStat de todos os stages do grupo por jogador.
    Inclui kills, damage, assists, knocks, wins, além de xama_points.
    team_name e fantasy_cost são buscados da stage mais recente do grupo.
    Ordena por total_xama_points DESC.
    """
    _get_group_or_404(group_id, db)

    stage_ids = _get_stage_ids_for_group(group_id, db)
    if not stage_ids:
        return []

    # Agrega MatchStat via Match → StageDay → stage_id
    stat_rows = (
        db.query(MatchStat)
        .join(Match, MatchStat.match_id == Match.id)
        .join(StageDay, Match.stage_day_id == StageDay.id)
        .filter(StageDay.stage_id.in_(stage_ids))
        .all()
    )

    if not stat_rows:
        return []

    from collections import defaultdict
    from decimal import Decimal as _D
    agg: dict[int, dict] = defaultdict(lambda: {
        "xama_points": _D("0"),
        "matches": 0,
        "kills": 0,
        "assists": 0,
        "damage": _D("0"),
        "knocks": 0,
        "wins": 0,
    })

    for ms in stat_rows:
        a = agg[ms.person_id]
        a["xama_points"] += ms.xama_points or _D("0")
        a["matches"] += 1
        a["kills"] += int(ms.kills or 0)
        a["assists"] += int(ms.assists or 0)
        a["damage"] += ms.damage or _D("0")
        a["knocks"] += int(ms.knocks or 0)
        if ms.placement == 1:
            a["wins"] += 1

    # team_name e fantasy_cost: usa o roster mais recente de cada jogador
    # (stage_id DESC para que o primeiro encontrado por jogador seja o mais novo)
    person_ids = list(agg.keys())
    rosters = (
        db.query(Roster)
        .filter(Roster.stage_id.in_(stage_ids), Roster.person_id.in_(person_ids))
        .order_by(Roster.stage_id.desc())
        .all()
    )
    cost_map: dict[int, float] = {}
    team_map: dict[int, str]   = {}
    for r in rosters:
        if r.person_id not in cost_map and r.effective_cost is not None:
            cost_map[r.person_id] = r.effective_cost
        if r.person_id not in team_map and r.team_name:
            team_map[r.person_id] = r.team_name

    name_map = {
        p.id: p.display_name
        for p in db.query(Person).filter(Person.id.in_(person_ids)).all()
    }

    result = []
    for person_id, a in agg.items():
        total  = float(a["xama_points"])   # Decimal → float para o schema
        played = a["matches"]
        ppm    = round(total / played, 2) if played > 0 else None
        result.append(
            GroupPlayerStatEntry(
                rank=0,  # preenchido após sort
                person_id=person_id,
                display_name=name_map.get(person_id, "—"),
                team_name=team_map.get(person_id),
                fantasy_cost=cost_map.get(person_id),
                total_xama_points=round(total, 2),
                matches_played=played,
                pts_per_match=ppm,
                total_kills=a["kills"],
                total_assists=a["assists"],
                total_damage=float(round(a["damage"], 1)),
                total_knocks=a["knocks"],
                total_wins=a["wins"],
            )
        )

    result.sort(key=lambda x: x.total_xama_points, reverse=True)
    result = result[:limit]
    for idx, entry in enumerate(result):
        entry.rank = idx + 1
    return result
