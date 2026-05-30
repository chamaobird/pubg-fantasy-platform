#!/usr/bin/env python3
"""
Diagnose tiantianhaovo stats for stage 49 (Final Stage).
Usage:
    python scripts/diagnose_tiantian_stage49.py
    python scripts/diagnose_tiantian_stage49.py --fix
"""
import sys, os, argparse
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import app.models.team_member  # noqa
from app.database import SessionLocal
from app.models.person import Person
from app.models.player_account import PlayerAccount
from app.models.roster import Roster
from app.models.substitution import StageSubstitution
from app.models.match_stat import MatchStat
from app.models.match import Match

STAGE_ID     = 49
STAGE_DAY_ID = 52   # Final Day 1
SHARD        = "pc-tournament"


def run(db, fix: bool = False):
    print(f"\n{'='*60}")
    print(f"DIAGNOSE tiantianhaovo — stage={STAGE_ID} day={STAGE_DAY_ID}")
    print(f"{'FIX MODE' if fix else 'DRY-RUN'}")
    print(f"{'='*60}\n")

    # 1. Substitutions for stage 49
    subs = db.query(StageSubstitution).filter_by(stage_id=STAGE_ID).all()
    print("--- Substituições registradas ---")
    for s in subs:
        out_p = db.query(Person).get(s.out_person_id)
        in_p  = db.query(Person).get(s.in_person_id)
        print(f"  {out_p.display_name if out_p else '?'} (id={s.out_person_id}) "
              f"→ {in_p.display_name if in_p else '?'} (id={s.in_person_id})")
    print()

    # 2. All persons like tiantian
    persons = db.query(Person).filter(
        Person.display_name.ilike('%tiantian%')
    ).all()
    print(f"--- Persons com nome *tiantian* ---")
    for p in persons:
        roster = db.query(Roster).filter_by(stage_id=STAGE_ID, person_id=p.id).first()
        accounts = db.query(PlayerAccount).filter_by(person_id=p.id).all()
        stats = (
            db.query(MatchStat)
            .join(Match, MatchStat.match_id == Match.id)
            .filter(Match.stage_day_id == STAGE_DAY_ID, MatchStat.person_id == p.id)
            .all()
        )
        print(f"\n  Person id={p.id}  name='{p.display_name}'  active={p.is_active}")
        if roster:
            print(f"  Roster stage49: id={roster.id}  is_available={roster.is_available}  team={roster.team_name}")
        else:
            print(f"  Roster stage49: NOT FOUND")
        print(f"  PlayerAccounts ({len(accounts)}):")
        for a in accounts:
            print(f"    shard={a.shard}  account_id={a.account_id}  alias={a.alias}")
        print(f"  MatchStats day52: {len(stats)} registros")
        if stats:
            sample = stats[0]
            print(f"    ex: kills={sample.kills} damage={sample.damage} fantasy_points={sample.fantasy_points}")

    # 3. Unresolved aliases in match stats for day 52
    print(f"\n--- MatchStats do dia {STAGE_DAY_ID} sem Person mapeado ---")
    all_stats = (
        db.query(MatchStat)
        .join(Match, MatchStat.match_id == Match.id)
        .filter(Match.stage_day_id == STAGE_DAY_ID)
        .all()
    )
    # Find stats where person has no roster entry in stage 49
    roster_persons = {
        r.person_id for r in db.query(Roster).filter_by(stage_id=STAGE_ID).all()
    }
    orphan_stats = [s for s in all_stats if s.person_id not in roster_persons]
    if orphan_stats:
        print(f"  {len(orphan_stats)} stats de persons fora do roster stage49:")
        seen = set()
        for s in orphan_stats:
            if s.person_id in seen:
                continue
            seen.add(s.person_id)
            p = db.query(Person).get(s.person_id)
            name = p.display_name if p else f"id={s.person_id}"
            print(f"    person_id={s.person_id}  name={name}  kills={s.kills}")
    else:
        print("  Nenhum — todos os stats mapeados para persons no roster.")

    print()

    # 4. Fix: se há dois tiantianhaovo, garantir que o que tem stats é is_available=True
    if fix and len(persons) >= 1:
        # Check substitution to find the "correct" tiantianhaovo (in_person_id of sub)
        tian_sub = None
        for s in subs:
            in_p = db.query(Person).get(s.in_person_id)
            if in_p and 'tiantian' in in_p.display_name.lower():
                tian_sub = s
                break

        if tian_sub:
            correct_id = tian_sub.in_person_id
            for p in persons:
                roster = db.query(Roster).filter_by(stage_id=STAGE_ID, person_id=p.id).first()
                if not roster:
                    continue
                if p.id == correct_id:
                    if not roster.is_available:
                        print(f"  [FIX] Person {p.id} ({p.display_name}) → is_available=True (é o sub correto)")
                        roster.is_available = True
                else:
                    if roster.is_available:
                        print(f"  [FIX] Person {p.id} ({p.display_name}) → is_available=False (duplicata)")
                        roster.is_available = False
            db.commit()
            print("  Commit OK")
        else:
            print("  Nenhuma substituição encontrada com tiantian como in_person — fix manual necessário")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--fix", action="store_true")
    args = parser.parse_args()
    db = SessionLocal()
    try:
        run(db, fix=args.fix)
    except Exception as e:
        db.rollback()
        print(f"\n[ERRO] {e}")
        import traceback; traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    main()
