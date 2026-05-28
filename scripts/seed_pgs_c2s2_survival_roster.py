#!/usr/bin/env python3
"""
scripts/seed_pgs_c2s2_survival_roster.py

Popula o roster da Survival Stage do PGS 2026 Circuit 2 - Series 2 (stage 48).

16 times:
  - Bottom 8 do Winners Stage C2S2 (posições 9–16)
  - 8 não-finalistas do C2S1 (nunca chegaram às stages 45–46)

Uso:
    python scripts/seed_pgs_c2s2_survival_roster.py --stage-id 48 --suggest
    python scripts/seed_pgs_c2s2_survival_roster.py --stage-id 48 --apply
    python scripts/seed_pgs_c2s2_survival_roster.py --stage-id 48 --apply --confirm
"""

import sys
import os
import argparse

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.roster import Roster
from app.models.person import Person


# ─── Roster da Survival Stage ─────────────────────────────────────────────────
#
# Formato: (person_id, display_name, is_available)
# is_available=False → reserva
#
# Bottom 8 Winners C2S2: copiado do roster da stage 47.
# Non-finalists C2S1: extraídos do roster da stage 44 (Survival C2S1).
#
SURVIVAL_ROSTER: list[tuple[str, list[tuple[int, str, bool]]]] = [

    # ── Bottom 8 Winners Stage C2S2 ───────────────────────────────────────────

    ("CERBERUS Esports", [
        (35,  "StannnL",  True),
        (36,  "Tanbinh",  True),
        (37,  "YUDIRT",   True),
        (38,  "Zest",     True),
        (34,  "Br1annn",  False),  # reserva
    ]),
    ("Four Angry Men", [
        (10,  "HSmm",         True),
        (11,  "Shen",         True),
        (12,  "SpaceMan1010", True),
        (13,  "WINDah",       True),
    ]),
    ("Natus Vincere", [
        (63,  "boost1k-",  True),
        (64,  "Feyerist",  True),
        (65,  "Hakatory",  True),
        (66,  "spyrro",    True),
    ]),
    ("GAM x TE", [
        # The Expendables rebranded. JUND não jogou o Winners (sub: Hoangf).
        (83,  "Clories",   True),
        (84,  "DuCkHjeUz", True),
        (86,  "TanVuu",    True),
        (348, "JUND",      True),
        (85,  "Hoangf",    False),  # reserva
    ]),
    ("Made in Thailand", [
        (59,  "Baren",  True),
        (60,  "Jacob",  True),
        (61,  "KISS",   True),
        (62,  "Scappy", True),
    ]),
    ("Team Falcons", [
        (40,  "Kickstart", True),
        (41,  "Shrimzy",   True),
        (42,  "TGLTN",     True),
        (202, "Gustav",    True),
    ]),
    ("Gen.G", [
        (51,  "BeaN",   True),
        (52,  "diyy",   True),
        (53,  "Salute", True),
        (54,  "seoul",  True),
    ]),
    ("Crazy Raccoon", [
        (18,  "Glaz",    True),
        (19,  "Gyuyeon", True),
        (20,  "Inonix",  True),
        (21,  "Pio",     True),
    ]),

    # ── Non-finalists C2S1 (nunca chegaram às stages 45–46) ───────────────────
    # Fonte: roster da Survival C2S1 (stage 44) — jogadores ativos.

    ("17 Gaming", [
        (349, "Akuma",    True),
        (6,   "Lilghost", True),
        (8,   "WenBo",    True),
        (9,   "xwudd",    True),
    ]),
    ("Change The Game", [
        (22,  "MMAO",       True),
        (24,  "SuiX1ngKzK", True),
        (25,  "XcDH",       True),
        (351, "Xcircle",    True),
    ]),
    ("eArena", [
        (30,  "Lericz",      True),
        (31,  "Nourinz",     True),
        (32,  "OHPONDZ",     True),
        (33,  "Pathompong",  True),
    ]),
    ("FULL SENSE", [
        (43,  "Belmoth",  True),
        (44,  "Flash",    True),
        (45,  "Thanad0l", True),
        (46,  "TiGGER",   True),
    ]),
    ("JD Gaming", [
        (55,  "Cold119", True),
        (56,  "Dec12th", True),
        (57,  "nanss",   True),
        (58,  "SuZe",    True),
    ]),
    ("S2G Esports", [
        (71,  "BARON",  True),
        (344, "LAHZA",  True),
        (73,  "Quetpa", True),
        (74,  "Shilla", True),
    ]),
    ("Team Vitality", [
        (95,  "Gedrox",     True),
        (96,  "hallomybad", True),
        (97,  "Lev4nte",    True),
        (98,  "QWZYYY",     True),
    ]),
    ("Theerathon Five", [
        (347, "DimasTy",  True),
        (80,  "Flukky",   True),
        (346, "Khawkong", True),
        (81,  "RangerX",  True),
    ]),
]


# ─── Helpers ──────────────────────────────────────────────────────────────────

def print_roster(stage_id: int):
    print(f"\n=== ROSTER Survival Stage (stage_id={stage_id}) ===\n")
    total = 0
    for team_name, players in SURVIVAL_ROSTER:
        status = "OK " if len(players) >= 4 else "!! "
        print(f"  {status} {team_name}  ({len(players)} jogadores)")
        for (pid, name, avail) in sorted(players, key=lambda x: (not x[2], x[1])):
            reserve_tag = " [RESERVA]" if not avail else ""
            print(f"       id={pid:4d}  {name:<20s}{reserve_tag}")
        total += len(players)

    print(f"\n  Total jogadores: {total}")
    print(f"  Times OK (>=4): {sum(1 for _, p in SURVIVAL_ROSTER if len(p) >= 4)}")
    print(f"  Times vazios  : {sum(1 for _, p in SURVIVAL_ROSTER if len(p) == 0)}")
    print()


def apply_roster(db: Session, stage_id: int, confirm: bool):
    already_in: set[int] = {
        r.person_id
        for r in db.query(Roster.person_id).filter(Roster.stage_id == stage_id).all()
    }

    to_create: list[dict] = []
    for team_name, players in SURVIVAL_ROSTER:
        for (pid, name, avail) in players:
            if pid not in already_in:
                to_create.append({
                    "stage_id":     stage_id,
                    "person_id":    pid,
                    "team_name":    team_name,
                    "is_available": avail,
                })

    print(f"\n  Criando {len(to_create)} entradas de Roster para stage {stage_id}...\n")

    if not confirm:
        print("  [DRY-RUN] Use --apply --confirm para aplicar.")
        for entry in to_create:
            flag = " [reserva]" if not entry["is_available"] else ""
            print(f"    person_id={entry['person_id']:4d}  team={entry['team_name']:<20s}  avail={entry['is_available']}{flag}")
        return

    created = 0
    skipped = 0
    for entry in to_create:
        existing = db.query(Roster).filter_by(
            stage_id=entry["stage_id"],
            person_id=entry["person_id"],
        ).first()
        if existing:
            skipped += 1
            continue
        db.add(Roster(**entry))
        created += 1

    db.commit()
    print(f"  OK: {created} criados, {skipped} pulados.")
    print()
    print(f"  Próximos passos:")
    print(f"    - POST /admin/stages/{stage_id}/calculate-pricing")
    print(f"    - Abrir lineup da Survival Stage no admin")


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Seed PGS C2S2 Survival Stage roster")
    parser.add_argument("--stage-id", type=int, required=True)
    parser.add_argument("--suggest", action="store_true")
    parser.add_argument("--apply",   action="store_true")
    parser.add_argument("--confirm", action="store_true")
    args = parser.parse_args()

    if not args.suggest and not args.apply:
        print("Use --suggest para ver o roster planejado.")
        print("Use --apply [--confirm] para criar as entradas.")
        return

    db = SessionLocal()
    try:
        if args.suggest:
            print_roster(args.stage_id)

        if args.apply:
            if not args.suggest:
                print_roster(args.stage_id)
            apply_roster(db, args.stage_id, confirm=args.confirm)

    except Exception as e:
        db.rollback()
        print(f"\n[ERRO] {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
