"""
open_pec_d2.py
──────────────
1. Adiciona os 8 times rebaixados do D1 ao roster da Stage 22
2. Roda pricing na Stage 22 (algoritmo padrão)
3. Abre a Stage 22 (lineup_status = 'open')

Times D1 rebaixados: JB, ACE, BW, HOWL, S2G, TMO, WORK, VIT
"""

from __future__ import annotations
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from app.database import SessionLocal
from app.models.roster import Roster
from app.models.stage import Stage
from app.services.pricing import calculate_stage_pricing

STAGE_D1 = 21
STAGE_D2 = 22

D1_LOSER_TEAMS = [
    'Joga Bonito',
    'ACEND Club',
    'Bushido Wildcats',
    'exhowl',
    'S2G Esports',
    'The Myth of',
    'Construction Workers',
    'Team Vitality',
]

def main():
    db = SessionLocal()
    try:
        # ── 1. Buscar rosters D1 dos times rebaixados ─────────────────────────
        d1_rosters = (
            db.query(Roster)
            .filter(
                Roster.stage_id == STAGE_D1,
                Roster.team_name.in_(D1_LOSER_TEAMS),
            )
            .all()
        )
        print(f"Encontrados {len(d1_rosters)} jogadores do D1 para adicionar ao D2\n")

        # ── 2. Adicionar ao roster da Stage 22 ───────────────────────────────
        added = 0
        skipped = 0
        for r in d1_rosters:
            existing = db.query(Roster).filter(
                Roster.stage_id == STAGE_D2,
                Roster.person_id == r.person_id,
            ).first()
            if existing:
                print(f"  [SKIP] person_id={r.person_id} já no D2")
                skipped += 1
                continue

            new_r = Roster(
                stage_id=STAGE_D2,
                person_id=r.person_id,
                team_name=r.team_name,
                fantasy_cost=15.00,   # será sobrescrito pelo pricing
                is_available=True,
            )
            db.add(new_r)
            added += 1
            print(f"  [ADD]  {r.team_name} - person_id={r.person_id}")

        db.flush()
        print(f"\nRoster D2: {added} adicionados, {skipped} já existiam\n")

        # ── 3. Rodar pricing na Stage 22 ──────────────────────────────────────
        print("Calculando preços para Stage 22...")
        result = calculate_stage_pricing(
            stage_id=STAGE_D2,
            db=db,
            source="auto",
        )
        print(f"  updated={result['updated']}  skipped={result['skipped']}  newcomers={result['newcomers']}\n")

        # ── 4. Abrir Stage 22 ─────────────────────────────────────────────────
        stage22 = db.get(Stage, STAGE_D2)
        stage22.lineup_status = 'open'
        print(f"Stage 22 aberta (lineup_status = 'open')")

        db.commit()
        print("\n[OK] Commit realizado.")

        # ── 5. Mostrar preços finais ──────────────────────────────────────────
        print("\n── Preços D2 (jogadores do D1) ──────────────────────────────────")
        d2_d1_rosters = (
            db.query(Roster)
            .filter(
                Roster.stage_id == STAGE_D2,
                Roster.team_name.in_(D1_LOSER_TEAMS),
            )
            .order_by(Roster.fantasy_cost.desc())
            .all()
        )
        from app.models.person import Person
        for r in d2_d1_rosters:
            person = db.get(Person, r.person_id)
            name = person.display_name if person else f"id={r.person_id}"
            print(f"  {r.fantasy_cost:6.2f}  {r.team_name:<25} {name}")

    except Exception as e:
        db.rollback()
        print(f"\n[ERRO] {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    main()
