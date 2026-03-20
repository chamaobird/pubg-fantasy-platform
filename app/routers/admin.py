# app/routers/admin.py
"""
Endpoints administrativos para sincronização com a PUBG API.
Todos os endpoints requerem autenticação JWT + is_admin=True.
"""

import logging
from datetime import datetime

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models import Player, Tournament, User
from app.models.match import Match, MatchPlayerStat
from app.models.lineup import Lineup
from app.services.pubg_api import PUBGApiClient, calculate_fantasy_cost
from app.services.lineup_scoring import score_all_lineups_for_match
from app.config import settings


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Admin"])

# ------------------------------------------------------------------
# POST /admin/recalculate-costs
# ------------------------------------------------------------------

@router.post(
    "/recalculate-costs",
    summary="Recalcula fantasy_cost de todos os jogadores",
    description=(
        "Recalcula o fantasy_cost de todos os jogadores no banco usando "
        "a fórmula padrão, sem chamar a PUBG API. Útil após ajuste da fórmula."
    ),
)
async def recalculate_costs(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    players = db.query(Player).all()
    updated = 0

    for player in players:
        new_cost = calculate_fantasy_cost(
            avg_kills=player.avg_kills or 0.0,
            avg_damage=player.avg_damage or 0.0,
            avg_placement=player.avg_placement or 15.0,
        )
        player.fantasy_cost = new_cost
        updated += 1

    db.commit()
    return {
        "message": f"fantasy_cost recalculado para {updated} jogadores.",
        "updated": updated,
    }

@router.post("/promote-to-admin", summary="[TEMP] Promove usuário a admin")
async def promote_user_to_admin(
    email: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """
    ENDPOINT TEMPORÁRIO: Promove qualquer usuário a admin.
    ⚠️ REMOVER EM PRODUÇÃO! Deixar apenas para setup inicial.
    """
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Usuário com email {email} não encontrado"
        )

    user.is_admin = True
    db.commit()
    db.refresh(user)

    return {
        "message": f"Usuário {email} promovido a admin com sucesso!",
        "user_id": user.id,
        "email": user.email,
        "is_admin": user.is_admin
    }


@router.get("/list-users", summary="[TEMP] Lista todos os emails")
async def list_all_users(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """TEMPORÁRIO: Lista emails de todos os usuários para debug"""
    users = db.query(User).all()
    return {
        "total": len(users),
        "users": [{"id": u.id, "email": u.email, "is_admin": u.is_admin} for u in users]
    }

# ------------------------------------------------------------------
# POST /admin/matches/{match_id}/score
# ------------------------------------------------------------------

@router.post(
    "/matches/{match_id}/score",
    summary="Score all lineups for a match",
    description=(
        "For the given match_id, computes fantasy points for every Lineup "
        "in the match's tournament using normalized MatchPlayerStat rows and "
        "the tournament's ScoringRule. Creates or updates one LineupScore per "
        "lineup and rebuilds each Lineup's total_points. Requires is_admin=True."
    ),
)
async def score_match_lineups(
    match_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Match {match_id} not found.",
        )
    if not match.tournament_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Match {match_id} has no tournament_id — cannot score lineups.",
        )

    try:
        result = score_all_lineups_for_match(match_id, db)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))

    return result


# ------------------------------------------------------------------
# POST /admin/seed-test-match
# ------------------------------------------------------------------

# Hardcoded per-slot stats — deterministic so results are predictable
_TEST_STATS = [
    {"kills": 5, "assists": 2, "damage_dealt": 380.0, "placement": 1, "survival_secs": 1750, "headshots": 3, "knocks": 4},
    {"kills": 3, "assists": 1, "damage_dealt": 210.0, "placement": 1, "survival_secs": 1600, "headshots": 1, "knocks": 2},
    {"kills": 2, "assists": 0, "damage_dealt": 145.0, "placement": 1, "survival_secs": 1500, "headshots": 0, "knocks": 1},
    {"kills": 1, "assists": 1, "damage_dealt":  90.0, "placement": 1, "survival_secs": 1400, "headshots": 0, "knocks": 0},
]

_TEST_PUBG_MATCH_ID = "test-match-001"


@router.post(
    "/seed-test-match",
    summary="[TEST] Seed a Match + MatchPlayerStat rows for scoring tests",
    description=(
        "Creates one Match and MatchPlayerStat rows for the first lineup found in the "
        "given tournament. Idempotent: if 'test-match-001' already exists it returns "
        "the existing match_id without inserting duplicates. "
        "For local testing only — use before calling POST /admin/matches/{match_id}/score."
    ),
)
async def seed_test_match(
    tournament_id: int = Query(default=1, description="Tournament to seed the match into"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    # ── Validate tournament exists ─────────────────────────────────────────
    tournament = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not tournament:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tournament {tournament_id} not found.",
        )

    # ── Find first lineup for this tournament ─────────────────────────────
    lineup = (
        db.query(Lineup)
        .filter(Lineup.tournament_id == tournament_id)
        .first()
    )
    if not lineup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                f"No lineups found for tournament {tournament_id}. "
                "Create a lineup first via POST /tournaments/{id}/lineups."
            ),
        )

    starter_players = lineup.players  # ordered by slot (slots 1-4)
    if not starter_players:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Lineup {lineup.id} has no players in lineup_players.",
        )

    # ── Upsert Match (idempotent on pubg_match_id) ────────────────────────
    match = (
        db.query(Match)
        .filter(Match.pubg_match_id == _TEST_PUBG_MATCH_ID)
        .first()
    )
    created_match = False
    if not match:
        match = Match(
            pubg_match_id = _TEST_PUBG_MATCH_ID,
            tournament_id = tournament_id,
            map_name      = "Erangel",
            match_number  = 1,
            phase         = "group",
            day           = 1,
        )
        db.add(match)
        db.flush()  # populate match.id
        created_match = True

    # ── Upsert MatchPlayerStat for each starter ───────────────────────────
    player_ids = []
    for i, player in enumerate(starter_players):
        raw = _TEST_STATS[i] if i < len(_TEST_STATS) else _TEST_STATS[-1]
        player_ids.append(player.id)

        existing_stat = (
            db.query(MatchPlayerStat)
            .filter(
                MatchPlayerStat.match_id  == match.id,
                MatchPlayerStat.player_id == player.id,
            )
            .first()
        )
        if existing_stat:
            # Overwrite with test values so re-seeding is safe
            existing_stat.kills         = raw["kills"]
            existing_stat.assists       = raw["assists"]
            existing_stat.damage_dealt  = raw["damage_dealt"]
            existing_stat.placement     = raw["placement"]
            existing_stat.survival_secs = raw["survival_secs"]
            existing_stat.headshots     = raw["headshots"]
            existing_stat.knocks        = raw["knocks"]
        else:
            db.add(MatchPlayerStat(
                match_id       = match.id,
                player_id      = player.id,
                kills          = raw["kills"],
                assists        = raw["assists"],
                damage_dealt   = raw["damage_dealt"],
                placement      = raw["placement"],
                survival_secs  = raw["survival_secs"],
                headshots      = raw["headshots"],
                knocks         = raw["knocks"],
            ))

    db.commit()

    return {
        "match_id":      match.id,
        "tournament_id": tournament_id,
        "lineup_id":     lineup.id,
        "player_ids":    player_ids,
        "match_created": created_match,
        "message":       (
            "Test match and stats created. "
            f"Now call POST /admin/matches/{match.id}/score to compute LineupScores."
        ),
    }
from pydantic import BaseModel as _BaseModel  # local alias to avoid collision if BaseModel already imported
from typing import Optional as _Optional
from datetime import datetime as _datetime


class RegisterTournamentBody(_BaseModel):
    name:       str
    pubg_id:    str
    region:     str                    = "AM"
    status:     str                    = "active"
    start_date: _Optional[_datetime]   = None
    end_date:   _Optional[_datetime]   = None
    max_teams:  int                    = 20


@router.post("/register-tournament", summary="Register a new tournament (e.g. PAS Cup week N)")
async def register_tournament(
    body: RegisterTournamentBody,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """
    Creates a Tournament row for a new PAS Cup (or any tournament).
    Idempotent: if pubg_id already exists, returns the existing row unchanged.

    Typical weekly flow for PAS:
      1. Run client.list_tournaments() in REPL — spot new am-pasNcup ID
      2. POST /admin/register-tournament with the new pubg_id
      3. POST /admin/players/bulk-upsert/{id} if roster changed
      4. Scheduler picks it up automatically on next 15-min cycle
    """
    from app.models import Tournament

    existing = db.query(Tournament).filter(Tournament.pubg_id == body.pubg_id).first()
    if existing:
        return {
            "action":        "already_exists",
            "tournament_id": existing.id,
            "name":          existing.name,
            "pubg_id":       existing.pubg_id,
            "status":        existing.status,
        }

    tournament = Tournament(
        name=body.name,
        pubg_id=body.pubg_id,
        region=body.region.upper(),
        status=body.status,
        start_date=body.start_date,
        end_date=body.end_date,
        max_teams=body.max_teams,
    )
    db.add(tournament)
    db.commit()
    db.refresh(tournament)

    return {
        "action":        "created",
        "tournament_id": tournament.id,
        "name":          tournament.name,
        "pubg_id":       tournament.pubg_id,
        "status":        tournament.status,
    }

@router.post("/reset-database", summary="[TEMP] Zera todos os dados de torneios, players e matches")
async def reset_database(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    from sqlalchemy import text
    try:
        # Deleta na ordem correta para respeitar FKs
        db.execute(text("DELETE FROM match_player_stats"))
        db.execute(text("DELETE FROM matches"))
        db.execute(text("DELETE FROM lineup_scores"))
        db.execute(text("DELETE FROM lineups"))
        db.execute(text("DELETE FROM player_price_history"))
        db.execute(text("DELETE FROM players"))
        db.execute(text("DELETE FROM teams"))
        db.execute(text("DELETE FROM tournaments"))
        db.commit()
        return {"status": "ok", "message": "Todos os dados zerados. Users mantidos."}
    except Exception as e:
        db.rollback()
        return {"status": "error", "message": str(e)}
    
@router.post("/run-migrations", summary="[TEMP] Força alembic upgrade head")
async def run_migrations(
    admin: User = Depends(require_admin),
):
    import subprocess
    result = subprocess.run(
        ["alembic", "upgrade", "head"],
        capture_output=True,
        text=True,
        cwd="/app"
    )
    return {
        "returncode": result.returncode,
        "stdout": result.stdout,
        "stderr": result.stderr,
    }

@router.get("/db-version", summary="[TEMP] Verifica versão atual do Alembic no banco")
async def db_version(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    from sqlalchemy import text
    try:
        result = db.execute(text("SELECT version_num FROM alembic_version")).fetchall()
        return {"alembic_version": [r[0] for r in result]}
    except Exception as e:
        return {"error": str(e)}
    
@router.post("/backfill-player-stats/{tournament_id}", summary="[TEMP] Popula avg_kills_50 etc via SQL direto")
async def backfill_player_stats(
    tournament_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    from sqlalchemy import text
    sql = text("""
        UPDATE players p
        SET
            avg_kills_50     = sub.avg_kills,
            avg_damage_50    = sub.avg_damage,
            avg_placement_50 = sub.avg_placement,
            avg_kills_10     = sub.avg_kills,
            computed_price   = p.fantasy_cost,
            price_updated_at = now()
        FROM (
            SELECT
                mps.player_id,
                AVG(mps.kills)        AS avg_kills,
                AVG(mps.damage_dealt) AS avg_damage,
                AVG(mps.placement)    AS avg_placement
            FROM match_player_stats mps
            JOIN matches m ON mps.match_id = m.id
            WHERE m.tournament_id = :tournament_id
            GROUP BY mps.player_id
        ) sub
        WHERE p.id = sub.player_id
        AND p.tournament_id = :tournament_id
    """)
    result = db.execute(sql, {"tournament_id": tournament_id})
    db.commit()
    return {"status": "ok", "rows_updated": result.rowcount}

@router.post(
    "/seed-players-from-matches/{tournament_id}",
    summary="Cria players automaticamente a partir dos matches importados",
    description=(
        "Lê os matches já importados para o torneio, busca cada match na PUBG API, "
        "extrai pubg_id + name de cada participante e cria/atualiza Player rows. "
        "Usa pubg_id como chave de upsert — se o player já existe, só atualiza o nome. "
        "Após rodar, execute import-matches-from-pubg novamente para resolver os stats."
    ),
)
async def seed_players_from_matches(
    tournament_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    from app.models.match import Match, MatchPlayerStat
    from app.models import Player, Team
    from app.services.pubg_client import PubgClient, PubgApiError
    from app.core.config import settings

    # ── 1. Busca matches já importados para este torneio ──────────────────
    matches = db.query(Match).filter(Match.tournament_id == tournament_id).all()
    if not matches:
        raise HTTPException(
            status_code=404,
            detail=f"Nenhum match encontrado para tournament_id={tournament_id}. "
                   "Execute import-matches-from-pubg primeiro.",
        )

    # Busca o torneio para herdar região
    from app.models import Tournament
    tournament = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    client = PubgClient(api_key=settings.PUBG_API_KEY, shard=settings.PUBG_SHARD)

    created = 0
    updated = 0
    errors = []
    seen_pubg_ids = set()  # evita duplicatas no mesmo run

    for match in matches:
        try:
            raw = client.get_match(match.pubg_match_id)
        except PubgApiError as e:
            errors.append(f"Match {match.pubg_match_id}: {e}")
            continue

        for rps in raw.player_stats:
            if not rps.pubg_account_id or rps.pubg_account_id in seen_pubg_ids:
                continue
            seen_pubg_ids.add(rps.pubg_account_id)

            # ── Extrai tag do time do nome (ex: "FE_fana" → "FE") ────────
            name_parts = rps.pubg_name.split("_", 1)
            team_tag   = name_parts[0] if len(name_parts) > 1 else None
            clean_name = rps.pubg_name  # mantém nome completo com prefixo

            # ── Upsert do time ────────────────────────────────────────────
            team_id = None
            if team_tag:
                team = db.query(Team).filter(Team.name == team_tag).first()
                if not team:
                    team = Team(name=team_tag)
                    db.add(team)
                    db.flush()
                team_id = team.id

                        # ── Upsert do player por pubg_id ──────────────────────────────
            player = db.query(Player).filter(Player.pubg_id == rps.pubg_account_id).first()
            if player:
                if player.tournament_id is None:
                    player.tournament_id = tournament_id
                if team_id and player.team_id is None:
                    player.team_id = team_id
                if player.region is None and tournament.region:
                    player.region = tournament.region
                updated += 1
            else:
                player = Player(
                    name=clean_name,
                    pubg_id=rps.pubg_account_id,
                    tournament_id=tournament_id,
                    team_id=team_id,
                    fantasy_cost=10.0,
                    region=tournament.region,
                )
                db.add(player)
                created += 1

    db.commit()

    logger.info(
        "seed-players-from-matches: tournament=%s created=%s updated=%s errors=%s",
        tournament_id, created, updated, len(errors),
    )

    return {
        "tournament_id": tournament_id,
        "matches_processed": len(matches),
        "players_created": created,
        "players_updated": updated,
        "errors": errors,
        "next_step": (
            f"Execute POST /historical/import-matches-from-pubg/{tournament_id} "
            "novamente para resolver os stats com os players recém-criados."
        ),
    }

@router.post("/reprocess-match-stats/{tournament_id}", summary="Re-processa stats de matches já importados")
async def reprocess_match_stats(
    tournament_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    from app.models.match import Match, MatchPlayerStat
    from app.models import Player
    from app.services.pubg_client import PubgClient, PubgApiError
    from app.services.historical import _compute_fantasy_points, PlayerStatInput
    from app.core.config import settings

    matches = db.query(Match).filter(Match.tournament_id == tournament_id).all()
    if not matches:
        raise HTTPException(status_code=404, detail="Nenhum match encontrado")

    client = PubgClient(api_key=settings.PUBG_API_KEY, shard=settings.PUBG_SHARD)

    # Mapa pubg_id -> player_id
    players = db.query(Player).filter(Player.tournament_id == tournament_id).all()
    pubgid_map = {p.pubg_id: p.id for p in players if p.pubg_id}
    name_map   = {p.name.lower(): p.id for p in players if p.name}

    created = 0
    skipped = 0
    errors  = []

    for match in matches:
        try:
            raw = client.get_match(match.pubg_match_id)
        except PubgApiError as e:
            errors.append(f"{match.pubg_match_id}: {e}")
            continue

        for rps in raw.player_stats:
            player_id = pubgid_map.get(rps.pubg_account_id) or name_map.get(rps.pubg_name.lower())
            if not player_id:
                skipped += 1
                continue

            # Verifica se já existe
            existing = db.query(MatchPlayerStat).filter(
                MatchPlayerStat.match_id == match.id,
                MatchPlayerStat.player_id == player_id,
            ).first()
            if existing:
                skipped += 1
                continue

            stat_input = PlayerStatInput(
                player_id=player_id,
                kills=rps.kills,
                assists=rps.assists,
                damage_dealt=rps.damage_dealt,
                placement=rps.placement,
                survival_secs=rps.survival_secs,
                headshots=rps.headshots,
                knocks=rps.knocks,
            )
            db.add(MatchPlayerStat(
                match_id=match.id,
                player_id=player_id,
                kills=rps.kills,
                assists=rps.assists,
                damage_dealt=rps.damage_dealt,
                placement=rps.placement,
                survival_secs=rps.survival_secs,
                headshots=rps.headshots,
                knocks=rps.knocks,
                fantasy_points=_compute_fantasy_points(stat_input),
            ))
            created += 1

    db.commit()
    return {"tournament_id": tournament_id, "stats_created": created, "skipped": skipped, "errors": errors}

class TournamentUpdate(BaseModel):
    name:   Optional[str] = None
    region: Optional[str] = None
    status: Optional[str] = None

@router.patch("/tournaments/{tournament_id}", summary="Atualiza nome/região/status de um torneio")
async def update_tournament(
    tournament_id: int,
    body: TournamentUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    from app.models import Tournament
    t = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")
    if body.name:   t.name   = body.name
    if body.region: t.region = body.region
    if body.status: t.status = body.status
    db.commit()
    return {"id": t.id, "name": t.name, "region": t.region, "status": t.status}

@router.post("/recalculate-fantasy-points/{tournament_id}", summary="Recalcula fantasy_points com fórmula XAMA")
async def recalculate_fantasy_points(
    tournament_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    from app.models.match import Match, MatchPlayerStat
    from app.services.historical import _compute_fantasy_points, _compute_late_game_bonus, PlayerStatInput

    matches = db.query(Match).filter(Match.tournament_id == tournament_id).all()
    if not matches:
        raise HTTPException(status_code=404, detail="Nenhum match encontrado")

    updated = 0
    for match in matches:
        stats = db.query(MatchPlayerStat).filter(MatchPlayerStat.match_id == match.id).all()
        if not stats:
            continue

        # Constrói lista de PlayerStatInput para calcular bônus
        stat_inputs = [
            PlayerStatInput(
                player_id=s.player_id,
                kills=s.kills or 0,
                assists=s.assists or 0,
                damage_dealt=s.damage_dealt or 0.0,
                placement=s.placement or 28,
                survival_secs=s.survival_secs or 0,
                headshots=s.headshots or 0,
                knocks=s.knocks or 0,
            )
            for s in stats
        ]

        late_game_bonus = _compute_late_game_bonus(stat_inputs)

        for s, si in zip(stats, stat_inputs):
            base_pts, pen_count = _compute_fantasy_points(si)
            s.penalty_count = pen_count
            bonus_pts = late_game_bonus.get(s.player_id, 0)
            s.base_points     = base_pts
            s.late_game_bonus = bonus_pts
            s.fantasy_points  = base_pts + bonus_pts
            updated += 1

    db.commit()
    return {"tournament_id": tournament_id, "updated": updated}

@router.get("/check-matches/{tournament_id}", summary="[TEMP] Verifica campos dos matches")
async def check_matches(
    tournament_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    from app.models.match import Match
    matches = db.query(Match).filter(Match.tournament_id == tournament_id).all()
    return [{"id": m.id, "day": m.day, "match_number": m.match_number, "map": m.map_name, "played_at": str(m.played_at)} for m in matches]

@router.patch("/tournaments/{tournament_id}/teams/{team_name}/deactivate", summary="Desativa jogadores de um time eliminado")
async def deactivate_team(
    tournament_id: int,
    team_name: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    from app.models import Player, Team
    players = (
        db.query(Player)
        .join(Team, Player.team_id == Team.id)
        .filter(
            Player.tournament_id == tournament_id,
            Team.name == team_name,
        )
        .all()
    )
    if not players:
        raise HTTPException(status_code=404, detail=f"Nenhum jogador encontrado para o time {team_name} no torneio {tournament_id}")
    for p in players:
        p.is_active = False
    db.commit()
    return {"tournament_id": tournament_id, "team": team_name, "deactivated": len(players)}