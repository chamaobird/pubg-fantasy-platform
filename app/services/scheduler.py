# app/services/scheduler.py
"""
APScheduler — dois jobs para o XAMA Fantasy.

lineup_control (a cada 1 minuto)
─────────────────────────────────
Verifica todos os stages com lineup_status != 'locked' e aplica as transições:
  closed → open   se agora >= lineup_open_at
  open   → locked se agora >= lineup_close_at
      └─ antes do lock: replica o dia anterior para usuários sem lineup

pricing (a cada 30 minutos)
────────────────────────────
Placeholder para o recálculo automático de fantasy_cost (Fase 5).
Está registrado mas não faz nada até os serviços de pricing existirem.

Design
──────
- BackgroundScheduler (thread-based) — jobs usam sessões sync do SQLAlchemy.
- max_instances=1 em ambos — nunca overlap.
- Erros são capturados e logados, nunca chegam a crashar o scheduler.
- Scheduler é criado em main.py lifespan e desligado no shutdown.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler

logger = logging.getLogger(__name__)


# ── Job 1: lineup_control ────────────────────────────────────────────────────

def _lineup_control_job() -> None:
    """
    Roda a cada minuto. Abre e fecha lineups automaticamente com base nos
    horários configurados em cada Stage e StageDay.
    """
    from app.database import SessionLocal
    from app.models.stage import Stage

    db = SessionLocal()
    try:
        now = datetime.now(tz=timezone.utc)

        # Busca stages que ainda não estão locked
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
    """Aplica transição de status para um stage, se necessário."""
    old_status = stage.lineup_status

    # closed → open
    if stage.lineup_status == "closed":
        if stage.lineup_open_at and now >= stage.lineup_open_at:
            stage.lineup_status = "open"
            logger.info(
                "lineup_control: stage %s (%s) → open", stage.id, stage.name
            )

    # open → locked
    if stage.lineup_status == "open":
        if stage.lineup_close_at and now >= stage.lineup_close_at:
            _replicate_missing_lineups(db, stage, now)
            stage.lineup_status = "locked"
            logger.info(
                "lineup_control: stage %s (%s) → locked", stage.id, stage.name
            )

    if stage.lineup_status != old_status:
        db.add(stage)


def _replicate_missing_lineups(db, stage, now: datetime) -> None:
    """
    Antes do lock: para cada StageDay cujo lineup_close_at chegou,
    replica o lineup do dia anterior para usuários que não submeteram.
    Placeholder — lógica completa implementada na task #042.
    """
    from app.models.stage_day import StageDay

    days_to_lock = (
        db.query(StageDay)
        .filter(
            StageDay.stage_id == stage.id,
            StageDay.lineup_close_at <= now,
        )
        .all()
    )

    for day in days_to_lock:
        logger.info(
            "lineup_control: stage_day %s (day %s) pronto para lock — "
            "replicação implementada na task #042",
            day.id,
            day.day_number,
        )


# ── Job 2: pricing ───────────────────────────────────────────────────────────

def _pricing_job() -> None:
    """
    Placeholder para recálculo automático de fantasy_cost.
    Implementado na Fase 5 (task #053).
    """
    logger.debug("pricing_job: aguardando Fase 5 para implementação.")


# ── Factory ──────────────────────────────────────────────────────────────────

def create_scheduler() -> BackgroundScheduler:
    """
    Cria e configura o scheduler. Não inicia — chame .start() no lifespan.
    """
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
