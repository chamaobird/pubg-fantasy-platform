"""
Importa matches de todos os championships históricos.

Para cada stage com pubg_tournament_id:
  1. Busca match IDs via PUBG API (/tournaments/{id})
  2. Importa cada match (MatchStat + PersonStageStat)
  3. Marca stage como finished

Pré-requisito: seed_historical_championships.py já rodado.

Uso:
    python scripts/import_historical_matches.py --dry-run
    python scripts/import_historical_matches.py
    python scripts/import_historical_matches.py --championship-short-name PCL-26S
"""
import argparse
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import text
from app.database import SessionLocal
from app.services.match_discovery import discover_matches_tournament
from app.services.import_ import import_stage_matches

# IDs de championships históricos (short_names) — filtra para não tocar em stages ativos
HISTORICAL_SHORT_NAMES = {
    "PCL-26S",
    "PWS-26S1",
    "PTS-26S1",
    "PVS-26S1",
    "PMS-26P1",
}

# Rate limit: PUBG API tournament endpoint permite ~10 req/min
SLEEP_BETWEEN_TOURNAMENTS = 7  # segundos


def log(msg: str) -> None:
    print(msg)


def get_historical_stages(db, champ_filter: str | None) -> list[dict]:
    """Retorna todas as stages históricas com pubg_tournament_id definido."""
    query = text("""
        SELECT s.id, s.name, s.short_name, s.pubg_tournament_id,
               c.short_name AS champ_short_name, c.name AS champ_name,
               sd.id AS stage_day_id
        FROM stage s
        JOIN championship c ON c.id = s.championship_id
        LEFT JOIN stage_day sd ON sd.stage_id = s.id AND sd.day_number = 1
        WHERE s.pubg_tournament_id IS NOT NULL
          AND c.short_name = ANY(:names)
          AND (:filter IS NULL OR c.short_name = :filter)
        ORDER BY s.id
    """)
    rows = db.execute(query, {
        "names":  list(HISTORICAL_SHORT_NAMES),
        "filter": champ_filter,
    }).fetchall()
    return [dict(r._mapping) for r in rows]


def get_already_imported(db, stage_day_id: int) -> set[str]:
    rows = db.execute(
        text("SELECT pubg_match_id FROM match WHERE stage_day_id = :sdid"),
        {"sdid": stage_day_id},
    ).fetchall()
    return {r[0] for r in rows}


def run(dry_run: bool, champ_filter: str | None) -> None:
    db = SessionLocal()
    try:
        stages = get_historical_stages(db, champ_filter)

        if not stages:
            log("Nenhuma stage histórica encontrada. Rode seed_historical_championships.py primeiro.")
            return

        total_imported = 0
        total_skipped  = 0

        for stage in stages:
            tid  = stage["pubg_tournament_id"]
            sid  = stage["id"]
            sdid = stage["stage_day_id"]

            log(f"\n── {stage['champ_name']} / {stage['name']} ──")
            log(f"   tournament_id={tid}  stage_id={sid}  stage_day_id={sdid}")

            if sdid is None:
                log("   [SKIP] stage_day não encontrado — rode o seed primeiro.")
                total_skipped += 1
                continue

            # 1. Busca match IDs da PUBG API
            log(f"   Buscando match IDs via PUBG API...")
            match_ids = discover_matches_tournament(tid)
            log(f"   → {len(match_ids)} matches encontrados no torneio")

            if not match_ids:
                log("   [SKIP] Nenhum match retornado pela API.")
                total_skipped += 1
                continue

            # 2. Filtra já importados
            already = get_already_imported(db, sdid)
            pending = [m for m in match_ids if m not in already]
            log(f"   → {len(already)} já importados, {len(pending)} pendentes")

            if not pending:
                log("   [OK] Tudo já importado.")
                total_skipped += 1
                continue

            if dry_run:
                log(f"   [DRY] Importaria {len(pending)} matches")
                for mid in pending[:3]:
                    log(f"         {mid}")
                if len(pending) > 3:
                    log(f"         ... e mais {len(pending) - 3}")
                continue

            # 3. Importa
            log(f"   Importando {len(pending)} matches...")
            result = import_stage_matches(
                db=db,
                stage_id=sid,
                stage_day_id=sdid,
                pubg_match_ids=pending,
            )
            imported = result.get("imported", 0)
            errors   = result.get("errors", 0)
            log(f"   → Importados: {imported} | Erros: {errors}")
            total_imported += imported

            # Rate limit entre torneios
            time.sleep(SLEEP_BETWEEN_TOURNAMENTS)

        log(f"\n{'─'*50}")
        if dry_run:
            log("Dry run concluído — nenhuma mudança gravada.")
        else:
            log(f"Importação concluída: {total_imported} matches importados, {total_skipped} stages puladas.")
            log("\nPróximo passo: verificar PersonStageStat e rodar pricing para stages impactadas.")

    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Simula sem importar")
    parser.add_argument(
        "--championship-short-name",
        default=None,
        help="Filtra por championship (ex: PCL-26S). Se omitido, importa todos.",
    )
    args = parser.parse_args()
    run(dry_run=args.dry_run, champ_filter=args.championship_short_name)
