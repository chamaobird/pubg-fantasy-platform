#!/usr/bin/env python3
"""
scripts/fix_stage49_pero_roster.py

Corrige o roster da PeRo na Final Stage (stage 49):
  - Aixleft (id=350): is_available=True  -> False  (titular que saiu)
  - 04NB    (id=67):  is_available=False -> True   (sub que entrou, agora titular)

Após aplicar, dispara recalculate-pricing via API.

Uso:
    python scripts/fix_stage49_pero_roster.py              # dry-run
    python scripts/fix_stage49_pero_roster.py --confirm    # aplica no banco
"""

import sys
import os
import argparse

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import app.models.team      # noqa — resolve FK
import app.models.team_member  # noqa
from app.database import SessionLocal
from app.models.roster import Roster
from app.models.person import Person
from app.models.player_account import PlayerAccount

STAGE_ID    = 49
AIXLEFT_ID  = 350   # titular que saiu (-> reserva)
NB_ID       = 67    # 04NB: sub que entrou (-> titular)
TIAN_ID     = 7     # tiantianhaovo: verificar account pc-tournament

SHARD = "pc-tournament"


def run(db, confirm: bool):
    print(f"\n{'='*60}")
    print(f"FIX PeRo roster — stage {STAGE_ID}  {'[APLICAR]' if confirm else '[DRY-RUN]'}")
    print(f"{'='*60}\n")

    # ── 1. Verificar estado atual ──────────────────────────────────────────────
    aixleft_r = db.query(Roster).filter_by(stage_id=STAGE_ID, person_id=AIXLEFT_ID).first()
    nb_r      = db.query(Roster).filter_by(stage_id=STAGE_ID, person_id=NB_ID).first()

    if not aixleft_r:
        print(f"  [ERRO] Aixleft (id={AIXLEFT_ID}) não encontrado no roster stage {STAGE_ID}")
        return
    if not nb_r:
        print(f"  [ERRO] 04NB (id={NB_ID}) não encontrado no roster stage {STAGE_ID}")
        return

    print(f"  Estado atual:")
    print(f"    Aixleft (id={AIXLEFT_ID}): is_available={aixleft_r.is_available}  -> sera False")
    print(f"    04NB    (id={NB_ID}): is_available={nb_r.is_available}      -> sera True")
    print()

    # ── 2. Verificar PlayerAccount do tiantianhaovo ────────────────────────────
    tian_accounts = db.query(PlayerAccount).filter_by(person_id=TIAN_ID, shard=SHARD).all()
    tian = db.query(Person).filter_by(id=TIAN_ID).first()
    tian_name = tian.display_name if tian else f"id={TIAN_ID}"

    print(f"  PlayerAccounts {tian_name} (shard={SHARD}):")
    if tian_accounts:
        for a in tian_accounts:
            is_pending = a.account_id.startswith("PENDING_")
            status = "PENDING — precisará ser resolvido antes de importar Day 2!" if is_pending else "OK"
            print(f"    account_id={a.account_id}  alias={a.alias}  [{status}]")
    else:
        print(f"    NENHUMA CONTA — Day 2 não resolverá stats do tiantianhaovo!")
        print(f"    Adicione via: POST /admin/persons/{TIAN_ID}/accounts")
    print()

    if confirm:
        # ── 3. Aplicar swap ────────────────────────────────────────────────────
        aixleft_r.is_available = False
        nb_r.is_available      = True
        db.commit()
        print("  [OK] Roster atualizado:")
        print(f"    Aixleft -> is_available=False")
        print(f"    04NB    -> is_available=True")
        print()
        print("  Próximo passo: Execute repricing via admin panel ou:")
        print(f"    POST /admin/pricing/stages/{STAGE_ID}/recalculate-pricing")

    else:
        print("  [DRY-RUN] Nenhuma alteração aplicada. Use --confirm para aplicar.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--confirm", action="store_true", help="Aplica as mudanças no banco")
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
