"""Verifica o estado dos 4 jogadores não resolvidos."""
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from dotenv import load_dotenv; load_dotenv(ROOT / ".env")
from app.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()

MISSING = ['BST_FROGMAN7', 'LxB_Rxberrtt', 'WIT_marcis', 'HOWL_Nailqop13']

for alias in MISSING:
    print(f"\n{'='*55}")
    print(f"Alias no match: {alias}")

    # account_id que jogou com esse alias nos matches D1
    acc = db.execute(text("""
        SELECT DISTINCT ms.account_id_used
        FROM match_stat ms
        WHERE ms.person_id IS NULL
          AND ms.match_id IN (
              SELECT id FROM match WHERE stage_day_id IN (31, 32)
          )
        -- filtra pelo alias que conhecemos da análise anterior
    """)).fetchall()

    # Busca pelo account que aparece nos matches sem person_id
    acc2 = db.execute(text("""
        SELECT DISTINCT ms.account_id_used
        FROM match_stat ms
        JOIN player_account pa ON pa.account_id = ms.account_id_used
        WHERE pa.alias = :alias AND ms.person_id IS NULL
    """), {'alias': alias}).fetchone()

    account_id = acc2[0] if acc2 else None
    print(f"  account_id usado: {account_id}")

    # Checa se existe person com display_name parecido
    like = alias.split('_')[-1] if '_' in alias else alias
    persons = db.execute(text("""
        SELECT p.id, p.display_name,
               array_agg(pa.alias ORDER BY pa.active_from) as aliases
        FROM person p
        LEFT JOIN player_account pa ON pa.person_id = p.id AND pa.shard='pc-tournament'
        WHERE p.display_name ILIKE :like
        GROUP BY p.id, p.display_name
    """), {'like': f'%{like}%'}).fetchall()
    if persons:
        print(f"  Persons parecidos ({like}): {[(r.id, r.display_name, list(r.aliases)) for r in persons]}")
    else:
        print(f"  Nenhum person com '{like}'")

    # Checa se jogou nas Playoffs 1 (match_stat com account parecido)
    if account_id:
        prev_stats = db.execute(text("""
            SELECT m.stage_day_id, sd.day_number, s.name as stage_name,
                   ms.kills, ms.damage, ms.placement
            FROM match_stat ms
            JOIN match m ON m.id = ms.match_id
            JOIN stage_day sd ON sd.id = m.stage_day_id
            JOIN stage s ON s.id = sd.stage_id
            WHERE ms.account_id_used = :aid
            ORDER BY m.played_at
        """), {'aid': account_id}).fetchall()
        if prev_stats:
            print(f"  Histórico com este account_id:")
            for r in prev_stats:
                print(f"    stage_day={r.stage_day_id} ({r.stage_name} D{r.day_number}) kills={r.kills} dmg={r.damage} place={r.placement}")

    # Busca na person_alias também
    alias_match = db.execute(text("""
        SELECT p.id, p.display_name, pa2.alias
        FROM person_alias pa2
        JOIN person p ON p.id = pa2.person_id
        WHERE pa2.alias ILIKE :like
    """), {'like': f'%{like}%'}).fetchall()
    if alias_match:
        print(f"  person_alias com '{like}': {[(r.id, r.display_name, r.alias) for r in alias_match]}")

# Também: busca se BST_FROGMAN1 existe
print(f"\n{'='*55}")
print("Busca por FROGMAN (BST):")
frogman = db.execute(text("""
    SELECT p.id, p.display_name FROM person p
    WHERE p.display_name ILIKE '%frogman%'
""")).fetchall()
print(f"  persons: {[(r.id, r.display_name) for r in frogman]}")

pa_frogman = db.execute(text("""
    SELECT pa.person_id, p.display_name, pa.account_id, pa.alias
    FROM player_account pa
    JOIN person p ON p.id = pa.person_id
    WHERE pa.alias ILIKE '%frogman%'
""")).fetchall()
print(f"  player_accounts: {[(r.person_id, r.display_name, r.alias) for r in pa_frogman]}")

# Busca WIT_marcis nos matches das Playoffs 1
print(f"\n{'='*55}")
print("WIT_marcis — jogou Playoffs 1 D2/D3?")
marcis_stats = db.execute(text("""
    SELECT ms.account_id_used, ms.person_id, m.stage_day_id, sd.day_number,
           s.name, ms.kills, ms.damage
    FROM match_stat ms
    JOIN match m ON m.id = ms.match_id
    JOIN stage_day sd ON sd.id = m.stage_day_id
    JOIN stage s ON s.id = sd.stage_id
    JOIN player_account pa ON pa.account_id = ms.account_id_used
    WHERE pa.alias ILIKE '%marcis%'
    ORDER BY m.played_at
""")).fetchall()
print(f"  via player_account alias: {len(marcis_stats)} stats")
for r in marcis_stats:
    print(f"    stage_day={r.stage_day_id} ({r.name} D{r.day_number}) person_id={r.person_id} kills={r.kills}")

print(f"\n{'='*55}")
print("HOWL_Nailqop13 — jogou Playoffs 1 D3?")
nailqop_stats = db.execute(text("""
    SELECT ms.account_id_used, ms.person_id, m.stage_day_id, sd.day_number,
           s.name, ms.kills, ms.damage
    FROM match_stat ms
    JOIN match m ON m.id = ms.match_id
    JOIN stage_day sd ON sd.id = m.stage_day_id
    JOIN stage s ON s.id = sd.stage_id
    JOIN player_account pa ON pa.account_id = ms.account_id_used
    WHERE pa.alias ILIKE '%nailqop%'
    ORDER BY m.played_at
""")).fetchall()
print(f"  via player_account alias: {len(nailqop_stats)} stats")
for r in nailqop_stats:
    print(f"    stage_day={r.stage_day_id} ({r.name} D{r.day_number}) person_id={r.person_id} kills={r.kills}")

db.close()
