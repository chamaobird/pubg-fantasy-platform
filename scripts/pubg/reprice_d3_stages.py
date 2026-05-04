"""
Repricing das stages D3 das Playoffs 2 (PAS stage 32, PEC stage 35).
Rodar APÓS fix_d3_unresolved.py para garantir stats completas.
"""
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from dotenv import load_dotenv; load_dotenv(ROOT / ".env")

from app.database import SessionLocal
from app.services.pricing import calculate_stage_pricing
from sqlalchemy import text

db = SessionLocal()

# ── 1. Repricing stage 32 (PAS D3) ────────────────────────────────────────
print("1. Repricing PAS D3 (stage 32)...")
result_pas = calculate_stage_pricing(32, db, source="playoffs2_d3_setup")
db.commit()
print(f"   updated={result_pas['updated']} skipped={result_pas['skipped']} newcomers={result_pas['newcomers']}")

# ── 2. Repricing stage 35 (PEC D3) ────────────────────────────────────────
print("\n2. Repricing PEC D3 (stage 35)...")
result_pec = calculate_stage_pricing(35, db, source="playoffs2_d3_setup")
db.commit()
print(f"   updated={result_pec['updated']} skipped={result_pec['skipped']} newcomers={result_pec['newcomers']}")

# ── 3. Validação: preços por time ──────────────────────────────────────────
print("\n3. Precos resultantes por time — PAS D3 (stage 32):")
rows = db.execute(text("""
    SELECT r.team_name,
           COUNT(*) as players,
           MIN(r.fantasy_cost) as min_cost,
           MAX(r.fantasy_cost) as max_cost,
           ROUND(AVG(r.fantasy_cost)::numeric,1) as avg_cost
    FROM roster r
    WHERE r.stage_id=32
    GROUP BY r.team_name
    ORDER BY avg_cost DESC
""")).fetchall()
for r in rows:
    print(f"   {r.team_name:25} {r.players}p  min={r.min_cost}  max={r.max_cost}  avg={r.avg_cost}")

print("\n   PEC D3 (stage 35):")
rows2 = db.execute(text("""
    SELECT r.team_name,
           COUNT(*) as players,
           MIN(r.fantasy_cost) as min_cost,
           MAX(r.fantasy_cost) as max_cost,
           ROUND(AVG(r.fantasy_cost)::numeric,1) as avg_cost
    FROM roster r
    WHERE r.stage_id=35
    GROUP BY r.team_name
    ORDER BY avg_cost DESC
""")).fetchall()
for r in rows2:
    print(f"   {r.team_name:25} {r.players}p  min={r.min_cost}  max={r.max_cost}  avg={r.avg_cost}")

# ── 4. Jogadores com custo NULL ───────────────────────────────────────────
print("\n4. Jogadores sem preco (NULL) nas stages D3:")
nulls = db.execute(text("""
    SELECT s.id as sid, r.team_name, p.display_name, r.fantasy_cost
    FROM roster r
    JOIN person p ON p.id=r.person_id
    JOIN stage s ON s.id=r.stage_id
    WHERE r.stage_id IN (32, 35) AND r.fantasy_cost IS NULL
    ORDER BY s.id, r.team_name
""")).fetchall()
if nulls:
    for r in nulls:
        print(f"   stage={r.sid} {r.team_name} {r.display_name}")
else:
    print("   Nenhum — todos com preco definido!")

db.close()
print("\nDone.")
