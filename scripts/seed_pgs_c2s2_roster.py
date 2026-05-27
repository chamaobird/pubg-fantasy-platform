#!/usr/bin/env python3
"""
scripts/seed_pgs_c2s2_roster.py

Popula o roster da Winners Stage do PGS 2026 Circuit 2 - Series 2.

Dados extraídos do histórico de produção (stages 43–46 do C2S1).
Times sem histórico: GAM x TE (novo — adicionar manualmente via admin).
Reservas conhecidas: Petrichor Road (04NB — id=67).

Uso:
    python scripts/seed_pgs_c2s2_roster.py --stage-id <ID> --suggest
    python scripts/seed_pgs_c2s2_roster.py --stage-id <ID> --apply
    python scripts/seed_pgs_c2s2_roster.py --stage-id <ID> --apply --confirm
"""

import sys
import os
import argparse

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.roster import Roster
from app.models.person import Person


# ─── Roster da Winners Stage ──────────────────────────────────────────────────
#
# Formato: (person_id, display_name, is_available)
# is_available=False  → reserva (não aparece como selecionável até ser ativado)
#
# Fonte: stages 43–46 do PGS 2026 Circuit 2 - Series 1 (produção).
# Refs: stage 43 = Winners C2S1, stage 46 = Final Day 2 C2S1.
#
# GAM x TE: time novo sem histórico no DB. Adicionar via admin após o seed.
#
WINNERS_ROSTER: list[tuple[str, list[tuple[int, str, bool]]]] = [
    ("Anyone's Legend", [
        (14,  "Delwyn",   True),
        (15,  "Destroyy", True),
        (16,  "Himass",   True),
        (17,  "Sololzy",  True),
    ]),
    ("CERBERUS Esports", [
        (35,  "StannnL",  True),
        (36,  "Tanbinh",  True),
        (37,  "YUDIRT",   True),
        (38,  "Zest",     True),
        (34,  "Br1annn",  False),  # reserva (estava no stage 42; confirmado pelo admin)
    ]),
    ("Crazy Raccoon", [
        (18,  "Glaz",    True),
        (19,  "Gyuyeon", True),
        (20,  "Inonix",  True),
        (21,  "Pio",     True),
    ]),
    ("Four Angry Men", [
        (10,  "HSmm",         True),
        (11,  "Shen",         True),
        (12,  "SpaceMan1010", True),
        (13,  "WINDah",       True),
    ]),
    ("FURIA", [
        (47,  "bielmtcalmo", True),
        (48,  "Dr4FTk1NG",   True),
        (49,  "possa",        True),
        (109, "FUR_zKraken",  True),
    ]),
    ("Gen.G", [
        # Era "Gen.G Esports" em C2S1 — renomeado para "Gen.G" em C2S2
        (51,  "BeaN",   True),
        (52,  "diyy",   True),
        (53,  "Salute", True),
        (54,  "seoul",  True),
    ]),
    ("Made in Thailand", [
        (59,  "Baren",  True),
        (60,  "Jacob",  True),
        (61,  "KISS",   True),
        (62,  "Scappy", True),
    ]),
    ("Natus Vincere", [
        (63,  "boost1k-",  True),
        (64,  "Feyerist",  True),
        (65,  "Hakatory",  True),
        (66,  "spyrro",    True),
    ]),
    ("Petrichor Road", [
        (68,  "Cui71",   True),
        (69,  "i26v6",   True),
        (70,  "MMing",   True),
        (350, "Aixleft", True),
        (67,  "04NB",    False),  # reserva confirmada (stage 42); ativo nas Finals C2S1
    ]),
    ("SOOPers", [
        (26,  "DIEL",   True),
        (27,  "Gyumin", True),
        (28,  "Heaven", True),
        (29,  "Rex",    True),
    ]),
    ("T1", [
        (75,  "EEND",    True),
        (76,  "Heather", True),
        (77,  "Rain1ng", True),
        (78,  "Type",    True),
    ]),
    ("Team Falcons", [
        # hwinn (id=39) estava no stage 42 mas não em 43–46 → omitido
        (40,  "Kickstart", True),
        (41,  "Shrimzy",   True),
        (42,  "TGLTN",     True),
        (202, "Gustav",    True),
    ]),
    ("Team Liquid", [
        (87,  "aLOW",       True),
        (88,  "CowBoi",     True),
        (89,  "luke12",     True),
        (90,  "PurdyKurty", True),
    ]),
    ("GAM x TE", [
        # The Expendables renomeada. Roster confirmado via stages 45-46 do C2S1.
        (83,  "Clories",   True),
        (84,  "DuCkHjeUz", True),
        (86,  "TanVuu",    True),
        (348, "JUND",      True),
        (85,  "Hoangf",    False),  # reserva confirmada (stage 42)
    ]),
    ("Twisted Minds", [
        (91,  "BatulinS",    True),
        (92,  "Lu",          True),
        (94,  "xmpl",        True),
        (229, "Perfect1ks",  True),
    ]),
    ("Virtus.pro", [
        (99,  "Beami",   True),
        (100, "curexi",  True),
        (101, "Lukarux", True),
        (102, "NIXZYEE", True),
    ]),
]


# ─── Helpers ──────────────────────────────────────────────────────────────────

def print_roster(stage_id: int):
    print(f"\n=== ROSTER Winners Stage (stage_id={stage_id}) ===\n")
    total = 0
    for team_name, players in WINNERS_ROSTER:
        status = "OK " if len(players) >= 4 else "!! "
        print(f"  {status} {team_name}  ({len(players)} jogadores)")
        for (pid, name, avail) in sorted(players, key=lambda x: (not x[2], x[1])):
            reserve_tag = " [RESERVA]" if not avail else ""
            print(f"       id={pid:4d}  {name:<20s}{reserve_tag}")
        total += len(players)

    print(f"\n  Total jogadores: {total}")
    print(f"  Times OK (>=4): {sum(1 for _, p in WINNERS_ROSTER if len(p) >= 4)}")
    print(f"  Times vazios  : {sum(1 for _, p in WINNERS_ROSTER if len(p) == 0)}")
    print()


def apply_roster(db: Session, stage_id: int, confirm: bool):
    already_in: set[int] = {
        r.person_id
        for r in db.query(Roster.person_id).filter(Roster.stage_id == stage_id).all()
    }

    to_create: list[dict] = []
    for team_name, players in WINNERS_ROSTER:
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
    print(f"    - Adicionar GAM x TE via admin (time novo, sem histórico no DB)")
    print(f"    - POST /admin/stages/{stage_id}/calculate-pricing")


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Seed PGS C2S2 Winners Stage roster")
    parser.add_argument("--stage-id", type=int, required=True,
                        help="ID da Winners Stage no banco (produção)")
    parser.add_argument("--suggest", action="store_true",
                        help="Mostra o roster planejado (não modifica o banco)")
    parser.add_argument("--apply",   action="store_true",
                        help="Cria entradas de roster (dry-run por padrão)")
    parser.add_argument("--confirm", action="store_true",
                        help="Confirma criação real (use com --apply)")
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
