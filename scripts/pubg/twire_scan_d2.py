"""
Scan Twire para encontrar match UUIDs do D2 da Playoffs 2 (PAS e PEC).
D1 PAS: twire IDs 1690130-1690142. D2 deve estar logo acima.
"""
import sys, requests
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from dotenv import load_dotenv; load_dotenv(ROOT / ".env")

EP  = 'https://tjjkdyimqrb7jjnc6m5rpefjtu.appsync-api.eu-west-1.amazonaws.com/graphql'
KEY = 'da2-vqpq6wms5ndbvhl2r7kvzbpmfi'
HDR = {'Content-Type': 'application/json', 'x-api-key': KEY, 'Origin': 'https://twire.gg'}

def twire_match(twire_id):
    try:
        payload = {'query': '''
            query GetMatch($id: String!, $game: String!) {
              matchById(id: $id, game: $game) {
                id matchId tournamentName startDate map
              }
            }
        ''', 'variables': {'id': str(twire_id), 'game': 'pubg'}}
        r = requests.post(EP, headers=HDR, json=payload, timeout=12)
        if r.status_code != 200:
            return None
        data = r.json()
        if not isinstance(data, dict):
            return None
        return (data.get('data') or {}).get('matchById')
    except Exception:
        return None

# D1 UUIDs para filtrar
from app.database import SessionLocal
from sqlalchemy import text
db = SessionLocal()
d1_uuids = set(r[0] for r in db.execute(text(
    "SELECT pubg_match_id FROM match WHERE stage_day_id IN (31,32)"
)).fetchall())
db.close()
print(f"D1 UUIDs conhecidos: {len(d1_uuids)}")

# Scan 1690100..1690450
SCAN_START = 1690100
SCAN_END   = 1690450

print(f"Escaneando {SCAN_START}..{SCAN_END}...\n")

pas_d1, pas_d2, pas_d3 = [], [], []
pec_d1, pec_d2, pec_d3 = [], [], []

for tid in range(SCAN_START, SCAN_END + 1):
    m = twire_match(tid)
    if not m:
        continue
    uuid = m.get('matchId') or ''
    name = m.get('tournamentName') or ''
    date = (m.get('startDate') or '')[:10]
    if not uuid or ('Americas' not in name and 'EMEA' not in name):
        continue

    is_d1 = uuid in d1_uuids
    marker = 'D1' if is_d1 else 'NEW'
    region = 'PAS' if 'Americas' in name else 'PEC'
    print(f"  [{marker}] {region} twire={tid} uuid={uuid} date={date}")

    entry = {'twire_id': tid, 'uuid': uuid, 'date': date, 'region': region}
    if region == 'PAS':
        if is_d1: pas_d1.append(entry)
        else:
            if date == '2026-05-02':  pas_d2.append(entry)
            elif date == '2026-05-03': pas_d3.append(entry)
            else: pas_d2.append(entry)  # data desconhecida → tratar como d2
    else:
        if is_d1: pec_d1.append(entry)
        else:
            if date == '2026-05-02': pec_d2.append(entry)
            elif date == '2026-05-03': pec_d3.append(entry)
            else: pec_d2.append(entry)

print(f"\n{'='*55}")
print(f"PAS D1 confirmado: {len(pas_d1)} | D2 novo: {len(pas_d2)} | D3 novo: {len(pas_d3)}")
print(f"PEC D1 confirmado: {len(pec_d1)} | D2 novo: {len(pec_d2)} | D3 novo: {len(pec_d3)}")

for label, lst in [("PAS D2", pas_d2), ("PAS D3", pas_d3), ("PEC D2", pec_d2), ("PEC D3", pec_d3)]:
    if lst:
        print(f"\n{label} UUIDs:")
        for e in sorted(lst, key=lambda x: x['date']):
            print(f"  '{e['uuid']}',  # twire={e['twire_id']} {e['date']}")
