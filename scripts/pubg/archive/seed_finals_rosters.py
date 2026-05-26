"""
Finals 2 Rosters Seed — PAS e PEC

PEC Finals: stages 36, 37, 38 (16 times PEC)
PAS Finals: stages 39, 40, 41 (16 times PAS)

Fonte dos rosters (stage mais recente de cada time):
  PAS stage 30: Copenhagen Wolves, BESTIA, ROC Esports, No Way, DUEL, FURIA, TOYO Esports, EUFAREIX10
  PAS stage 31: Newgen Allstars, Team Falcons, Team Liquid, RENT FREE, Chupinskys
  PAS stage 32: GodLike, IAM BOLIVIA, Team FATE
  PEC stage 33: NATUS VINCERE, Team Vitality, ACEND Club, Joga Bonito, Virtus.pro, Bushido Wildcats, Twisted Minds, noslack
  PEC stage 34: PGG, YOOO, Storm on Request, S2G Esports, HiVE
  PEC stage 35: Team Nemesis, Construction Workers, exhowl

Copia apenas is_available=True para evitar trazer subs indevidos.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
sys.stdout.reconfigure(encoding='utf-8')

from dotenv import load_dotenv; load_dotenv(ROOT / ".env")

from app.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()

# ─────────────────────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────────────────────

# (source_stage_id, team_name_in_db) -> target stages list
PAS_TARGETS = [39, 40, 41]
PEC_TARGETS = [36, 37, 38]

# PAS teams: source stage -> list of team_names as they appear in the DB
PAS_SOURCES = {
    30: ['Copenhagen Wolves', 'BESTIA', 'ROC Esports', 'No Way', 'DUEL',
         'FURIA', 'TOYO Esports', 'EUFAREIX10'],
    31: ['Newgen Allstars', 'Team Falcons', 'Team Liquid', 'RENT FREE', 'Chupinskys'],
    32: ['GodLike', 'IAM BOLIVIA', 'Team FATE'],
}

# PEC teams: source stage -> list of team_names as they appear in the DB
PEC_SOURCES = {
    33: ['NATUS VINCERE', 'Team Vitality', 'ACEND Club', 'Joga Bonito',
         'Virtus.pro', 'Bushido Wildcats', 'Twisted Minds', 'noslack'],
    34: ['PGG', 'YOOO', 'Storm on Request', 'S2G Esports', 'HiVE'],
    35: ['Team Nemesis', 'Construction Workers', 'exhowl'],
}

# ─────────────────────────────────────────────────────────────────────────────
# PASSO 0: Verificacao de stages
# ─────────────────────────────────────────────────────────────────────────────
print("="*60)
print("PASSO 0: Verificando stages")
print("="*60)

all_stage_ids = PAS_TARGETS + PEC_TARGETS + list(PAS_SOURCES.keys()) + list(PEC_SOURCES.keys())
rows = db.execute(text("""
    SELECT s.id, s.name, c.id as champ_id, c.name as champ_name
    FROM stage s
    JOIN championship c ON c.id = s.championship_id
    WHERE s.id = ANY(:ids)
    ORDER BY s.id
"""), {'ids': all_stage_ids}).fetchall()

stage_map = {}
for r in rows:
    stage_map[r.id] = r
    print(f"  stage {r.id}: {r.name!r} | champ {r.champ_id}: {r.champ_name!r}")

print()

# Flag champ assignment issue if stage 36 exists in PEC targets but mapped to PAS champ
if 36 in stage_map:
    s36 = stage_map[36]
    if 'PAS' in (s36.champ_name or '').upper() or s36.champ_id == 15:
        print(f"  AVISO: stage 36 ({s36.name!r}) esta em champ {s36.champ_id} ({s36.champ_name!r})")
        print(f"         Pode ser erro de atribuicao (deveria ser champ PEC). Consultar admin.")
        print()

# ─────────────────────────────────────────────────────────────────────────────
# PASSO 1: Verificar team_names no DB
# ─────────────────────────────────────────────────────────────────────────────
print("="*60)
print("PASSO 1: Verificando team_names no DB")
print("="*60)

all_teams_by_source = {}  # (src_stage, team_name) -> list of (person_id, fantasy_cost, newcomer_to_tier)
missing_teams = []

for src_stage, team_list in {**PAS_SOURCES, **PEC_SOURCES}.items():
    for team in team_list:
        rows = db.execute(text("""
            SELECT r.person_id, r.fantasy_cost, r.newcomer_to_tier, r.is_available, r.team_name
            FROM roster r
            WHERE r.stage_id = :sid AND r.team_name = :team AND r.is_available = true
        """), {'sid': src_stage, 'team': team}).fetchall()

        if not rows:
            # Tenta busca exata sem is_available para verificar se o time existe
            check = db.execute(text("""
                SELECT team_name, COUNT(*) cnt
                FROM roster WHERE stage_id = :sid AND team_name = :team
                GROUP BY team_name
            """), {'sid': src_stage, 'team': team}).fetchone()
            if check:
                print(f"  WARN: stage {src_stage} {team!r} existe mas is_available=False para todos")
            else:
                missing_teams.append((src_stage, team))
                print(f"  ERRO: stage {src_stage} {team!r} NAO encontrado!")
            continue

        all_teams_by_source[(src_stage, team)] = rows
        print(f"  stage {src_stage} {team!r}: {len(rows)} jogadores (is_available=True)")

if missing_teams:
    print(f"\n  ERROS: {len(missing_teams)} times nao encontrados — verifique nomes no DB")
    db.close()
    sys.exit(1)

print(f"\n  Total: {len(all_teams_by_source)} times verificados, todos ok.")

# ─────────────────────────────────────────────────────────────────────────────
# PASSO 2: Popular rosters Finals
# ─────────────────────────────────────────────────────────────────────────────

def seed_finals(label, sources_dict, target_stages):
    print()
    print("="*60)
    print(f"Populando {label} -> stages {target_stages}")
    print("="*60)

    # Verifica se algum target ja tem roster
    for tgt in target_stages:
        cnt = db.execute(text(
            "SELECT COUNT(*) FROM roster WHERE stage_id = :sid"
        ), {'sid': tgt}).scalar()
        if cnt > 0:
            print(f"  stage {tgt} ja tem {cnt} entradas — usando ON CONFLICT DO NOTHING")

    total_inserted = 0
    team_summary = []

    for src_stage, team_list in sources_dict.items():
        for team in team_list:
            key = (src_stage, team)
            players = all_teams_by_source.get(key)
            if not players:
                continue

            inserted_for_team = 0
            for tgt in target_stages:
                for p in players:
                    result = db.execute(text("""
                        INSERT INTO roster (stage_id, person_id, team_name, fantasy_cost, newcomer_to_tier, is_available)
                        VALUES (:sid, :pid, :team, :cost, :newcomer, true)
                        ON CONFLICT (stage_id, person_id) DO NOTHING
                    """), {
                        'sid': tgt,
                        'pid': p.person_id,
                        'team': team,
                        'cost': p.fantasy_cost,
                        'newcomer': p.newcomer_to_tier,
                    })
                    inserted_for_team += result.rowcount

            total_inserted += inserted_for_team
            team_summary.append((team, len(players), inserted_for_team))
            print(f"  {team}: {len(players)} jogadores x {len(target_stages)} stages = {inserted_for_team} entradas")

    db.commit()
    print(f"\n  {label} TOTAL: {total_inserted} entradas inseridas")
    return total_inserted

seed_finals("PAS Finals", PAS_SOURCES, PAS_TARGETS)
seed_finals("PEC Finals", PEC_SOURCES, PEC_TARGETS)

# ─────────────────────────────────────────────────────────────────────────────
# VERIFICACAO FINAL
# ─────────────────────────────────────────────────────────────────────────────
print()
print("="*60)
print("VERIFICACAO FINAL")
print("="*60)

for label, stage_ids in [("PAS Finals", PAS_TARGETS), ("PEC Finals", PEC_TARGETS)]:
    print(f"\n{label}:")
    for sid in stage_ids:
        teams_rows = db.execute(text("""
            SELECT team_name, COUNT(*) players
            FROM roster WHERE stage_id = :sid AND is_available = true
            GROUP BY team_name ORDER BY team_name
        """), {'sid': sid}).fetchall()
        total_players = sum(r.players for r in teams_rows)
        print(f"  stage {sid}: {len(teams_rows)} times, {total_players} jogadores")
        for r in teams_rows:
            print(f"    {r.team_name}: {r.players}p")

db.close()
print("\nDone.")
