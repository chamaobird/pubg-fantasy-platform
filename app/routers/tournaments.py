from collections import defaultdict
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func as sql_func
from app.database import get_db
from app.dependencies import get_current_user
from app.models import Lineup, Player, Team, Tournament, User, lineup_players
from app.models.match import Match, MatchPlayerStat
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
    budget_limit: float
    is_active: bool
    lineup_open: bool = False
    current_day: int = 1

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
            budget_limit=float(t.budget_limit or 0.0),
            is_active=(t.status == "active"),
            lineup_open=bool(t.lineup_open),
            current_day=int(t.current_day or 1),
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
        budget_limit=float(tournament.budget_limit or 0.0),
        is_active=(tournament.status == "active"),
        lineup_open=bool(tournament.lineup_open),
        current_day=int(tournament.current_day or 1),
    )


class TournamentPlayerResponse(BaseModel):
    id: int
    name: str
    team: Optional[str] = None
    nationality: Optional[str] = None
    region: Optional[str] = None
    fantasy_cost: float
    avg_kills_50: Optional[float] = None
    avg_damage_50: Optional[float] = None
    avg_placement_50: Optional[float] = None


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
    query = query.filter(Player.is_active == True)
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
            avg_kills_50=float(p.avg_kills_50) if p.avg_kills_50 is not None else None,
            avg_damage_50=float(p.avg_damage_50) if p.avg_damage_50 is not None else None,
            avg_placement_50=float(p.avg_placement_50) if p.avg_placement_50 is not None else None,
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
    day: int = 1
    captain_id: int
    reserve_player_id: Optional[int] = None
    total_points: float = 0.0
    created_at: str
    players: list[LineupPlayerBasicOut]


@router.post(
    "/{tournament_id}/lineups",
    response_model=LineupOut,
    status_code=status.HTTP_201_CREATED,
    summary="Cria lineup do usuário no torneio para o dia atual",
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

    # --- Lineup Lock: rejeita submissões quando fechado ---
    if not tournament.lineup_open:
        raise HTTPException(
            status_code=403,
            detail="Lineup submissions are closed for this tournament",
        )

    current_day = int(tournament.current_day or 1)

    # --- Uma lineup por usuário por torneio POR DIA ---
    existing_lineup = db.query(Lineup).filter(
        Lineup.tournament_id == tournament_id,
        Lineup.user_id == current_user.id,
        Lineup.day == current_day,
    ).first()
    if existing_lineup:
        raise HTTPException(
            status_code=400,
            detail=f"Você já possui uma lineup para o Dia {current_day} deste torneio. Não é possível criar mais de uma por dia.",
        )

    player_ids = body.player_ids
    if len(player_ids) != 4:
        raise HTTPException(status_code=400, detail="Lineup must have exactly 4 players")
    if len(set(player_ids)) != len(player_ids):
        raise HTTPException(status_code=400, detail="Duplicate players are not allowed")
    if body.captain_id not in player_ids:
        raise HTTPException(status_code=400, detail="captain_id must be in player_ids")
    reserve_player_id = body.reserve_player_id
    if reserve_player_id in player_ids:
        raise HTTPException(status_code=400, detail="reserve_player_id must not be in player_ids")
    all_ids = list(player_ids) + [reserve_player_id]
    all_players = (
        db.query(Player)
        .filter(Player.id.in_(all_ids), Player.tournament_id == tournament_id)
        .all()
    )
    if len(all_players) != len(all_ids):
        raise HTTPException(status_code=400, detail="One or more players not found in this tournament")
    players_by_id = {p.id: p for p in all_players}
    starters = [players_by_id[pid] for pid in player_ids]
    reserve_player = players_by_id[reserve_player_id]
    team_ids = [p.team_id for p in starters + [reserve_player] if p.team_id is not None]
    if len(team_ids) != len(set(team_ids)):
        raise HTTPException(status_code=400, detail="Only one player per team is allowed")
    starter_costs = [float(p.fantasy_cost or 0.0) for p in starters]
    min_starter_cost = min(starter_costs) if starter_costs else 0.0
    reserve_real_cost = float(reserve_player.fantasy_cost or 0.0)
    if reserve_real_cost > min_starter_cost:
        raise HTTPException(
            status_code=400,
            detail="Reserve player cost cannot exceed the cheapest starter",
        )
    total_cost = sum(starter_costs)
    budget = float(tournament.budget_limit)
    if total_cost > budget:
        raise HTTPException(
            status_code=400,
            detail=f"Lineup total cost with reserve {total_cost:.2f} exceeds budget {budget:.2f}",
        )
    lineup = Lineup(
        user_id=current_user.id,
        tournament_id=tournament_id,
        day=current_day,
        name=body.name,
        captain_player_id=body.captain_id,
        reserve_player_id=reserve_player_id,
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
    ordered_players = starters
    return LineupOut(
        id=lineup.id,
        name=lineup.name,
        tournament_id=lineup.tournament_id,
        day=lineup.day,
        captain_id=lineup.captain_player_id,
        reserve_player_id=lineup.reserve_player_id,
        total_points=float(lineup.total_points or 0.0),
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
    summary="Lista lineups do usuário no torneio (uma por dia)",
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
        .order_by(Lineup.day.asc(), Lineup.created_at.desc())
        .all()
    )
    result: list[LineupOut] = []
    for lineup in lineups:
        result.append(
            LineupOut(
                id=lineup.id,
                name=lineup.name,
                tournament_id=lineup.tournament_id,
                day=int(lineup.day or 1),
                captain_id=lineup.captain_player_id,
                reserve_player_id=lineup.reserve_player_id,
                total_points=float(lineup.total_points or 0.0),
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


# ------------------------------------------------------------------
# GET /tournaments/{tournament_id}/rankings
# ── v3: multi-day support — soma pontos de todos os dias por padrão
#        ?day=N filtra por dia específico
# ------------------------------------------------------------------
class RankingEntry(BaseModel):
    position: int
    lineup_id: int
    lineup_name: str
    user_id: int
    username: str                      # sempre preenchido (fallback = "user_{id}")
    display_name: Optional[str] = None # preenchido se o user definiu em /profile
    total_points: float
    day: Optional[int] = None          # None = total acumulado; N = dia específico
    days_played: list[int] = []        # quais dias o usuário tem lineup
    players: list[LineupPlayerBasicOut]


@router.get(
    "/{tournament_id}/rankings",
    response_model=list[RankingEntry],
    summary="Rankings do torneio",
    description=(
        "Sem ?day: retorna um entry por usuário com total_points = soma de todos os dias. "
        "Com ?day=N: retorna rankings apenas do dia N. "
        "Ties broken by created_at ASC."
    ),
)
def tournament_rankings(
    tournament_id: int,
    day: Optional[int] = Query(None, description="Filtrar por dia (ex: 1, 2). Sem filtro = total acumulado."),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    tournament = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    from sqlalchemy import nullslast

    if day is not None:
        # ── Filtro por dia específico ──────────────────────────────────────
        lineups = (
            db.query(Lineup)
            .options(joinedload(Lineup.players))
            .filter(
                Lineup.tournament_id == tournament_id,
                Lineup.day == day,
            )
            .order_by(
                nullslast(Lineup.total_points.desc()),
                Lineup.created_at.asc(),
            )
            .offset(skip)
            .limit(limit)
            .all()
        )

        # Carrega todos os users de uma vez (evita N+1)
        user_ids = list({l.user_id for l in lineups})
        users_by_id = {
            u.id: u
            for u in db.query(User).filter(User.id.in_(user_ids)).all()
        }

        # Pré-carrega quais dias cada usuário tem lineup
        all_lineups_for_users = (
            db.query(Lineup.user_id, Lineup.day)
            .filter(
                Lineup.tournament_id == tournament_id,
                Lineup.user_id.in_(user_ids),
            )
            .all()
        )
        days_by_user: dict[int, list[int]] = defaultdict(list)
        for row in all_lineups_for_users:
            days_by_user[row.user_id].append(row.day)

        result: list[RankingEntry] = []
        for position, lineup in enumerate(lineups, start=skip + 1):
            user = users_by_id.get(lineup.user_id)
            result.append(
                RankingEntry(
                    position=position,
                    lineup_id=lineup.id,
                    lineup_name=lineup.name,
                    user_id=lineup.user_id,
                    username=user.username if user else f"user_{lineup.user_id}",
                    display_name=user.display_name if user else None,
                    total_points=float(lineup.total_points or 0.0),
                    day=day,
                    days_played=sorted(set(days_by_user[lineup.user_id])),
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

    else:
        # ── Visão total: soma de todos os dias por usuário ─────────────────
        # Carrega todas as lineups do torneio
        all_lineups = (
            db.query(Lineup)
            .options(joinedload(Lineup.players))
            .filter(Lineup.tournament_id == tournament_id)
            .order_by(Lineup.day.asc(), Lineup.created_at.asc())
            .all()
        )

        if not all_lineups:
            return []

        # Agrupa por user_id
        user_lineup_map: dict[int, list[Lineup]] = defaultdict(list)
        for l in all_lineups:
            user_lineup_map[l.user_id].append(l)

        # Constrói entries: total de pontos por user, players do dia mais recente
        entries = []
        for user_id, user_lineups in user_lineup_map.items():
            total_pts = sum(float(l.total_points or 0.0) for l in user_lineups)
            latest_lineup = max(user_lineups, key=lambda l: l.day)
            earliest_created = min(l.created_at for l in user_lineups if l.created_at)
            entries.append({
                "user_id": user_id,
                "total_points": total_pts,
                "lineup": latest_lineup,
                "days_played": sorted(set(l.day for l in user_lineups)),
                "earliest_created": earliest_created,
            })

        # Ordena: total_points DESC, created_at ASC (empate)
        entries.sort(key=lambda x: (-x["total_points"], x["earliest_created"] or ""))

        # Paginação manual
        paginated = entries[skip: skip + limit]

        # Carrega users de uma vez
        user_ids = [e["user_id"] for e in paginated]
        users_by_id = {
            u.id: u
            for u in db.query(User).filter(User.id.in_(user_ids)).all()
        }

        result: list[RankingEntry] = []
        for position, entry in enumerate(paginated, start=skip + 1):
            user = users_by_id.get(entry["user_id"])
            lineup = entry["lineup"]
            result.append(
                RankingEntry(
                    position=position,
                    lineup_id=lineup.id,
                    lineup_name=lineup.name,
                    user_id=entry["user_id"],
                    username=user.username if user else f"user_{entry['user_id']}",
                    display_name=user.display_name if user else None,
                    total_points=entry["total_points"],
                    day=None,  # visão total
                    days_played=entry["days_played"],
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


# ------------------------------------------------------------------
# GET /tournaments/{tournament_id}/player-stats
# ------------------------------------------------------------------
class PlayerStatsSummary(BaseModel):
    player_id: int
    name: str
    team: Optional[str] = None
    region: Optional[str] = None
    fantasy_cost: float
    matches_played: int
    matches_total: int
    # Kill stats
    total_kills: int
    avg_kills: float
    # Assist stats
    total_assists: int
    avg_assists: float
    # Damage stats
    total_damage: float
    avg_damage: float
    # Placement
    avg_placement: float
    # Headshots
    total_headshots: int
    avg_headshots: float
    # Knocks (DBNOs)
    total_knocks: int
    avg_knocks: float
    # Survival
    avg_survival_secs: float
    # Wins (1st place finishes)
    total_wins: int
    # Fantasy points
    total_fantasy_points: float
    pts_per_match: float
    total_base_points: float
    total_late_game_bonus: float
    total_penalty_count: int


@router.get(
    "/{tournament_id}/player-stats",
    response_model=list[PlayerStatsSummary],
    summary="Stats agregadas dos jogadores no torneio (expandida)",
    description=(
        "Retorna stats completas de todos os jogadores com ao menos 1 partida. "
        "Inclui kills, assists, damage, headshots, knocks, survival, fantasy points. "
        "Endpoint público — sem autenticação."
    ),
)
def tournament_player_stats(
    tournament_id: int,
    team: Optional[str] = Query(None, description="Filtrar por nome do time"),
    match_id: Optional[int] = Query(None, description="Filtrar por partida específica"),
    date: Optional[str] = Query(None, description="Filtrar por data (YYYY-MM-DD)"),
    group_label: Optional[str] = Query(None, description="Filtrar por grupo (ex: 'A', 'B', 'C', 'D')"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    from app.models.match import Match, MatchPlayerStat
    from datetime import date as date_type, timedelta

    tournament = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    # ── Calcula edição mais recente e matches_total ───────────────────────
    all_matches = (
        db.query(Match)
        .filter(Match.tournament_id == tournament_id)
        .order_by(Match.played_at)
        .all()
    )

    if all_matches:
        latest = all_matches[-1].played_at
        cutoff = latest - timedelta(days=180)
        recent_matches = [m for m in all_matches if m.played_at and m.played_at >= cutoff]
        recent_match_ids = [m.id for m in recent_matches]
    else:
        recent_match_ids = []
        recent_matches = []

    if match_id:
        recent_match_ids = [mid for mid in recent_match_ids if mid == match_id]
    elif date:
        try:
            from datetime import datetime as dt
            filter_date = dt.strptime(date, "%Y-%m-%d").date()
            from datetime import timezone, timedelta
            BRT = timezone(timedelta(hours=-3))
            recent_matches = [
                m for m in recent_matches
                if m.played_at and m.played_at.astimezone(BRT).date() == filter_date
            ]
            recent_match_ids = [m.id for m in recent_matches]
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    # ── Filtro por grupo (group_label) ────────────────────────────────────────
    if group_label:
        recent_matches = [m for m in recent_matches if m.group_label == group_label]
        recent_match_ids = [m.id for m in recent_matches]

    matches_total = len(recent_match_ids)

    rows = (
        db.query(
            Player,
            Team.name.label("team_name"),
            sql_func.count(MatchPlayerStat.id).label("matches_played"),
            sql_func.sum(MatchPlayerStat.kills).label("total_kills"),
            sql_func.avg(MatchPlayerStat.kills).label("avg_kills"),
            sql_func.sum(MatchPlayerStat.assists).label("total_assists"),
            sql_func.avg(MatchPlayerStat.assists).label("avg_assists"),
            sql_func.sum(MatchPlayerStat.damage_dealt).label("total_damage"),
            sql_func.avg(MatchPlayerStat.damage_dealt).label("avg_damage"),
            sql_func.avg(MatchPlayerStat.placement).label("avg_placement"),
            sql_func.sum(MatchPlayerStat.headshots).label("total_headshots"),
            sql_func.avg(MatchPlayerStat.headshots).label("avg_headshots"),
            sql_func.sum(MatchPlayerStat.knocks).label("total_knocks"),
            sql_func.avg(MatchPlayerStat.knocks).label("avg_knocks"),
            sql_func.avg(MatchPlayerStat.survival_secs).label("avg_survival_secs"),
            sql_func.sum(MatchPlayerStat.fantasy_points).label("total_fantasy_points"),
            sql_func.sum(MatchPlayerStat.base_points).label("total_base_points"),
            sql_func.sum(MatchPlayerStat.late_game_bonus).label("total_late_game_bonus"),
            sql_func.sum(MatchPlayerStat.penalty_count).label("total_penalty_count"),
            sql_func.sum(MatchPlayerStat.wins_count).label("total_wins"),
        )
        .join(MatchPlayerStat, MatchPlayerStat.player_id == Player.id)
        .join(Match, MatchPlayerStat.match_id == Match.id)
        .outerjoin(Team, Player.team_id == Team.id)
        .filter(MatchPlayerStat.match_id.in_(recent_match_ids))
        .group_by(Player.id, Team.name)
        .order_by(sql_func.sum(MatchPlayerStat.fantasy_points).desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    if team:
        rows = [r for r in rows if r.team_name and team.lower() in r.team_name.lower()]

    result = []
    for r in rows:
        mp = r.matches_played or 1
        tfp = float(r.total_fantasy_points or 0.0)
        result.append(PlayerStatsSummary(
            player_id=r.Player.id,
            name=r.Player.name,
            team=r.team_name,
            region=r.Player.region,
            fantasy_cost=round(float(r.Player.fantasy_cost or 0.0), 2),
            matches_played=mp,
            matches_total=matches_total,
            total_kills=int(r.total_kills or 0),
            avg_kills=round(float(r.avg_kills or 0.0), 2),
            total_assists=int(r.total_assists or 0),
            avg_assists=round(float(r.avg_assists or 0.0), 2),
            total_damage=round(float(r.total_damage or 0.0), 1),
            avg_damage=round(float(r.avg_damage or 0.0), 1),
            avg_placement=round(float(r.avg_placement or 0.0), 1),
            total_headshots=int(r.total_headshots or 0),
            avg_headshots=round(float(r.avg_headshots or 0.0), 2),
            total_knocks=int(r.total_knocks or 0),
            avg_knocks=round(float(r.avg_knocks or 0.0), 2),
            avg_survival_secs=round(float(r.avg_survival_secs or 0.0), 0),
            total_wins=int(r.total_wins or 0),
            total_fantasy_points=round(tfp, 2),
            pts_per_match=round(tfp / mp, 2),
            total_base_points=round(float(r.total_base_points or 0.0), 2),
            total_late_game_bonus=round(float(r.total_late_game_bonus or 0.0), 2),
            total_penalty_count=int(r.total_penalty_count or 0),
        ))
    return result


@router.get(
    "/{tournament_id}/matches",
    summary="Lista partidas do torneio agrupadas por data",
)
def tournament_matches(
    tournament_id: int,
    db: Session = Depends(get_db),
):
    from app.models.match import Match

    tournament = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    matches = (
        db.query(Match)
        .filter(Match.tournament_id == tournament_id)
        .order_by(Match.played_at)
        .all()
    )

    if not matches:
        return {"tournament_id": tournament_id, "total_matches": 0, "days": []}

    sessions = []
    current_session = []
    for m in matches:
        if not current_session:
            current_session.append(m)
        else:
            last = current_session[-1]
            diff = abs((m.played_at - last.played_at).total_seconds())
            if diff <= 4 * 3600:
                current_session.append(m)
            else:
                sessions.append(current_session)
                current_session = [m]
    if current_session:
        sessions.append(current_session)

    editions = [[sessions[0]]]
    for i in range(1, len(sessions)):
        gap = abs((sessions[i][0].played_at - sessions[i-1][-1].played_at).total_seconds())
        if gap > 30 * 24 * 3600:
            editions.append([sessions[i]])
        else:
            editions[-1].append(sessions[i])

    latest_edition = editions[-1]
    result = []
    for i, session in enumerate(latest_edition):
        from datetime import timezone, timedelta
        BRT = timezone(timedelta(hours=-3))
        date_key = session[0].played_at.astimezone(BRT).date().isoformat()
        # Usa o campo day do primeiro match da sessão (se disponível)
        session_day = session[0].day if session[0].day else (i + 1)
        session_matches = []
        for j, m in enumerate(session):
            stats_count = (
                db.query(sql_func.count(MatchPlayerStat.id))
                .filter(MatchPlayerStat.match_id == m.id)
                .scalar() or 0
            )
            session_matches.append({
                "id": m.id,
                "map_name": m.map_name,
                "played_at": m.played_at.isoformat() if m.played_at else None,
                "duration_secs": m.duration_secs,
                "match_number_in_day": j + 1,
                "group_label": m.group_label,
                "stats_count": stats_count,
            })
        result.append({
            "date": date_key,
            "session": i + 1,
            "day": session_day,
            "matches_count": len(session_matches),
            "matches": session_matches,
        })

    latest_matches = [m for session in latest_edition for m in session]
    return {
        "tournament_id": tournament_id,
        "total_matches": len(latest_matches),
        "days": result,
    }


@router.get(
    "/{tournament_id}/debug-players",
    summary="[Debug] Player pubg_id coverage for a tournament",
)
def debug_tournament_players(
    tournament_id: int,
    db: Session = Depends(get_db),
):
    """Returns player lookup info to diagnose stats resolution failures."""
    players = (
        db.query(Player)
        .filter(Player.tournament_id == tournament_id)
        .all()
    )
    fallback = False
    if not players:
        players = db.query(Player).all()
        fallback = True

    with_pubg_id = [p for p in players if p.pubg_id]
    without_pubg_id = [p for p in players if not p.pubg_id]

    return {
        "tournament_id": tournament_id,
        "fallback_to_all": fallback,
        "total_players": len(players),
        "with_pubg_id": len(with_pubg_id),
        "without_pubg_id": len(without_pubg_id),
        "all_players": [
            {"id": p.id, "name": p.name, "pubg_id": p.pubg_id, "live_pubg_id": getattr(p, "live_pubg_id", None)}
            for p in players
        ],
    }


@router.get(
    "/{tournament_id}/debug-match-resolve/{pubg_match_id}",
    summary="[Debug] Dry-run player resolution for a PUBG match",
)
def debug_match_resolve(
    tournament_id: int,
    pubg_match_id: str,
    shard: str = Query("steam", description="PUBG shard to fetch from"),
    db: Session = Depends(get_db),
):
    """
    Fetches a match from the PUBG API and shows which participants
    would be resolved to Player records — without saving anything.
    """
    from app.core.config import settings
    from app.services.pubg_client import PubgApiError, PubgClient
    from app.services.historical import _build_player_lookup, _resolve_player_id

    client = PubgClient(api_key=settings.PUBG_API_KEY, shard=shard)
    try:
        raw = client.get_match(pubg_match_id)
    except PubgApiError as exc:
        raise HTTPException(status_code=502, detail=f"PUBG API error: {exc}")

    lookup = _build_player_lookup(db, tournament_id)

    resolved = []
    unresolved = []
    for rps in raw.player_stats:
        pid = _resolve_player_id(lookup, rps.pubg_account_id, rps.pubg_name)
        entry = {"pubg_name": rps.pubg_name, "pubg_account_id": rps.pubg_account_id}
        if pid is not None:
            resolved.append({**entry, "player_id": pid})
        else:
            unresolved.append(entry)

    return {
        "pubg_match_id": pubg_match_id,
        "shard": shard,
        "tournament_id": tournament_id,
        "total_participants": len(raw.player_stats),
        "resolved_count": len(resolved),
        "unresolved_count": len(unresolved),
        "resolved": resolved,
        "unresolved": unresolved,
    }
