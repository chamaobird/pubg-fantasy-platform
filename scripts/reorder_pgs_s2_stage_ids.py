#!/usr/bin/env python3
"""
scripts/reorder_pgs_s2_stage_ids.py

Reordena os IDs dos stages do PGS S2 para sequência cronológica:
  42 → Group Stage   (May 20)
  43 → Winners Stage (May 21)
  44 → Survival Stage (May 22)
  45 → Final Stage Day 1 (May 23)
  46 → Final Stage Day 2 (May 24)

Estratégia:
  1. Dropa todas as FK constraints que referenciam stage.id
  2. Move stages para IDs temporários (evita conflito)
  3. Move para IDs finais
  4. Recria FK constraints
  5. Atualiza sequence

Uso:
    python scripts/reorder_pgs_s2_stage_ids.py          # dry-run (lista o que faria)
    python scripts/reorder_pgs_s2_stage_ids.py --confirm
"""

import sys
import os
import argparse

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import engine
from sqlalchemy import text

# Mapeamento: current_id → final_id
# 46=Group, 42=Winners, 43=Survival, 44=FinalD1, 47=FinalD2
REMAP = {
    46: 42,   # Group Stage
    42: 43,   # Winners Stage
    43: 44,   # Survival Stage
    44: 45,   # Final Stage Day 1
    47: 46,   # Final Stage Day 2
}

TEMP_OFFSET = 9000  # IDs temporários: 9042, 9043, etc.

# Tabelas filho que têm stage_id FK
CHILD_TABLES = [
    "stage_day",
    "roster",
    "roster_change_log",
    "person_stage_stat",
    "user_stage_stat",
]

# FK constraints: (tabela, constraint_name, on_delete)
FK_CONSTRAINTS = [
    ("person_stage_stat", "person_stage_stat_stage_id_fkey", "RESTRICT"),
    ("roster",            "roster_stage_id_fkey",            "RESTRICT"),
    ("roster_change_log", "roster_change_log_stage_id_fkey", "CASCADE"),
    ("stage",             "stage_roster_source_stage_id_fkey", "SET NULL"),   # self-ref: roster_source_stage_id
    ("stage_day",         "stage_day_stage_id_fkey",          "RESTRICT"),
    ("user_stage_stat",   "user_stage_stat_stage_id_fkey",    "RESTRICT"),
]

# FK self-ref usa coluna diferente
SELF_REF_COL = "roster_source_stage_id"


def run(confirm: bool):
    # Verificação prévia (read-only)
    with engine.connect() as conn:
        print("\n=== ESTADO ATUAL ===")
        for cur_id, final_id in sorted(REMAP.items(), key=lambda x: x[1]):
            row = conn.execute(text(
                "SELECT id, name, start_date FROM stage WHERE id=:id"
            ), {"id": cur_id}).fetchone()
            if row:
                print(f"  stage {cur_id} -> {final_id}:  {row.name}  ({row.start_date.date()})")
            else:
                print(f"  stage {cur_id}: NAO ENCONTRADA")

    if not confirm:
        print("\n[DRY-RUN] Use --confirm para aplicar.")
        return

    print("\n=== EXECUTANDO ===")
    with engine.begin() as conn:
        try:
            # ── 1. Dropa FK constraints ───────────────────────────────────────
            for table, constraint, _ in FK_CONSTRAINTS:
                conn.execute(text(
                    f"ALTER TABLE {table} DROP CONSTRAINT IF EXISTS {constraint}"
                ))
                print(f"  [DROP FK] {table}.{constraint}")

            # ── 2. Move para IDs temporários ──────────────────────────────────
            for cur_id in REMAP:
                tmp_id = cur_id + TEMP_OFFSET
                for tbl in CHILD_TABLES:
                    conn.execute(text(
                        f"UPDATE {tbl} SET stage_id=:tmp WHERE stage_id=:cur"
                    ), {"tmp": tmp_id, "cur": cur_id})
                # self-ref
                conn.execute(text(
                    "UPDATE stage SET roster_source_stage_id=:tmp WHERE roster_source_stage_id=:cur"
                ), {"tmp": tmp_id, "cur": cur_id})
                conn.execute(text(
                    "UPDATE stage SET id=:tmp WHERE id=:cur"
                ), {"tmp": tmp_id, "cur": cur_id})
                print(f"  [TEMP] stage {cur_id} -> {tmp_id}")

            # ── 3. Move para IDs finais ───────────────────────────────────────
            for cur_id, final_id in REMAP.items():
                tmp_id = cur_id + TEMP_OFFSET
                for tbl in CHILD_TABLES:
                    conn.execute(text(
                        f"UPDATE {tbl} SET stage_id=:final WHERE stage_id=:tmp"
                    ), {"final": final_id, "tmp": tmp_id})
                conn.execute(text(
                    "UPDATE stage SET roster_source_stage_id=:final WHERE roster_source_stage_id=:tmp"
                ), {"final": final_id, "tmp": tmp_id})
                conn.execute(text(
                    "UPDATE stage SET id=:final WHERE id=:tmp"
                ), {"final": final_id, "tmp": tmp_id})
                print(f"  [FINAL] stage {tmp_id} -> {final_id}")

            # ── 4. Recria FK constraints ──────────────────────────────────────
            fk_defs = {
                "person_stage_stat_stage_id_fkey":   "ALTER TABLE person_stage_stat ADD CONSTRAINT person_stage_stat_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES stage(id) ON DELETE RESTRICT",
                "roster_stage_id_fkey":              "ALTER TABLE roster ADD CONSTRAINT roster_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES stage(id) ON DELETE RESTRICT",
                "roster_change_log_stage_id_fkey":   "ALTER TABLE roster_change_log ADD CONSTRAINT roster_change_log_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES stage(id) ON DELETE CASCADE",
                "stage_roster_source_stage_id_fkey": "ALTER TABLE stage ADD CONSTRAINT stage_roster_source_stage_id_fkey FOREIGN KEY (roster_source_stage_id) REFERENCES stage(id) ON DELETE SET NULL",
                "stage_day_stage_id_fkey":           "ALTER TABLE stage_day ADD CONSTRAINT stage_day_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES stage(id) ON DELETE RESTRICT",
                "user_stage_stat_stage_id_fkey":     "ALTER TABLE user_stage_stat ADD CONSTRAINT user_stage_stat_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES stage(id) ON DELETE RESTRICT",
            }
            for name, ddl in fk_defs.items():
                conn.execute(text(ddl))
                print(f"  [ADD FK] {name}")

            # ── 5. Atualiza sequence ──────────────────────────────────────────
            conn.execute(text(
                "SELECT setval(pg_get_serial_sequence('stage', 'id'), (SELECT MAX(id) FROM stage))"
            ))
            print(f"  [SEQ] sequence atualizada para MAX(id)")

            print("\nOK commit concluido.")  # engine.begin() auto-commita ao sair do with

        except Exception as e:
            print(f"\n[ERRO] Rollback executado: {e}")
            raise

    # Verificação final (nova conexão após commit)
    with engine.connect() as conn:
        print("\n=== RESULTADO FINAL ===")
        rows = conn.execute(text(
            "SELECT id, short_name, start_date, lineup_status FROM stage "
            "WHERE id BETWEEN 42 AND 50 ORDER BY id"
        )).fetchall()
        for r in rows:
            print(f"  id={r.id}  {r.short_name:<10}  {r.start_date.date()}  lineup={r.lineup_status}")


def main():
    parser = argparse.ArgumentParser(description="Reorder PGS S2 stage IDs")
    parser.add_argument("--confirm", action="store_true")
    args = parser.parse_args()
    run(confirm=args.confirm)


if __name__ == "__main__":
    main()
