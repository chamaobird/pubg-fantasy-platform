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

from app.database import get_db
from app.services.auth import get_current_user
from app.models import Player, Tournament, User
from app.services.pubg_api import PUBGApiClient, calculate_fantasy_cost
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Admin"])


# ------------------------------------------------------------------
# DEPENDENCY: verifica admin
# ------------------------------------------------------------------

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """
    Dependency que garante que o usuário autenticado tem is_admin=True.
    Levanta 403 caso contrário.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: administrator privileges required.",
        )
    return current_user


# ------------------------------------------------------------------
# POST /admin/sync-tournaments
# ------------------------------------------------------------------

@router.post(
    "/sync-tournaments",
    summary="Sincroniza torneios da PUBG API",
    description=(
        "Busca torneios ativos do shard pc-tournament da PUBG API e "
        "salva/atualiza na tabela tournaments. Requer is_admin=True."
    ),
)
async def sync_tournaments(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if not settings.PUBG_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="PUBG_API_KEY não configurada. Verifique as variáveis de ambiente.",
        )

    try:
        async with PUBGApiClient() as client:
            tournaments_data = await client.list_tournaments()
    except httpx.HTTPStatusError as e:
        logger.error(f"[sync-tournaments] PUBG API error: {e.response.status_code} - {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                f"PUBG API indisponível (HTTP {e.response.status_code}). "
                "Tente novamente em alguns minutos ou use o seed_data.py para dados de teste."
            ),
        )
    except httpx.RequestError as e:
        logger.error(f"[sync-tournaments] Connection error: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Não foi possível conectar à PUBG API. Verifique a conectividade de rede.",
        )

    if not tournaments_data:
        return {
            "message": "Nenhum torneio retornado pela PUBG API.",
            "synced": 0,
            "tip": "Execute scripts/seed_data.py para popular com dados de teste.",
        }

    created = 0
    updated = 0

    for t_data in tournaments_data:
        existing = (
            db.query(Tournament)
            .filter(Tournament.pubg_id == t_data["pubg_id"])
            .first()
        )

        if existing:
            existing.name = t_data["name"]
            existing.region = t_data["region"]
            existing.status = t_data["status"]
            if t_data["start_date"]:
                existing.start_date = t_data["start_date"]
            updated += 1
        else:
            new_tournament = Tournament(
                name=t_data["name"],
                pubg_id=t_data["pubg_id"],
                region=t_data["region"],
                start_date=t_data["start_date"],
                status=t_data["status"],
            )
            db.add(new_tournament)
            created += 1

    db.commit()
    logger.info(f"[sync-tournaments] Created: {created}, Updated: {updated}")

    return {
        "message": "Sincronização de torneios concluída com sucesso.",
        "created": created,
        "updated": updated,
        "total_synced": created + updated,
    }


# ------------------------------------------------------------------
# POST /admin/sync-players
# ------------------------------------------------------------------

@router.post(
    "/sync-players",
    summary="Sincroniza jogadores da PUBG API",
    description=(
        "Busca jogadores de torneios regionais PUBG (pc-tournament), "
        "calcula fantasy_cost e salva/atualiza na tabela players. "
        "Requer is_admin=True.\n\n"
        "**Fórmula fantasy_cost:**\n"
        "```\n"
        "placement_score = max(0, (28 - avg_placement) * 0.5)\n"
        "fantasy_cost    = (avg_kills * 2) + (avg_damage / 100) + placement_score\n"
        "```"
    ),
)
async def sync_players(
    tournament_pubg_id: str | None = Query(
        None,
        description="ID do torneio PUBG. Se omitido, usa o primeiro torneio ativo no banco."
    ),
    max_matches: int = Query(
        5,
        ge=1, le=20,
        description="Máximo de matches a processar (cada match = 1 req PUBG API + sleep 6s)."
    ),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if not settings.PUBG_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="PUBG_API_KEY não configurada. Verifique as variáveis de ambiente.",
        )

    target_pubg_id = tournament_pubg_id
    if not target_pubg_id:
        active_tournament = (
            db.query(Tournament)
            .filter(Tournament.pubg_id.isnot(None))
            .filter(Tournament.status == "active")
            .first()
        )
        if not active_tournament:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=(
                    "Nenhum torneio ativo com pubg_id encontrado no banco. "
                    "Execute /admin/sync-tournaments primeiro ou informe tournament_pubg_id."
                ),
            )
        target_pubg_id = active_tournament.pubg_id

    try:
        async with PUBGApiClient() as client:
            players_data = await client.extract_players_from_tournament(
                target_pubg_id, max_matches=max_matches
            )
    except httpx.HTTPStatusError as e:
        status_code = e.response.status_code
        if status_code == 404:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    f"Torneio '{target_pubg_id}' não encontrado na PUBG API. "
                    "Verifique o ID ou use /admin/sync-tournaments para listar torneios válidos."
                ),
            )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"PUBG API retornou erro HTTP {status_code}. Tente novamente em breve.",
        )
    except httpx.RequestError as e:
        logger.error(f"[sync-players] Connection error: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Não foi possível conectar à PUBG API.",
        )

    if not players_data:
        return {
            "message": f"Nenhum jogador encontrado no torneio '{target_pubg_id}'.",
            "synced": 0,
            "tip": "Execute scripts/seed_data.py para popular com dados de teste.",
        }

    created = 0
    updated = 0
    now = datetime.utcnow()

    for p_data in players_data:
        existing = (
            db.query(Player)
            .filter(Player.pubg_id == p_data["pubg_id"])
            .first()
        )

        if existing:
            existing.name = p_data["name"]
            existing.region = p_data["region"]
            existing.avg_kills = p_data["avg_kills"]
            existing.avg_damage = p_data["avg_damage"]
            existing.avg_placement = p_data["avg_placement"]
            existing.matches_played = p_data["matches_played"]
            existing.fantasy_cost = p_data["fantasy_cost"]
            existing.raw_stats = p_data["raw_stats"]
            existing.last_synced_at = now
            updated += 1
        else:
            new_player = Player(
                name=p_data["name"],
                pubg_id=p_data["pubg_id"],
                region=p_data["region"],
                avg_kills=p_data["avg_kills"],
                avg_damage=p_data["avg_damage"],
                avg_placement=p_data["avg_placement"],
                matches_played=p_data["matches_played"],
                fantasy_cost=p_data["fantasy_cost"],
                raw_stats=p_data["raw_stats"],
                last_synced_at=now,
            )
            db.add(new_player)
            created += 1

    db.commit()
    logger.info(
        f"[sync-players] Tournament: {target_pubg_id} | "
        f"Created: {created}, Updated: {updated}"
    )

    return {
        "message": "Sincronização de jogadores concluída com sucesso.",
        "tournament_pubg_id": target_pubg_id,
        "created": created,
        "updated": updated,
        "total_synced": created + updated,
        "fantasy_cost_formula": {
            "description": (
                "placement_score = max(0, (28 - avg_placement) * 0.5) | "
                "fantasy_cost = (avg_kills * 2) + (avg_damage / 100) + placement_score"
            ),
            "minimum_cost": 5.0,
        },
    }


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
        # ---------------------------------------------------------------
# POST /admin/seed-database
# ---------------------------------------------------------------

@router.post(
    "/seed-database",
    summary="Popula o banco com dados de exemplo",
    description="Insere torneios e jogadores de exemplo para testes. Seguro rodar multiplas vezes (idempotente).",
)
async def seed_database(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    from app.models import Team

    results = {"tournaments": 0, "teams": 0, "players": 0}

    # --- Torneios ---
    tournaments_data = [
        {"name": "PUBG Global Series 2026 - Americas", "pubg_id": "pgs2026-americas", "region": "Americas", "status": "active", "max_teams": 16},
        {"name": "PUBG Continental Series 7 - Asia", "pubg_id": "pcs7-asia", "region": "Asia", "status": "upcoming", "max_teams": 20},
        {"name": "PUBG Continental Series 7 - Europe", "pubg_id": "pcs7-europe", "region": "Europe", "status": "active", "max_teams": 16},
        {"name": "PUBG Brasil Series - Eliminatorias 2026", "pubg_id": "pbs-elim-2026", "region": "Brazil", "status": "upcoming", "max_teams": 32},
    ]

    created_tournaments = {}
    for t_data in tournaments_data:
        existing = db.query(Tournament).filter(Tournament.pubg_id == t_data["pubg_id"]).first()
        if not existing:
            tournament = Tournament(
                name=t_data["name"],
                pubg_id=t_data["pubg_id"],
                region=t_data["region"],
                status=t_data["status"],
                max_teams=t_data["max_teams"],
                start_date=datetime.utcnow(),
            )
            db.add(tournament)
            db.flush()
            created_tournaments[t_data["pubg_id"]] = tournament.id
            results["tournaments"] += 1
        else:
            created_tournaments[t_data["pubg_id"]] = existing.id

    # --- Times ---
    teams_data = [
        {"name": "Team Liquid", "tournament_pubg_id": "pgs2026-americas"},
        {"name": "NaVi", "tournament_pubg_id": "pgs2026-americas"},
        {"name": "Twisted Minds", "tournament_pubg_id": "pcs7-asia"},
        {"name": "Danawa Esports", "tournament_pubg_id": "pcs7-asia"},
        {"name": "NAVI Europe", "tournament_pubg_id": "pcs7-europe"},
        {"name": "FaZe Clan", "tournament_pubg_id": "pcs7-europe"},
        {"name": "INTZ", "tournament_pubg_id": "pbs-elim-2026"},
        {"name": "Havan Liberty", "tournament_pubg_id": "pbs-elim-2026"},
    ]

    created_teams = {}
    for tm_data in teams_data:
        t_id = created_tournaments.get(tm_data["tournament_pubg_id"])
        if t_id:
            existing = db.query(Team).filter(Team.name == tm_data["name"], Team.tournament_id == t_id).first()
            if not existing:
                team = Team(name=tm_data["name"], tournament_id=t_id)
                db.add(team)
                db.flush()
                created_teams[tm_data["name"]] = team.id
                results["teams"] += 1
            else:
                created_teams[tm_data["name"]] = existing.id

    # --- Jogadores ---
    players_data = [
        {"name": "Pio", "pubg_id": "pio-tl", "team": "Team Liquid", "region": "Americas", "avg_kills": 4.2, "avg_damage": 520.0, "avg_placement": 3.5},
        {"name": "Riotz", "pubg_id": "riotz-tl", "team": "Team Liquid", "region": "Americas", "avg_kills": 3.8, "avg_damage": 480.0, "avg_placement": 4.1},
        {"name": "Sezzi", "pubg_id": "sezzi-tl", "team": "Team Liquid", "region": "Americas", "avg_kills": 3.1, "avg_damage": 390.0, "avg_placement": 4.1},
        {"name": "Kickstart", "pubg_id": "kickstart-tl", "team": "Team Liquid", "region": "Americas", "avg_kills": 2.9, "avg_damage": 360.0, "avg_placement": 4.1},
        {"name": "Reduxx", "pubg_id": "reduxx-navi", "team": "NaVi", "region": "Americas", "avg_kills": 5.1, "avg_damage": 610.0, "avg_placement": 2.8},
        {"name": "Tgltn", "pubg_id": "tgltn-navi", "team": "NaVi", "region": "Americas", "avg_kills": 4.7, "avg_damage": 570.0, "avg_placement": 2.8},
        {"name": "Ibiza", "pubg_id": "ibiza-navi", "team": "NaVi", "region": "Americas", "avg_kills": 3.5, "avg_damage": 430.0, "avg_placement": 2.8},
        {"name": "Ubah", "pubg_id": "ubah-navi", "team": "NaVi", "region": "Americas", "avg_kills": 3.2, "avg_damage": 400.0, "avg_placement": 2.8},
        {"name": "Kaymind", "pubg_id": "kaymind-tw", "team": "Twisted Minds", "region": "Asia", "avg_kills": 4.5, "avg_damage": 540.0, "avg_placement": 3.2},
        {"name": "Esportsman", "pubg_id": "esportsman-tw", "team": "Twisted Minds", "region": "Asia", "avg_kills": 3.9, "avg_damage": 490.0, "avg_placement": 3.2},
        {"name": "Buncee", "pubg_id": "buncee-dw", "team": "Danawa Esports", "region": "Asia", "avg_kills": 4.8, "avg_damage": 580.0, "avg_placement": 2.5},
        {"name": "GodV", "pubg_id": "godv-dw", "team": "Danawa Esports", "region": "Asia", "avg_kills": 4.3, "avg_damage": 510.0, "avg_placement": 2.5},
        {"name": "Cpt", "pubg_id": "cpt-faze", "team": "FaZe Clan", "region": "Europe", "avg_kills": 5.3, "avg_damage": 640.0, "avg_placement": 2.1},
        {"name": "Avarice", "pubg_id": "avarice-faze", "team": "FaZe Clan", "region": "Europe", "avg_kills": 4.6, "avg_damage": 555.0, "avg_placement": 2.1},
        {"name": "BreaK", "pubg_id": "break-faze", "team": "FaZe Clan", "region": "Europe", "avg_kills": 3.8, "avg_damage": 460.0, "avg_placement": 2.1},
        {"name": "Jeemzz", "pubg_id": "jeemzz-navi", "team": "NAVI Europe", "region": "Europe", "avg_kills": 4.1, "avg_damage": 500.0, "avg_placement": 3.0},
        {"name": "Aqua", "pubg_id": "aqua-navi", "team": "NAVI Europe", "region": "Europe", "avg_kills": 3.7, "avg_damage": 450.0, "avg_placement": 3.0},
        {"name": "Shinbm", "pubg_id": "shinbm-intz", "team": "INTZ", "region": "Brazil", "avg_kills": 3.5, "avg_damage": 420.0, "avg_placement": 5.0},
        {"name": "Kustom", "pubg_id": "kustom-intz", "team": "INTZ", "region": "Brazil", "avg_kills": 3.0, "avg_damage": 380.0, "avg_placement": 5.0},
        {"name": "Fantoche", "pubg_id": "fantoche-havan", "team": "Havan Liberty", "region": "Brazil", "avg_kills": 4.0, "avg_damage": 490.0, "avg_placement": 4.2},
    ]

    for p_data in players_data:
        existing = db.query(Player).filter(Player.pubg_id == p_data["pubg_id"]).first()
        if not existing:
            team_id = created_teams.get(p_data["team"])
            fantasy_cost = calculate_fantasy_cost(
                avg_kills=p_data["avg_kills"],
                avg_damage=p_data["avg_damage"],
                avg_placement=p_data["avg_placement"],
            )
            player = Player(
                name=p_data["name"],
                pubg_id=p_data["pubg_id"],
                region=p_data["region"],
                team_id=team_id,
                avg_kills=p_data["avg_kills"],
                avg_damage=p_data["avg_damage"],
                avg_placement=p_data["avg_placement"],
                fantasy_cost=fantasy_cost,
                position="fragger",
            )
            db.add(player)
            results["players"] += 1

    db.commit()
    return {
        "message": "Seed concluido com sucesso!",
        "created": results,
        "note": "Execute novamente para verificar idempotencia (deve retornar zeros).",
    }
    }
