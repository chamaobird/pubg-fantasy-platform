#!/usr/bin/env python3
"""
scripts/seed_pgs_s2_survival_teams.py

Cria os 8 times que entram diretamente no Survival Stage do PGS 2026 S2
(seeds #9–#16 vindos de classificatórias regionais — não participam do Winners Stage).

Também cria os registros de Roster para o stage de Survival.

Uso:
    python scripts/seed_pgs_s2_survival_teams.py [--dry-run]
    python scripts/seed_pgs_s2_survival_teams.py --confirm

IDs produção:
    Survival Stage = stage_id 43
"""

import sys
import os
import argparse

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import app.models.team_member  # noqa: F401
from app.models.team import Team  # noqa: F401
from app.database import SessionLocal
from app.models.team import Team
from app.models.roster import Roster

TARGET_STAGE_ID = 43  # Survival Stage — produção

# 8 times que entram diretamente na Survival (seeds #9–#16)
TEAMS = [
    dict(name="Gen.G Esports",    tag="GEN",  region="AS", seed=9),
    dict(name="The Expendables",  tag="TE",   region="EU", seed=10),
    dict(name="FURIA",            tag="FUR",  region="SA", seed=11),
    dict(name="Finhay Cerberus",  tag="FCE",  region="AS", seed=12),
    dict(name="Change the Game",  tag="CTG",  region="AS", seed=13),
    dict(name="Full Sense",       tag="FS",   region="AS", seed=14),
    dict(name="Team Falcons",     tag="FLC",  region="EU", seed=15),
    dict(name="S2G Esports",      tag="S2G",  region="EU", seed=16),
]


def run(db, dry_run: bool):
    created_teams = 0
    skipped_teams = 0
    created_roster = 0
    skipped_roster = 0

    for t in TEAMS:
        seed = t.pop("seed")

        # ── Team record ────────────────────────────────────────────────────────
        existing = db.query(Team).filter_by(name=t["name"]).first()
        if existing:
            print(f"[SKIP]   Team: {existing.tag:5s}  {existing.name}  (id={existing.id})")
            team = existing
            skipped_teams += 1
        else:
            team = Team(**t)
            print(f"[CREATE] Team: {t['tag']:5s}  {t['name']}  region={t['region']}")
            if not dry_run:
                db.add(team)
                db.flush()
                print(f"         -> id={team.id}")
            created_teams += 1

        t["seed"] = seed  # restaura para não afetar iteração

        # ── Roster entry ───────────────────────────────────────────────────────
        # Survival teams não têm jogadores ainda — apenas registra o time.
        # Jogadores serão importados via suggest-from-history quando souber quem veio.
        if not dry_run and team.id:
            existing_r = db.query(Roster).filter_by(
                stage_id=TARGET_STAGE_ID, team_name=team.name
            ).first()
            if existing_r:
                print(f"[SKIP]   Roster já existe: {team.name}")
                skipped_roster += 1
            else:
                # Sem person_id — placeholder de time (sem jogador)
                # Roster entries de jogadores virão do seed_pgs_s2_roster depois
                print(f"  (Sem jogadores — adicionar via suggest-from-history)")
                skipped_roster += 1
        else:
            print(f"  [DRY]  Roster stage={TARGET_STAGE_ID}  {t['name']}")

    print(f"\n  Times: {created_teams} criados, {skipped_teams} pulados")
    print(f"  Roster: {created_roster} criados, {skipped_roster} pulados")

    if dry_run:
        db.rollback()
        print("\n[DRY-RUN] Nenhuma alteração salva. Use --confirm para aplicar.")
    else:
        db.commit()
        print("\nOK Seed concluído.")
        print("\nPróximo passo: seed jogadores de cada time no stage 43")
        print("  ou: POST /roster/suggest-from-history para cada time")


def main():
    parser = argparse.ArgumentParser(description="Seed PGS S2 Survival Stage teams (8 times diretos)")
    parser.add_argument("--dry-run", action="store_true", help="Simula sem salvar (default)")
    parser.add_argument("--confirm", action="store_true", help="Aplica as alterações")
    args = parser.parse_args()

    dry_run = not args.confirm

    db = SessionLocal()
    try:
        run(db, dry_run=dry_run)
    except Exception as e:
        db.rollback()
        print(f"\n[ERRO] {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
