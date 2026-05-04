"""
Importa matches D3 das Playoffs 2 (PAS stage 32 sd34, PEC stage 35 sd36).
UUIDs obtidos via tournament endpoints am-pas1p2 / eu-pecsp2.
"""
import sys, os, requests
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from dotenv import load_dotenv; load_dotenv(ROOT / ".env")

from app.database import SessionLocal
from app.services.import_ import import_stage_matches
from app.services.lineup_scoring import rescore_stage, score_stage_day
from sqlalchemy import text

PUBG_KEY = os.environ.get('PUBG_API_KEY', '')
PUBG_HDR = {'Authorization': f'Bearer {PUBG_KEY}', 'Accept': 'application/vnd.api+json'}

PAS_D3 = {
    'stage_id': 32, 'stage_day_id': 34,
    'matches': [
        'b5db9bb5-f626-41ad-b77e-9c7817a784ab',
        '709e03eb-8399-4acf-9f95-9caa3a9dfbfc',
        'e2a85b84-786f-4898-b62b-b5a4575a4589',
        '27525cff-dabb-41e9-8354-f36ccd501147',
        'c9b1e414-9094-48f5-8a12-4deff9d2e42c',
    ]
}
PEC_D3 = {
    'stage_id': 35, 'stage_day_id': 36,
    'matches': [
        '61c3c73f-e1b9-45b9-a933-64945b0b06c4',
        'f20200f3-bfc3-4040-88d3-2822853e64bd',
        '8af60cc9-d712-47bc-979f-726aa24e1e32',
        '4dfed86c-04f0-484c-8692-dcb63e11b42c',
        '5d8f24b6-5941-4c74-89b6-f475d1e29d71',
    ]
}

def get_match_participants(match_id):
    url = f'https://api.pubg.com/shards/pc-tournament/matches/{match_id}'
    r = requests.get(url, headers=PUBG_HDR, timeout=20)
    if r.status_code != 200:
        return {}
    result = {}
    for item in r.json().get('included', []):
        if item.get('type') == 'participant':
            stats = item.get('attributes', {}).get('stats', {})
            aid = stats.get('playerId', '')
            alias = stats.get('name', '')
            if aid and alias:
                result[alias] = aid
    return result

db = SessionLocal()

def fix_accounts(db, stage_id, match_ids, label):
    print(f"  Coletando participants {label} via PUBG API...")
    all_parts = {}
    for mid in match_ids:
        all_parts.update(get_match_participants(mid))
    print(f"  {len(all_parts)} participants únicos")

    lookup_rows = db.execute(text("""
        SELECT p.display_name, p.id as person_id,
               array_agg(DISTINCT pa.account_id) FILTER (WHERE pa.account_id IS NOT NULL) as known_accounts
        FROM roster r
        JOIN person p ON p.id = r.person_id
        LEFT JOIN player_account pa ON pa.person_id=p.id AND pa.shard='pc-tournament'
        WHERE r.stage_id=:sid
        GROUP BY p.id, p.display_name
    """), {'sid': stage_id}).fetchall()

    account_to_person = {}
    alias_to_person   = {}
    for row in lookup_rows:
        for acc in (row.known_accounts or []):
            account_to_person[acc] = row.person_id
        display = row.display_name.lower()
        alias_to_person[display] = row.person_id
        if '_' in row.display_name:
            alias_to_person[row.display_name.split('_', 1)[1].lower()] = row.person_id

    inserted = 0
    unmatched = []
    for alias, account_id in all_parts.items():
        if account_id in account_to_person:
            continue
        alias_lower = alias.lower()
        alias_no_prefix = alias.split('_', 1)[1].lower() if '_' in alias else alias_lower
        person_id = alias_to_person.get(alias_lower) or alias_to_person.get(alias_no_prefix)
        if person_id:
            db.execute(text("""
                INSERT INTO player_account (person_id, account_id, shard, alias)
                VALUES (:pid, :aid, 'pc-tournament', :alias)
                ON CONFLICT DO NOTHING
            """), {'pid': person_id, 'aid': account_id, 'alias': alias})
            account_to_person[account_id] = person_id
            inserted += 1
        else:
            unmatched.append(alias)
    db.commit()
    print(f"  Accounts inseridos: {inserted}")
    if unmatched:
        print(f"  Não resolvidos ({len(unmatched)}): {sorted(set(unmatched))}")
    return sorted(set(unmatched))

for cfg_label, cfg in [("PAS D3", PAS_D3), ("PEC D3", PEC_D3)]:
    print(f"\n{'='*60}")
    print(f"IMPORTANDO {cfg_label} (stage={cfg['stage_id']}, sd={cfg['stage_day_id']})")
    print(f"{'='*60}")

    print("Passo 1: Import inicial...")
    r1 = import_stage_matches(
        db=db, stage_id=cfg['stage_id'],
        pubg_match_ids=cfg['matches'],
        stage_day_id=cfg['stage_day_id'],
        force_reprocess=False,
    )
    unresolved = r1.get('unresolved_players', [])
    print(f"  imported={r1.get('imported',0)} unresolved={len(unresolved)}: {unresolved}")

    if unresolved:
        print("Passo 2: Fix accounts...")
        fix_accounts(db, cfg['stage_id'], cfg['matches'], cfg_label)

        print("Passo 3: Reimport force_reprocess=True...")
        r2 = import_stage_matches(
            db=db, stage_id=cfg['stage_id'],
            pubg_match_ids=cfg['matches'],
            stage_day_id=cfg['stage_day_id'],
            force_reprocess=True,
        )
        print(f"  reprocessed={r2.get('reprocessed',0)} unresolved={r2.get('unresolved_players',[])}")

    print("Passo 4: Rescore...")
    rescore_stage(db, cfg['stage_id'])
    score_stage_day(db, cfg['stage_day_id'])
    print("  Rescore OK")

# Verificação final
print(f"\n{'='*60}")
print("VERIFICACAO FINAL")
print("="*60)
for label, sdid in [("PAS D3", 34), ("PEC D3", 36)]:
    r = db.execute(text("""
        SELECT COUNT(*) total,
               SUM(CASE WHEN person_id IS NOT NULL THEN 1 ELSE 0 END) resolved,
               SUM(CASE WHEN person_id IS NULL    THEN 1 ELSE 0 END) unresolved,
               COUNT(DISTINCT match_id) matches
        FROM match_stat
        WHERE match_id IN (SELECT id FROM match WHERE stage_day_id=:sdid)
    """), {'sdid': sdid}).fetchone()
    if r.matches:
        per_match = r.total // r.matches
        print(f"  {label}: {r.matches} matches | {r.total} stats ({per_match}/match) | resolved={r.resolved} unresolved={r.unresolved}")
    else:
        print(f"  {label}: 0 matches importados!")

db.close()
print("\nDone.")
