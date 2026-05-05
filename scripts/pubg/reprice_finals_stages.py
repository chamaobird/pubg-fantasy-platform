"""
Repricing Finals 2 — PAS (stages 39, 40, 41) e PEC (stages 36, 37, 38)
"""
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
sys.stdout.reconfigure(encoding='utf-8')
from dotenv import load_dotenv; load_dotenv(ROOT / ".env")

from app.database import SessionLocal
from app.services.pricing import calculate_stage_pricing
from sqlalchemy import text

db = SessionLocal()

STAGES = [
    (39, "PAS Finals D1"),
    (40, "PAS Finals D2"),
    (41, "PAS Finals D3"),
    (36, "PEC Finals D1"),
    (37, "PEC Finals D2"),
    (38, "PEC Finals D3"),
]

for sid, label in STAGES:
    print(f"\nRepricing {label} (stage {sid})...")
    result = calculate_stage_pricing(sid, db, source="finals2_setup")
    db.commit()
    print(f"  updated={result['updated']} skipped={result['skipped']} newcomers={result['newcomers']}")

# Validacao: NULLs
print("\n" + "="*60)
print("Jogadores sem preco (NULL):")
nulls = db.execute(text("""
    SELECT r.stage_id, r.team_name, p.display_name, r.fantasy_cost
    FROM roster r
    JOIN person p ON p.id = r.person_id
    WHERE r.stage_id IN (36,37,38,39,40,41) AND r.fantasy_cost IS NULL
    ORDER BY r.stage_id, r.team_name
""")).fetchall()
if nulls:
    for r in nulls:
        print(f"  stage {r.stage_id} {r.team_name} {r.display_name}")
else:
    print("  Nenhum — todos com preco!")

# Sumario de precos por stage (apenas stage 39 e 36, os outros sao identicos)
for sid, label in [(39, "PAS Finals"), (36, "PEC Finals")]:
    print(f"\n{label} (stage {sid}) — precos por time:")
    rows = db.execute(text("""
        SELECT r.team_name,
               COUNT(*) players,
               MIN(r.fantasy_cost) min_c,
               MAX(r.fantasy_cost) max_c,
               ROUND(AVG(r.fantasy_cost)::numeric, 1) avg_c
        FROM roster r
        WHERE r.stage_id = :sid AND r.is_available = true
        GROUP BY r.team_name ORDER BY avg_c DESC
    """), {'sid': sid}).fetchall()
    for r in rows:
        print(f"  {r.team_name:25} {r.players}p  min={r.min_c}  max={r.max_c}  avg={r.avg_c}")

db.close()
print("\nDone.")
