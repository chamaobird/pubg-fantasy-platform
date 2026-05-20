#!/usr/bin/env python3
"""
scripts/fix_gs_accounts.py

Corrige accounts e roster da Group Stage (stage 42, championship 16)
com base no scan de aliases da PUBG API.

Ações:
  1. The Expendables — adiciona novos account_ids (prefixo TE_ -> GTE_)
  2. The Expendables — cria Person JUND + account + roster; Hoangf -> reserva
  3. Theerathon Five — adiciona accounts para DimasTy e Khawkong
  4. 17 Gaming       — cria Person Akuma + account + roster; tiantianhaovo -> reserva
  5. Petrichor Road  — novo account para Cui711 (alias Cui71); 04NB -> reserva
  6. Petrichor Road  — cria Person Aixleft + account + roster
  7. CTG             — cria Person Xcircle + account + roster; PeekK1ng -> reserva

Uso:
    python scripts/fix_gs_accounts.py             # dry-run
    python scripts/fix_gs_accounts.py --confirm   # aplica
"""

import sys, os, argparse
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import app.models.team_member  # noqa
from app.models.team import Team  # noqa
from app.database import SessionLocal
from app.models.person import Person
from app.models.player_account import PlayerAccount
from app.models.roster import Roster

STAGE_ID   = 42
SHARD      = "pc-tournament"

# ─── Dados do scan ────────────────────────────────────────────────────────────

# Novos accounts a vincular a Persons já existentes
# (person_id, display_name, new_account_id, new_alias)
LINK_ACCOUNTS = [
    # The Expendables — prefixo mudou TE_ → GTE_
    (83,  "Clories",    "account.0083451e2e3041e5a82da3816ea3c208", "GTE_Clories"),
    (84,  "DuCkHjeUz",  "account.357fc8b0b992420ead201284f65af1d5", "GTE_DuCkHjeUz"),
    (86,  "TanVuu",     "account.8f0a2839060e421abfcd45d3c255d7b8", "GTE_TanVuu"),
    # Theerathon Five — sem account anterior
    (347, "DimasTy",    "account.5189dab4f45b465f8a692346916f036a", "T5_DimasTy"),
    (346, "Khawkong",   "account.aa23b24409d448cb9ac12cd5ecf3fff8", "T5_Khawkong"),
    # PeRo — alias mudou Cui711 → Cui71 + novo account_id
    (68,  "Cui711",     "account.fcd523d5c69644899dcd3a2eeb0301c1", "PeRo_Cui71"),
]

# Persons a tornar reserva no stage 42
# (person_id, display_name, motivo)
MAKE_RESERVE = [
    (85,  "Hoangf",       "substituído por JUND no TE"),
    (7,   "tiantianhaovo","substituído por Akuma no 17G"),
    (67,  "04NB",         "substituído por Aixleft no PeRo"),
    (23,  "PeekK1ng",     "substituído por Xcircle no CTG"),
]

# Novos jogadores a criar (display_name, team_name, new_account_id, alias)
NEW_PLAYERS = [
    ("JUND",    "The Expendables",  "account.7f8ce7b6eff24ddc83f3b581282c4365", "GTE_JUND"),
    ("Akuma",   "17 Gaming",        "account.47f3916bf6a84d079ede7870edff58ba", "17_Akuma"),
    ("Aixleft", "Petrichor Road",   "account.0174b3b2104643b0944c96f117c1db89", "PeRo_Aixleft"),
    ("Xcircle", "Change The Game",  "account.59978a39b47d425fafc32a6f181487dd", "CTG_Xcircle"),
]


def run(db, confirm: bool):
    dry = not confirm

    print(f"\n{'='*65}")
    print(f"FIX GS ACCOUNTS  stage={STAGE_ID}  {'DRY-RUN' if dry else 'CONFIRMADO'}")
    print(f"{'='*65}\n")

    # ── 1. Vincular novos accounts a Persons existentes ───────────────────────
    print("--- 1. Vincular novos account_ids ---\n")
    for person_id, name, account_id, alias in LINK_ACCOUNTS:
        existing = db.query(PlayerAccount).filter_by(account_id=account_id).first()
        if existing:
            print(f"  [SKIP]   {name}: account_id já existe")
            continue
        print(f"  [ADD]    {name} (id={person_id}): {alias} | {account_id[:20]}...")
        if not dry:
            pa = PlayerAccount(
                person_id=person_id,
                account_id=account_id,
                shard=SHARD,
                alias=alias,
            )
            db.add(pa)
    print()

    # ── 2. Tornar jogadores reserva ───────────────────────────────────────────
    print("--- 2. Marcar como reserva ---\n")
    for person_id, name, reason in MAKE_RESERVE:
        entry = db.query(Roster).filter_by(stage_id=STAGE_ID, person_id=person_id).first()
        if not entry:
            print(f"  [SKIP]   {name}: sem roster entry no stage {STAGE_ID}")
            continue
        if not entry.is_available:
            print(f"  [SKIP]   {name}: já é reserva")
            continue
        print(f"  [RSV]    {name} (id={person_id}): is_available=False  ({reason})")
        if not dry:
            entry.is_available = False
    print()

    # ── 3. Criar novos jogadores + accounts + roster ──────────────────────────
    print("--- 3. Criar novos jogadores ---\n")
    for display_name, team_name, account_id, alias in NEW_PLAYERS:
        # Person
        person = db.query(Person).filter_by(display_name=display_name).first()
        if person:
            print(f"  [EXISTS] Person: {display_name} (id={person.id})")
        else:
            print(f"  [CREATE] Person: {display_name}")
            if not dry:
                person = Person(display_name=display_name, is_active=True)
                db.add(person)
                db.flush()
                print(f"           -> id={person.id}")

        if not dry and person:
            # PlayerAccount
            existing_pa = db.query(PlayerAccount).filter_by(account_id=account_id).first()
            if existing_pa:
                print(f"  [SKIP]   PlayerAccount já existe para {display_name}")
            else:
                pa = PlayerAccount(
                    person_id=person.id,
                    account_id=account_id,
                    shard=SHARD,
                    alias=alias,
                )
                db.add(pa)
                print(f"  [ADD]    PlayerAccount: {alias} | {account_id[:20]}...")

            # Roster
            existing_r = db.query(Roster).filter_by(stage_id=STAGE_ID, person_id=person.id).first()
            if existing_r:
                print(f"  [SKIP]   Roster já existe para {display_name}")
            else:
                r = Roster(
                    stage_id=STAGE_ID,
                    person_id=person.id,
                    team_name=team_name,
                    is_available=True,
                )
                db.add(r)
                print(f"  [ADD]    Roster: stage={STAGE_ID}  team={team_name}")

        print()

    # ── Commit ────────────────────────────────────────────────────────────────
    if dry:
        db.rollback()
        print("[DRY-RUN] Nenhuma alteração salva. Use --confirm para aplicar.")
    else:
        db.commit()
        print("OK Concluido.")
        print("\nProximos passos:")
        print(f"  1. POST /admin/championships/16/reprocess-all")
        print(f"  2. POST /admin/pricing/stages/{STAGE_ID}/recalculate-pricing")
        print(f"  3. Para LAHZAA- (S2G, rsv): ajustar is_available se for ativar")


def main():
    parser = argparse.ArgumentParser(description="Fix Group Stage accounts")
    parser.add_argument("--confirm", action="store_true")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        run(db, confirm=args.confirm)
    except Exception as e:
        db.rollback()
        print(f"\n[ERRO] {e}")
        import traceback; traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    main()
