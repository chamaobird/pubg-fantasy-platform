"""
1. Remove Walkerwoman do roster RENT FREE stage 31
2. Corrige FR_gats com custo newcomer (historico insuficiente)
3. Executa repricing stages 31 (PAS D2) e 34 (PEC D2)
4. Valida resultado
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

# ── 1. Remove Walkerwoman (person_id=?) de stage 31 ───────────────────────
print("1. Removendo Walkerwoman do stage 31...")
wr = db.execute(text("""
    DELETE FROM roster
    WHERE stage_id=31
      AND person_id=(SELECT id FROM person WHERE display_name='Walkerwoman')
    RETURNING id, person_id
""")).fetchone()
if wr:
    print(f"   Removido roster_id={wr.id} person_id={wr.person_id}")
else:
    print("   Nao encontrado (pode ja estar removido)")
db.commit()

# ── 2. Repricing stage 31 (PAS D2) ────────────────────────────────────────
print("\n2. Repricing PAS D2 (stage 31)...")
result_pas = calculate_stage_pricing(31, db, source="playoffs2_d2_setup")
db.commit()
print(f"   updated={result_pas['updated']} skipped={result_pas['skipped']} newcomers={result_pas['newcomers']}")

# ── 3. Repricing stage 34 (PEC D2) ────────────────────────────────────────
print("\n3. Repricing PEC D2 (stage 34)...")
result_pec = calculate_stage_pricing(34, db, source="playoffs2_d2_setup")
db.commit()
print(f"   updated={result_pec['updated']} skipped={result_pec['skipped']} newcomers={result_pec['newcomers']}")

# ── 4. Validação: preços por time ──────────────────────────────────────────
print("\n4. Precos resultantes por time — PAS D2 (stage 31):")
rows = db.execute(text("""
    SELECT r.team_name,
           COUNT(*) as players,
           MIN(r.fantasy_cost) as min_cost,
           MAX(r.fantasy_cost) as max_cost,
           ROUND(AVG(r.fantasy_cost)::numeric,1) as avg_cost
    FROM roster r
    WHERE r.stage_id=31
    GROUP BY r.team_name
    ORDER BY avg_cost DESC
""")).fetchall()
for r in rows:
    print(f"   {r.team_name:25} {r.players}p  min={r.min_cost}  max={r.max_cost}  avg={r.avg_cost}")

print("\n   PEC D2 (stage 34):")
rows2 = db.execute(text("""
    SELECT r.team_name,
           COUNT(*) as players,
           MIN(r.fantasy_cost) as min_cost,
           MAX(r.fantasy_cost) as max_cost,
           ROUND(AVG(r.fantasy_cost)::numeric,1) as avg_cost
    FROM roster r
    WHERE r.stage_id=34
    GROUP BY r.team_name
    ORDER BY avg_cost DESC
""")).fetchall()
for r in rows2:
    print(f"   {r.team_name:25} {r.players}p  min={r.min_cost}  max={r.max_cost}  avg={r.avg_cost}")

# ── 5. Jogadores ainda sem preco ──────────────────────────────────────────
print("\n5. Jogadores sem preco (NULL) nas stages D2:")
nulls = db.execute(text("""
    SELECT s.id as sid, r.team_name, p.display_name, r.fantasy_cost
    FROM roster r
    JOIN person p ON p.id=r.person_id
    JOIN stage s ON s.id=r.stage_id
    WHERE r.stage_id IN (31,34) AND r.fantasy_cost IS NULL
    ORDER BY s.id, r.team_name
""")).fetchall()
if nulls:
    for r in nulls:
        print(f"   stage={r.sid} {r.team_name} {r.display_name}")
else:
    print("   Nenhum — todos com preco definido!")

db.close()
print("\nDone.")
