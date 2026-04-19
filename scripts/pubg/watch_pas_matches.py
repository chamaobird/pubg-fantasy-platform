"""
watch_pas_matches.py
Poll do torneio am-pas126 e importa novos matches automaticamente.

Uso:
    python scripts/pubg/watch_pas_matches.py --stage-id 16 --stage-day-id 17 --watch 3
"""
import argparse, os, sys, time, requests
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from app.database import SessionLocal
from app.services.import_ import import_stage_matches

API_KEY     = os.getenv("PUBG_API_KEY") or os.getenv("PUBG_API_TOKEN") or os.getenv("PUBG_TOKEN")
HEADERS     = {"Authorization": f"Bearer {API_KEY}", "Accept": "application/vnd.api+json"}
BASE        = "https://api.pubg.com"
TOURNAMENT  = "am-pas126"


def now() -> str:
    return datetime.now(timezone.utc).strftime("%H:%M:%S UTC")


def get_tournament_ids() -> list[str]:
    r = requests.get(f"{BASE}/tournaments/{TOURNAMENT}", headers=HEADERS, timeout=15)
    r.raise_for_status()
    included = r.json().get("included", [])
    return [m["id"] for m in included]


def do_import(stage_id: int, stage_day_id: int, new_ids: list[str]) -> int:
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
        for m in result["matches"]:
            print(f"    {m['pubg_match_id'][:8]}... | {m['status']:12} | ok={m['players_ok']:2} skip={m['players_skipped']:2} pts={m['total_pts']:.1f}")
        if result["errors"]:
            for e in result["errors"]:
                print(f"    ERRO: {e['match_id']}: {e['error']}")
        return result["imported"]
    except Exception as ex:
        db.rollback()
        print(f"    [ERRO import] {ex}")
        return 0
    finally:
        db.close()


def load_imported_ids(stage_id: int) -> set[str]:
    """Carrega do banco TODOS os match IDs já importados (qualquer stage)."""
    from sqlalchemy import create_engine, text
    engine = create_engine(os.getenv("DATABASE_URL"))
    with engine.connect() as conn:
        rows = conn.execute(text("SELECT pubg_match_id FROM match")).fetchall()
    ids = {r[0] for r in rows}
    return ids


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--stage-id",     type=int, required=True)
    parser.add_argument("--stage-day-id", type=int, required=True)
    parser.add_argument("--watch",        type=int, default=5, help="Intervalo em minutos (default: 5)")
    args = parser.parse_args()

    print(f"\nPAS Watch | Tournament: {TOURNAMENT} | Stage: {args.stage_id} | StageDay: {args.stage_day_id}")
    print(f"Polling a cada {args.watch} minuto(s). Ctrl+C para parar.\n")

    known: set[str] = load_imported_ids(args.stage_id)
    print(f"[init] {len(known)} match(es) já importados no banco: {[i[:8] for i in known]}\n")

    while True:
        try:
            ids = get_tournament_ids()
            new_ids = [i for i in ids if i not in known]
            known.update(ids)

            if new_ids:
                print(f"[{now()}] {len(new_ids)} novo(s) match(es): {[i[:8] for i in new_ids]}")
                do_import(args.stage_id, args.stage_day_id, new_ids)
            else:
                print(f"[{now()}] Sem novos matches ({len(known)} conhecidos)")

        except KeyboardInterrupt:
            print("\nParado.")
            break
        except Exception as ex:
            print(f"[{now()}] Erro no poll: {ex}")

        time.sleep(args.watch * 60)


if __name__ == "__main__":
    main()
