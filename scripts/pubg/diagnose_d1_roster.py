"""
Diagnostica o que aconteceu com o D1: por que 124 jogadores nao tinham
account pc-tournament, e se houve trocas de elenco entre Playoffs 1 e 2.
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

# ── 1. Resumo do fix ──
print("=" * 60)
print("1. Accounts inseridos no fix (active_from >= 2026-05-03)")
print("=" * 60)
new_accounts = db.execute(text("""
    SELECT pa.person_id, p.display_name, pa.account_id, pa.alias, pa.active_from,
           (SELECT COUNT(*) FROM player_account pa2
            WHERE pa2.person_id = pa.person_id AND pa2.shard='pc-tournament'
            AND pa2.active_from < '2026-05-03') as had_before
    FROM player_account pa
    JOIN person p ON p.id = pa.person_id
    WHERE pa.shard = 'pc-tournament'
      AND pa.active_from >= '2026-05-03'
    ORDER BY p.display_name
""")).fetchall()
total = len(new_accounts)
had_before = sum(1 for r in new_accounts if r.had_before > 0)
brand_new = total - had_before
print(f"Total: {total} | ja tinham outro account antes: {had_before} | completamente novos: {brand_new}")

# ── 2. Quem eram totalmente novos (nunca tiveram account pc-tournament)? ──
print()
print("=" * 60)
print("2. Jogadores SEM account pc-tournament antes do fix (brand new)")
print("=" * 60)
for r in new_accounts:
    if r.had_before == 0:
        print(f"  {r.display_name:25} | alias={r.alias}")

# ── 3. Quem JA TINHA account mas recebeu um segundo? ──
print()
print("=" * 60)
print("3. Jogadores que JA TINHAM account e receberam um segundo (mudanca de ID?)")
print("=" * 60)
for r in new_accounts:
    if r.had_before > 0:
        all_accounts = db.execute(text("""
            SELECT account_id, alias, active_from, active_until
            FROM player_account
            WHERE person_id=:pid AND shard='pc-tournament'
            ORDER BY active_from
        """), {'pid': r.person_id}).fetchall()
        print(f"  {r.display_name}:")
        for a in all_accounts:
            marker = "  [NOVO]" if str(a.active_from) >= '2026-05-03' else "  [ant.]"
            print(f"  {marker} account={a.account_id} alias={a.alias}")

# ── 4. Compara elenco Playoffs 1 vs Playoffs 2 (PAS) ──
print()
print("=" * 60)
print("4. PAS: elenco Playoffs 1 vs Playoffs 2")
print("=" * 60)

# Stages PAS
pas_stages = db.execute(text("""
    SELECT s.id, s.name
    FROM stage s
    JOIN championship c ON c.id = s.championship_id
    WHERE c.name ILIKE '%americas%'
    ORDER BY s.id
""")).fetchall()
print("Stages PAS:")
for s in pas_stages:
    print(f"  stage={s.id} | {s.name}")

# Jogadores no elenco de cada stage PAS
print()
for s in pas_stages:
    players = db.execute(text("""
        SELECT p.display_name, r.team_name
        FROM roster r
        JOIN person p ON p.id = r.person_id
        WHERE r.stage_id = :sid
        ORDER BY r.team_name, p.display_name
    """), {'sid': s.id}).fetchall()
    print(f"Stage {s.id} ({s.name}): {len(players)} jogadores")

# Diff entre Playoffs 1 e 2 para PAS
p1_stages = [s for s in pas_stages if s.id < 30]
p2_stages = [s for s in pas_stages if s.id >= 30]

if p1_stages and p2_stages:
    # Pega o último stage do Playoffs 1 (ou melhor: todos os stages do último championship PAS antes do 12)
    prev_champ_stage_ids = [s.id for s in p1_stages]
    curr_stage_id = p2_stages[0].id  # stage 30

    prev_players = db.execute(text("""
        SELECT DISTINCT p.id, p.display_name, r.team_name
        FROM roster r
        JOIN person p ON p.id = r.person_id
        WHERE r.stage_id = ANY(:sids)
    """), {'sids': prev_champ_stage_ids}).fetchall()

    curr_players = db.execute(text("""
        SELECT DISTINCT p.id, p.display_name, r.team_name
        FROM roster r
        JOIN person p ON p.id = r.person_id
        WHERE r.stage_id = :sid
    """), {'sid': curr_stage_id}).fetchall()

    prev_ids = {r.id for r in prev_players}
    curr_ids = {r.id for r in curr_players}

    new_in_p2 = [r for r in curr_players if r.id not in prev_ids]
    dropped = [r for r in prev_players if r.id not in curr_ids]

    print(f"\nNOVOS no Playoffs 2 PAS (nao estavam em nenhum stage anterior): {len(new_in_p2)}")
    for r in new_in_p2:
        print(f"  + {r.team_name:20} | {r.display_name}")

    print(f"\nSAIRAM do Playoffs 2 PAS (estavam antes, sumiu): {len(dropped)}")
    for r in dropped:
        print(f"  - {r.team_name:20} | {r.display_name}")

# ── 5. Mesma analise para PEC ──
print()
print("=" * 60)
print("5. PEC: elenco stages")
print("=" * 60)

pec_stages = db.execute(text("""
    SELECT s.id, s.name
    FROM stage s
    JOIN championship c ON c.id = s.championship_id
    WHERE c.name ILIKE '%EMEA%'
    ORDER BY s.id
""")).fetchall()
print("Stages PEC:")
for s in pec_stages:
    players = db.execute(text("""
        SELECT COUNT(*) FROM roster WHERE stage_id=:sid
    """), {'sid': s.id}).scalar()
    print(f"  stage={s.id} | {s.name} | {players} jogadores")

p1_pec = [s for s in pec_stages if s.id < 33]
p2_pec = [s for s in pec_stages if s.id >= 33]

if p1_pec and p2_pec:
    prev_pec_ids = [s.id for s in p1_pec]
    curr_pec_id = p2_pec[0].id  # stage 33

    prev_pec = db.execute(text("""
        SELECT DISTINCT p.id, p.display_name, r.team_name
        FROM roster r JOIN person p ON p.id = r.person_id
        WHERE r.stage_id = ANY(:sids)
    """), {'sids': prev_pec_ids}).fetchall()

    curr_pec = db.execute(text("""
        SELECT DISTINCT p.id, p.display_name, r.team_name
        FROM roster r JOIN person p ON p.id = r.person_id
        WHERE r.stage_id = :sid
    """), {'sid': curr_pec_id}).fetchall()

    prev_pec_ids_set = {r.id for r in prev_pec}
    curr_pec_ids_set = {r.id for r in curr_pec}

    new_pec = [r for r in curr_pec if r.id not in prev_pec_ids_set]
    dropped_pec = [r for r in prev_pec if r.id not in curr_pec_ids_set]

    print(f"\nNOVOS no Playoffs 2 PEC: {len(new_pec)}")
    for r in new_pec:
        print(f"  + {r.team_name:20} | {r.display_name}")

    print(f"\nSAIRAM do Playoffs 2 PEC: {len(dropped_pec)}")
    for r in dropped_pec:
        print(f"  - {r.team_name:20} | {r.display_name}")

# ── 6. Accounts totais por stage ──
print()
print("=" * 60)
print("6. Por que o problema? — Accounts pc-tournament por epoch")
print("=" * 60)

epochs = db.execute(text("""
    SELECT DATE(active_from) as dt, COUNT(*) as cnt
    FROM player_account
    WHERE shard='pc-tournament'
    GROUP BY DATE(active_from)
    ORDER BY dt
""")).fetchall()
for r in epochs:
    print(f"  {r.dt}: {r.cnt} accounts inseridos")

db.close()
