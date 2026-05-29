#!/usr/bin/env python3
"""
scripts/seed_pgs_c2s2_final_roster.py

Popula o roster da Final Stage do PGS 2026 Circuit 2 - Series 2 (stage 49).

16 times:
  - Top 8 da Winners Stage C2S2 (stage 47)
  - Top 8 da Survival Stage C2S2 (stage 48)

Standings calculados via fórmula oficial PUBG (survival pts + kills, tiebreaker: surv pts).

Uso:
    python scripts/seed_pgs_c2s2_final_roster.py --stage-id 49 --suggest
    python scripts/seed_pgs_c2s2_final_roster.py --stage-id 49 --apply
    python scripts/seed_pgs_c2s2_final_roster.py --stage-id 49 --apply --confirm

ATENÇÃO: Verificar se houve substituições na Survival Stage (stage 48) que precisem
ser replicadas aqui. Use o admin panel para checar StageSubstitutions da stage 48
e ajustar is_available manualmente se necessário.
"""

import sys
import os
import argparse

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.roster import Roster
from app.models.person import Person


# ─── Roster da Final Stage ────────────────────────────────────────────────────
#
# Formato: (person_id, display_name, is_available)
# is_available=False → reserva
#
# ── Top 8 Winners Stage (stage 47) — IDs via seed_pgs_c2s2_roster.py ─────────
# ── Top 8 Survival Stage (stage 48) — IDs via seed_pgs_c2s2_survival_roster.py
#
FINAL_ROSTER: list[tuple[str, list[tuple[int, str, bool]]]] = [

    # ── Top 8 Winners Stage ───────────────────────────────────────────────────

    ("Anyone's Legend", [   # Winners #1 — 44pts (surv=15, kills=29)
        (14,  "Delwyn",   True),
        (15,  "Destroyy", True),
        (16,  "Himass",   True),
        (17,  "Sololzy",  True),
    ]),
    ("SOOPers", [           # Winners #2 — 38pts (surv=11, kills=27)
        (26,  "DIEL",   True),
        (27,  "Gyumin", True),
        (28,  "Heaven", True),
        (29,  "Rex",    True),
    ]),
    ("FURIA", [             # Winners #3 — 36pts (surv=13, kills=23)
        (47,  "bielmtcalmo", True),
        (48,  "Dr4FTk1NG",   True),
        (49,  "possa",       True),
        (109, "FUR_zKraken", True),
    ]),
    ("Team Liquid", [       # Winners #4 — 36pts (surv=13, kills=23) — tiebreaker: kills
        (87,  "aLOW",       True),
        (88,  "CowBoi",     True),
        (89,  "luke12",     True),
        (90,  "PurdyKurty", True),
    ]),
    ("Petrichor Road", [    # Winners #5 — 31pts (surv=15, kills=16)
        (68,  "Cui71",   True),
        (69,  "i26v6",   True),
        (70,  "MMing",   True),
        (350, "Aixleft", True),
        (67,  "04NB",    False),  # reserva
    ]),
    ("Virtus.pro", [        # Winners #6 — 31pts (surv=13, kills=18)
        (99,  "Beami",   True),
        (100, "curexi",  True),
        (101, "Lukarux", True),
        (102, "NIXZYEE", True),
    ]),
    ("T1", [                # Winners #7 — 31pts (surv=9, kills=22)
        (75,  "EEND",    True),
        (76,  "Heather", True),
        (77,  "Rain1ng", True),
        (78,  "Type",    True),
    ]),
    ("Twisted Minds", [     # Winners #8 — 29pts (surv=10, kills=19)
        (91,  "BatulinS",   True),
        (92,  "Lu",         True),
        (94,  "xmpl",       True),
        (229, "Perfect1ks", True),
    ]),

    # ── Top 8 Survival Stage ─────────────────────────────────────────────────

    ("Four Angry Men", [    # Survival #1 — 54pts (surv=25, kills=29)
        (10,  "HSmm",         True),
        (11,  "Shen",         True),
        (12,  "SpaceMan1010", True),
        (13,  "WINDah",       True),
    ]),
    ("FULL SENSE", [        # Survival #2 — 45pts (surv=19, kills=26)
        (43,  "Belmoth",  True),
        (44,  "Flash",    True),
        (45,  "Thanad0l", True),
        (46,  "TiGGER",   True),
    ]),
    ("Natus Vincere", [     # Survival #3 — 44pts (surv=20, kills=24) — tiebreaker: surv
        (63,  "boost1k-",  True),
        (64,  "Feyerist",  True),
        (65,  "Hakatory",  True),
        (66,  "spyrro",    True),
    ]),
    ("JD Gaming", [         # Survival #4 — 44pts (surv=16, kills=28)
        (55,  "Cold119", True),
        (56,  "Dec12th", True),
        (57,  "nanss",   True),
        (58,  "SuZe",    True),
    ]),
    ("eArena", [            # Survival #5 — 37pts (surv=11, kills=26)
        (30,  "Lericz",     True),
        (31,  "Nourinz",    True),
        (32,  "OHPONDZ",    True),
        (33,  "Pathompong", True),
    ]),
    ("17 Gaming", [         # Survival #6 — 34pts (surv=15, kills=19)
        (349, "Akuma",    True),
        (6,   "Lilghost", True),
        (8,   "WenBo",    True),
        (9,   "xwudd",    True),
    ]),
    ("Made in Thailand", [  # Survival #7 — 33pts (surv=13, kills=20)
        (59,  "Baren",  True),
        (60,  "Jacob",  True),
        (61,  "KISS",   True),
        (62,  "Scappy", True),
    ]),
    ("S2G Esports", [       # Survival #8 — 30pts (surv=13, kills=17)
        (71,  "BARON",  True),
        (344, "LAHZA",  True),
        (73,  "Quetpa", True),
        (74,  "Shilla", True),
    ]),
]


# ─── Helpers ──────────────────────────────────────────────────────────────────

def print_roster(stage_id: int):
    print(f"\n=== ROSTER Final Stage (stage_id={stage_id}) ===\n")
    total = 0
    for team_name, players in FINAL_ROSTER:
        status = "OK " if len(players) >= 4 else "!! "
        print(f"  {status} {team_name}  ({len(players)} jogadores)")
        for (pid, name, avail) in sorted(players, key=lambda x: (not x[2], x[1])):
            reserve_tag = " [RESERVA]" if not avail else ""
            print(f"       id={pid:4d}  {name:<20s}{reserve_tag}")
        total += len(players)

    print(f"\n  Total jogadores: {total}")
    print(f"  Times OK (>=4): {sum(1 for _, p in FINAL_ROSTER if len(p) >= 4)}")
    print(f"  Times vazios  : {sum(1 for _, p in FINAL_ROSTER if len(p) == 0)}")
    print()


def apply_roster(db: Session, stage_id: int, confirm: bool):
    already_in: set[int] = {
        r.person_id
        for r in db.query(Roster.person_id).filter(Roster.stage_id == stage_id).all()
    }

    to_create: list[dict] = []
    for team_name, players in FINAL_ROSTER:
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
            print(f"    person_id={entry['person_id']:4d}  team={entry['team_name']:<25s}  avail={entry['is_available']}{flag}")
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
    print(f"  Proximos passos:")
    print(f"    1. Verificar subs da Survival (stage 48) e ajustar is_available se necessario")
    print(f"    2. POST /admin/pricing/stages/{stage_id}/recalculate-pricing")
    print(f"    3. Abrir lineup da Final Stage no admin (usa 'Abrir Proxima Stage')")


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Seed PGS C2S2 Final Stage roster")
    parser.add_argument("--stage-id", type=int, required=True,
                        help="ID da Final Stage no banco (producao: 49)")
    parser.add_argument("--suggest", action="store_true",
                        help="Mostra o roster planejado (nao modifica o banco)")
    parser.add_argument("--apply",   action="store_true",
                        help="Cria entradas de roster (dry-run por padrao)")
    parser.add_argument("--confirm", action="store_true",
                        help="Confirma criacao real (use com --apply)")
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
