# app/services/stage_sync_service.py
"""
Stage Sync Scheduler — executa match import + scoring para stages com
pubg_tournament_id configurado, dentro de uma janela de tempo definida pelo admin.

Fluxo por tick (a cada 5 min via APScheduler):
  Para cada StageSyncSchedule com status in (pending, active):
    1. Se run_from > now → pula (janela futura)
    2. Se run_until < now → marca completed
    3. Se intervalo não passou → pula
    4. Executa _execute_sync: chama _process_day para cada stage_day do stage
    5. Atualiza last_run_at, runs_count, status
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.stage_sync_schedule import StageSyncSchedule

logger = logging.getLogger(__name__)


# ── Entry point do APScheduler ────────────────────────────────────────────────

def run_due_schedules(db: Session) -> dict:
    """Verifica e executa todos os schedules devidos. Chamado a cada 5 min."""
    now = datetime.now(timezone.utc)

    schedules = (
        db.query(StageSyncSchedule)
        .filter(StageSyncSchedule.status.in_(["pending", "active"]))
        .all()
    )

    ran = completed = skipped = 0

    for sched in schedules:
        try:
            outcome = _maybe_run(db, sched, now)
            if outcome == "ran":
                ran += 1
            elif outcome == "completed":
                completed += 1
            else:
                skipped += 1
        except Exception as exc:
            logger.error(
                "[StageSyncService] schedule=%s erro inesperado: %s",
                sched.id, exc, exc_info=True,
            )

    return {"ran": ran, "completed": completed, "skipped": skipped}


# ── Lógica de decisão ─────────────────────────────────────────────────────────

def _maybe_run(db: Session, sched: StageSyncSchedule, now: datetime) -> str:
    """Decide se executa o schedule. Retorna 'ran' | 'completed' | 'skipped'."""

    # Janela futura ainda não chegou
    if sched.run_from and now < sched.run_from:
        return "skipped"

    # Passou do run_until — encerra
    if now > sched.run_until:
        sched.status = "completed"
        db.add(sched)
        db.commit()
        logger.info("[StageSyncService] schedule=%s → completed (expirou sem runs)", sched.id)
        return "completed"

    # Verifica intervalo desde o último run
    if sched.last_run_at is not None:
        next_run = sched.last_run_at + timedelta(minutes=int(sched.interval_min))
        if now < next_run:
            return "skipped"

    # Executa
    _execute_sync(db, sched, now)

    # Atualiza status
    sched.status = "completed" if now >= sched.run_until else "active"
    db.add(sched)
    db.commit()

    if sched.status == "completed":
        logger.info("[StageSyncService] schedule=%s → completed após run #%d", sched.id, sched.runs_count)

    return "ran"


# ── Execução do sync ──────────────────────────────────────────────────────────

def _execute_sync(db: Session, sched: StageSyncSchedule, now: datetime) -> None:
    """
    Roda _process_day para cada stage_day do stage com match_schedule configurado.

    Requer que stage_days existam com match_schedule — sem eles não há nada a importar
    (Opção A: admin pré-configura stage_days antes de ativar o scheduler).
    """
    from app.models.stage import Stage
    from app.models.stage_day import StageDay
    from app.jobs.match_import_job import _process_day

    stage = db.query(Stage).filter(Stage.id == sched.stage_id).first()
    if not stage:
        logger.warning(
            "[StageSyncService] schedule=%s — stage=%s não encontrado",
            sched.id, sched.stage_id,
        )
        _bump(sched, now)
        return

    if not stage.pubg_tournament_id:
        logger.warning(
            "[StageSyncService] schedule=%s — stage=%s sem pubg_tournament_id",
            sched.id, sched.stage_id,
        )
        _bump(sched, now)
        return

    days = (
        db.query(StageDay)
        .filter(
            StageDay.stage_id == sched.stage_id,
            StageDay.match_schedule.isnot(None),
        )
        .all()
    )

    if not days:
        logger.info(
            "[StageSyncService] schedule=%s stage=%s — sem stage_days com match_schedule",
            sched.id, sched.stage_id,
        )
        _bump(sched, now)
        return

    new_imports = 0
    for day in days:
        before = _count_processed(day)
        try:
            _process_day(db, day, now)
        except Exception as exc:
            logger.error(
                "[StageSyncService] schedule=%s stage_day=%s erro: %s",
                sched.id, day.id, exc, exc_info=True,
            )
        after = _count_processed(day)
        new_imports += max(0, after - before)

    _bump(sched, now)
    logger.info(
        "[StageSyncService] schedule=%s stage=%s run#%d — %d day(s), %d novos imports",
        sched.id, sched.stage_id, sched.runs_count, len(days), new_imports,
    )


def _bump(sched: StageSyncSchedule, now: datetime) -> None:
    sched.last_run_at = now
    sched.runs_count = (sched.runs_count or 0) + 1


def _count_processed(day) -> int:
    return sum(1 for e in (day.match_schedule or []) if e.get("processed_at"))


# ── Trigger manual ────────────────────────────────────────────────────────────

def trigger_now(db: Session, schedule_id: int) -> dict:
    """Admin trigger imediato — ignora o intervalo normal."""
    sched = db.query(StageSyncSchedule).filter(StageSyncSchedule.id == schedule_id).first()
    if not sched:
        raise ValueError(f"Schedule {schedule_id} não encontrado")
    if sched.status == "cancelled":
        raise ValueError("Schedule cancelado — não pode ser executado")

    now = datetime.now(timezone.utc)
    _execute_sync(db, sched, now)

    sched.status = "completed" if now >= sched.run_until else "active"
    db.add(sched)
    db.commit()

    return {
        "schedule_id": schedule_id,
        "ran_at": now.isoformat(),
        "runs_count": sched.runs_count,
        "status": sched.status,
    }
