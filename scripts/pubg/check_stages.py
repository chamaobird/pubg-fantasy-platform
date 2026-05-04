"""Check stage and stage_day IDs for playoffs 2."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from app.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()

# Check championships 12 and 13 (PAS+PEC Playoffs 2)
rows = db.execute(text("""
    SELECT c.id as champ_id, c.name as champ_name,
           s.id as stage_id, s.name as stage_name,
           sd.id as stage_day_id, sd.day_number
    FROM championship c
    JOIN stage s ON s.championship_id = c.id
    JOIN stage_day sd ON sd.stage_id = s.id
    WHERE c.id IN (12, 13)
    ORDER BY c.id, s.id, sd.id
""")).fetchall()

print("Championships, Stages, StageDays:")
for r in rows:
    print(f"  champ={r.champ_id} ({r.champ_name}) | stage={r.stage_id} ({r.stage_name}) | stage_day={r.stage_day_id} day={r.day_number}")

print()

# Check match counts per stage_day
counts = db.execute(text("""
    SELECT sd.id as stage_day_id, sd.day_number,
           s.name as stage_name, c.name as champ_name,
           COUNT(DISTINCT m.id) as match_count,
           COUNT(DISTINCT mp.id) as participant_count,
           SUM(CASE WHEN mp.person_id IS NULL THEN 1 ELSE 0 END) as unresolved
    FROM championship c
    JOIN stage s ON s.championship_id = c.id
    JOIN stage_day sd ON sd.stage_id = s.id
    LEFT JOIN match m ON m.stage_day_id = sd.id
    LEFT JOIN match_participant mp ON mp.match_id = m.id
    WHERE c.id IN (12, 13)
    GROUP BY sd.id, sd.day_number, s.name, c.name
    ORDER BY c.id, s.id, sd.id
""")).fetchall()

print("Match counts per stage_day:")
for r in counts:
    print(f"  stage_day={r.stage_day_id} ({r.champ_name} {r.stage_name} D{r.day_number}): {r.match_count} matches, {r.participant_count} participants, {r.unresolved} unresolved")

db.close()
