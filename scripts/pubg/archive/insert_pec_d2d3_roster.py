"""
insert_pec_d2d3_roster.py
─────────────────────────
Insere Person + PlayerAccount + Roster para os times do PEC D2 (stage 22) e D3 (stage 23).
Skipa jogadores que já existem no banco (idempotente).

Uso:
    python scripts/pubg/insert_pec_d2d3_roster.py [--dry-run]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from app.database import SessionLocal
from app.models.person import Person
from app.models.player_account import PlayerAccount
from app.models.roster import Roster

# ── Dados ─────────────────────────────────────────────────────────────────────

STAGE_22_TEAMS = [
    {"tag": "YO",   "nome_time": "YOOO",             "jogadores": ["vjeemzz", "pw9d", "TwitchTV_mykLe", "K4pii"]},
    {"tag": "NOT",  "nome_time": "NoTag Team",        "jogadores": ["OConnell", "rappha", "Mak", "Donquixote_Doffy"]},
    {"tag": "BORZ", "nome_time": "BORZ",              "jogadores": ["Marchel-", "HalloSenpai", "h1xs", "Luu4iikk-"]},
    {"tag": "PGG",  "nome_time": "PGG",               "jogadores": ["Presenti", "SL0YJACKET", "Zub1la", "Salik-"]},
    {"tag": "BAL",  "nome_time": "Baldinini",         "jogadores": ["MrShimada", "caydel", "taBl-", "sunfloweeeee"]},
    {"tag": "GTG",  "nome_time": "Ghetto Gang",       "jogadores": ["Apr1l-", "iamf1ve-", "imSancho", "Blazor-"]},
    {"tag": "SQU",  "nome_time": "Storm on Request",  "jogadores": ["gt210kz", "pozyyan", "xisooo", "Vezyv1y-"]},
    {"tag": "STS",  "nome_time": "Starry SKY",        "jogadores": ["vaaazooo", "SILERZZ", "KnorkiS", "TOP4IK_PB"]},
]

STAGE_23_TEAMS = [
    {"tag": "VPX",  "nome_time": "Vuptrox",           "jogadores": ["Mikzenn", "Vorix", "Bjoernter", "BlISSEDDDDDDDD"]},
    {"tag": "RL",   "nome_time": "Redline",            "jogadores": ["sniipZEKO", "DYNNO-", "karxx_", "ivas"]},
    {"tag": "GN",   "nome_time": "GoNext Esports",     "jogadores": ["Acaliptos", "IZIO--", "MAXXXXXXXXX-", "F1Nee-"]},
    {"tag": "PBRU", "nome_time": "PBRU",               "jogadores": ["quintx", "Nabat_", "xreyzer1", "h0pejj"]},
    {"tag": "EVER", "nome_time": "Everlong",           "jogadores": ["Verstory", "youngwhitetrash", "rinazxc", "saint_xd"]},
]

# ── Inserção ──────────────────────────────────────────────────────────────────

def insert_team(db, stage_id: int, team: dict, dry_run: bool) -> dict:
    tag       = team["tag"]
    nome_time = team["nome_time"]
    results   = []

    for player_name in team["jogadores"]:
        # 1. Verifica se Person já existe pelo display_name
        person = db.query(Person).filter(Person.display_name == player_name).first()
        if person:
            print(f"  [SKIP] Person já existe: {player_name} (id={person.id})")
        else:
            person = Person(display_name=player_name, is_active=True)
            if not dry_run:
                db.add(person)
                db.flush()
            print(f"  [NEW]  Person: {player_name}" + (f" (id={person.id})" if not dry_run else " (dry-run)"))

        # 2. Verifica se PlayerAccount já existe para este person
        if not dry_run and person.id:
            existing_pa = db.query(PlayerAccount).filter(PlayerAccount.person_id == person.id).first()
            if existing_pa:
                print(f"         PlayerAccount já existe: alias={existing_pa.alias}")
            else:
                pa = PlayerAccount(
                    person_id=person.id,
                    alias=player_name,
                    account_id=f"PENDING_{player_name}",
                    shard="pc-tournament",
                )
                db.add(pa)
                db.flush()
                print(f"         PlayerAccount criado: alias={player_name}")

            # 3. Verifica se Roster já existe para esta stage
            existing_r = db.query(Roster).filter(
                Roster.stage_id == stage_id,
                Roster.person_id == person.id,
            ).first()
            if existing_r:
                print(f"         Roster já existe para stage {stage_id}")
            else:
                r = Roster(
                    stage_id=stage_id,
                    person_id=person.id,
                    team_name=nome_time,
                    fantasy_cost=15.00,
                )
                db.add(r)
                db.flush()
                print(f"         Roster criado: stage={stage_id} team={nome_time} cost=15.00")

        results.append(player_name)

    return results


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Simula sem gravar no banco")
    args = parser.parse_args()

    if args.dry_run:
        print("=== DRY RUN — nenhuma alteracao sera gravada ===\n")

    db = SessionLocal()
    try:
        total = 0

        print(f"\n--- Stage 22 (Dia 2) — {len(STAGE_22_TEAMS)} times ---")
        for team in STAGE_22_TEAMS:
            print(f"\n[{team['tag']}] {team['nome_time']}")
            insert_team(db, stage_id=22, team=team, dry_run=args.dry_run)
            total += len(team["jogadores"])

        print(f"\n--- Stage 23 (Dia 3) — {len(STAGE_23_TEAMS)} times ---")
        for team in STAGE_23_TEAMS:
            print(f"\n[{team['tag']}] {team['nome_time']}")
            insert_team(db, stage_id=23, team=team, dry_run=args.dry_run)
            total += len(team["jogadores"])

        if not args.dry_run:
            db.commit()
            print(f"\n[OK] Commit realizado. {total} jogadores processados.")
        else:
            print(f"\n[DRY RUN] {total} jogadores seriam processados.")

    except Exception as e:
        db.rollback()
        print(f"\n[ERRO] {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
