"""Check D1 matches status in database."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from app.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()

# Check matches for PAS D1 (stage_day=31) and PEC D1 (stage_day=32)
for label, stage_day_id in [("PAS D1", 31), ("PEC D1", 32)]:
    matches = db.execute(text("""
        SELECT m.id, m.pubg_match_id, m.played_at,
               COUNT(ms.id) as stat_count
        FROM match m
        LEFT JOIN match_stat ms ON ms.match_id = m.id
        WHERE m.stage_day_id = :sdid
        GROUP BY m.id, m.pubg_match_id, m.played_at
        ORDER BY m.played_at
    """), {'sdid': stage_day_id}).fetchall()

    print(f"{label} (stage_day={stage_day_id}): {len(matches)} matches")
    for m in matches:
        print(f"  id={m.id} pubg_id={m.pubg_match_id} stats={m.stat_count} played_at={m.played_at}")
    print()

db.close()
