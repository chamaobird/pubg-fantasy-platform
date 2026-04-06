# app/services/scheduler.py
"""
APScheduler — dois jobs para o XAMA Fantasy.

lineup_control (a cada 1 minuto)
─────────────────────────────────
Verifica todos os stages com lineup_status != 'locked' e aplica as transições:
  closed → open   se agora >= lineup_open_at
  open   → locked se agora >= lineup_close_at
      └─ antes do lock: replica o dia anterior para usuários sem lineup (#042)

pricing (a cada 30 minutos)
────────────────────────────
Placeholder para o recálculo automático de fantasy_cost (Fase 5).
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler

logger = logging.getLogger(__name__)


# ── Job 1: lineup_control ────────────────────────────────────────────────────

def _lineup_control_job() -> None:
    from app.database import SessionLocal
    from app.models.stage import Stage

    db = SessionLocal()
    try:
        now = datetime.now(tz=timezone.utc)
        stages = (
            db.query(Stage)
            .filter(Stage.lineup_status != "locked")
            .all()
        )
        if not stages:
            return

        for stage in stages:
            _process_stage_status(db, stage, now)

        db.commit()

    except Exception as exc:
        logger.error("lineup_control: erro não tratado: %s", exc, exc_info=True)
        db.rollback()
    finally:
        db.close()


def _process_stage_status(db, stage, now: datetime) -> None:
    old_status = stage.lineup_status

    if stage.lineup_status == "closed":
        if stage.lineup_open_at and now >= stage.lineup_open_at:
            stage.lineup_status = "open"
            logger.info("lineup_control: stage %s (%s) → open", stage.id, stage.name)

    if stage.lineup_status == "open":
        if stage.lineup_close_at and now >= stage.lineup_close_at:
            _replicate_missing_lineups(db, stage, now)
            stage.lineup_status = "locked"
            logger.info("lineup_control: stage %s (%s) → locked", stage.id, stage.name)

    if stage.lineup_status != old_status:
        db.add(stage)


def _replicate_missing_lineups(db, stage, now: datetime) -> None:
    from app.models.stage_day import StageDay
    from app.services.lineup import replicate_all_missing_lineups

    days_to_lock = (
        db.query(StageDay)
        .filter(
            StageDay.stage_id == stage.id,
            StageDay.lineup_close_at <= now,
        )
        .all()
    )

    for day in days_to_lock:
        try:
            summary = replicate_all_missing_lineups(db, day.id)
            logger.info(
                "lineup_control: replicação stage_day=%s — %s", day.id, summary
            )
        except Exception as exc:
            logger.error(
                "lineup_control: erro na replicação stage_day=%s: %s",
                day.id, exc, exc_info=True,
            )


# ── Job 2: pricing ───────────────────────────────────────────────────────────

def _pricing_job() -> None:
    from app.jobs.pricing import run_pricing_job
    run_pricing_job()


# ── Factory ──────────────────────────────────────────────────────────────────

def create_scheduler() -> BackgroundScheduler:
    scheduler = BackgroundScheduler(timezone="UTC")

    scheduler.add_job(
        _lineup_control_job,
        trigger="interval",
        minutes=1,
        id="lineup_control",
        name="Lineup status control (closed→open→locked)",
        max_instances=1,
        misfire_grace_time=30,
    )

    scheduler.add_job(
        _pricing_job,
        trigger="interval",
        minutes=30,
        id="pricing",
        name="Fantasy cost recalculation (Fase 5)",
        max_instances=1,
        misfire_grace_time=120,
    )

    return scheduler