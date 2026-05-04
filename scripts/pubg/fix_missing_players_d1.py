"""
Resolve os 3+1 jogadores não vinculados no D1:
  - BST_FROGMAN7 → person_id=119 (FROGMAN1, alias trocou para FROGMAN7)
  - WIT_marcis    → person_id=315 (jogador extra que jogou PAS Playoffs 1 D2/D3)
  - HOWL_Nailqop13 → person_id=320 (jogador extra que jogou PEC Playoffs 1 D3)
  - LxB_Rxberrtt  → skip (extra não registrado)

Passos:
  1. Verifica/adiciona player_account com os novos account_ids
  2. Verifica/adiciona ao roster das stages D1
  3. Reimporta D1 com force_reprocess=True
  4. Rescora stages e stage_days
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

# Account IDs identificados na sessão anterior (do scan dos matches D1)
PLAYERS = [
    {
        'person_id': 119,
        'display_name': 'FROGMAN1',
        'new_alias': 'BST_FROGMAN7',
        'account_id': 'account.c19ac30cdebc444f9c6908e4e305923a',
        'stage_ids': [30],          # PAS D1
        'tournament': 'PAS',
    },
    {
        'person_id': 315,
        'display_name': 'WIT_marcis',
        'new_alias': 'WIT_marcis',
        'account_id': 'account.3d3323e445eb4454a6eee53a4d155d46',
        'stage_ids': [30],          # PAS D1
        'tournament': 'PAS',
    },
    {
        'person_id': 320,
        'display_name': 'Nailqop13',
        'new_alias': 'HOWL_Nailqop13',
        'account_id': 'account.f3ca4f15ff4149ee8aa717dc76b0d574',
        'stage_ids': [33],          # PEC D1
        'tournament': 'PEC',
    },
]

print("=" * 60)
print("PASSO 1: Inserindo player_accounts")
print("=" * 60)

for p in PLAYERS:
    existing = db.execute(text(
        "SELECT id FROM player_account WHERE person_id=:pid AND account_id=:aid"
    ), {'pid': p['person_id'], 'aid': p['account_id']}).fetchone()

    if existing:
        print(f"  {p['display_name']}: account já existe (id={existing.id})")
    else:
        db.execute(text("""
            INSERT INTO player_account (person_id, account_id, shard, alias)
            VALUES (:pid, :aid, 'pc-tournament', :alias)
            ON CONFLICT DO NOTHING
        """), {'pid': p['person_id'], 'aid': p['account_id'], 'alias': p['new_alias']})
        print(f"  {p['display_name']}: inserido account {p['account_id']} alias={p['new_alias']}")

db.commit()

print()
print("=" * 60)
print("PASSO 2: Verificando roster nas stages D1")
print("=" * 60)

for p in PLAYERS:
    for stage_id in p['stage_ids']:
        existing_roster = db.execute(text(
            "SELECT id, fantasy_cost, team_name FROM roster WHERE person_id=:pid AND stage_id=:sid"
        ), {'pid': p['person_id'], 'sid': stage_id}).fetchone()

        if existing_roster:
            print(f"  {p['display_name']} stage={stage_id}: já no roster (id={existing_roster.id}, team={existing_roster.team_name}, cost={existing_roster.fantasy_cost})")
        else:
            # Busca dados do roster de uma stage anterior (último stage com roster para este player)
            prev_roster = db.execute(text("""
                SELECT r.fantasy_cost, r.team_name, r.cost_override, r.newcomer_to_tier, r.is_available
                FROM roster r
                WHERE r.person_id = :pid
                ORDER BY r.stage_id DESC
                LIMIT 1
            """), {'pid': p['person_id']}).fetchone()

            if prev_roster:
                db.execute(text("""
                    INSERT INTO roster (stage_id, person_id, team_name, fantasy_cost, cost_override,
                                       newcomer_to_tier, is_available)
                    VALUES (:sid, :pid, :team_name, :cost, :cost_override, :newcomer, :avail)
                    ON CONFLICT DO NOTHING
                """), {
                    'sid': stage_id,
                    'pid': p['person_id'],
                    'team_name': prev_roster.team_name,
                    'cost': prev_roster.fantasy_cost,
                    'cost_override': prev_roster.cost_override,
                    'newcomer': prev_roster.newcomer_to_tier,
                    'avail': prev_roster.is_available,
                })
                print(f"  {p['display_name']} stage={stage_id}: inserido no roster (team={prev_roster.team_name}, cost={prev_roster.fantasy_cost})")
            else:
                print(f"  {p['display_name']} stage={stage_id}: SEM roster anterior! Inserindo com custo padrão 10")
                db.execute(text("""
                    INSERT INTO roster (stage_id, person_id, team_name, fantasy_cost, is_available)
                    VALUES (:sid, :pid, :team_name, 10, true)
                    ON CONFLICT DO NOTHING
                """), {'sid': stage_id, 'pid': p['person_id'], 'team_name': p['new_alias'].split('_')[0]})

db.commit()

print()
print("=" * 60)
print("PASSO 3: Reimportando D1 com force_reprocess=True")
print("=" * 60)

PAS_D1_MATCHES = [
    'ae17c384-7f05-452e-adde-0a65c7f91a7e',
    '83b6e8ea-b2a4-4275-9099-65d978a50d7e',
    'c4d94179-ee36-4944-9229-722c7b5b603e',
    'c5ea4684-c5e1-4a80-9419-8bfeb7520c67',
    '1f65d7ad-e22b-4dc1-9e32-e9f6d5f2624b',
]

PEC_D1_MATCHES = [
    'b284f8dc-ed65-4a92-9ff6-ef1de30bd36d',
    '7ab246b3-7e70-4be9-afac-ac4298aea74c',
    'b5406348-a11a-44b6-862c-62d372641f5e',
    'e341de0d-f7f1-40b8-b503-2ea7760302c4',
    '51859cdf-d38d-4907-8a2b-dccdf90fb83d',
]

for name, stage_id, stage_day_id, matches in [
    ("PAS D1", 30, 31, PAS_D1_MATCHES),
    ("PEC D1", 33, 32, PEC_D1_MATCHES),
]:
    print(f"\n{name} (stage={stage_id}, stage_day={stage_day_id})...")
    result = import_stage_matches(
        db=db,
        stage_id=stage_id,
        pubg_match_ids=matches,
        stage_day_id=stage_day_id,
        force_reprocess=True,
    )
    unresolved = result.get('unresolved_players', [])
    reprocessed = result.get('reprocessed', 0)
    print(f"  reprocessed={reprocessed} unresolved={unresolved}")

print()
print("=" * 60)
print("PASSO 4: Rescorando stages e stage_days")
print("=" * 60)

for name, stage_id, stage_day_id in [("PAS D1", 30, 31), ("PEC D1", 33, 32)]:
    try:
        rescore_stage(db, stage_id)
        print(f"  {name} rescore_stage OK")
    except Exception as e:
        print(f"  {name} rescore_stage ERRO: {e}")
    try:
        score_stage_day(db, stage_day_id)
        print(f"  {name} score_stage_day OK")
    except Exception as e:
        print(f"  {name} score_stage_day ERRO: {e}")

# Verificação final
print()
print("=" * 60)
print("VERIFICAÇÃO FINAL")
print("=" * 60)

for label, sdid, expected in [("PAS D1", 31, 64*5), ("PEC D1", 32, 64*5)]:
    counts = db.execute(text("""
        SELECT COUNT(ms.id) as total,
               SUM(CASE WHEN ms.person_id IS NOT NULL THEN 1 ELSE 0 END) as resolved
        FROM match_stat ms
        WHERE ms.match_id IN (SELECT id FROM match WHERE stage_day_id = :sdid)
    """), {'sdid': sdid}).fetchone()
    print(f"  {label}: total={counts.total} resolved={counts.resolved} (esperado ≈{expected-5} a {expected} — excluindo LxB_Rxberrtt)")

db.close()
print("\nDone.")
