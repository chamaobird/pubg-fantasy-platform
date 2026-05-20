#!/usr/bin/env python3
"""
scripts/import_remaining_match.py

Importa a partida restante do Group Stage (2026-05-20) e roda reprocess-all.

Match: ccc31698-3d4f-4668-a9b3-30bee84e4682
Stage: 42 (Group Stage, championship 16)

Uso:
    python scripts/import_remaining_match.py             # dry-run (mostra o que faria)
    python scripts/import_remaining_match.py --confirm   # aplica
"""

import sys
import os
import argparse

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import app.models.team_member  # noqa: F401
from app.models.team import Team  # noqa: F401
from app.database import SessionLocal
from app.services.import_ import import_stage_matches, reprocess_match
from app.models.match import Match
from app.models.stage_day import StageDay

STAGE_ID  = 42
MATCH_ID  = "ccc31698-3d4f-4668-a9b3-30bee84e4682"


def run(db, confirm: bool):
    # Check if already imported
    existing = (
        db.query(Match)
        .join(StageDay, Match.stage_day_id == StageDay.id)
        .filter(
            Match.pubg_match_id == MATCH_ID,
            StageDay.stage_id == STAGE_ID,
        )
        .first()
    )

    if existing:
        print(f"[SKIP] Match {MATCH_ID[:12]}... ja importado (match_id={existing.id})")
        if confirm:
            print(f"\n[REPROCESS] Reprocessando match_id={existing.id}...")
            result = reprocess_match(db, existing.id)
            print(f"  status={result.status}  players_ok={result.players_ok}  skipped={result.players_skipped}")
            if result.unresolved_aliases:
                print(f"  unresolved: {result.unresolved_aliases}")
            db.commit()
        return

    print(f"[IMPORT] match={MATCH_ID}")
    print(f"         stage={STAGE_ID}")

    if not confirm:
        print("\n[DRY-RUN] Use --confirm para importar.")
        return

    result = import_stage_matches(
        db=db,
        stage_id=STAGE_ID,
        pubg_match_ids=[MATCH_ID],
    )

    print(f"\n[RESULT]")
    print(f"  imported={result['imported']}  reprocessed={result['reprocessed']}  skipped={result['skipped']}")
    if result["errors"]:
        for e in result["errors"]:
            print(f"  ERROR: {e['match_id'][:12]}... -> {e['error']}")
    if result["unresolved_players"]:
        print(f"  unresolved: {result['unresolved_players']}")

    for m in result["matches"]:
        print(f"  match {m['pubg_match_id'][:12]}...  status={m['status']}  pts={m['total_pts']}  ok={m['players_ok']}  skip={m['players_skipped']}")


def main():
    parser = argparse.ArgumentParser(description="Import remaining GS match + reprocess")
    parser.add_argument("--confirm", action="store_true")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        run(db, confirm=args.confirm)
    except Exception as e:
        db.rollback()
        print(f"\n[ERRO] {e}")
        import traceback; traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    main()
