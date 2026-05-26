"""
Setup completo para Playoffs 2 Dia 2:
  1. Renomeia FE -> GodLike no banco (team + roster.team_name)
  2. Cria roster do PAS Dia 2 (stage_id=31) com os 16 times
  3. Cria roster do PEC Dia 2 (stage_id=34) com os 16 times
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

# ── 1. Atualiza time FE → GodLike ──────────────────────────────────────────
print("=" * 60)
print("1. Atualizando time FE -> GodLike")
print("=" * 60)

db.execute(text("""
    UPDATE team SET tag='GodL', name='GodLike'
    WHERE tag='FE'
"""))

updated = db.execute(text(
    "UPDATE roster SET team_name='GodLike' WHERE team_name='Athletes of Christ' RETURNING stage_id, person_id"
)).fetchall()
db.commit()

print(f"  team.tag: FE -> GodL, name -> GodLike")
print(f"  roster.team_name: 'Athletes of Christ' -> 'GodLike' em {len(updated)} registros")
stages_updated = sorted(set(r.stage_id for r in updated))
print(f"  Stages afetados: {stages_updated}")

# ── 2. Mapeamento times D2 -> source stage ────────────────────────────────
# Para cada time: qual stage buscar o roster mais recente

PAS_D2_TEAMS = [
    'Newgen Allstars',   # stage 30 (D1 Playoffs 2)
    'Team Falcons',      # stage 30
    'Team Liquid',       # stage 30
    'RENT FREE',         # stage 26 (Finals 1 D3)
    'Chupinskys',        # stage 17 (Playoffs 1 D3)
    'GodLike',           # stage 30 (era Athletes of Christ)
    'Pest Control',      # stage 30
    'IAM BOLIVIA',       # stage 17 (Playoffs 1 D3)
    'Collector',         # stage 17 (Playoffs 1 D3)
    'What It Takes',     # stage 30
    'Last Breath',       # stage 30
    'Affinity',          # stage 26 (Finals 1 D3)
    '55 e-Sports',       # stage 30
    'Team FATE',         # stage 17 (Playoffs 1 D3)
    'Injected',          # stage 17 (Playoffs 1 D3)
    'Tempest',           # stage 17 (Playoffs 1 D3)
]

PEC_D2_TEAMS = [
    'PGG',                # stage 29 (Finals 1 D3)
    'YOOO',               # stage 23 (Playoffs 1 D3)
    'Storm on Request',   # stage 23
    'S2G Esports',        # stage 23
    'HiVE',               # stage 29
    'Team Nemesis',       # stage 29
    'Ghetto Gang',        # stage 23
    'BORZ',               # stage 29
    'exhowl',             # stage 23
    'Construction Workers', # stage 23
    'Baldinini',          # stage 23
    'NoTag Team',         # stage 23
    'Vis',                # stage 29  (TeamVis = Vis)
    'Starry SKY',         # stage 29
    'S8UL',               # stage 29
    'The Myth of',        # stage 29
]

def create_d2_roster(db, target_stage_id, teams, label):
    print(f"\n{'=' * 60}")
    print(f"{label} — criando roster stage_id={target_stage_id}")
    print(f"{'=' * 60}")

    already = db.execute(text(
        "SELECT COUNT(*) FROM roster WHERE stage_id=:sid"
    ), {'sid': target_stage_id}).scalar()
    if already > 0:
        print(f"  ATENÇÃO: stage {target_stage_id} já tem {already} entradas de roster. Abortando para não duplicar.")
        return

    inserted = 0
    not_found = []

    for team_name in teams:
        # Busca roster mais recente para este time (excluindo o target stage)
        source = db.execute(text("""
            SELECT r.person_id, r.team_name, r.fantasy_cost, r.cost_override,
                   r.newcomer_to_tier, r.is_available, r.stage_id
            FROM roster r
            WHERE r.team_name = :tname
              AND r.stage_id < :target
            ORDER BY r.stage_id DESC
            LIMIT 100
        """), {'tname': team_name, 'target': target_stage_id}).fetchall()

        if not source:
            not_found.append(team_name)
            print(f"  !! NAO encontrado: '{team_name}'")
            continue

        # Pega apenas os do stage mais recente para este time
        latest_stage = source[0].stage_id
        players = [r for r in source if r.stage_id == latest_stage]

        for r in players:
            db.execute(text("""
                INSERT INTO roster (stage_id, person_id, team_name, fantasy_cost,
                                   cost_override, newcomer_to_tier, is_available)
                VALUES (:sid, :pid, :tname, :cost, :cost_override, :newcomer, :avail)
                ON CONFLICT DO NOTHING
            """), {
                'sid': target_stage_id,
                'pid': r.person_id,
                'tname': r.team_name,
                'cost': r.fantasy_cost,
                'cost_override': r.cost_override,
                'newcomer': False,   # reset newcomer para novo stage
                'avail': True,
            })
            inserted += 1

        print(f"  {team_name:25} ({len(players)} jogadores, de stage {latest_stage})")

    db.commit()

    total = db.execute(text("SELECT COUNT(*) FROM roster WHERE stage_id=:sid"), {'sid': target_stage_id}).scalar()
    print(f"\n  Total inserido: {total} jogadores em {target_stage_id}")
    if not_found:
        print(f"  Times NAO encontrados: {not_found}")

    return total

create_d2_roster(db, 31, PAS_D2_TEAMS, "PAS D2")
create_d2_roster(db, 34, PEC_D2_TEAMS, "PEC D2")

# ── 3. Verificação final ──────────────────────────────────────────────────
print(f"\n{'=' * 60}")
print("VERIFICACAO FINAL")
print("=" * 60)

for label, sid in [("PAS D1 stage 30", 30), ("PAS D2 stage 31", 31),
                   ("PEC D1 stage 33", 33), ("PEC D2 stage 34", 34)]:
    teams_count = db.execute(text(
        "SELECT COUNT(DISTINCT team_name) FROM roster WHERE stage_id=:sid"
    ), {'sid': sid}).scalar()
    players_count = db.execute(text(
        "SELECT COUNT(*) FROM roster WHERE stage_id=:sid"
    ), {'sid': sid}).scalar()
    print(f"  {label}: {teams_count} times, {players_count} jogadores")

# Confirma GodLike
godl = db.execute(text("SELECT id, tag, name FROM team WHERE tag='GodL'")).fetchone()
print(f"\n  Time GodLike: id={godl.id} tag={godl.tag} name={godl.name}")

godl_roster_31 = db.execute(text("""
    SELECT p.display_name FROM roster r JOIN person p ON p.id=r.person_id
    WHERE r.stage_id=31 AND r.team_name='GodLike'
    ORDER BY p.display_name
""")).fetchall()
print(f"  GodLike no stage 31: {[r.display_name for r in godl_roster_31]}")

db.close()
print("\nDone.")
