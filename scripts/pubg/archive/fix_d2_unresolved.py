"""
Fix todos os jogadores não resolvidos do D2 (PAS stage 31, PEC stage 34):

PAS D2 (stage 31):
  - WIT_marcis (315)         → não estava no roster 31, criar entrada
  - CLR_MIKSUU- (316)        → alias mudou de MIKSUU para MIKSUU-
  - INJ_Plushie (317)        → alias mudou de Plushiee para Plushie
  - INSK_piiero (NEW)        → extra, criar person + roster
  - TMP_bb1ng-_- (NEW)       → extra, criar person + roster

PEC D2 (stage 34):
  - BAL_caydel (274)         → alias mudou de caydel- para caydel
  - GTG_anybodezz (319)      → conta D2 não inserida
  - STS_Momme (321)          → conta D2 não inserida
  - STS_N1tro (322)          → conta D2 não inserida
  - HOWL_Nailqop13 (320)     → não estava no roster 34, criar entrada

Fluxo:
  1. Busca account IDs dos matches D2 via PUBG API
  2. Cria persons novos (piiero, bb1ng-_-)
  3. Adiciona entradas de roster onde faltando
  4. Insere player_account para todas as aliases D2
  5. Reimporta D2 com force_reprocess=True
  6. Rescora stages 31 e 34
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

PAS_D2_MATCHES = [
    '95a94701-c0bd-4b8c-8464-bec64b9b509b',
    '0061efa2-27fa-45c5-ba4a-46744c985125',
    'd49b1136-f0aa-453a-8b82-310a19bce0e6',
    'e6197312-ece1-401f-bc77-3d3ca99c276e',
    '9149770d-e6d4-4fd3-a782-08bf8c1d5b81',
]
PEC_D2_MATCHES = [
    '7d83cb6c-77d0-4f7e-ba52-aa27d9e5147c',
    'c2aff09e-f1a0-40e9-b61c-02a1be5fb45a',
    'cacaffea-0fef-4e33-b8dc-6ec048ce8362',
    '9e92d8dc-8d24-4f08-b23f-d3e6f6a39ca2',
    '09a4db62-a181-4c71-b790-9aaf6c59df39',
]

def get_match_participants(match_id):
    """Retorna dict alias -> account_id para um match."""
    url = f'https://api.pubg.com/shards/pc-tournament/matches/{match_id}'
    r = requests.get(url, headers=PUBG_HDR, timeout=20)
    if r.status_code != 200:
        print(f"  WARN: match {match_id} retornou {r.status_code}")
        return {}
    result = {}
    for item in r.json().get('included', []):
        if item.get('type') == 'participant':
            stats = item.get('attributes', {}).get('stats', {})
            aid   = stats.get('playerId', '')
            alias = stats.get('name', '')
            if aid and alias:
                result[alias] = aid
    return result

def collect_all_participants(match_ids, label):
    """Coleta todos os participants dos matches, retorna alias -> account_id."""
    print(f"\n  Coletando participants {label} via PUBG API...")
    all_parts = {}
    for mid in match_ids:
        parts = get_match_participants(mid)
        all_parts.update(parts)
    print(f"  {len(all_parts)} participants únicos")
    return all_parts

db = SessionLocal()

# ─────────────────────────────────────────────────────────────────────────────
# PASSO 1: Coleta todos os participants do D2
# ─────────────────────────────────────────────────────────────────────────────
print("="*60)
print("PASSO 1: Coletando participants D2 via PUBG API")
print("="*60)

pas_parts = collect_all_participants(PAS_D2_MATCHES, "PAS D2")
pec_parts = collect_all_participants(PEC_D2_MATCHES, "PEC D2")

def find_account(parts, *possible_aliases):
    """Procura account_id por múltiplas aliases possíveis."""
    for alias in possible_aliases:
        if alias in parts:
            return alias, parts[alias]
    return None, None

# ─────────────────────────────────────────────────────────────────────────────
# PASSO 2: Cria persons novos — INSK_piiero e TMP_bb1ng-_-
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("PASSO 2: Criando persons novos (extras D2)")
print("="*60)

# INSK_piiero — Chupinskys
alias_piiero, account_piiero = find_account(pas_parts, 'INSK_piiero', 'piiero')
print(f"\n  INSK_piiero: alias={alias_piiero} account={account_piiero}")

piiero_pid = db.execute(text(
    "SELECT id FROM person WHERE display_name='INSK_piiero'"
)).scalar()
if not piiero_pid:
    db.execute(text("""
        INSERT INTO person (display_name, is_active)
        VALUES ('INSK_piiero', true)
    """))
    db.flush()
    piiero_pid = db.execute(text(
        "SELECT id FROM person WHERE display_name='INSK_piiero'"
    )).scalar()
    print(f"  Criado person INSK_piiero id={piiero_pid}")
else:
    print(f"  INSK_piiero já existe id={piiero_pid}")

# TMP_bb1ng-_- — Tempest
alias_bb1ng, account_bb1ng = find_account(pas_parts, 'TMP_bb1ng-_-', 'bb1ng-_-', 'bb1ng')
print(f"\n  TMP_bb1ng-_-: alias={alias_bb1ng} account={account_bb1ng}")

bb1ng_pid = db.execute(text(
    "SELECT id FROM person WHERE display_name='TMP_bb1ng-_-'"
)).scalar()
if not bb1ng_pid:
    db.execute(text("""
        INSERT INTO person (display_name, is_active)
        VALUES ('TMP_bb1ng-_-', true)
    """))
    db.flush()
    bb1ng_pid = db.execute(text(
        "SELECT id FROM person WHERE display_name='TMP_bb1ng-_-'"
    )).scalar()
    print(f"  Criado person TMP_bb1ng-_- id={bb1ng_pid}")
else:
    print(f"  TMP_bb1ng-_- já existe id={bb1ng_pid}")

db.commit()

# ─────────────────────────────────────────────────────────────────────────────
# PASSO 3: Adiciona roster entries onde faltando
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("PASSO 3: Adicionando roster entries faltantes")
print("="*60)

def ensure_roster(db, stage_id, person_id, team_name, display_name):
    """Adiciona pessoa ao roster da stage se não existir."""
    existing = db.execute(text(
        "SELECT id FROM roster WHERE stage_id=:sid AND person_id=:pid"
    ), {'sid': stage_id, 'pid': person_id}).scalar()
    if existing:
        print(f"  {display_name} já está no roster {stage_id} (id={existing})")
        return False

    # Descobre fantasy_cost do roster anterior (stage mais recente com esse player)
    prev_cost = db.execute(text("""
        SELECT fantasy_cost FROM roster
        WHERE person_id=:pid AND fantasy_cost IS NOT NULL
        ORDER BY stage_id DESC LIMIT 1
    """), {'pid': person_id}).scalar()
    cost = prev_cost or 15  # newcomer default

    db.execute(text("""
        INSERT INTO roster (stage_id, person_id, team_name, fantasy_cost)
        VALUES (:sid, :pid, :team, :cost)
    """), {'sid': stage_id, 'pid': person_id, 'team': team_name, 'cost': cost})
    print(f"  Adicionado {display_name} (pid={person_id}) ao roster {stage_id} team={team_name} cost={cost}")
    return True

# WIT_marcis (315) → stage 31
ensure_roster(db, 31, 315, 'What It Takes', 'WIT_marcis')

# INSK_piiero (new) → stage 31
ensure_roster(db, 31, piiero_pid, 'Chupinskys', 'INSK_piiero')

# TMP_bb1ng-_- (new) → stage 31
ensure_roster(db, 31, bb1ng_pid, 'Tempest', 'TMP_bb1ng-_-')

# HOWL_Nailqop13 (320) → stage 34
ensure_roster(db, 34, 320, 'exhowl', 'HOWL_Nailqop13')

db.commit()

# ─────────────────────────────────────────────────────────────────────────────
# PASSO 4: Insere player_account para todos os unresolved
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("PASSO 4: Inserindo player_account D2")
print("="*60)

def insert_account(db, person_id, account_id, alias, label):
    if not account_id:
        print(f"  SKIP {label}: account_id não encontrado na API")
        return False
    db.execute(text("""
        INSERT INTO player_account (person_id, account_id, shard, alias)
        VALUES (:pid, :aid, 'pc-tournament', :alias)
        ON CONFLICT DO NOTHING
    """), {'pid': person_id, 'aid': account_id, 'alias': alias})
    print(f"  Inserido {label} (pid={person_id}) account={account_id[:20]}...")
    return True

# ── PAS D2 unresolved ──────────────────────────────────────────────────────

# WIT_marcis (315) — pode estar com alias diferente no D2
alias_marcis, acc_marcis = find_account(pas_parts, 'WIT_marcis', 'marcis')
print(f"\n  WIT_marcis: alias={alias_marcis} account={acc_marcis}")
insert_account(db, 315, acc_marcis, alias_marcis or 'WIT_marcis', 'WIT_marcis')

# CLR_MIKSUU- (316)
alias_mik, acc_mik = find_account(pas_parts, 'CLR_MIKSUU-', 'CLR_MIKSUU', 'MIKSUU-', 'MIKSUU')
print(f"\n  CLR_MIKSUU-: alias={alias_mik} account={acc_mik}")
insert_account(db, 316, acc_mik, alias_mik or 'CLR_MIKSUU-', 'CLR_MIKSUU-')

# INJ_Plushie (317)
alias_plush, acc_plush = find_account(pas_parts, 'INJ_Plushie', 'INJ_Plushiee', 'Plushie', 'Plushiee')
print(f"\n  INJ_Plushie: alias={alias_plush} account={acc_plush}")
insert_account(db, 317, acc_plush, alias_plush or 'INJ_Plushie', 'INJ_Plushie')

# INSK_piiero (new)
print(f"\n  INSK_piiero (new): alias={alias_piiero} account={account_piiero}")
insert_account(db, piiero_pid, account_piiero, alias_piiero or 'INSK_piiero', 'INSK_piiero')

# TMP_bb1ng-_- (new)
print(f"\n  TMP_bb1ng-_- (new): alias={alias_bb1ng} account={account_bb1ng}")
insert_account(db, bb1ng_pid, account_bb1ng, alias_bb1ng or 'TMP_bb1ng-_-', 'TMP_bb1ng-_-')

# ── PEC D2 unresolved ──────────────────────────────────────────────────────

# BAL_caydel (274)
alias_cay, acc_cay = find_account(pec_parts, 'BAL_caydel', 'BAL_caydel-', 'caydel', 'caydel-')
print(f"\n  BAL_caydel: alias={alias_cay} account={acc_cay}")
insert_account(db, 274, acc_cay, alias_cay or 'BAL_caydel', 'BAL_caydel')

# GTG_anybodezz (319)
alias_any, acc_any = find_account(pec_parts, 'GTG_anybodezz', 'anybodezz')
print(f"\n  GTG_anybodezz: alias={alias_any} account={acc_any}")
insert_account(db, 319, acc_any, alias_any or 'GTG_anybodezz', 'GTG_anybodezz')

# STS_Momme (321)
alias_mom, acc_mom = find_account(pec_parts, 'STS_Momme', 'Momme')
print(f"\n  STS_Momme: alias={alias_mom} account={acc_mom}")
insert_account(db, 321, acc_mom, alias_mom or 'STS_Momme', 'STS_Momme')

# STS_N1tro (322)
alias_n1t, acc_n1t = find_account(pec_parts, 'STS_N1tro', 'N1tro')
print(f"\n  STS_N1tro: alias={alias_n1t} account={acc_n1t}")
insert_account(db, 322, acc_n1t, alias_n1t or 'STS_N1tro', 'STS_N1tro')

# HOWL_Nailqop13 (320)
alias_nail, acc_nail = find_account(pec_parts, 'HOWL_Nailqop13', 'Nailqop13')
print(f"\n  HOWL_Nailqop13: alias={alias_nail} account={acc_nail}")
insert_account(db, 320, acc_nail, alias_nail or 'HOWL_Nailqop13', 'HOWL_Nailqop13')

db.commit()
print("\n  Commit OK")

# ─────────────────────────────────────────────────────────────────────────────
# PASSO 5: Reimport D2 force_reprocess=True
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("PASSO 5: Reimportando D2 (force_reprocess=True)")
print("="*60)

print("\n  PAS D2 (stage 31, stage_day 33)...")
r_pas = import_stage_matches(
    db=db, stage_id=31,
    pubg_match_ids=PAS_D2_MATCHES,
    stage_day_id=33,
    force_reprocess=True,
)
print(f"  reprocessed={r_pas.get('reprocessed',0)} unresolved={r_pas.get('unresolved_players',[])}")

print("\n  PEC D2 (stage 34, stage_day 35)...")
r_pec = import_stage_matches(
    db=db, stage_id=34,
    pubg_match_ids=PEC_D2_MATCHES,
    stage_day_id=35,
    force_reprocess=True,
)
print(f"  reprocessed={r_pec.get('reprocessed',0)} unresolved={r_pec.get('unresolved_players',[])}")

# ─────────────────────────────────────────────────────────────────────────────
# PASSO 6: Rescore
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("PASSO 6: Rescorando")
print("="*60)

rescore_stage(db, 31)
score_stage_day(db, 33)
print("  PAS D2 rescored OK")

rescore_stage(db, 34)
score_stage_day(db, 35)
print("  PEC D2 rescored OK")

# ─────────────────────────────────────────────────────────────────────────────
# VERIFICACAO FINAL
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("VERIFICACAO FINAL")
print("="*60)

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
        per_match = r.total // r.matches if r.matches else 0
        print(f"  {label}: {r.matches} matches | {r.total} stats ({per_match}/match) | resolved={r.resolved} unresolved={r.unresolved}")
    else:
        print(f"  {label}: 0 matches!")

# Lista unresolved restantes
for label, sdid in [("PAS D2", 33), ("PEC D2", 35)]:
    unres = db.execute(text("""
        SELECT DISTINCT ms.alias_used
        FROM match_stat ms
        WHERE ms.person_id IS NULL
          AND ms.match_id IN (SELECT id FROM match WHERE stage_day_id=:sdid)
        ORDER BY ms.alias_used
    """), {'sdid': sdid}).fetchall()
    if unres:
        names = [r[0] for r in unres]
        print(f"  {label} ainda unresolved: {names}")
    else:
        print(f"  {label}: todos resolvidos!")

db.close()
print("\nDone.")
