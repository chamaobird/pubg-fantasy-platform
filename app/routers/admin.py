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
from app.dependencies import get_current_user, require_admin
from app.models import Player, Tournament, User
from app.services.pubg_api import PUBGApiClient, calculate_fantasy_cost
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Admin"])


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

    tournament = db.query(Tournament).filter(Tournament.pubg_id == target_pubg_id).first()
    tournament_id = tournament.id if tournament else None

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
            existing.tournament_id = tournament_id
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
                tournament_id=tournament_id,
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


@router.post("/seed-data")
async def seed_database(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Popula banco com dados de teste (3 torneios, 20 jogadores, 1 admin)"""
    from scripts.seed_data import seed_tournaments, seed_players, seed_admin_user

    seed_tournaments(db)
    seed_players(db)
    seed_admin_user(db)

    return {"message": "Seed executado com sucesso!"}


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


@router.post("/fix-database")
async def fix_database_schema(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    from sqlalchemy import text
    db.execute(text("ALTER TABLE players ADD COLUMN IF NOT EXISTS fantasy_cost FLOAT DEFAULT 10.0"))
    db.commit()
    return {"message": "Campo fantasy_cost adicionado!"}


@router.post("/fix-database-schema")
async def fix_database_schema_no_auth(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """TEMP: Adiciona colunas faltantes na tabela players"""
    from sqlalchemy import text

    colunas_adicionadas = []

    try:
        # Lista de todas as colunas que podem estar faltando
        alteracoes = [
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS fantasy_cost FLOAT DEFAULT 10.0",
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS position VARCHAR",
            """
            DO $$
            BEGIN
              IF NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'players'
                  AND column_name = 'nationality'
              ) THEN
                ALTER TABLE players ADD COLUMN nationality VARCHAR(50);
              END IF;
            END $$;
            """,

            """
            DO $$
            BEGIN
              IF NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'players'
                  AND column_name = 'tournament_id'
              ) THEN
                ALTER TABLE players ADD COLUMN tournament_id INTEGER;
              END IF;
            END $$;
            """,

            """
            DO $$
            BEGIN
              IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'fk_players_tournament_id'
              ) THEN
                ALTER TABLE players
                  ADD CONSTRAINT fk_players_tournament_id
                  FOREIGN KEY (tournament_id)
                  REFERENCES tournaments(id)
                  ON DELETE SET NULL;
              END IF;
            END $$;
            """,
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS avg_kills FLOAT DEFAULT 0.0",
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS avg_damage FLOAT DEFAULT 0.0",
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS avg_placement FLOAT DEFAULT 0.0",
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS matches_played INTEGER DEFAULT 0",
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS raw_stats JSON",
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE",
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()",

            """
            DO $$
            BEGIN
              IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'players'
                  AND column_name = 'price'
              ) THEN
                ALTER TABLE players
                  ALTER COLUMN price SET DEFAULT 10.0;

                UPDATE players
                  SET price = COALESCE(price, fantasy_cost, 10.0)
                WHERE price IS NULL;
              END IF;
            END $$;
            """,

            """
            CREATE TABLE IF NOT EXISTS lineups (
              id SERIAL PRIMARY KEY,
              user_id INTEGER NOT NULL,
              tournament_id INTEGER NOT NULL,
              name VARCHAR(100) NOT NULL,
              captain_player_id INTEGER NOT NULL,
              created_at TIMESTAMPTZ DEFAULT NOW(),
              CONSTRAINT fk_lineups_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
              CONSTRAINT fk_lineups_tournament FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
              CONSTRAINT fk_lineups_captain FOREIGN KEY (captain_player_id) REFERENCES players(id)
            );
            """,

            """
            CREATE TABLE IF NOT EXISTS lineup_players (
              lineup_id INTEGER NOT NULL,
              player_id INTEGER NOT NULL,
              slot INTEGER NOT NULL,
              added_at TIMESTAMPTZ DEFAULT NOW(),
              PRIMARY KEY (lineup_id, player_id),
              CONSTRAINT uq_lineup_slot UNIQUE (lineup_id, slot),
              CONSTRAINT fk_lineup_players_lineup FOREIGN KEY (lineup_id) REFERENCES lineups(id) ON DELETE CASCADE,
              CONSTRAINT fk_lineup_players_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
            );
            """,

            """
            DO $$
            BEGIN
              IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'players'
                  AND column_name = 'is_active'
              ) THEN
                ALTER TABLE players
                  ALTER COLUMN is_active SET DEFAULT true;

                UPDATE players
                  SET is_active = COALESCE(is_active, true)
                WHERE is_active IS NULL;
              END IF;
            END $$;
            """,

            "ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS pubg_id VARCHAR",
            "ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS region VARCHAR",
            "ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS type VARCHAR DEFAULT 'official'",
            "ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'upcoming'",
            "ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS scoring_rules_json TEXT",
            "ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS start_date TIMESTAMP WITH TIME ZONE",
            "ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS end_date TIMESTAMP WITH TIME ZONE",
            "ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS max_teams INTEGER DEFAULT 16",
            "ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS budget_limit NUMERIC(8,2) DEFAULT 100.0",
            "ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS created_by INTEGER",
            "ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()",

            """
            DO $$
            BEGIN
              IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'tournaments'
                  AND column_name = 'type'
                  AND udt_name = 'tournament_type'
              ) THEN
                ALTER TABLE tournaments
                  ALTER COLUMN type TYPE VARCHAR
                  USING type::text;
              END IF;
            END $$;
            """,

            """
            DO $$
            BEGIN
              IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'tournaments'
                  AND column_name = 'status'
                  AND udt_name = 'tournament_status'
              ) THEN
                ALTER TABLE tournaments
                  ALTER COLUMN status TYPE VARCHAR
                  USING status::text;
              END IF;
            END $$;
            """,
        ]

        for sql in alteracoes:
            db.execute(text(sql))
            if "ADD COLUMN IF NOT EXISTS" in sql:
                coluna = sql.split("ADD COLUMN IF NOT EXISTS ")[1].split(" ")[0]
                colunas_adicionadas.append(coluna)
            elif "ALTER COLUMN price SET DEFAULT" in sql:
                colunas_adicionadas.append("players.price_default_and_backfill")
            elif "ADD COLUMN nationality" in sql:
                colunas_adicionadas.append("players.nationality")
            elif "ADD COLUMN tournament_id" in sql:
                colunas_adicionadas.append("players.tournament_id")
            elif "fk_players_tournament_id" in sql:
                colunas_adicionadas.append("players.tournament_id_fk")
            elif "CREATE TABLE IF NOT EXISTS lineups" in sql:
                colunas_adicionadas.append("lineups_table_created")
            elif "CREATE TABLE IF NOT EXISTS lineup_players" in sql:
                colunas_adicionadas.append("lineup_players_table_created")
            elif "ALTER COLUMN is_active SET DEFAULT" in sql:
                colunas_adicionadas.append("players.is_active_default_and_backfill")
            elif "ALTER COLUMN type TYPE VARCHAR" in sql:
                colunas_adicionadas.append("tournaments.type_cast_to_varchar")
            elif "ALTER COLUMN status TYPE VARCHAR" in sql:
                colunas_adicionadas.append("tournaments.status_cast_to_varchar")

        db.commit()

        return {
            "message": "Todas as colunas adicionadas com sucesso!",
            "colunas_adicionadas": colunas_adicionadas,
        }
    except Exception as e:
        db.rollback()
        return {"status": "error", "message": str(e)}
