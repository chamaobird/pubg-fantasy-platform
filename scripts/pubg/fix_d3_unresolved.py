"""
Fix todos os jogadores não resolvidos do D3 (PAS stage 32, PEC stage 35).

Diagnóstico executado em 04/05/2026:

PAS D3 (stage 32, stage_day 34):
  - CLR_MIKSUU-  (316)    -> account ja existe, mas NAO esta no roster 32 -> add roster
  - INJ_Plushie  (317)    -> account ja existe, mas NAO esta no roster 32 -> add roster
  - M4UR1L1O     (171)    -> NO roster 32, mas falta account D3 (FN_M4URILIO1) -> insert account
  - DOTS_itsZeiko (NEW)   -> nova person, add roster 32, insert account
  - AKA_L1P7      (NEW)   -> nova person, add roster 32, insert account
  - ONE_balkeraaXL (NEW)  -> nova person, add roster 32, insert account
  - ONE_demonfrost (NEW)  -> nova person, add roster 32, insert account
  - NVM_LOST       (NEW)  -> nova person, add roster 32, insert account

PEC D3 (stage 35, stage_day 36):
  - GTG_anybodezz (319)  -> account ja existe, mas NAO esta no roster 35 -> add roster
  - STS_N1tro     (322)  -> account ja existe, mas NAO esta no roster 35 -> add roster

Fluxo:
  1. Adicionar ao roster os que faltam
  2. Criar persons novos + adicionar ao roster + inserir account
  3. Inserir account para M4UR1L1O (account D3 diferente do D2)
  4. Reimportar stages 32 e 35 com force_reprocess=True
  5. Rescorar stages 32 e 35
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from dotenv import load_dotenv; load_dotenv(ROOT / ".env")

from app.database import SessionLocal
from app.services.import_ import import_stage_matches
from app.services.lineup_scoring import rescore_stage, score_stage_day
from sqlalchemy import text

db = SessionLocal()

PAS_D3_MATCHES = [
    'b5db9bb5-f626-41ad-b77e-9c7817a784ab',
    '709e03eb-8399-4acf-9f95-9caa3a9dfbfc',
    'e2a85b84-786f-4898-b62b-b5a4575a4589',
    '27525cff-dabb-41e9-8354-f36ccd501147',
    'c9b1e414-9094-48f5-8a12-4deff9d2e42c',
]
PEC_D3_MATCHES = [
    '61c3c73f-e1b9-45b9-a933-64945b0b06c4',
    'f20200f3-bfc3-4040-88d3-2822853e64bd',
    '8af60cc9-d712-47bc-979f-726aa24e1e32',
    '4dfed86c-04f0-484c-8692-dcb63e11b42c',
    '5d8f24b6-5941-4c74-89b6-f475d1e29d71',
]

# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def get_or_create_person(db, display_name):
    pid = db.execute(text(
        "SELECT id FROM person WHERE display_name=:name"
    ), {'name': display_name}).scalar()
    if pid:
        print(f"  Person ja existe: {display_name} (id={pid})")
        return pid
    db.execute(text(
        "INSERT INTO person (display_name, is_active) VALUES (:name, true)"
    ), {'name': display_name})
    db.flush()
    pid = db.execute(text(
        "SELECT id FROM person WHERE display_name=:name"
    ), {'name': display_name}).scalar()
    print(f"  Criado person: {display_name} (id={pid})")
    return pid

def ensure_roster(db, stage_id, person_id, team_name, display_name, default_cost=15):
    existing = db.execute(text(
        "SELECT id, fantasy_cost FROM roster WHERE stage_id=:sid AND person_id=:pid"
    ), {'sid': stage_id, 'pid': person_id}).fetchone()
    if existing:
        print(f"  {display_name} ja no roster {stage_id} (id={existing.id}, cost={existing.fantasy_cost})")
        return False
    # Busca custo do roster mais recente do jogador
    prev_cost = db.execute(text("""
        SELECT fantasy_cost FROM roster
        WHERE person_id=:pid AND fantasy_cost IS NOT NULL
        ORDER BY stage_id DESC LIMIT 1
    """), {'pid': person_id}).scalar()
    cost = prev_cost or default_cost
    db.execute(text("""
        INSERT INTO roster (stage_id, person_id, team_name, fantasy_cost)
        VALUES (:sid, :pid, :team, :cost)
    """), {'sid': stage_id, 'pid': person_id, 'team': team_name, 'cost': cost})
    print(f"  Adicionado {display_name} (pid={person_id}) ao roster {stage_id} team={team_name} cost={cost}")
    return True

def insert_account(db, person_id, account_id, alias, label):
    existing = db.execute(text(
        "SELECT id FROM player_account WHERE person_id=:pid AND account_id=:aid"
    ), {'pid': person_id, 'aid': account_id}).fetchone()
    if existing:
        print(f"  {label}: account ja existe (id={existing.id})")
        return False
    db.execute(text("""
        INSERT INTO player_account (person_id, account_id, shard, alias)
        VALUES (:pid, :aid, 'pc-tournament', :alias)
        ON CONFLICT DO NOTHING
    """), {'pid': person_id, 'aid': account_id, 'alias': alias})
    print(f"  {label} (pid={person_id}): inserido account {account_id[:30]}...")
    return True

# ─────────────────────────────────────────────────────────────────────────────
# PASSO 1: Adicionar ao roster 32 — CLR_MIKSUU-(316) e INJ_Plushie(317)
# ─────────────────────────────────────────────────────────────────────────────
print("="*60)
print("PASSO 1: Add ao roster 32 — jogadores sem roster mas com account")
print("="*60)

ensure_roster(db, 32, 316, 'Collector', 'CLR_MIKSUU-')
ensure_roster(db, 32, 317, 'Injected',  'INJ_Plushiee')
db.commit()

# ─────────────────────────────────────────────────────────────────────────────
# PASSO 2: Adicionar ao roster 35 — GTG_anybodezz(319) e STS_N1tro(322)
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("PASSO 2: Add ao roster 35 — jogadores sem roster mas com account")
print("="*60)

ensure_roster(db, 35, 319, 'Ghetto Gang', 'GTG_anybodezz')
ensure_roster(db, 35, 322, 'Starry SKY',  'STS_N1tro')
db.commit()

# ─────────────────────────────────────────────────────────────────────────────
# PASSO 3: Inserir account D3 para M4UR1L1O (171) — alias mudou para FN_M4URILIO1
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("PASSO 3: Insert account D3 para M4UR1L1O (pid=171)")
print("="*60)

insert_account(db, 171,
    'account.a775ef254f414f6c9dca31b1fc61144e',
    'FN_M4URILIO1',
    'M4UR1L1O/FN_M4URILIO1')
db.commit()

# ─────────────────────────────────────────────────────────────────────────────
# PASSO 4: Criar persons novos + roster 32 + accounts
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("PASSO 4: Criar persons novos para PAS D3")
print("="*60)

NEW_PAS = [
    {
        'display_name': 'DOTS_itsZeiko',
        'team': 'DOTS',
        'account_id': 'account.18f98f9877d0435e869c98c974d41bd2',
        'alias': 'DOTS_itsZeiko',
    },
    {
        'display_name': 'AKA_L1P7',
        'team': 'Also known as',
        'account_id': 'account.3230545100bc4ac29fbc279d0dfd9de9',
        'alias': 'AKA_L1P7',
    },
    {
        'display_name': 'ONE_balkeraaXL',
        'team': 'Dream One',
        'account_id': 'account.3beff29b8975407bb76965cf9695b9a0',
        'alias': 'ONE_balkeraaXL',
    },
    {
        'display_name': 'ONE_demonfrost',
        'team': 'Dream One',
        'account_id': 'account.4476e0ad8d0340e28ed5d9cd1cd87341',
        'alias': 'ONE_demonfrost',
    },
    {
        'display_name': 'NVM_LOST',
        'team': 'NEVERMIND',
        'account_id': 'account.ee451e54887b4a38af57a01a8459bd2b',
        'alias': 'NVM_LOST',
    },
]

for p in NEW_PAS:
    print(f"\n  {p['display_name']}:")
    pid = get_or_create_person(db, p['display_name'])
    db.flush()
    ensure_roster(db, 32, pid, p['team'], p['display_name'])
    insert_account(db, pid, p['account_id'], p['alias'], p['display_name'])

db.commit()
print("\n  Commit OK")

# ─────────────────────────────────────────────────────────────────────────────
# PASSO 5: Reimportar D3 com force_reprocess=True
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("PASSO 5: Reimportando D3 (force_reprocess=True)")
print("="*60)

print("\n  PAS D3 (stage 32, stage_day 34)...")
r_pas = import_stage_matches(
    db=db, stage_id=32,
    pubg_match_ids=PAS_D3_MATCHES,
    stage_day_id=34,
    force_reprocess=True,
)
unres_pas = r_pas.get('unresolved_players', [])
print(f"  reprocessed={r_pas.get('reprocessed',0)} unresolved={unres_pas}")

print("\n  PEC D3 (stage 35, stage_day 36)...")
r_pec = import_stage_matches(
    db=db, stage_id=35,
    pubg_match_ids=PEC_D3_MATCHES,
    stage_day_id=36,
    force_reprocess=True,
)
unres_pec = r_pec.get('unresolved_players', [])
print(f"  reprocessed={r_pec.get('reprocessed',0)} unresolved={unres_pec}")

# ─────────────────────────────────────────────────────────────────────────────
# PASSO 6: Rescore
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("PASSO 6: Rescorando stages 32 e 35")
print("="*60)

rescore_stage(db, 32)
score_stage_day(db, 34)
print("  PAS D3 rescored OK")

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
               SUM(CASE WHEN person_id IS NULL     THEN 1 ELSE 0 END) unresolved,
               COUNT(DISTINCT match_id) matches
        FROM match_stat
        WHERE match_id IN (SELECT id FROM match WHERE stage_day_id=:sdid)
    """), {'sdid': sdid}).fetchone()
    if r.matches:
        per_match = r.total // r.matches
        print(f"  {label}: {r.matches} matches | {r.total} stats ({per_match}/match) | resolved={r.resolved} unresolved={r.unresolved}")
    else:
        print(f"  {label}: 0 matches importados!")

print()
for label, sid, sdid in [("PAS D3", 32, 34), ("PEC D3", 35, 36)]:
    rows = db.execute(text("""
        SELECT r.team_name,
               COUNT(DISTINCT r.person_id) as roster_size,
               COUNT(DISTINCT ms.person_id) as persons_with_stats
        FROM roster r
        JOIN stage_day sd ON sd.stage_id = r.stage_id
        LEFT JOIN match m ON m.stage_day_id = sd.id
        LEFT JOIN match_stat ms ON ms.match_id = m.id AND ms.person_id = r.person_id
        WHERE r.stage_id=:sid AND sd.id=:sdid
        GROUP BY r.team_name
        ORDER BY r.team_name
    """), {'sid': sid, 'sdid': sdid}).fetchall()
    print(f"  {label} por time:")
    for r in rows:
        missing = r.roster_size - r.persons_with_stats
        flag = " <-- AINDA FALTAM" if missing > 0 else ""
        print(f"    {r.team_name:25s} roster={r.roster_size} com_stats={r.persons_with_stats}{flag}")

db.close()
print("\nDone.")
