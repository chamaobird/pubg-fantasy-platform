"""
1. Importa D2 PAS e PEC
2. Coleta accounts não resolvidos
3. Insere accounts via PUBG API para os participantes
4. Reimporta com force_reprocess
5. Rescora
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

PAS_D2 = {
    'stage_id': 31, 'stage_day_id': 33,
    'matches': [
        '95a94701-c0bd-4b8c-8464-bec64b9b509b',
        '0061efa2-27fa-45c5-ba4a-46744c985125',
        'd49b1136-f0aa-453a-8b82-310a19bce0e6',
        'e6197312-ece1-401f-bc77-3d3ca99c276e',
        '9149770d-e6d4-4fd3-a782-08bf8c1d5b81',
    ]
}
PEC_D2 = {
    'stage_id': 34, 'stage_day_id': 35,
    'matches': [
        '7d83cb6c-77d0-4f7e-ba52-aa27d9e5147c',
        'c2aff09e-f1a0-40e9-b61c-02a1be5fb45a',
        'cacaffea-0fef-4e33-b8dc-6ec048ce8362',
        '9e92d8dc-8d24-4f08-b23f-d3e6f6a39ca2',
        '09a4db62-a181-4c71-b790-9aaf6c59df39',
    ]
}

def get_match_participants(match_id):
    """Busca participantes do match via PUBG API."""
    url = f'https://api.pubg.com/shards/pc-tournament/matches/{match_id}'
    r = requests.get(url, headers=PUBG_HDR, timeout=20)
    if r.status_code != 200:
        return []
    data = r.json()
    participants = []
    for item in data.get('included', []):
        if item.get('type') == 'participant':
            attrs = item.get('attributes', {})
            stats = attrs.get('stats', {})
            participants.append({
                'account_id': stats.get('playerId', ''),
                'alias': stats.get('name', ''),
            })
    return participants

db = SessionLocal()

def fix_accounts_for_stage(db, stage_id, match_ids, label):
    """Detecta players sem person_id, busca accounts via PUBG API e insere."""
    print(f"\n  Coletando participants do {label} via PUBG API...")

    # Coleta todos os participants dos matches
    all_participants = {}  # alias -> account_id
    for mid in match_ids:
        parts = get_match_participants(mid)
        for p in parts:
            if p['account_id']:
                all_participants[p['alias']] = p['account_id']

    print(f"  {len(all_participants)} participants encontrados nos matches")

    # Busca lookup de person para a stage
    lookup_rows = db.execute(text("""
        SELECT p.display_name, p.id as person_id,
               array_agg(DISTINCT pa.account_id) FILTER (WHERE pa.account_id IS NOT NULL) as known_accounts,
               array_agg(DISTINCT pa.alias) FILTER (WHERE pa.alias IS NOT NULL) as known_aliases
        FROM roster r
        JOIN person p ON p.id = r.person_id
        LEFT JOIN player_account pa ON pa.person_id = p.id AND pa.shard = 'pc-tournament'
        WHERE r.stage_id = :sid
        GROUP BY p.id, p.display_name
    """), {'sid': stage_id}).fetchall()

    # Monta reverse lookup: account_id -> person_id
    account_to_person = {}
    alias_to_person = {}
    for row in lookup_rows:
        for acc in (row.known_accounts or []):
            account_to_person[acc] = row.person_id
        # alias lookup (normalizado)
        display = row.display_name.lower()
        alias_to_person[display] = row.person_id
        # também sem prefixo de time
        if '_' in row.display_name:
            without_prefix = row.display_name.split('_', 1)[1].lower()
            alias_to_person[without_prefix] = row.person_id

    inserted = 0
    unmatched = []

    for alias, account_id in all_participants.items():
        # Já tem account no banco?
        if account_id in account_to_person:
            continue

        # Tenta resolver por alias
        alias_lower = alias.lower()
        alias_without_prefix = alias.split('_', 1)[1].lower() if '_' in alias else alias_lower

        person_id = alias_to_person.get(alias_lower) or alias_to_person.get(alias_without_prefix)

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
        print(f"  Nao resolvidos ({len(unmatched)}): {sorted(set(unmatched))}")
    return unmatched

# ── LOOP PRINCIPAL ─────────────────────────────────────────────────────────
for cfg_label, cfg in [("PAS D2", PAS_D2), ("PEC D2", PEC_D2)]:
    print(f"\n{'='*60}")
    print(f"IMPORTANDO {cfg_label} (stage={cfg['stage_id']}, stage_day={cfg['stage_day_id']})")
    print(f"{'='*60}")

    # PASSO 1: Import inicial
    print("Passo 1: Import inicial...")
    result = import_stage_matches(
        db=db, stage_id=cfg['stage_id'],
        pubg_match_ids=cfg['matches'],
        stage_day_id=cfg['stage_day_id'],
        force_reprocess=False,
    )
    unresolved = result.get('unresolved_players', [])
    print(f"  imported={result.get('imported',0)} unresolved={len(unresolved)}: {unresolved}")

    if unresolved:
        # PASSO 2: Fix accounts via PUBG API
        print("Passo 2: Fix accounts...")
        still_unmatched = fix_accounts_for_stage(db, cfg['stage_id'], cfg['matches'], cfg_label)

        # PASSO 3: Reimport com force_reprocess
        print("Passo 3: Reimport force_reprocess...")
        result2 = import_stage_matches(
            db=db, stage_id=cfg['stage_id'],
            pubg_match_ids=cfg['matches'],
            stage_day_id=cfg['stage_day_id'],
            force_reprocess=True,
        )
        print(f"  reprocessed={result2.get('reprocessed',0)} unresolved={result2.get('unresolved_players',[])}")

    # PASSO 4: Rescore
    print("Passo 4: Rescore...")
    rescore_stage(db, cfg['stage_id'])
    score_stage_day(db, cfg['stage_day_id'])
    print("  Rescore OK")

# ── VERIFICAÇÃO FINAL ──────────────────────────────────────────────────────
print(f"\n{'='*60}")
print("VERIFICACAO FINAL")
print("=" * 60)
for label, sdid in [("PAS D2", 33), ("PEC D2", 35)]:
    r = db.execute(text("""
        SELECT COUNT(*) total,
               SUM(CASE WHEN person_id IS NOT NULL THEN 1 ELSE 0 END) resolved,
               SUM(CASE WHEN person_id IS NULL THEN 1 ELSE 0 END) unresolved,
               COUNT(DISTINCT match_id) matches
        FROM match_stat
        WHERE match_id IN (SELECT id FROM match WHERE stage_day_id=:sdid)
    """), {'sdid': sdid}).fetchone()
    if r.matches:
        print(f"  {label}: {r.matches} matches | {r.total} stats ({r.total//r.matches}/match) | resolved={r.resolved} unresolved={r.unresolved}")
    else:
        print(f"  {label}: 0 matches importados!")

db.close()
print("\nDone.")
