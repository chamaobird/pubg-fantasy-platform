"""
import_pec_day.py
─────────────────
Importa partidas do PEC Spring Playoffs da PUBG API (tournament eu-pecs26)
para a stage/stage_day especificada.

Modo polling: verifica a cada N minutos e importa novos matches automaticamente.

Uso:
    # Importar matches disponíveis agora (Stage D1 = 21, StageDay = 22)
    python scripts/pubg/import_pec_day.py --stage-id 21 --stage-day-id 22

    # Polling: verifica a cada 5 minutos por novos matches
    python scripts/pubg/import_pec_day.py --stage-id 21 --stage-day-id 22 --watch 5

    # Dia 2 (após abrir Stage 22):
    python scripts/pubg/import_pec_day.py --stage-id 22 --stage-day-id 23 --watch 5

Tournament IDs por dia:
    Todos os dias usam: eu-pecs26
    (A API vai acumulando todos os matches do evento neste tournament ID)

Stages/StageDays no banco:
    Stage 21 (D1, locked)  -> StageDay 22 (17/04)
    Stage 22 (D2, preview) -> StageDay 23 (18/04)
    Stage 23 (D3, preview) -> StageDay 24 (19/04)
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from app.database import SessionLocal
from app.services.import_ import import_stage_matches

API_KEY = os.getenv("PUBG_API_KEY", "")
HEADERS = {"Authorization": f"Bearer {API_KEY}", "Accept": "application/vnd.api+json"}
BASE = "https://api.pubg.com"
TOURNAMENT_ID = "eu-pecs26"


def get_tournament_match_ids() -> list[str]:
    resp = requests.get(f"{BASE}/tournaments/{TOURNAMENT_ID}", headers=HEADERS, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    matches = data.get("data", {}).get("relationships", {}).get("matches", {}).get("data", [])
    return [m["id"] for m in matches]


def import_new_matches(
    stage_id: int,
    stage_day_id: int,
    all_known_ids: set[str],
    tournament_ids: list[str],
) -> tuple[int, set[str]]:
    """Importa IDs novos (não em all_known_ids). Retorna (qtd importados, novo set)."""
    new_ids = [mid for mid in tournament_ids if mid not in all_known_ids]
    if not new_ids:
        return 0, all_known_ids

    print(f"  [{now()}] {len(new_ids)} novo(s) match(es) para importar: {new_ids}")

    db = SessionLocal()
    try:
        result = import_stage_matches(
            db=db,
            stage_id=stage_id,
            pubg_match_ids=new_ids,
            stage_day_id=stage_day_id,
            force_reprocess=False,
        )
        db.commit()
        for m in result.get("matches", []):
            status = m.get("status")
            ok = m.get("players_ok", 0)
            skip = m.get("players_skipped", 0)
            pts = m.get("total_pts", 0)
            print(f"    {m['pubg_match_id'][:8]}...  {status}  ok={ok}  skip={skip}  pts={pts:.1f}")
    except Exception as e:
        db.rollback()
        print(f"  [ERROR] {e}")
        return 0, all_known_ids
    finally:
        db.close()

    return len(new_ids), all_known_ids | set(new_ids)


def now() -> str:
    return datetime.now(timezone.utc).strftime("%H:%M:%S UTC")


def load_known_ids_from_db(stage_id: int) -> set[str]:
    """Carrega do banco todos os pubg_match_ids já importados para a stage."""
    from sqlalchemy import text as sql_text
    db = SessionLocal()
    try:
        rows = db.execute(
            sql_text("""
                SELECT m.pubg_match_id
                FROM match m
                JOIN stage_day sd ON sd.id = m.stage_day_id
                WHERE sd.stage_id = :stage_id
            """),
            {"stage_id": stage_id},
        ).fetchall()
        return {r[0] for r in rows}
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="Import PEC Spring Playoffs matches")
    parser.add_argument("--stage-id",     type=int, required=True, help="Stage ID no banco (21/22/23)")
    parser.add_argument("--stage-day-id", type=int, required=True, help="StageDay ID no banco (22/23/24)")
    parser.add_argument("--watch",        type=int, default=0,     help="Polling: verificar a cada N minutos (0=off)")
    args = parser.parse_args()

    print(f"\nPEC Spring Playoffs Import")
    print(f"  Tournament: {TOURNAMENT_ID}")
    print(f"  Stage: {args.stage_id} | StageDay: {args.stage_day_id}")
    print(f"  Modo: {'polling a cada ' + str(args.watch) + 'min' if args.watch else 'one-shot'}\n")

    # Inicializa known_ids do banco (evita reimportar matches já existentes)
    known_ids: set[str] = load_known_ids_from_db(args.stage_id)
    if known_ids:
        print(f"[{now()}] {len(known_ids)} match(es) ja no banco para stage {args.stage_id} — serao ignorados")

    # Primeiro fetch
    tournament_ids = get_tournament_match_ids()
    print(f"[{now()}] {len(tournament_ids)} match(es) no tournament")

    imported, known_ids = import_new_matches(args.stage_id, args.stage_day_id, known_ids, tournament_ids)
    print(f"[{now()}] Importados: {imported} | Total conhecido: {len(known_ids)}")

    if not args.watch:
        return

    # Polling loop
    print(f"\nMonitorando... (Ctrl+C para parar)")
    while True:
        time.sleep(args.watch * 60)
        try:
            tournament_ids = get_tournament_match_ids()
            imported, known_ids = import_new_matches(args.stage_id, args.stage_day_id, known_ids, tournament_ids)
            if imported == 0:
                print(f"  [{now()}] Sem novos matches ({len(known_ids)} total, {len(tournament_ids)} no tournament)")
        except KeyboardInterrupt:
            print("\nParado pelo usuário.")
            break
        except Exception as e:
            print(f"  [{now()}] Erro no poll: {e}")


if __name__ == "__main__":
    main()
