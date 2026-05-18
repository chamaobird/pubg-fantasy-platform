"""
Assign pubg_tournament_id to existing stages that were used for match imports
but never had this field set. Silences the seatlon monitor false-positives.

Run:
    python scripts/assign_tournament_ids.py
    python scripts/assign_tournament_ids.py --dry-run
"""
import os
import sys
import argparse

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import text
from app.database import SessionLocal

# tournament_id -> list of stage IDs that used it
ASSIGNMENTS = {
    "am-pas126":  [15, 16, 17],        # PAS Playoffs 1
    "am-pas1p2":  [30, 31, 32],        # PAS Playoffs 2
    "eu-pecsp2":  [33, 34, 35],        # PEC Playoffs 2
    "eu-pecsf2":  [36, 37, 38],        # PEC Finals 2
    "am-pas1f2":  [39, 40, 41],        # PAS Finals 2
}


def run(dry_run: bool) -> None:
    db = SessionLocal()
    try:
        for tournament_id, stage_ids in ASSIGNMENTS.items():
            for stage_id in stage_ids:
                row = db.execute(
                    text("SELECT id, name, pubg_tournament_id FROM stage WHERE id = :sid"),
                    {"sid": stage_id},
                ).fetchone()

                if not row:
                    print(f"  [SKIP] stage {stage_id} not found")
                    continue

                current = row.pubg_tournament_id
                if current == tournament_id:
                    print(f"  [OK]   stage {stage_id} ({row.name!r}) already = {tournament_id}")
                    continue
                if current and current != tournament_id:
                    print(f"  [WARN] stage {stage_id} ({row.name!r}) has {current!r}, would overwrite with {tournament_id!r}")

                if dry_run:
                    print(f"  [DRY]  stage {stage_id} ({row.name!r}): None -> {tournament_id}")
                else:
                    db.execute(
                        text("UPDATE stage SET pubg_tournament_id = :tid WHERE id = :sid"),
                        {"tid": tournament_id, "sid": stage_id},
                    )
                    print(f"  [SET]  stage {stage_id} ({row.name!r}): {current!r} -> {tournament_id}")

        if not dry_run:
            db.commit()
            print("\nDone. Committed.")
        else:
            print("\nDry run — no changes written.")
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    run(dry_run=args.dry_run)
