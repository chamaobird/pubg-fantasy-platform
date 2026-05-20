#!/usr/bin/env python3
"""
scripts/split_pgs_s2_final_stage.py

Divide o Final Stage (44) em dois stages independentes:
  - Stage 44  → "Final Stage Day 1"  (May 23, lineup separado)
  - Novo stage → "Final Stage Day 2"  (May 24, lineup separado)

Permite que usuários submetam lineup diferente para cada dia da Final.

Uso:
    python scripts/split_pgs_s2_final_stage.py          # dry-run
    python scripts/split_pgs_s2_final_stage.py --confirm

IDs produção:
    championship=16, Final Stage=44
"""

import sys
import os
import argparse
from datetime import datetime, date, timezone
from decimal import Decimal

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal
from app.models.stage import Stage
from app.models.stage_day import StageDay

CHAMPIONSHIP_ID  = 16
FINAL_STAGE_ID   = 44

D1_UTC = datetime(2026, 5, 23, 10, 0, tzinfo=timezone.utc)  # 06:00 EDT
D2_UTC = datetime(2026, 5, 24, 10, 0, tzinfo=timezone.utc)  # 06:00 EDT


def run(db, confirm: bool):

    stage44 = db.query(Stage).filter_by(id=FINAL_STAGE_ID).first()
    if not stage44:
        print(f"[ERRO] Stage {FINAL_STAGE_ID} nao encontrada")
        return

    print(f"[ATUAL] Stage {FINAL_STAGE_ID}: name={stage44.name!r}  start={stage44.start_date}  end={stage44.end_date}")

    # ── 1. Remove StageDay 2 de stage 44 ──────────────────────────────────────
    day2 = db.query(StageDay).filter_by(stage_id=FINAL_STAGE_ID, day_number=2).first()
    if day2:
        print(f"[DELETE] StageDay id={day2.id} (day=2, {day2.date}) de stage 44")
        if confirm:
            db.delete(day2)
            db.flush()
    else:
        print(f"[SKIP] StageDay 2 nao encontrado em stage 44")

    # ── 2. Atualiza stage 44 → "Final Stage Day 1" ────────────────────────────
    print(f"[UPDATE] Stage 44: name -> 'Final Stage Day 1'  end_date -> {D1_UTC.date()}")
    if confirm:
        stage44.name       = "Final Stage Day 1"
        stage44.short_name = "Final D1"
        stage44.end_date   = D1_UTC

    # ── 3. Cria novo stage "Final Stage Day 2" ────────────────────────────────
    existing_d2 = db.query(Stage).filter_by(
        championship_id=CHAMPIONSHIP_ID, name="Final Stage Day 2"
    ).first()

    if existing_d2:
        print(f"[SKIP] Stage 'Final Stage Day 2' ja existe: id={existing_d2.id}")
    else:
        print(f"[CREATE] Stage 'Final Stage Day 2'  start={D2_UTC.date()}  lineup=closed")
        if confirm:
            new_stage = Stage(
                championship_id    = CHAMPIONSHIP_ID,
                name               = "Final Stage Day 2",
                short_name         = "Final D2",
                shard              = "pc-tournament",
                lineup_size        = 4,
                captain_multiplier = Decimal("1.30"),
                price_min          = 10,
                price_max          = 35,
                pricing_newcomer_cost = 15,
                lineup_status      = "closed",
                stage_phase        = "upcoming",
                start_date         = D2_UTC,
                end_date           = D2_UTC,
                lineup_close_at    = D2_UTC,
                lineup_open_at     = None,
            )
            db.add(new_stage)
            db.flush()
            print(f"         -> id={new_stage.id}")

            # StageDay para o novo stage
            sd = StageDay(
                stage_id       = new_stage.id,
                day_number     = 1,
                date           = date(2026, 5, 24),
                lineup_close_at= D2_UTC,
            )
            db.add(sd)
            db.flush()
            print(f"[CREATE] StageDay 1: May 24 2026  -> id={sd.id}")

    if confirm:
        db.commit()
        print("\nOK concluido.")
        print("  Stages finais: 44 (Final D1 May 23) + novo (Final D2 May 24)")
        print("  Proximo passo: seed roster + pricing para ambas quando souber os 16 finalistas")
    else:
        db.rollback()
        print("\n[DRY-RUN] Use --confirm para aplicar.")


def main():
    parser = argparse.ArgumentParser(description="Split PGS S2 Final Stage into D1 + D2")
    parser.add_argument("--confirm", action="store_true")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        run(db, confirm=args.confirm)
    except Exception as e:
        db.rollback()
        print(f"\n[ERRO] {e}")
        import traceback; traceback.print_exc()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
