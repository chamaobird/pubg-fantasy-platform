#!/usr/bin/env python3
"""
scripts/open_pgs_s2_faceoffs.py

Avança todos os faceoffs draft → open para a PGS S2 (championship_id=16).
Idempotente: só atualiza os que ainda estão em draft.

Uso:
    python scripts/open_pgs_s2_faceoffs.py [--dry-run]
    python scripts/open_pgs_s2_faceoffs.py --confirm

    python scripts/open_pgs_s2_faceoffs.py --confirm --championship-id 16
"""

import sys
import os
import argparse

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text
from app.database import SessionLocal

DEFAULT_CHAMPIONSHIP_ID = 16  # PGS S2 produção


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--confirm", action="store_true")
    parser.add_argument("--championship-id", type=int, default=DEFAULT_CHAMPIONSHIP_ID)
    args = parser.parse_args()

    dry_run = not args.confirm
    cid = args.championship_id

    db = SessionLocal()
    try:
        rows = db.execute(
            text("SELECT id, group_label, team_a_name, team_b_name, status FROM faceoff WHERE championship_id = :cid AND status = 'draft' ORDER BY id"),
            {"cid": cid},
        ).fetchall()

        if not rows:
            print(f"Nenhum faceoff em draft para championship_id={cid}.")
            return

        print(f"\n=== Faceoffs draft -> open (championship_id={cid}) ===\n")
        for r in rows:
            print(f"  [{r.id}] {r.group_label or 'sem grupo':20s}  {r.team_a_name} vs {r.team_b_name}")

        print(f"\n  Total: {len(rows)} faceoffs")

        if dry_run:
            print("\n[DRY-RUN] Nenhuma alteração salva. Use --confirm para aplicar.")
            return

        db.execute(
            text("UPDATE faceoff SET status = 'open' WHERE championship_id = :cid AND status = 'draft'"),
            {"cid": cid},
        )
        db.commit()
        print(f"\nOK {len(rows)} faceoffs abertos.")
    except Exception as e:
        db.rollback()
        print(f"\n[ERRO] {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
