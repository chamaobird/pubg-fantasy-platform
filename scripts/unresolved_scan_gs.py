#!/usr/bin/env python3
"""
scripts/unresolved_scan_gs.py

Escaneia os matches importados da Group Stage (championship 16) e mostra
jogadores que não foram resolvidos — com alias real da API PUBG e sugestão
de Person do roster.

Uso:
    python scripts/unresolved_scan_gs.py               # escaneia 1a partida de cada match
    python scripts/unresolved_scan_gs.py --all         # escaneia todas as partidas
    python scripts/unresolved_scan_gs.py --stage 45    # filtra por stage_id específico
"""

import sys
import os
import argparse
from collections import defaultdict
from difflib import SequenceMatcher

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import app.models.team_member  # noqa: F401
from app.models.team import Team  # noqa: F401
from sqlalchemy import text
from app.database import SessionLocal
from app.pubg.client import PubgClient, PubgApiError
from app.services.identity import build_lookup, resolve_from_lookup
from app.models.stage import Stage
from app.models.stage_day import StageDay
from app.models.match import Match
from app.models.roster import Roster
from app.models.person import Person

CHAMPIONSHIP_ID = 16


def _suggest(alias: str, candidates: list[dict]) -> dict | None:
    """Tenta sugerir Person para um alias não-resolvido."""
    alias_lower = alias.lower()
    best = None
    best_score = 0

    for cand in candidates:
        name_lower = cand["display_name"].lower()
        score = 0

        if alias_lower.endswith(name_lower):
            score = 95
        elif name_lower and name_lower in alias_lower:
            score = 75
        elif alias_lower in name_lower:
            score = 70
        else:
            # Fuzzy match
            ratio = SequenceMatcher(None, alias_lower, name_lower).ratio()
            if ratio >= 0.6:
                score = int(ratio * 65)
            # Team prefix heuristic
            parts = alias.split("_")
            prefix = parts[0].lower() if parts else ""
            team_lower = (cand["team_name"] or "").lower()
            if prefix and len(prefix) >= 2 and prefix in team_lower:
                score = max(score, 60)

        if score > best_score:
            best_score = score
            best = {**cand, "confidence": score}

    return best if best_score >= 55 else None


def run(db, stage_filter: int | None, scan_all: bool):
    stages = (
        db.query(Stage)
        .filter(Stage.championship_id == CHAMPIONSHIP_ID, Stage.is_active == True)  # noqa
        .order_by(Stage.id)
        .all()
    )
    if stage_filter:
        stages = [s for s in stages if s.id == stage_filter]

    if not stages:
        print(f"Nenhuma stage ativa encontrada para championship {CHAMPIONSHIP_ID}")
        return

    all_unresolved: list[dict] = []
    seen_accounts: set[str] = set()

    for stage in stages:
        # Carrega roster candidates para sugestão
        roster_rows = (
            db.query(Roster, Person)
            .join(Person, Person.id == Roster.person_id)
            .filter(Roster.stage_id == stage.id)
            .all()
        )
        candidates = [
            {"person_id": r.person_id, "display_name": p.display_name, "team_name": r.team_name}
            for r, p in roster_rows
        ]

        lookup = build_lookup(db, stage.id)

        matches_q = (
            db.query(Match)
            .join(StageDay, Match.stage_day_id == StageDay.id)
            .filter(StageDay.stage_id == stage.id)
            .order_by(Match.id)
        )
        if not scan_all:
            matches_q = matches_q.limit(3)
        matches = matches_q.all()

        if not matches:
            print(f"Stage {stage.id} ({stage.name}): nenhuma partida importada\n")
            continue

        client = PubgClient(shard=stage.shard)
        stage_unresolved = []

        print(f"Escaneando stage {stage.id} ({stage.name}) — {len(matches)} partidas...")

        for match in matches:
            try:
                raw = client.get_match(match.pubg_match_id)
            except PubgApiError as exc:
                print(f"  [ERRO] match {match.pubg_match_id[:12]}...: {exc}")
                continue

            for rps in raw.player_stats:
                if resolve_from_lookup(lookup, rps.account_id, rps.alias) is None:
                    if rps.account_id not in seen_accounts:
                        seen_accounts.add(rps.account_id)
                        suggestion = _suggest(rps.alias, candidates)
                        entry = {
                            "stage_id":              stage.id,
                            "stage_name":            stage.name,
                            "pubg_match_id":         match.pubg_match_id,
                            "account_id":            rps.account_id,
                            "alias":                 rps.alias,
                            "suggested_person_id":   suggestion["person_id"] if suggestion else None,
                            "suggested_name":        suggestion["display_name"] if suggestion else None,
                            "suggested_team":        suggestion["team_name"] if suggestion else None,
                            "confidence":            suggestion["confidence"] if suggestion else 0,
                        }
                        stage_unresolved.append(entry)
                        all_unresolved.append(entry)

        if stage_unresolved:
            print(f"  {len(stage_unresolved)} não-resolvidos:\n")
            # Agrupa por equipe sugerida
            by_team: dict = defaultdict(list)
            no_team = []
            for e in stage_unresolved:
                if e["suggested_team"]:
                    by_team[e["suggested_team"]].append(e)
                else:
                    no_team.append(e)

            def _print_entry(e):
                conf_str = f"conf={e['confidence']:3d}%" if e["suggested_person_id"] else "conf=  0%"
                suggest_str = f"-> id={e['suggested_person_id']:4d} {e['suggested_name']:<20s} ({e['suggested_team']})" if e["suggested_person_id"] else "-> SEM SUGESTAO"
                print(f"    alias: {e['alias']:<30s}  {conf_str}  {suggest_str}")
                print(f"           account_id: {e['account_id']}")
                print(f"           POST /admin/persons/{{person_id}}/accounts  body: account_id={e['account_id']!r}  alias={e['alias']!r}  shard={e['stage_id']} (pc-tournament)")
                print()

            for team, entries in sorted(by_team.items()):
                print(f"  [{team}]")
                for e in entries:
                    _print_entry(e)

            if no_team:
                print(f"  [SEM MATCH — identificar manualmente]")
                for e in no_team:
                    _print_entry(e)
        else:
            print(f"  Todos resolvidos!\n")

    print(f"\n{'='*70}")
    print(f"TOTAL NÃO-RESOLVIDOS: {len(all_unresolved)}")
    if all_unresolved:
        print(f"\nApós vincular todos os accounts:")
        print(f"  POST /admin/championships/{CHAMPIONSHIP_ID}/reprocess-all")
    print()


def main():
    parser = argparse.ArgumentParser(description="Scan unresolved players in Group Stage")
    parser.add_argument("--all",   action="store_true", help="Escaneia todas as partidas (default: 3 por stage)")
    parser.add_argument("--stage", type=int,            help="Filtra por stage_id específico")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        run(db, stage_filter=args.stage, scan_all=args.all)
    except Exception as e:
        db.rollback()
        print(f"\n[ERRO] {e}")
        import traceback; traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    main()
