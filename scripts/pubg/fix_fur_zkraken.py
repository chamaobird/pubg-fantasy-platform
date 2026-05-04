"""
Fix FUR_zKraken account mapping and then reimport D1 matches for PAS and PEC.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from app.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()

# Fix FUR_zKraken (person_id=109) — in-game alias is FUR_zkraken (lowercase k)
person_id = 109
account_id = 'account.d22295dd51a3475b98cdafb6bfc9eb0a'

existing = db.execute(text(
    "SELECT * FROM player_account WHERE person_id=:pid AND account_id=:aid"
), {'pid': person_id, 'aid': account_id}).fetchone()

if existing:
    print(f"FUR_zKraken already has account {account_id} — skipping insert")
else:
    db.execute(text("""
        INSERT INTO player_account (person_id, account_id, shard, alias)
        VALUES (:pid, :aid, 'pc-tournament', 'FUR_zkraken')
        ON CONFLICT DO NOTHING
    """), {'pid': person_id, 'aid': account_id})
    db.commit()
    print(f"Inserted FUR_zKraken (person_id=109) with account {account_id}")

# Verify total pc-tournament accounts
count = db.execute(text("SELECT COUNT(*) FROM player_account WHERE shard='pc-tournament'")).scalar()
print(f"Total pc-tournament accounts in DB: {count}")

# Show FUR_zKraken accounts
rows = db.execute(text(
    "SELECT pa.*, p.display_name FROM player_account pa JOIN person p ON p.id=pa.person_id WHERE pa.person_id=109"
)).fetchall()
print(f"\nFUR_zKraken accounts ({len(rows)}):")
for r in rows:
    print(f"  {r}")

db.close()
