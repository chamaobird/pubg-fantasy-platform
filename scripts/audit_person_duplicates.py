#!/usr/bin/env python3
"""
audit_person_duplicates.py — Detecta e corrige duplicatas de jogadores/aliases

Operações (em ordem, todas dentro de uma transação):

1. MERGE zkraken (50) → FUR_zKraken (109)
   - move match_stat (40 rows)
   - move roster (stages 3-8)
   - deleta person 50

2. DELETE 7 persons duplicatas sem histórico
   IDs: 324, 325, 326, 327, 328, 332, 333
   (sem accounts, roster nem match_stat — cópias sem tag de time)

3. DELETE player_account duplicatas
   43 pares com mesmo (person_id, account_id, shard) acumulados por troca de time
   Mantém a row de maior ID (alias mais recente)

Uso:
  python scripts/audit_person_duplicates.py          # dry-run (apenas relata)
  python scripts/audit_person_duplicates.py --fix    # aplica as correções
"""

import argparse
import os
import sys
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DRY_RUN_LABEL = "[DRY-RUN]"
FIX_LABEL     = "[FIX]"


def report_section(title: str):
    print(f"\n{'=' * 60}")
    print(f"  {title}")
    print('=' * 60)


def run(fix: bool):
    label = FIX_LABEL if fix else DRY_RUN_LABEL
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = False
    cur = conn.cursor()

    # ------------------------------------------------------------------ #
    # 1. MERGE zkraken (50) → FUR_zKraken (109)                          #
    # ------------------------------------------------------------------ #
    report_section("1. MERGE: zkraken (id=50) -> FUR_zKraken (id=109)")

    DEAD_ID   = 50   # zkraken — sem accounts, partidas pontualmente residuais
    CANON_ID  = 109  # FUR_zKraken — tem player_accounts registrados

    cur.execute("SELECT id, display_name FROM person WHERE id IN (%s, %s)", (DEAD_ID, CANON_ID))
    persons = {r[0]: r[1] for r in cur.fetchall()}
    print(f"  Canônico : id={CANON_ID}  display_name={persons.get(CANON_ID)!r}")
    print(f"  Duplicata: id={DEAD_ID}   display_name={persons.get(DEAD_ID)!r}")

    cur.execute("SELECT COUNT(*) FROM match_stat WHERE person_id = %s", (DEAD_ID,))
    n_ms = cur.fetchone()[0]
    cur.execute("SELECT stage_id FROM roster WHERE person_id = %s ORDER BY stage_id", (DEAD_ID,))
    roster_stages = [r[0] for r in cur.fetchall()]
    print(f"  match_stat a mover : {n_ms}")
    print(f"  roster a mover     : stages {roster_stages}")

    cur.execute("SELECT COUNT(*) FROM person_stage_stat WHERE person_id = %s", (DEAD_ID,))
    n_pss = cur.fetchone()[0]
    cur.execute("SELECT id, team_id FROM team_member WHERE person_id = %s", (DEAD_ID,))
    tm_rows = cur.fetchall()
    print(f"  person_stage_stat a mover: {n_pss}")
    print(f"  team_member a mover       : {tm_rows}")

    if fix:
        cur.execute("UPDATE match_stat SET person_id = %s WHERE person_id = %s", (CANON_ID, DEAD_ID))
        print(f"  {label} match_stat movidos: {cur.rowcount}")

        cur.execute("UPDATE roster SET person_id = %s WHERE person_id = %s", (CANON_ID, DEAD_ID))
        print(f"  {label} roster movidos: {cur.rowcount}")

        cur.execute("UPDATE person_stage_stat SET person_id = %s WHERE person_id = %s", (CANON_ID, DEAD_ID))
        print(f"  {label} person_stage_stat movidos: {cur.rowcount}")

        cur.execute("UPDATE team_member SET person_id = %s WHERE person_id = %s", (CANON_ID, DEAD_ID))
        print(f"  {label} team_member movidos: {cur.rowcount}")

        cur.execute("DELETE FROM person WHERE id = %s", (DEAD_ID,))
        print(f"  {label} person {DEAD_ID} deletado")
    else:
        print(f"  {label} moveria {n_ms} match_stat + {len(roster_stages)} roster + {n_pss} person_stage_stat + {len(tm_rows)} team_member; deletaria person {DEAD_ID}")

    # ------------------------------------------------------------------ #
    # 2. DELETE 7 persons duplicatas sem histórico                        #
    # ------------------------------------------------------------------ #
    report_section("2. DELETE: duplicatas sem tag de time (sem histórico)")

    DEAD_PERSONS = [
        (324, "C4MB4",       196, "BO_C4MB4"),
        (325, "Imsfck1ngbd", 194, "BO_Imsfck1ngbd"),
        (326, "Neyzhera",    195, "BO_Neyzhera"),
        (327, "V-I-R-I",     197, "BO_V-I-R-I"),
        (328, "MIKSUU-",     316, "CLR_MIKSUU-"),
        (332, "gats",        318, "FR_gats"),
        (333, "Plushiee",    317, "INJ_Plushiee"),
    ]

    for dead_id, dead_name, canon_id, canon_name in DEAD_PERSONS:
        # Verificações de segurança
        cur.execute("SELECT COUNT(*) FROM match_stat WHERE person_id = %s", (dead_id,))
        n_ms = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM roster WHERE person_id = %s", (dead_id,))
        n_r = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM player_account WHERE person_id = %s", (dead_id,))
        n_pa = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM person_stage_stat WHERE person_id = %s", (dead_id,))
        n_pss = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM team_member WHERE person_id = %s", (dead_id,))
        n_tm = cur.fetchone()[0]

        safe = (n_ms == 0 and n_r == 0 and n_pa == 0)
        status = "OK" if safe else "UNSAFE -- skipping"

        print(f"  {dead_id:4d} {dead_name!r:<20}  match_stat={n_ms} roster={n_r} accounts={n_pa} pss={n_pss} team_member={n_tm}  [{status}]")

        if fix and safe:
            if n_tm:
                cur.execute("DELETE FROM team_member WHERE person_id = %s", (dead_id,))
            if n_pss:
                cur.execute("DELETE FROM person_stage_stat WHERE person_id = %s", (dead_id,))
            cur.execute("DELETE FROM person WHERE id = %s", (dead_id,))
            print(f"    {label} deletado (team_member={n_tm}, pss={n_pss} removidos)")
        elif fix and not safe:
            print(f"    {label} IGNORADO -- cheque manual necessario")

    # ------------------------------------------------------------------ #
    # 3. DELETE player_account duplicatas (mesmo person+account+shard)   #
    # ------------------------------------------------------------------ #
    report_section("3. DELETE: player_account duplicatas (aliases acumulados)")

    cur.execute("""
        SELECT person_id, account_id, shard,
               COUNT(*)                        AS cnt,
               array_agg(id ORDER BY id)       AS ids,
               array_agg(alias ORDER BY id)    AS aliases
        FROM player_account
        GROUP BY person_id, account_id, shard
        HAVING COUNT(*) > 1
        ORDER BY person_id, account_id
    """)
    dup_groups = cur.fetchall()

    print(f"  Grupos duplicados encontrados: {len(dup_groups)}")
    ids_to_delete = []
    for person_id, account_id, shard, cnt, ids, aliases in dup_groups:
        keep    = max(ids)  # mantém o mais recente (maior ID)
        to_del  = [i for i in ids if i != keep]
        alias_keep = aliases[ids.index(keep)]
        print(f"  person={person_id:4d}  account=...{account_id[-12:]}  cnt={cnt}"
              f"  keep=#{keep}({alias_keep!r})  del={to_del}")
        ids_to_delete.extend(to_del)

    print(f"\n  Total rows a deletar: {len(ids_to_delete)}")

    if fix and ids_to_delete:
        cur.execute("DELETE FROM player_account WHERE id = ANY(%s)", (ids_to_delete,))
        print(f"  {label} deletadas {cur.rowcount} rows de player_account")

    # ------------------------------------------------------------------ #
    # Commit / rollback                                                   #
    # ------------------------------------------------------------------ #
    if fix:
        conn.commit()
        print("\n[OK] Todas as correcoes aplicadas e commitadas.")
    else:
        conn.rollback()
        print(f"\n{DRY_RUN_LABEL} Nenhuma alteracao foi feita. Use --fix para aplicar.")

    cur.close()
    conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Audita e corrige duplicatas de Person/PlayerAccount")
    parser.add_argument("--fix", action="store_true", help="Aplica as correções (default: dry-run)")
    args = parser.parse_args()
    run(fix=args.fix)
