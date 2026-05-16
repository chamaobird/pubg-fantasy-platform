#!/usr/bin/env python3
"""
scripts/seed_pgs_s2_faceoffs.py

1. Roda migration group_label (IF NOT EXISTS — idempotente)
2. Cria 12 faceoffs da PGS 2026 S2 em status draft:
   - 8 pares do Winners Stage  (seeds 1–16)
   - 4 pares da Survival Direta (seeds 9–16 regionais)

Uso:
    python scripts/seed_pgs_s2_faceoffs.py [--dry-run]
    python scripts/seed_pgs_s2_faceoffs.py --confirm

    # Produção com ID diferente:
    python scripts/seed_pgs_s2_faceoffs.py --confirm --championship-id 5
"""

import sys
import os
import argparse

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine
from app.models.faceoff import Faceoff

# ── Config ────────────────────────────────────────────────────────────────────

DEFAULT_CHAMPIONSHIP_ID = 5  # PGS 2026 S2 (confirmar em produção)

# ── Pares ─────────────────────────────────────────────────────────────────────

PAIRS = [
    # ── Winners Stage (seeds 1–16) ────────────────────────────────────────────
    dict(group_label="Winners Stage", seed_a=1,  team_a_name="Virtus.pro",        seed_b=2,  team_b_name="eArena"),
    dict(group_label="Winners Stage", seed_a=3,  team_a_name="T1",                seed_b=4,  team_b_name="17 Gaming"),
    dict(group_label="Winners Stage", seed_a=5,  team_a_name="Crazy Raccoon",     seed_b=6,  team_b_name="Natus Vincere"),
    dict(group_label="Winners Stage", seed_a=7,  team_a_name="JD Gaming",         seed_b=8,  team_b_name="Petrichor Road"),
    dict(group_label="Winners Stage", seed_a=9,  team_a_name="Made in Thailand",  seed_b=10, team_b_name="Anyone's Legend"),
    dict(group_label="Winners Stage", seed_a=11, team_a_name="SOOPers",           seed_b=12, team_b_name="Team Liquid"),
    dict(group_label="Winners Stage", seed_a=13, team_a_name="Team Vitality",     seed_b=14, team_b_name="Theerathon Five"),
    dict(group_label="Winners Stage", seed_a=15, team_a_name="Twisted Minds",     seed_b=16, team_b_name="Four Angry Men"),
    # ── Survival Direta (seeds 9–16 regionais) ────────────────────────────────
    dict(group_label="Survival Direta", seed_a=9,  team_a_name="Gen.G Esports",    seed_b=10, team_b_name="The Expendables"),
    dict(group_label="Survival Direta", seed_a=11, team_a_name="FURIA",             seed_b=12, team_b_name="Finhay Cerberus"),
    dict(group_label="Survival Direta", seed_a=13, team_a_name="Change the Game",   seed_b=14, team_b_name="Full Sense"),
    dict(group_label="Survival Direta", seed_a=15, team_a_name="Team Falcons",      seed_b=16, team_b_name="S2G Esports"),
]


# ── Migration ─────────────────────────────────────────────────────────────────

def run_migration():
    with engine.connect() as conn:
        conn.execute(text(
            "ALTER TABLE faceoff ADD COLUMN IF NOT EXISTS group_label VARCHAR(100) NULL;"
        ))
        conn.commit()
    print("[MIGRATION] group_label OK")


# ── Seed ──────────────────────────────────────────────────────────────────────

def seed(db: Session, championship_id: int, dry_run: bool):
    created = 0
    skipped = 0

    for p in PAIRS:
        existing = db.query(Faceoff).filter_by(
            championship_id=championship_id,
            team_a_name=p["team_a_name"],
            team_b_name=p["team_b_name"],
        ).first()

        if existing:
            print(f"[SKIP]   {p['group_label']:20s}  {p['team_a_name']} vs {p['team_b_name']}  (id={existing.id})")
            skipped += 1
            continue

        label = f"[{p['group_label']}]"
        print(f"[CREATE] {label:22s}  #{p['seed_a']} {p['team_a_name']} vs #{p['seed_b']} {p['team_b_name']}")
        if not dry_run:
            f = Faceoff(
                championship_id=championship_id,
                team_a_name=p["team_a_name"],
                team_b_name=p["team_b_name"],
                seed_a=p["seed_a"],
                seed_b=p["seed_b"],
                group_label=p["group_label"],
                status="draft",
            )
            db.add(f)
        created += 1

    print(f"\n  {created} criados, {skipped} pulados")

    if dry_run:
        db.rollback()
        print("[DRY-RUN] Nenhuma alteração salva. Use --confirm para aplicar.")
    else:
        db.commit()
        print("OK Seed concluído.")
        print("\nPróximo passo: Admin → Faceoffs → PGS S2 → avançar status draft → open")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Seed faceoffs PGS S2 + migration group_label")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--confirm", action="store_true")
    parser.add_argument("--championship-id", type=int, default=DEFAULT_CHAMPIONSHIP_ID,
                        help=f"ID do championship em produção (default: {DEFAULT_CHAMPIONSHIP_ID})")
    args = parser.parse_args()

    dry_run = not args.confirm

    # Migration sempre roda (idempotente)
    print(f"\n=== Migration ===")
    run_migration()

    print(f"\n=== Faceoffs (championship_id={args.championship_id}) ===")
    db = SessionLocal()
    try:
        seed(db, args.championship_id, dry_run)
    except Exception as e:
        db.rollback()
        print(f"\n[ERRO] {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
