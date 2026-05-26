"""
Busca os match UUIDs do Dia 2 das Playoffs 2 (PAS e PEC).
Tenta PUBG API primeiro; se vazia, usa Twire AppSync.
"""
import sys, os, requests, json
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from dotenv import load_dotenv; load_dotenv(ROOT / ".env")

PUBG_KEY = os.environ.get('PUBG_API_KEY', '')
PUBG_HDR = {'Authorization': f'Bearer {PUBG_KEY}', 'Accept': 'application/vnd.api+json'}

# ── PUBG API ──────────────────────────────────────────────────────────────
def get_tournament_matches(tournament_id):
    url = f'https://api.pubg.com/tournaments/{tournament_id}'
    r = requests.get(url, headers=PUBG_HDR, timeout=15)
    if r.status_code != 200:
        return []
    data = r.json()
    matches = data.get('data', {}).get('relationships', {}).get('matches', {}).get('data', [])
    return [m['id'] for m in matches]

def get_match_date(match_id):
    url = f'https://api.pubg.com/shards/pc-tournament/matches/{match_id}'
    r = requests.get(url, headers=PUBG_HDR, timeout=15)
    if r.status_code != 200:
        return None
    return r.json().get('data', {}).get('attributes', {}).get('createdAt', '')

# ── Twire AppSync ─────────────────────────────────────────────────────────
EP  = 'https://tjjkdyimqrb7jjnc6m5rpefjtu.appsync-api.eu-west-1.amazonaws.com/graphql'
KEY = 'da2-vqpq6wms5ndbvhl2r7kvzbpmfi'
HDR = {'Content-Type': 'application/json', 'x-api-key': KEY, 'Origin': 'https://twire.gg'}

def twire_match(twire_id):
    payload = {'query': '''
        query GetMatch($id: String!, $game: String!) {
          matchById(id: $id, game: $game) {
            id matchId tournamentName startDate map
          }
        }
    ''', 'variables': {'id': str(twire_id), 'game': 'pubg'}}
    r = requests.post(EP, headers=HDR, json=payload, timeout=15)
    if r.status_code != 200:
        return None
    return r.json().get('data', {}).get('matchById')

# ── D1 matches já conhecidos (para referência de datas) ──────────────────
D1_PAS = [1690130, 1690131, 1690134, 1690139, 1690142]  # Twire IDs D1 PAS
# D1 PEC IDs precisamos descobrir — vamos escanear pela data

# ── Tenta PUBG API ────────────────────────────────────────────────────────
print("=== Tentando PUBG API ===")
for tid in ['am-pas126', 'am-pas226', 'eu-pecs26', 'eu-pecs226']:
    matches = get_tournament_matches(tid)
    print(f"  {tid}: {len(matches)} matches")
    if matches:
        # Pega datas dos últimos 10
        recent = matches[:15]
        dated = []
        for mid in recent:
            d = get_match_date(mid)
            if d:
                dated.append((d, mid))
        dated.sort(reverse=True)
        for d, mid in dated[:10]:
            print(f"    {d[:10]}  {mid}")

# ── Twire scan para D2 ────────────────────────────────────────────────────
# D1 PAS: IDs 1690130–1690142 (5 matches)
# D2 provavelmente sequencial, vamos escanear 1690143 em diante
print()
print("=== Twire scan para D2 (após D1 IDs) ===")
# Escaneia IDs próximos ao range do D1
# D1 PAS terminou em ~1690142, D1 PEC provavelmente próximo
# Vamos escanear 1690143 a 1690320 buscando PAS/PEC Playoffs 2 D2

PAS_D2 = []
PEC_D2 = []
PAS_D1_KNOWN = set()  # para excluir D1
PEC_D1_KNOWN = set()

# Carrega D1 já conhecidos do banco
from app.database import SessionLocal
from sqlalchemy import text
db = SessionLocal()
pas_d1_uuids = [r[0] for r in db.execute(text(
    "SELECT pubg_match_id FROM match WHERE stage_day_id=31")).fetchall()]
pec_d1_uuids = [r[0] for r in db.execute(text(
    "SELECT pubg_match_id FROM match WHERE stage_day_id=32")).fetchall()]
db.close()
print(f"  D1 PAS UUIDs conhecidos: {len(pas_d1_uuids)}")
print(f"  D1 PEC UUIDs conhecidos: {len(pec_d1_uuids)}")
all_known_uuids = set(pas_d1_uuids + pec_d1_uuids)

# Scan sequencial
SCAN_START = 1690100
SCAN_END   = 1690400

print(f"\n  Escaneando Twire IDs {SCAN_START}..{SCAN_END} ...")
found = []
for twire_id in range(SCAN_START, SCAN_END + 1):
    m = twire_match(twire_id)
    if not m:
        continue
    uuid = m.get('matchId', '')
    name = m.get('tournamentName', '')
    date = m.get('startDate', '')
    if not uuid:
        continue
    # Só queremos PAS e PEC Playoffs 2
    if 'Americas' not in name and 'EMEA' not in name:
        continue
    found.append({
        'twire_id': twire_id,
        'uuid': uuid,
        'tournament': name,
        'date': date,
        'is_d1': uuid in all_known_uuids,
    })
    day = date[:10] if date else '?'
    marker = '[D1]' if uuid in all_known_uuids else '[NEW]'
    print(f"  {marker} twire={twire_id} uuid={uuid[:8]}.. {day} | {name[:40]}")

print(f"\n  Total encontrado: {len(found)}")
new_matches = [f for f in found if not f['is_d1']]
print(f"  Novos (nao D1): {len(new_matches)}")

# Agrupa por torneio e data
pas_new = [f for f in new_matches if 'Americas' in f['tournament']]
pec_new = [f for f in new_matches if 'EMEA' in f['tournament']]

print(f"\nPAS novos ({len(pas_new)}):")
for f in sorted(pas_new, key=lambda x: x['date']):
    print(f"  twire={f['twire_id']} uuid={f['uuid']} date={f['date'][:10]}")

print(f"\nPEC novos ({len(pec_new)}):")
for f in sorted(pec_new, key=lambda x: x['date']):
    print(f"  twire={f['twire_id']} uuid={f['uuid']} date={f['date'][:10]}")
