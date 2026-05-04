"""
Dia 3 das Playoffs 2 — PAS (stage 32) e PEC (stage 35)

1. Cria rosters D3:
   - PAS D3: times do D2 (stage 31) + novos do Playoffs 1 D3 (stage 17)
   - PEC D3: times do D2 (stage 34) + novos do Playoffs 1 D3 (stage 23)

2. Scan Twire para UUIDs D3 (2026-05-03)

3. Import D3 matches com fix automático de accounts

4. Rescore stages 32 e 35
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

db = SessionLocal()

# ─────────────────────────────────────────────────────────────────────────────
# PASSO 1: Setup D3 Rosters
# ─────────────────────────────────────────────────────────────────────────────
print("="*60)
print("PASSO 1: Setup rosters D3")
print("="*60)

# PAS D3 — stage 32
# times do D2 (stage 31):  team_name_in_db → team_name_no_d3
PAS_D2_TEAMS = {
    'GodLike':       'GodLike',
    'IAM BOLIVIA':   'IAM BOLIVIA',
    'Team FATE':     'Team FATE',
    '55 e-Sports':   '55 e-Sports',
    'Collector':     'Collector',
    'Last Breath':   'Last Breath',
    'Injected':      'Injected',
    'Pest Control':  'PEST Control',
    'Affinity':      'Affinity',
    'What It Takes': 'What It Takes',
    'Tempest':       'Tempest',
}
# times novos no D3 — vêm do stage 17 (PAS Playoffs 1 D3)
PAS_D1_P1_TEAMS = {
    'Also Known As': 'Also known as',
    'Dream One':     'Dream One',
    'DOTS':          'DOTS',
    'For Nothing':   'For Nothing',
    'Nevermind':     'NEVERMIND',
}

# PEC D3 — stage 35
# times do D2 (stage 34):
PEC_D2_TEAMS = {
    'Team Nemesis':         'Team Nemesis',
    'Construction Workers': 'Construction Workers',
    'exhowl':               'exhowl',
    'BORZ':                 'BORZ',
    'NoTag Team':           'NoTag Team',
    'Starry SKY':           'Starry SKY',
    'Baldinini':            'Baldinini',
    'The Myth of':          'The Myth of',
    'Vis':                  'Vis',
    'S8UL':                 'S8UL',
    'Ghetto Gang':          'Ghetto Gang',
}
# times novos no D3 — vêm do stage 23 (PEC Playoffs 1 D3)
PEC_D1_P1_TEAMS = {
    'PBRU':           'PBRU',
    'Vuptrox':        'Vuptrox',
    'Redline':        'Redline',
    'Everlong':       'Everlong',
    'GoNext Esports': 'GoNext Esports',
}

def setup_d3_roster(db, d3_stage_id, src_d2_stage, d2_teams, src_p1_stage, p1_teams, label):
    """Cria roster D3 copiando de D2 e de P1 D3."""
    # Verifica se já existe
    existing = db.execute(text(
        "SELECT COUNT(*) FROM roster WHERE stage_id=:sid"
    ), {'sid': d3_stage_id}).scalar()
    if existing > 0:
        print(f"  {label}: roster stage {d3_stage_id} já existe ({existing} entries) — pulando")
        return existing

    inserted = 0
    skipped = []

    # Times do D2
    for db_name, d3_name in d2_teams.items():
        rows = db.execute(text("""
            SELECT r.person_id, r.fantasy_cost
            FROM roster r
            WHERE r.stage_id=:sid AND r.team_name=:team
        """), {'sid': src_d2_stage, 'team': db_name}).fetchall()
        if not rows:
            skipped.append(f"D2:{db_name}")
            continue
        for row in rows:
            db.execute(text("""
                INSERT INTO roster (stage_id, person_id, team_name, fantasy_cost)
                VALUES (:sid, :pid, :team, :cost)
                ON CONFLICT DO NOTHING
            """), {'sid': d3_stage_id, 'pid': row.person_id, 'team': d3_name, 'cost': row.fantasy_cost})
            inserted += 1
        print(f"    {d3_name}: {len(rows)} players (from D2:{db_name})")

    # Times do Playoffs 1 D3
    for db_name, d3_name in p1_teams.items():
        rows = db.execute(text("""
            SELECT r.person_id, r.fantasy_cost
            FROM roster r
            WHERE r.stage_id=:sid AND r.team_name=:team
        """), {'sid': src_p1_stage, 'team': db_name}).fetchall()
        if not rows:
            skipped.append(f"P1:{db_name}")
            continue
        for row in rows:
            db.execute(text("""
                INSERT INTO roster (stage_id, person_id, team_name, fantasy_cost)
                VALUES (:sid, :pid, :team, :cost)
                ON CONFLICT DO NOTHING
            """), {'sid': d3_stage_id, 'pid': row.person_id, 'team': d3_name, 'cost': row.fantasy_cost})
            inserted += 1
        print(f"    {d3_name}: {len(rows)} players (from P1:{db_name})")

    db.commit()
    if skipped:
        print(f"  WARN — times não encontrados: {skipped}")
    print(f"  {label}: {inserted} entradas criadas no roster {d3_stage_id}")
    return inserted

print("\nPAS D3 (stage 32):")
setup_d3_roster(db, 32, 31, PAS_D2_TEAMS, 17, PAS_D1_P1_TEAMS, "PAS D3")

print("\nPEC D3 (stage 35):")
setup_d3_roster(db, 35, 34, PEC_D2_TEAMS, 23, PEC_D1_P1_TEAMS, "PEC D3")

# ─────────────────────────────────────────────────────────────────────────────
# PASSO 2: Scan Twire para match UUIDs D3
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("PASSO 2: Scan Twire para match UUIDs D3")
print("="*60)

EP  = 'https://tjjkdyimqrb7jjnc6m5rpefjtu.appsync-api.eu-west-1.amazonaws.com/graphql'
KEY = 'da2-vqpq6wms5ndbvhl2r7kvzbpmfi'
TWIRE_HDR = {'Content-Type': 'application/json', 'x-api-key': KEY, 'Origin': 'https://twire.gg'}

def twire_match(twire_id):
    try:
        payload = {'query': '''
            query GetMatch($id: String!, $game: String!) {
              matchById(id: $id, game: $game) {
                id matchId tournamentName gameCreatedAt map
              }
            }
        ''', 'variables': {'id': str(twire_id), 'game': 'pubg'}}
        r = requests.post(EP, headers=TWIRE_HDR, json=payload, timeout=12)
        if r.status_code != 200:
            return None
        data = r.json()
        if not isinstance(data, dict):
            return None
        return (data.get('data') or {}).get('matchById')
    except Exception:
        return None

# Carrega todos os UUIDs já conhecidos (D1 + D2)
known_uuids = set(r[0] for r in db.execute(text(
    "SELECT pubg_match_id FROM match WHERE stage_day_id IN (31,32,33,35)"
)).fetchall())
print(f"  UUIDs D1+D2 já conhecidos: {len(known_uuids)}")

# Scan: D2 PAS foi ~1690280, D3 deve estar logo acima
SCAN_START = 1690350
SCAN_END   = 1690650
print(f"  Escaneando Twire IDs {SCAN_START}..{SCAN_END} ...")

pas_d3, pec_d3 = [], []

for tid in range(SCAN_START, SCAN_END + 1):
    m = twire_match(tid)
    if not m:
        continue
    uuid  = m.get('matchId') or ''
    name  = m.get('tournamentName') or ''
    date  = (m.get('gameCreatedAt') or '')[:10]
    if not uuid or ('Americas' not in name and 'EMEA' not in name):
        continue
    if uuid in known_uuids:
        continue  # D1 ou D2, pula

    region = 'PAS' if 'Americas' in name else 'PEC'
    print(f"  [NEW] {region} twire={tid} uuid={uuid} date={date}")
    entry = {'uuid': uuid, 'twire_id': tid, 'date': date}
    if region == 'PAS':
        pas_d3.append(entry)
    else:
        pec_d3.append(entry)

print(f"\n  PAS D3 encontrados: {len(pas_d3)}")
print(f"  PEC D3 encontrados: {len(pec_d3)}")

if not pas_d3 and not pec_d3:
    print("  WARN: nenhum match D3 encontrado no range. Pode precisar expandir o scan.")
    db.close()
    exit(0)

PAS_D3_MATCHES = [e['uuid'] for e in sorted(pas_d3, key=lambda x: (x['date'], x['twire_id']))]
PEC_D3_MATCHES = [e['uuid'] for e in sorted(pec_d3, key=lambda x: (x['date'], x['twire_id']))]

print(f"\n  PAS D3 UUIDs: {PAS_D3_MATCHES}")
print(f"  PEC D3 UUIDs: {PEC_D3_MATCHES}")

# ─────────────────────────────────────────────────────────────────────────────
# PASSO 3: Import D3 (initial pass)
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("PASSO 3: Import inicial D3")
print("="*60)

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

def fix_accounts(db, stage_id, match_ids, label):
    """Insere accounts faltantes via PUBG API, retorna lista de unmatched."""
    print(f"  Coletando participants {label} via PUBG API...")
    all_parts = {}
    for mid in match_ids:
        all_parts.update(get_match_participants(mid))
    print(f"  {len(all_parts)} participants únicos")

    # Lookup roster da stage
    lookup_rows = db.execute(text("""
        SELECT p.display_name, p.id as person_id,
               array_agg(DISTINCT pa.account_id) FILTER (WHERE pa.account_id IS NOT NULL) as known_accounts,
               array_agg(DISTINCT pa.alias)      FILTER (WHERE pa.alias      IS NOT NULL) as known_aliases
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
            alias_to_person[row.display_name.split('_',1)[1].lower()] = row.person_id

    inserted = 0
    unmatched = []
    for alias, account_id in all_parts.items():
        if account_id in account_to_person:
            continue
        alias_lower = alias.lower()
        alias_no_prefix = alias.split('_',1)[1].lower() if '_' in alias else alias_lower
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
        print(f"  Nao resolvidos ({len(unmatched)}): {sorted(set(unmatched))}")
    return sorted(set(unmatched))

if PAS_D3_MATCHES:
    print("\n  PAS D3 (stage 32, stage_day 34)...")
    r1 = import_stage_matches(db=db, stage_id=32, pubg_match_ids=PAS_D3_MATCHES, stage_day_id=34, force_reprocess=False)
    print(f"  imported={r1.get('imported',0)} unresolved={len(r1.get('unresolved_players',[]))}: {r1.get('unresolved_players',[])}")

    if r1.get('unresolved_players'):
        print("  Fix accounts PAS D3...")
        fix_accounts(db, 32, PAS_D3_MATCHES, "PAS D3")
        print("  Reimport PAS D3 force_reprocess=True...")
        r2 = import_stage_matches(db=db, stage_id=32, pubg_match_ids=PAS_D3_MATCHES, stage_day_id=34, force_reprocess=True)
        print(f"  reprocessed={r2.get('reprocessed',0)} unresolved={r2.get('unresolved_players',[])}")

if PEC_D3_MATCHES:
    print("\n  PEC D3 (stage 35, stage_day 36)...")
    r3 = import_stage_matches(db=db, stage_id=35, pubg_match_ids=PEC_D3_MATCHES, stage_day_id=36, force_reprocess=False)
    print(f"  imported={r3.get('imported',0)} unresolved={len(r3.get('unresolved_players',[]))}: {r3.get('unresolved_players',[])}")

    if r3.get('unresolved_players'):
        print("  Fix accounts PEC D3...")
        fix_accounts(db, 35, PEC_D3_MATCHES, "PEC D3")
        print("  Reimport PEC D3 force_reprocess=True...")
        r4 = import_stage_matches(db=db, stage_id=35, pubg_match_ids=PEC_D3_MATCHES, stage_day_id=36, force_reprocess=True)
        print(f"  reprocessed={r4.get('reprocessed',0)} unresolved={r4.get('unresolved_players',[])}")

# ─────────────────────────────────────────────────────────────────────────────
# PASSO 4: Rescore
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("PASSO 4: Rescorando D3")
print("="*60)

if PAS_D3_MATCHES:
    rescore_stage(db, 32)
    score_stage_day(db, 34)
    print("  PAS D3 rescored OK")

if PEC_D3_MATCHES:
    rescore_stage(db, 35)
    score_stage_day(db, 36)
    print("  PEC D3 rescored OK")

# ─────────────────────────────────────────────────────────────────────────────
# VERIFICACAO FINAL
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
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

# Roster summary
print()
for label, sid in [("PAS D3 roster", 32), ("PEC D3 roster", 35)]:
    rows = db.execute(text("""
        SELECT team_name, COUNT(*) players
        FROM roster WHERE stage_id=:sid
        GROUP BY team_name ORDER BY team_name
    """), {'sid': sid}).fetchall()
    total = sum(r.players for r in rows)
    print(f"  {label}: {len(rows)} times, {total} jogadores")
    for r in rows:
        print(f"    {r.team_name}: {r.players}p")

db.close()
print("\nDone.")
