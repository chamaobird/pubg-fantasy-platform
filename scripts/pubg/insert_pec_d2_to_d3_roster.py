"""
insert_pec_d2_to_d3_roster.py
──────────────────────────────
Copia jogadores dos 11 times do D2 que avançaram para o D3
do Stage 22 → Stage 23 (com preços baseados na performance do D2).

Uso:
    python scripts/pubg/insert_pec_d2_to_d3_roster.py [--dry-run]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from app.database import SessionLocal
from app.models.person import Person
from app.models.person_stage_stat import PersonStageStat
from app.models.roster import Roster

# Times do D2 que vão para D3
D3_FROM_D2_TEAMS = [
    "The Myth of",
    "Storm on Request",
    "NoTag Team",
    "YOOO",
    "S2G Esports",
    "Construction Workers",
    "Baldinini",
    "Ghetto Gang",
    "Team Vitality",
    "exhowl",
    "Joga Bonito",
]

STAGE_D2 = 22
STAGE_D3 = 23


def price_from_pts(pts: float) -> float:
    """Precifica jogador com base nos pontos do D2."""
    if pts >= 100:
        return 22.0
    if pts >= 70:
        return 18.0
    if pts >= 50:
        return 14.0
    if pts >= 30:
        return 11.0
    return 8.0


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if args.dry_run:
        print("=== DRY RUN — nenhuma alteracao sera gravada ===\n")

    db = SessionLocal()
    try:
        total_added = 0
        total_skip  = 0

        for team_name in sorted(D3_FROM_D2_TEAMS):
            players = (
                db.query(Roster, Person, PersonStageStat)
                .join(Person, Roster.person_id == Person.id)
                .outerjoin(
                    PersonStageStat,
                    (PersonStageStat.person_id == Person.id) & (PersonStageStat.stage_id == STAGE_D2)
                )
                .filter(Roster.stage_id == STAGE_D2, Roster.team_name == team_name)
                .all()
            )

            if not players:
                print(f"[WARN] Nenhum jogador encontrado para team_name='{team_name}' no Stage {STAGE_D2}")
                continue

            print(f"\n[{team_name}]")
            for r_d2, person, pss in players:
                pts = pss.total_xama_points if pss else 0.0
                cost = price_from_pts(pts)

                existing = db.query(Roster).filter(
                    Roster.stage_id == STAGE_D3,
                    Roster.person_id == person.id,
                ).first()

                if existing:
                    print(f"  [SKIP] {person.display_name:<20}  {pts:>7.1f} pts  cost={existing.fantasy_cost}  (ja no D3)")
                    total_skip += 1
                    continue

                print(f"  [ADD]  {person.display_name:<20}  {pts:>7.1f} pts  -> cost={cost}")
                if not args.dry_run:
                    new_r = Roster(
                        stage_id=STAGE_D3,
                        person_id=person.id,
                        team_name=team_name,
                        fantasy_cost=cost,
                    )
                    db.add(new_r)
                    total_added += 1
                else:
                    total_added += 1

        if not args.dry_run:
            db.commit()
            print(f"\n[OK] Commit realizado. Adicionados={total_added}, Pulados={total_skip}")
        else:
            print(f"\n[DRY RUN] Seriam adicionados={total_added}, Pulados={total_skip}")

    except Exception as e:
        db.rollback()
        print(f"\n[ERRO] {e}")
        import traceback; traceback.print_exc()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
