# app/migrations.py
"""
Sistema de migration automática para o Warzone Fantasy.

Estratégia em duas camadas:
  1. Base.metadata.create_all()  → cria tabelas que NÃO existem ainda
  2. _run_column_migrations()    → adiciona colunas novas em tabelas já existentes
                                   usando ALTER TABLE ... ADD COLUMN IF NOT EXISTS
                                   (idempotente: seguro rodar múltiplas vezes)

Por que não usar Alembic?
  - Alembic requer um diretório de versões e um comando CLI separado.
  - Neste setup (Render sem Shell gratuito), precisamos que tudo rode
    automaticamente no startup sem intervenção manual.
  - Para projetos maiores, migrar para Alembic é recomendado.

Como adicionar novas migrations:
  1. Altere o model em app/models.py
  2. Adicione o ALTER TABLE correspondente em COLUMN_MIGRATIONS abaixo
  3. Faça deploy — rodará automaticamente no próximo startup
"""

import logging
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import engine, Base

logger = logging.getLogger(__name__)


# ------------------------------------------------------------------
# COLUMN MIGRATIONS
# Cada item é um dict com:
#   - description : texto legível para o log
#   - sql         : comando SQL idempotente (IF NOT EXISTS garante isso)
#
# IMPORTANTE: nunca remova migrations antigas — elas são idempotentes
# e protegem deploys em ambientes que ainda não as receberam.
# ------------------------------------------------------------------

COLUMN_MIGRATIONS = [
    # ── users ──────────────────────────────────────────────────────
    {
        "description": "users: add is_admin boolean column",
        "sql": "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE NOT NULL",
    },

    # ── players ────────────────────────────────────────────────────
    {
        "description": "players: add pubg_id varchar column",
        "sql": "ALTER TABLE players ADD COLUMN IF NOT EXISTS pubg_id VARCHAR",
    },
    {
        "description": "players: add unique index on pubg_id",
        "sql": """
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_indexes
                    WHERE tablename = 'players' AND indexname = 'ix_players_pubg_id'
                ) THEN
                    CREATE UNIQUE INDEX ix_players_pubg_id ON players(pubg_id)
                    WHERE pubg_id IS NOT NULL;
                END IF;
            END $$
        """,
    },
    {
        "description": "players: add region column",
        "sql": "ALTER TABLE players ADD COLUMN IF NOT EXISTS region VARCHAR",
    },
    {
        "description": "players: add avg_kills column",
        "sql": "ALTER TABLE players ADD COLUMN IF NOT EXISTS avg_kills FLOAT DEFAULT 0.0",
    },
    {
        "description": "players: add avg_damage column",
        "sql": "ALTER TABLE players ADD COLUMN IF NOT EXISTS avg_damage FLOAT DEFAULT 0.0",
    },
    {
        "description": "players: add avg_placement column",
        "sql": "ALTER TABLE players ADD COLUMN IF NOT EXISTS avg_placement FLOAT DEFAULT 0.0",
    },
    {
        "description": "players: add matches_played column",
        "sql": "ALTER TABLE players ADD COLUMN IF NOT EXISTS matches_played INTEGER DEFAULT 0",
    },
    {
        "description": "players: add raw_stats JSON column",
        "sql": "ALTER TABLE players ADD COLUMN IF NOT EXISTS raw_stats JSON",
    },
    {
        "description": "players: add last_synced_at column",
        "sql": "ALTER TABLE players ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE",
    },

    # ── tournaments ────────────────────────────────────────────────
    {
        "description": "tournaments: add pubg_id column",
        "sql": "ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS pubg_id VARCHAR",
    },
    {
        "description": "tournaments: add unique index on pubg_id",
        "sql": """
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_indexes
                    WHERE tablename = 'tournaments' AND indexname = 'ix_tournaments_pubg_id'
                ) THEN
                    CREATE UNIQUE INDEX ix_tournaments_pubg_id ON tournaments(pubg_id)
                    WHERE pubg_id IS NOT NULL;
                END IF;
            END $$
        """,
    },
    {
        "description": "tournaments: add region column",
        "sql": "ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS region VARCHAR",
    },
]


# ------------------------------------------------------------------
# RUNNER PRINCIPAL
# ------------------------------------------------------------------

def run_migrations() -> None:
    """
    Ponto de entrada chamado no startup do FastAPI.

    Etapa 1 — create_all:
        Cria todas as tabelas definidas nos models que ainda não existem
        no banco. Tabelas já existentes são ignoradas (idempotente).

    Etapa 2 — column migrations:
        Percorre COLUMN_MIGRATIONS e executa cada ALTER TABLE.
        Cada SQL usa IF NOT EXISTS, tornando a operação segura para
        ser repetida a cada restart da aplicação.
    """
    logger.info("=" * 55)
    logger.info("  Warzone Fantasy — Auto Migration iniciando")
    logger.info("=" * 55)

    # Etapa 1: criar tabelas novas
    try:
        logger.info("[Migration] Etapa 1/2: create_all (tabelas novas)...")
        Base.metadata.create_all(bind=engine)
        logger.info("[Migration] create_all concluído.")
    except Exception as e:
        logger.error(f"[Migration] ERRO no create_all: {e}")
        raise RuntimeError(f"Falha crítica no create_all: {e}") from e

    # Etapa 2: adicionar colunas em tabelas existentes
    logger.info(
        f"[Migration] Etapa 2/2: {len(COLUMN_MIGRATIONS)} column migrations..."
    )

    success = 0
    skipped = 0
    errors = 0

    with engine.connect() as conn:
        for migration in COLUMN_MIGRATIONS:
            desc = migration["description"]
            sql = migration["sql"].strip()
            try:
                conn.execute(text(sql))
                conn.commit()
                logger.info(f"[Migration] ✓ {desc}")
                success += 1
            except Exception as e:
                error_msg = str(e).lower()
                # Erros esperados de "já existe" — não são falhas reais
                if any(phrase in error_msg for phrase in [
                    "already exists",
                    "duplicate column",
                    "já existe",
                ]):
                    logger.debug(f"[Migration] ~ {desc} (já existe, ignorado)")
                    skipped += 1
                    conn.rollback()
                else:
                    logger.error(f"[Migration] ✗ {desc} → {e}")
                    errors += 1
                    conn.rollback()
                    # Não levanta exceção: um erro de coluna não deve
                    # impedir o servidor de subir. Será logado para revisão.

    logger.info("=" * 55)
    logger.info(
        f"  Migration concluída: "
        f"{success} aplicadas, {skipped} já existiam, {errors} erros"
    )
    if errors:
        logger.warning(
            f"  ATENÇÃO: {errors} migration(s) falharam. "
            "Verifique os logs acima."
        )
    logger.info("=" * 55)
