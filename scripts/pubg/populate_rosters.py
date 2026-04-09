"""
scripts/pubg/populate_rosters.py
─────────────────────────────────
Cria Roster entries para cada jogador que participou de cada stage,
baseado nos MatchStats já importados no banco.

Lógica:
  Para cada Stage → busca person_ids distintos com MatchStat naquela stage
  → cria Roster(stage_id, person_id, team_name, newcomer_to_tier=False)

team_name é extraído do PlayerAccount.alias mais recente do jogador
no shard pc-tournament (ex: "GNS_SuccessStory" → team_name="GNS").

Idempotente — ignora rosters já existentes.

Uso (da raiz do projeto):
    python scripts/pubg/populate_rosters.py
    python scripts/pubg/populate_rosters.py --dry-run
"""
from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

from dotenv import load_dotenv

# ── Bootstrap ─────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

from app.database import SessionLocal                    # noqa: E402
from app.models.match import Match                       # noqa: E402
from app.models.match_stat import MatchStat              # noqa: E402
from app.models.player_account import PlayerAccount      # noqa: E402
from app.models.roster import Roster                     # noqa: E402
from app.models.stage import Stage                       # noqa: E402
from app.models.stage_day import StageDay                # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

SHARD = "pc-tournament"


def parse_team_tag(alias: str) -> str | None:
    """'GNS_SuccessStory' → 'GNS'. Sem '_' → None."""
    if alias and "_" in alias:
        return alias.split("_", 1)[0]
    return None


def main(dry_run: bool) -> None:
    print("\n" + "=" * 65)
    print("  XAMA Fantasy — Populate Rosters")
    print("=" * 65)
    if dry_run:
        print("  DRY RUN — nenhuma alteracao sera feita\n")

    db = SessionLocal()
    total_created = 0
    total_skipped = 0

    try:
        stages = db.query(Stage).filter(Stage.is_active == True).order_by(Stage.id).all()  # noqa: E712
        log.info("Stages ativas: %d", len(stages))

        # Pré-carrega aliases mais recentes por person_id
        # (último PlayerAccount registrado no shard pc-tournament)
        accounts = (
            db.query(PlayerAccount.person_id, PlayerAccount.alias)
            .filter(PlayerAccount.shard == SHARD)
            .order_by(PlayerAccount.person_id, PlayerAccount.active_from.desc())
            .all()
        )
        # Mantém apenas o mais recente por person_id
        alias_map: dict[int, str] = {}
        for person_id, alias in accounts:
            if person_id not in alias_map and alias:
                alias_map[person_id] = alias

        # Pré-carrega rosters existentes como set (stage_id, person_id)
        existing_rosters: set[tuple[int, int]] = {
            (r.stage_id, r.person_id)
            for r in db.query(Roster.stage_id, Roster.person_id).all()
        }

        for stage in stages:
            # Busca person_ids distintos com MatchStat nesta stage
            person_ids = [
                row[0] for row in (
                    db.query(MatchStat.person_id)
                    .join(Match, MatchStat.match_id == Match.id)
                    .join(StageDay, Match.stage_day_id == StageDay.id)
                    .filter(StageDay.stage_id == stage.id)
                    .distinct()
                    .all()
                )
            ]

            if not person_ids:
                log.info("  Stage %-8s — sem match_stats, pulando", stage.short_name)
                continue

            created = skipped = 0
            for person_id in person_ids:
                if (stage.id, person_id) in existing_rosters:
                    skipped += 1
                    continue

                alias     = alias_map.get(person_id, "")
                team_name = parse_team_tag(alias)

                if dry_run:
                    created += 1
                    continue

                roster = Roster(
                    stage_id         = stage.id,
                    person_id        = person_id,
                    team_name        = team_name,
                    newcomer_to_tier = False,
                    is_available     = True,
                )
                db.add(roster)
                existing_rosters.add((stage.id, person_id))
                created += 1

            log.info(
                "  Stage %-8s — %d jogadores: %d criados, %d ja existiam",
                stage.short_name, len(person_ids), created, skipped,
            )
            total_created += created
            total_skipped += skipped

        if not dry_run:
            db.commit()
            log.info("Banco commitado")

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    print("\n" + "=" * 65)
    print("  Resumo")
    print("=" * 65)
    print(f"  Rosters criados     : {total_created}")
    print(f"  Ja existiam         : {total_skipped}")
    if dry_run:
        print("\n  DRY RUN — nenhuma alteracao foi feita")
    else:
        print("\n  Concluido")
    print("=" * 65 + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Populate rosters PGS 2026")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    main(dry_run=args.dry_run)
