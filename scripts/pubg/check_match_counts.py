"""Check match counts per stage_day."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from app.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()

# Find what the match results table is called
tables = db.execute(text("""
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name LIKE '%match%'
    ORDER BY table_name
""")).fetchall()
print("Match-related tables:", [r[0] for r in tables])

print()

# Count matches per stage_day
counts = db.execute(text("""
    SELECT sd.id as stage_day_id, sd.day_number,
           s.id as stage_id, s.name as stage_name, c.name as champ_name,
           COUNT(DISTINCT m.id) as match_count
    FROM championship c
    JOIN stage s ON s.championship_id = c.id
    JOIN stage_day sd ON sd.stage_id = s.id
    LEFT JOIN match m ON m.stage_day_id = sd.id
    WHERE c.id IN (12, 13)
    GROUP BY sd.id, sd.day_number, s.id, s.name, c.name
    ORDER BY c.id, s.id, sd.id
""")).fetchall()

print("Match counts per stage_day:")
for r in counts:
    print(f"  champ=({r.champ_name}) stage={r.stage_id} ({r.stage_name}) stage_day={r.stage_day_id} D{r.day_number}: {r.match_count} matches")

db.close()
