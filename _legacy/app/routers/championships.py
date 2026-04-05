# app/routers/championships.py
"""
Endpoints de campeonatos — gerenciamento de ligas, times fantasy,
partidas e rankings ao vivo.

Rotas públicas (só requer autenticação JWT):
  GET  /championships/leagues                → lista ligas abertas
  GET  /championships/leagues/{id}           → detalhes de uma liga
  GET  /championships/leagues/{id}/ranking   → ranking ao vivo da liga
  GET  /championships/matches/{id}/stats     → stats de uma partida + pontos

Rotas do usuário autenticado:
  POST /championships/leagues/{id}/teams           → cria fantasy team na liga
  POST /championships/leagues/{id}/teams/{tid}/players → adiciona jogador ao squad (máx 4)
  DELETE /championships/leagues/{id}/teams/{tid}/players/{pid} → remove jogador
  GET  /championships/my-teams                     → meus times em todas as ligas

Rotas admin:
  POST /championships/leagues                      → cria liga
  POST /championships/leagues/{id}/matches/sync    → importa matches da PUBG API e pontua ao vivo
  POST /championships/matches/{id}/reprocess       → reprocessa pontuação de uma partida
"""

import logging
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import (
    FantasyLeague,
    FantasyTeam,
    Match,
    MatchPlayerStat,
    Player,
    PlayerScore,
    Tournament,
    fantasy_team_players,
)
from app.routers.admin import require_admin
from app.services.pubg_api import PUBGApiClient
from app.services.scoring import (
    get_scoring_breakdown,
    process_match_stats,
    PLACEMENT_POINTS,
    POINTS_PER_KILL,
    POINTS_PER_ASSIST,
    POINTS_PER_DAMAGE,
    POINTS_PER_SECOND,
    POINTS_PER_HEADSHOT,
    POINTS_PER_KNOCK,
)
from app.models import User
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/championships", tags=["Championships"])

MAX_SQUAD_SIZE = 4


# ---------------------------------------------------------------------------
# SCHEMAS
# ---------------------------------------------------------------------------

class LeagueCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=100)
    tournament_id: int
    max_fantasy_teams: int = Field(default=20, ge=2, le=200)
    budget_per_team: float = Field(default=100.0, ge=10.0)


class LeagueResponse(BaseModel):
    id: int
    name: str
    tournament_id: Optional[int]
    tournament_name: Optional[str] = None
    max_fantasy_teams: int
    budget_per_team: float
    teams_count: int = 0
    created_at: str

    class Config:
        from_attributes = True


class FantasyTeamCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=60)


class FantasyTeamResponse(BaseModel):
    id: int
    name: str
    owner_username: str
    total_points: float
    players: list[dict] = []
    squad_complete: bool = False
    created_at: str

    class Config:
        from_attributes = True


class RankingEntry(BaseModel):
    rank: int
    fantasy_team_id: int
    fantasy_team_name: str
    owner_username: str
    total_points: float
    players_summary: list[dict] = []


class MatchStatResponse(BaseModel):
    player_name: str
    pubg_id: Optional[str]
    kills: int
    assists: int
    damage_dealt: float
    placement: int
    survival_secs: int
    headshots: int
    knocks: int
    fantasy_points: float
    breakdown: dict


class AddPlayerRequest(BaseModel):
    player_id: int
    slot: int = Field(..., ge=1, le=4, description="Slot no squad (1-4)")


# ---------------------------------------------------------------------------
# ROTAS PÚBLICAS
# ---------------------------------------------------------------------------

@router.get(
    "/scoring-rules",
    summary="Retorna a tabela de pontuação vigente",
    description="Exibe todas as regras de pontuação para transparência ao usuário.",
)
def get_scoring_rules():
    return {
        "description": "Fórmula de pontuação fantasy — Warzone Fantasy",
        "per_stat": {
            "kill":     {"points": POINTS_PER_KILL,     "description": "por abate"},
            "assist":   {"points": POINTS_PER_ASSIST,   "description": "por assistência"},
            "damage":   {"points": POINTS_PER_DAMAGE,   "description": "por ponto de dano causado"},
            "survival": {"points": POINTS_PER_SECOND,   "description": "por segundo vivo na partida"},
            "headshot": {"points": POINTS_PER_HEADSHOT, "description": "bônus por headshot kill"},
            "knock":    {"points": POINTS_PER_KNOCK,    "description": "bônus por knockdown"},
        },
        "placement_table": PLACEMENT_POINTS,
        "example": {
            "scenario": "6 kills, 2 assists, 420 dano, 2º lugar, 30 min vivo",
            "breakdown": {
                "kills":     "6 × 10 = 60 pts",
                "assists":   "2 × 4  =  8 pts",
                "damage":    "420 × 0.05 = 21 pts",
                "placement": "2º → 20 pts",
                "survival":  "1800s × 0.01 = 18 pts",
                "total":     "127 pts",
            },
        },
    }


@router.get(
    "/leagues",
    response_model=list[LeagueResponse],
    summary="Lista ligas fantasy abertas",
)
def list_leagues(
    tournament_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(FantasyLeague)
    if tournament_id:
        query = query.filter(FantasyLeague.tournament_id == tournament_id)

    leagues = query.order_by(FantasyLeague.created_at.desc()).offset(skip).limit(limit).all()

    result = []
    for lg in leagues:
        t_name = lg.tournament.name if lg.tournament else None
        result.append(LeagueResponse(
            id=lg.id,
            name=lg.name,
            tournament_id=lg.tournament_id,
            tournament_name=t_name,
            max_fantasy_teams=lg.max_fantasy_teams,
            budget_per_team=lg.budget_per_team,
            teams_count=len(lg.fantasy_teams),
            created_at=lg.created_at.isoformat(),
        ))
    return result


@router.get(
    "/leagues/{league_id}",
    response_model=LeagueResponse,
    summary="Detalhes de uma liga",
)
def get_league(
    league_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lg = _get_league_or_404(db, league_id)
    return LeagueResponse(
        id=lg.id,
        name=lg.name,
        tournament_id=lg.tournament_id,
        tournament_name=lg.tournament.name if lg.tournament else None,
        max_fantasy_teams=lg.max_fantasy_teams,
        budget_per_team=lg.budget_per_team,
        teams_count=len(lg.fantasy_teams),
        created_at=lg.created_at.isoformat(),
    )


@router.get(
    "/leagues/{league_id}/ranking",
    response_model=list[RankingEntry],
    summary="Ranking ao vivo da liga",
    description="Retorna os times ordenados por pontuação total. Atualizado a cada match processado.",
)
def get_league_ranking(
    league_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_league_or_404(db, league_id)

    teams = (
        db.query(FantasyTeam)
        .filter(FantasyTeam.league_id == league_id)
        .order_by(FantasyTeam.total_points.desc())
        .all()
    )

    ranking = []
    for pos, ft in enumerate(teams, start=1):
        players_summary = []
        for p in ft.players:
            score = (
                db.query(PlayerScore)
                .filter(PlayerScore.player_id == p.id, PlayerScore.league_id == league_id)
                .first()
            )
            players_summary.append({
                "player_id":    p.id,
                "name":         p.name,
                "position":     p.position,
                "total_points": score.total_points if score else 0.0,
                "total_kills":  score.total_kills  if score else 0,
            })

        ranking.append(RankingEntry(
            rank=pos,
            fantasy_team_id=ft.id,
            fantasy_team_name=ft.name,
            owner_username=ft.owner.username,
            total_points=ft.total_points,
            players_summary=players_summary,
        ))

    return ranking


@router.get(
    "/matches/{match_id}/stats",
    response_model=list[MatchStatResponse],
    summary="Stats de uma partida com pontuação detalhada",
)
def get_match_stats(
    match_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Partida não encontrada.")

    stats = (
        db.query(MatchPlayerStat)
        .filter(MatchPlayerStat.match_id == match_id)
        .order_by(MatchPlayerStat.fantasy_points.desc())
        .all()
    )

    return [
        MatchStatResponse(
            player_name=s.player.name,
            pubg_id=s.player.pubg_id,
            kills=s.kills,
            assists=s.assists,
            damage_dealt=s.damage_dealt,
            placement=s.placement,
            survival_secs=s.survival_secs,
            headshots=s.headshots,
            knocks=s.knocks,
            fantasy_points=s.fantasy_points,
            breakdown=get_scoring_breakdown(
                kills=s.kills,
                assists=s.assists,
                damage_dealt=s.damage_dealt,
                placement=s.placement,
                survival_secs=s.survival_secs,
                headshots=s.headshots,
                knocks=s.knocks,
            ),
        )
        for s in stats
    ]


# ---------------------------------------------------------------------------
# ROTAS DO USUÁRIO AUTENTICADO
# ---------------------------------------------------------------------------

@router.get(
    "/my-teams",
    response_model=list[FantasyTeamResponse],
    summary="Meus times em todas as ligas",
)
def my_teams(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    teams = (
        db.query(FantasyTeam)
        .filter(FantasyTeam.owner_id == current_user.id)
        .order_by(FantasyTeam.created_at.desc())
        .all()
    )
    return [_serialize_fantasy_team(ft) for ft in teams]


@router.post(
    "/leagues/{league_id}/teams",
    response_model=FantasyTeamResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cria um time fantasy na liga",
)
def create_fantasy_team(
    league_id: int,
    body: FantasyTeamCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lg = _get_league_or_404(db, league_id)

    # Verifica se a liga ainda tem vagas
    if len(lg.fantasy_teams) >= lg.max_fantasy_teams:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Liga lotada ({lg.max_fantasy_teams} times). Tente outra liga.",
        )

    # Usuário só pode ter 1 time por liga
    existing = (
        db.query(FantasyTeam)
        .filter(FantasyTeam.league_id == league_id, FantasyTeam.owner_id == current_user.id)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Você já tem um time nesta liga.",
        )

    ft = FantasyTeam(name=body.name, owner_id=current_user.id, league_id=league_id)
    db.add(ft)
    db.commit()
    db.refresh(ft)

    logger.info(f"[Championships] FantasyTeam criada: '{ft.name}' na liga {league_id} por {current_user.username}")
    return _serialize_fantasy_team(ft)


@router.post(
    "/leagues/{league_id}/teams/{team_id}/players",
    response_model=FantasyTeamResponse,
    summary="Adiciona jogador ao squad (máx 4)",
    description=(
        "Adiciona um jogador a um slot do squad (1-4). "
        "Verifica budget disponível e se o jogador já está no squad."
    ),
)
def add_player_to_team(
    league_id: int,
    team_id: int,
    body: AddPlayerRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lg = _get_league_or_404(db, league_id)
    ft = _get_own_team_or_403(db, team_id, league_id, current_user)

    if len(ft.players) >= MAX_SQUAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Squad completo ({MAX_SQUAD_SIZE}/{MAX_SQUAD_SIZE}). Remova um jogador antes de adicionar.",
        )

    player = db.query(Player).filter(Player.id == body.player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Jogador não encontrado.")

    # Verifica se jogador já está no squad
    if any(p.id == player.id for p in ft.players):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Jogador '{player.name}' já está no seu squad.",
        )

    # Verifica se o slot já está ocupado
    slot_check = db.execute(
        fantasy_team_players.select().where(
            fantasy_team_players.c.fantasy_team_id == ft.id,
            fantasy_team_players.c.slot == body.slot,
        )
    ).first()
    if slot_check:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Slot {body.slot} já está ocupado. Remova o jogador atual primeiro.",
        )

    # Verifica budget
    current_spend = sum(p.fantasy_cost for p in ft.players)
    if current_spend + player.fantasy_cost > lg.budget_per_team:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Budget insuficiente. "
                f"Gasto atual: {current_spend:.1f} | "
                f"Custo do jogador: {player.fantasy_cost:.1f} | "
                f"Budget total: {lg.budget_per_team:.1f}"
            ),
        )

    db.execute(
        fantasy_team_players.insert().values(
            fantasy_team_id=ft.id,
            player_id=player.id,
            slot=body.slot,
        )
    )
    db.commit()
    db.refresh(ft)

    logger.info(
        f"[Championships] '{player.name}' adicionado ao slot {body.slot} "
        f"do time '{ft.name}' (liga {league_id})"
    )
    return _serialize_fantasy_team(ft)


@router.delete(
    "/leagues/{league_id}/teams/{team_id}/players/{player_id}",
    response_model=FantasyTeamResponse,
    summary="Remove jogador do squad",
)
def remove_player_from_team(
    league_id: int,
    team_id: int,
    player_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ft = _get_own_team_or_403(db, team_id, league_id, current_user)

    if not any(p.id == player_id for p in ft.players):
        raise HTTPException(status_code=404, detail="Jogador não está no seu squad.")

    db.execute(
        fantasy_team_players.delete().where(
            fantasy_team_players.c.fantasy_team_id == ft.id,
            fantasy_team_players.c.player_id == player_id,
        )
    )
    db.commit()
    db.refresh(ft)
    return _serialize_fantasy_team(ft)


# ---------------------------------------------------------------------------
# ROTAS ADMIN
# ---------------------------------------------------------------------------

@router.post(
    "/leagues",
    response_model=LeagueResponse,
    status_code=status.HTTP_201_CREATED,
    summary="[Admin] Cria uma liga fantasy",
)
def create_league(
    body: LeagueCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    tournament = db.query(Tournament).filter(Tournament.id == body.tournament_id).first()
    if not tournament:
        raise HTTPException(status_code=404, detail="Torneio não encontrado.")

    lg = FantasyLeague(
        name=body.name,
        tournament_id=body.tournament_id,
        max_fantasy_teams=body.max_fantasy_teams,
        budget_per_team=body.budget_per_team,
    )
    db.add(lg)
    db.commit()
    db.refresh(lg)

    return LeagueResponse(
        id=lg.id,
        name=lg.name,
        tournament_id=lg.tournament_id,
        tournament_name=tournament.name,
        max_fantasy_teams=lg.max_fantasy_teams,
        budget_per_team=lg.budget_per_team,
        teams_count=0,
        created_at=lg.created_at.isoformat(),
    )


@router.post(
    "/leagues/{league_id}/matches/sync",
    summary="[Admin] Importa matches da PUBG API e pontua ao vivo",
    description=(
        "Busca matches do torneio vinculado à liga, importa os novos "
        "(que ainda não estão no banco) e executa o scoring engine em cada um. "
        "Rate limit: sleep(6s) entre matches. Retorna resumo de cada match processado."
    ),
)
async def sync_and_score_matches(
    league_id: int,
    max_new_matches: int = Query(5, ge=1, le=20, description="Máximo de matches novos a importar"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if not settings.PUBG_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="PUBG_API_KEY não configurada.",
        )

    lg = _get_league_or_404(db, league_id)
    if not lg.tournament or not lg.tournament.pubg_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A liga não está vinculada a um torneio com pubg_id. Configure primeiro.",
        )

    tournament_pubg_id = lg.tournament.pubg_id

    try:
        async with PUBGApiClient() as client:
            tournament_data = await client.get_tournament(tournament_pubg_id)
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"PUBG API erro {e.response.status_code} ao buscar torneio '{tournament_pubg_id}'.",
        )

    match_refs = (
        tournament_data.get("data", {})
        .get("relationships", {})
        .get("matches", {})
        .get("data", [])
    )

    # Filtra apenas matches que ainda não estão no banco
    existing_pubg_ids = {
        row[0] for row in db.query(Match.pubg_match_id).all()
    }
    new_match_ids = [
        m["id"] for m in match_refs
        if m["id"] not in existing_pubg_ids
    ][:max_new_matches]

    if not new_match_ids:
        return {
            "message": "Nenhum match novo encontrado. Tudo já está sincronizado.",
            "league_id": league_id,
            "processed": [],
        }

    results = []

    try:
        async with PUBGApiClient() as client:
            for i, pubg_match_id in enumerate(new_match_ids):
                if i > 0:
                    import asyncio
                    await asyncio.sleep(6)  # respeita rate limit

                try:
                    match_data = await client.get_match(pubg_match_id)
                except httpx.HTTPStatusError as e:
                    logger.warning(f"[Championships] Match {pubg_match_id} falhou: {e}")
                    results.append({"pubg_match_id": pubg_match_id, "error": str(e)})
                    continue

                # Persiste o Match
                attrs = match_data.get("data", {}).get("attributes", {})
                match = Match(
                    pubg_match_id = pubg_match_id,
                    tournament_id = lg.tournament_id,
                    map_name      = attrs.get("mapName", ""),
                    played_at     = _parse_dt(attrs.get("createdAt")),
                    duration_secs = int(attrs.get("duration", 0)),
                )
                db.add(match)
                db.flush()

                # Extrai stats brutas dos participantes
                player_stats_raw = _extract_participants(match_data)

                # Scoring engine ao vivo
                summary = process_match_stats(db, match, player_stats_raw)
                results.append(summary)

                logger.info(f"[Championships] Match {pubg_match_id} processado: {summary}")

    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Erro de conexão com PUBG API: {e}",
        )

    return {
        "message": f"{len(results)} matches processados com scoring ao vivo.",
        "league_id": league_id,
        "tournament_pubg_id": tournament_pubg_id,
        "processed": results,
    }


@router.post(
    "/matches/{match_id}/reprocess",
    summary="[Admin] Reprocessa pontuação de uma partida",
    description="Recalcula os fantasy_points de todos os jogadores em uma partida já importada.",
)
def reprocess_match(
    match_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Partida não encontrada.")

    stats = db.query(MatchPlayerStat).filter(MatchPlayerStat.match_id == match_id).all()
    if not stats:
        raise HTTPException(status_code=404, detail="Nenhuma stat encontrada para esta partida.")

    # Reconstrói lista de raw stats a partir do que já está no banco
    player_stats_raw = [
        {
            "pubg_id":       s.player.pubg_id,
            "kills":         s.kills,
            "assists":       s.assists,
            "damage_dealt":  s.damage_dealt,
            "placement":     s.placement,
            "survival_secs": s.survival_secs,
            "headshots":     s.headshots,
            "knocks":        s.knocks,
        }
        for s in stats if s.player.pubg_id
    ]

    summary = process_match_stats(db, match, player_stats_raw)
    return {"message": "Partida reprocessada com sucesso.", **summary}


# ---------------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------------

def _get_league_or_404(db: Session, league_id: int) -> FantasyLeague:
    lg = db.query(FantasyLeague).filter(FantasyLeague.id == league_id).first()
    if not lg:
        raise HTTPException(status_code=404, detail="Liga não encontrada.")
    return lg


def _get_own_team_or_403(
    db: Session, team_id: int, league_id: int, user: User
) -> FantasyTeam:
    ft = db.query(FantasyTeam).filter(
        FantasyTeam.id == team_id,
        FantasyTeam.league_id == league_id,
    ).first()
    if not ft:
        raise HTTPException(status_code=404, detail="Time não encontrado nesta liga.")
    if ft.owner_id != user.id and not user.is_admin:
        raise HTTPException(status_code=403, detail="Este time não é seu.")
    return ft


def _serialize_fantasy_team(ft: FantasyTeam) -> FantasyTeamResponse:
    players = []
    for p in ft.players:
        row = db_row = None
        players.append({
            "player_id":    p.id,
            "name":         p.name,
            "pubg_id":      p.pubg_id,
            "position":     p.position,
            "region":       p.region,
            "fantasy_cost": p.fantasy_cost,
        })
    return FantasyTeamResponse(
        id=ft.id,
        name=ft.name,
        owner_username=ft.owner.username,
        total_points=ft.total_points,
        players=players,
        squad_complete=len(players) == MAX_SQUAD_SIZE,
        created_at=ft.created_at.isoformat(),
    )


def _extract_participants(match_data: dict) -> list[dict]:
    """Extrai lista de stats dos participantes de um match da PUBG API."""
    included = match_data.get("included", [])
    result = []
    for item in included:
        if item.get("type") != "participant":
            continue
        stats = item.get("attributes", {}).get("stats", {})
        pubg_id = stats.get("playerId", "")
        if not pubg_id or pubg_id == "ai":
            continue
        result.append({
            "pubg_id":      pubg_id,
            "kills":        stats.get("kills", 0),
            "assists":      stats.get("assists", 0),
            "damageDealt":  stats.get("damageDealt", 0.0),
            "winPlace":     stats.get("winPlace", 28),
            "timeSurvived": stats.get("timeSurvived", 0),
            "headshotKills":stats.get("headshotKills", 0),
            "DBNOs":        stats.get("DBNOs", 0),
        })
    return result


def _parse_dt(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None
