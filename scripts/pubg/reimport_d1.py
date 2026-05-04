"""
Reimporta D1 (PAS e PEC) com force_reprocess=True para recapturar stats
de jogadores que foram ignorados antes por falta de player_account.

PAS D1: stage_id=30, stage_day_id=31
PEC D1: stage_id=33, stage_day_id=32
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from app.database import SessionLocal
from app.services.import_ import import_stage_matches
from app.services.lineup_scoring import rescore_stage, score_stage_day
from sqlalchemy import text

db = SessionLocal()

# Match IDs from database
PAS_D1 = {
    'stage_id': 30,
    'stage_day_id': 31,
    'pubg_match_ids': [
        'ae17c384-7f05-452e-adde-0a65c7f91a7e',
        '83b6e8ea-b2a4-4275-9099-65d978a50d7e',
        'c4d94179-ee36-4944-9229-722c7b5b603e',
        'c5ea4684-c5e1-4a80-9419-8bfeb7520c67',
        '1f65d7ad-e22b-4dc1-9e32-e9f6d5f2624b',
    ]
}

PEC_D1 = {
    'stage_id': 33,
    'stage_day_id': 32,
    'pubg_match_ids': [
        'b284f8dc-ed65-4a92-9ff6-ef1de30bd36d',
        '7ab246b3-7e70-4be9-afac-ac4298aea74c',
        'b5406348-a11a-44b6-862c-62d372641f5e',
        'e341de0d-f7f1-40b8-b503-2ea7760302c4',
        '51859cdf-d38d-4907-8a2b-dccdf90fb83d',
    ]
}

for name, cfg in [("PAS D1", PAS_D1), ("PEC D1", PEC_D1)]:
    print(f"\n{'='*50}")
    print(f"Reimportando {name} (stage={cfg['stage_id']}, stage_day={cfg['stage_day_id']}) ...")
    result = import_stage_matches(
        db=db,
        stage_id=cfg['stage_id'],
        pubg_match_ids=cfg['pubg_match_ids'],
        stage_day_id=cfg['stage_day_id'],
        force_reprocess=True,
    )
    print(f"Resultado:")
    for k, v in result.items():
        if k != 'matches':
            print(f"  {k}: {v}")
    if 'matches' in result:
        for m in result['matches']:
            print(f"  match {m.get('pubg_match_id', '')[:8]}... skip={m.get('skip',0)} ok={m.get('ok',0)} new={m.get('new',0)}")

print("\n" + "="*50)
print("Rescorando stages e stage_days...")

for name, stage_id, stage_day_id in [("PAS D1", 30, 31), ("PEC D1", 33, 32)]:
    print(f"\n{name}: rescore_stage(stage_id={stage_id})")
    try:
        rescore_stage(db, stage_id)
        print(f"  rescore_stage OK")
    except Exception as e:
        print(f"  rescore_stage ERRO: {e}")

    print(f"{name}: score_stage_day(stage_day_id={stage_day_id})")
    try:
        score_stage_day(db, stage_day_id)
        print(f"  score_stage_day OK")
    except Exception as e:
        print(f"  score_stage_day ERRO: {e}")

# Final stat count check
print("\nVerificando stats finais:")
for label, sdid in [("PAS D1", 31), ("PEC D1", 32)]:
    counts = db.execute(text("""
        SELECT m.pubg_match_id, COUNT(ms.id) as cnt
        FROM match m
        LEFT JOIN match_stat ms ON ms.match_id = m.id
        WHERE m.stage_day_id = :sdid
        GROUP BY m.pubg_match_id
        ORDER BY m.pubg_match_id
    """), {'sdid': sdid}).fetchall()
    total = sum(r.cnt for r in counts)
    print(f"  {label}: {len(counts)} matches, {total} total stats ({total//max(len(counts),1)} avg/match)")

db.close()
print("\nDone.")
