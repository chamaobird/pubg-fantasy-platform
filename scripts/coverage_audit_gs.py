#!/usr/bin/env python3
"""
scripts/coverage_audit_gs.py

Mostra jogadores do roster do PGS S2 (championship 16) que pontuaram
em menos partidas do que o total importado.

Útil para identificar quem não tem PlayerAccount vinculado.

Uso:
    python scripts/coverage_audit_gs.py
"""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text
from app.database import SessionLocal

CHAMPIONSHIP_ID = 16


def run(db):
    rows = db.execute(text("""
        WITH stage_match_counts AS (
            SELECT sd.stage_id, COUNT(DISTINCT m.id) AS total_matches
            FROM match m
            JOIN stage_day sd ON sd.id = m.stage_day_id
            GROUP BY sd.stage_id
        ),
        player_appearances AS (
            SELECT sd.stage_id, ms.person_id, COUNT(DISTINCT ms.match_id) AS matches_appeared
            FROM match_stat ms
            JOIN match m ON m.id = ms.match_id
            JOIN stage_day sd ON sd.id = m.stage_day_id
            GROUP BY sd.stage_id, ms.person_id
        )
        SELECT
            r.stage_id,
            s.name            AS stage_name,
            s.shard,
            r.person_id,
            p.display_name,
            r.team_name,
            r.is_available,
            COALESCE(pa.matches_appeared, 0)  AS matches_appeared,
            smc.total_matches
        FROM roster r
        JOIN person p ON p.id = r.person_id
        JOIN stage s ON s.id = r.stage_id
        LEFT JOIN player_appearances pa ON pa.stage_id = r.stage_id AND pa.person_id = r.person_id
        LEFT JOIN stage_match_counts smc ON smc.stage_id = r.stage_id
        WHERE s.championship_id = :cid
          AND smc.total_matches > 0
          AND COALESCE(pa.matches_appeared, 0) < smc.total_matches
        ORDER BY COALESCE(pa.matches_appeared, 0) ASC, r.stage_id, r.team_name, p.display_name
    """), {"cid": CHAMPIONSHIP_ID}).fetchall()

    if not rows:
        print("Nenhuma gap encontrada — todos os jogadores resolvidos!")
        return

    # Load PlayerAccounts for persons in gaps
    person_ids = list({r.person_id for r in rows})
    acc_rows = db.execute(text("""
        SELECT person_id, alias, account_id, shard
        FROM player_account
        WHERE person_id = ANY(:pids)
        ORDER BY person_id, active_from
    """), {"pids": person_ids}).fetchall()

    accounts_by_person: dict[int, list[str]] = {}
    for ar in acc_rows:
        label = f"{ar.alias} | {ar.account_id[:20]}... ({ar.shard})" if ar.alias else f"{ar.account_id[:24]}... ({ar.shard})"
        accounts_by_person.setdefault(ar.person_id, []).append(label)

    # Group by stage
    from collections import defaultdict
    by_stage: dict = defaultdict(list)
    for r in rows:
        by_stage[(r.stage_id, r.stage_name, r.total_matches)].append(r)

    total_zero = sum(1 for r in rows if r.matches_appeared == 0)
    print(f"\n{'='*70}")
    print(f"COVERAGE AUDIT — championship {CHAMPIONSHIP_ID}")
    print(f"Total gaps: {len(rows)}   Zero coverage: {total_zero}")
    print(f"{'='*70}\n")

    for (stage_id, stage_name, total_matches), stage_rows in sorted(by_stage.items()):
        zero_count = sum(1 for r in stage_rows if r.matches_appeared == 0)
        print(f"Stage {stage_id}: {stage_name}  (total_matches={total_matches}  gaps={len(stage_rows)}  zero={zero_count})")
        print(f"  {'person_id':>9}  {'display_name':<22}  {'team_name':<25}  {'avail':>5}  {'appeared':>8}  accounts")
        print(f"  {'-'*9}  {'-'*22}  {'-'*25}  {'-'*5}  {'-'*8}  {'-'*40}")
        for r in stage_rows:
            accts = accounts_by_person.get(r.person_id, [])
            acct_str = accts[0] if accts else "*** SEM PLAYER_ACCOUNT ***"
            avail = "Y" if r.is_available else "rsv"
            marker = " !!!" if r.matches_appeared == 0 else ""
            print(f"  {r.person_id:>9}  {r.display_name:<22}  {r.team_name:<25}  {avail:>5}  {r.matches_appeared:>4}/{total_matches:<3}  {acct_str}{marker}")
            for extra_acct in accts[1:]:
                print(f"  {'':<9}  {'':<22}  {'':<25}  {'':<5}  {'':<8}  {extra_acct}")
        print()

    print("Próximo passo: python scripts/unresolved_scan_gs.py")
    print("  para ver os aliases reais da API PUBG e sugestões de match\n")


def main():
    db = SessionLocal()
    try:
        run(db)
    except Exception as e:
        print(f"\n[ERRO] {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
