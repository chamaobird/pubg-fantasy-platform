#!/usr/bin/env python3
"""
scripts/seed_pgs_s2_teams.py

Cria os 16 times do Winners Stage do PGS 2026 Series 2.

Uso:
    python scripts/seed_pgs_s2_teams.py [--dry-run]
"""

import sys
import os
import argparse

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import app.models.team_member  # resolve TeamMember relationship
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.team import Team


# ─── Dados ────────────────────────────────────────────────────────────────────

# 16 times do Winners Stage (Top 16 PGS S1)
# region: AS=Asia, EU=Europe/EMEA, SA=South America
TEAMS = [
    dict(name="Virtus.pro",       tag="VP",    region="EU"),
    dict(name="eArena",           tag="eA",    region="AS"),
    dict(name="T1",               tag="T1",    region="AS"),
    dict(name="17 Gaming",        tag="17G",   region="AS"),
    dict(name="Crazy Raccoon",    tag="CR",    region="AS"),
    dict(name="Natus Vincere",    tag="NaVi",  region="EU"),
    dict(name="JD Gaming",        tag="JDG",   region="AS"),
    dict(name="Petrichor Road",   tag="PR",    region="AS"),
    dict(name="Made in Thailand", tag="MIT",   region="AS"),
    dict(name="Anyone's Legend",  tag="AL",    region="AS"),
    dict(name="SOOPers",          tag="SOUP",  region="AS"),
    dict(name="Team Liquid",      tag="TL",    region="EU"),
    dict(name="Team Vitality",    tag="VIT",   region="EU"),
    dict(name="Theerathon Five",  tag="TF",    region="AS"),
    dict(name="Twisted Minds",    tag="TM",    region="EU"),
    dict(name="Four Angry Men",   tag="4AM",   region="AS"),
]


# ─── Seed ─────────────────────────────────────────────────────────────────────

def seed(db: Session, dry_run: bool):
    created = 0
    skipped = 0

    for t in TEAMS:
        existing = db.query(Team).filter_by(name=t["name"]).first()
        if existing:
            print(f"[SKIP]   {existing.tag:6s}  {existing.name}  (id={existing.id})")
            skipped += 1
            continue

        team = Team(**t)
        print(f"[CREATE] {t['tag']:6s}  {t['name']}  region={t['region']}")
        if not dry_run:
            db.add(team)
            db.flush()
            print(f"         -> id={team.id}")
        created += 1

    print(f"\n  {created} criados, {skipped} pulados")

    if not dry_run:
        db.commit()
        print("OK Seed concluido com sucesso.")
    else:
        db.rollback()
        print("[DRY-RUN] Nenhuma alteracao salva.")


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Seed PGS S2 Winners Stage teams")
    parser.add_argument("--dry-run", action="store_true", help="Simula sem salvar")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        seed(db, dry_run=args.dry_run)
    except Exception as e:
        db.rollback()
        print(f"\n[ERRO] {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
