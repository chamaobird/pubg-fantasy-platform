# ─────────────────────────────────────────────────────────────────────────────
# FILE 1 — app/services/scheduler.py  (new file)
# ─────────────────────────────────────────────────────────────────────────────
"""
APScheduler-based auto-import for active tournaments.

What it does
────────────
Every 15 minutes, for every tournament with status='active':
  1. Calls import_matches_from_pubg() if the tournament has a pubg_id
  2. If new matches were created, calls recalculate_prices()
  3. Logs a summary — no exceptions bubble up to crash the scheduler

Design decisions
────────────────
- Uses BackgroundScheduler (thread-based), not AsyncScheduler.
  FastAPI's lifespan is async but the job itself uses a sync SQLAlchemy
  session — mixing asyncio schedulers with sync ORM is error-prone.
  BackgroundScheduler runs the job in a thread pool, which is correct here.

- One DB session per job run, closed in a finally block.

- If import finds 0 new matches (all skipped), recalculate_prices is NOT
  called — no point recomputing prices when nothing changed.

- The scheduler is started/stopped inside FastAPI's lifespan context so it
  shuts down cleanly when the container stops.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler

from app.database import SessionLocal
from app.models import Tournament

logger = logging.getLogger(__name__)

# Interval in minutes — 15 catches any finished match within one cycle
IMPORT_INTERVAL_MINUTES = 15


def _run_import_cycle() -> None:
    """
    Single scheduler job. Runs in a background thread every N minutes.
    Creates its own DB session and closes it when done.
    """
    db = SessionLocal()
    try:
        # ── Find all active tournaments with a real pubg_id ───────────────
        active = (
            db.query(Tournament)
            .filter(
                Tournament.status == "active",
                Tournament.pubg_id.isnot(None),
            )
            .all()
        )

        if not active:
            logger.debug("Scheduler: no active tournaments with pubg_id — skipping cycle")
            return

        logger.info(
            "Scheduler: starting import cycle for %s active tournament(s)",
            len(active),
        )

        for tournament in active:
            _process_tournament(db, tournament)

    except Exception as exc:  # noqa: BLE001
        logger.error("Scheduler: unhandled error in import cycle: %s", exc)
    finally:
        db.close()


def _process_tournament(db, tournament: Tournament) -> None:
    """Import + reprice one tournament. Errors are caught and logged."""
    from app.services.historical import import_matches_from_pubg, recalculate_prices

    logger.info(
        "Scheduler: importing tournament %s (%s)",
        tournament.id,
        tournament.pubg_id,
    )

    try:
        result = import_matches_from_pubg(db, tournament.id, tournament.pubg_id)
    except ValueError as exc:
        logger.error(
            "Scheduler: import failed for tournament %s: %s",
            tournament.id, exc,
        )
        return

    created = result.get("created", 0)
    skipped = result.get("skipped", 0)
    errors  = result.get("errors", [])

    logger.info(
        "Scheduler: tournament %s — created=%s skipped=%s errors=%s",
        tournament.id, created, skipped, len(errors),
    )

    if errors:
        for err in errors[:3]:  # log first 3 to avoid log spam
            logger.warning("Scheduler: import error: %s", err)

    # ── Only reprice if something actually changed ────────────────────────
    if created == 0:
        logger.debug(
            "Scheduler: no new matches for tournament %s — skipping recalculate",
            tournament.id,
        )
        return

    try:
        price_result = recalculate_prices(db, tournament.id, dry_run=False)
        logger.info(
            "Scheduler: repriced %s player(s) for tournament %s",
            price_result.get("updated", 0),
            tournament.id,
        )
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "Scheduler: recalculate_prices failed for tournament %s: %s",
            tournament.id, exc,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Public API — called from main.py lifespan
# ─────────────────────────────────────────────────────────────────────────────

def create_scheduler() -> BackgroundScheduler:
    """
    Build and return a configured scheduler (not yet started).
    Call .start() inside lifespan startup and .shutdown() inside cleanup.
    """
    scheduler = BackgroundScheduler(timezone="UTC")
    scheduler.add_job(
        _run_import_cycle,
        trigger="interval",
        minutes=IMPORT_INTERVAL_MINUTES,
        id="auto_import",
        name="Auto-import active tournaments",
        max_instances=1,          # never overlap if a run takes longer than expected
        misfire_grace_time=60,    # if delayed by <60s, still run; else skip
    )
    return scheduler


# ─────────────────────────────────────────────────────────────────────────────
# FILE 2 — app/main.py  (patch — replace lifespan function only)
# ─────────────────────────────────────────────────────────────────────────────
#
# BEFORE:
#
# @asynccontextmanager
# async def lifespan(app: FastAPI):
#     logger.info("Warzone Fantasy API iniciada. Migrations já aplicadas no startup.")
#     yield
#     logger.info("Warzone Fantasy API encerrando.")
#
# AFTER:

# @asynccontextmanager
# async def lifespan(app: FastAPI):
#     # ── Start background scheduler ────────────────────────────────────────
#     from app.services.scheduler import create_scheduler
#     scheduler = create_scheduler()
#     scheduler.start()
#     logger.info(
#         "Scheduler started — auto-import every %s minutes for active tournaments.",
#         15,
#     )
#
#     logger.info("Warzone Fantasy API iniciada. Migrations já aplicadas no startup.")
#     yield
#
#     # ── Graceful shutdown ─────────────────────────────────────────────────
#     scheduler.shutdown(wait=False)
#     logger.info("Scheduler stopped. Warzone Fantasy API encerrando.")


# ─────────────────────────────────────────────────────────────────────────────
# FILE 3 — requirements.txt  (add one line)
# ─────────────────────────────────────────────────────────────────────────────
#
# Add this line to requirements.txt:
#
# APScheduler==3.10.4
#
# Then rebuild:
#   docker compose down
#   docker compose up --build
