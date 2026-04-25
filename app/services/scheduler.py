# app/services/scheduler.py
"""
APScheduler — três jobs para o XAMA Fantasy.

lineup_control (a cada 1 minuto)
─────────────────────────────────
Verifica todos os stages com lineup_status != 'locked' e aplica as transições:
  closed → open    se agora >= lineup_open_at
  open   → locked  se agora >= lineup_close_at  (também: stage_phase → live)
      └─ antes do lock: replica o dia anterior para usuários sem lineup (#042)

Nota: stage_phase é automático SOMENTE para upcoming→live (quando a lineup fecha).
      A transição live→finished deve ser feita manualmente pelo admin no painel.

scoring (a cada 1 minuto)
──────────────────────────
Detecta StageDays com lineup_status == 'locked' que ainda não foram pontuados
e executa o scoring de lineup (LineupPlayer.points_earned, Lineup.total_points,
UserDayStat, UserStageStat) após confirmar que há MatchStats importados (#070-#072).

pricing (a cada 30 minutos)
────────────────────────────
Recálculo automático de fantasy_cost (Fase 5).
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.background import BackgroundScheduler

logger = logging.getLogger(__name__)

# In-memory: evita enviar o lembrete de over-budget mais de uma vez por stage
_over_budget_reminder_sent: set[int] = set()


# ── Job 1: lineup_control ─────────────────────────────────────────────────────

def _lineup_control_job() -> None:
    from app.database import SessionLocal
    from app.models.stage import Stage

    db = SessionLocal()
    try:
        now = datetime.now(tz=timezone.utc)
        stages = (
            db.query(Stage)
            .filter(Stage.lineup_status.notin_(["locked"]))
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
            _notify_lineup_open(db, stage)

    if stage.lineup_status == "open":
        if stage.lineup_close_at:
            _maybe_send_over_budget_reminders(db, stage, now)
        if stage.lineup_close_at and now >= stage.lineup_close_at:
            _replicate_missing_lineups(db, stage, now)
            stage.lineup_status = "locked"
            stage.stage_phase = "live"  # exibe como "EM JOGO" no dashboard
            logger.info("lineup_control: stage %s (%s) → locked / phase=live", stage.id, stage.name)

    if stage.lineup_status != old_status:
        db.add(stage)


def _notify_lineup_open(db, stage) -> None:
    try:
        from app.services.email import broadcast_lineup_open
        close_iso = stage.lineup_close_at.isoformat() if stage.lineup_close_at else None
        result = broadcast_lineup_open(
            db=db,
            stage_name=stage.name,
            stage_id=stage.id,
            close_iso=close_iso,
        )
        logger.info(
            "lineup_control: notificação lineup_open stage %s — %s",
            stage.id, result,
        )
    except Exception as exc:
        logger.error(
            "lineup_control: erro ao notificar lineup_open stage %s: %s",
            stage.id, exc, exc_info=True,
        )


def _maybe_send_over_budget_reminders(db, stage, now: datetime) -> None:
    """Envia email 1h antes do close para usuários com lineup inválido (over-budget)."""
    if stage.id in _over_budget_reminder_sent:
        return
    threshold = stage.lineup_close_at - timedelta(hours=1)
    if now < threshold:
        return

    try:
        from app.models.lineup import Lineup
        from app.models.stage_day import StageDay
        from app.models.user import User
        from app.services.email import send_over_budget_notification

        day_ids = [
            d.id for d in
            db.query(StageDay).filter(StageDay.stage_id == stage.id).all()
        ]
        if not day_ids:
            _over_budget_reminder_sent.add(stage.id)
            return

        invalid_pairs = (
            db.query(Lineup, User)
            .join(User, Lineup.user_id == User.id)
            .filter(
                Lineup.stage_day_id.in_(day_ids),
                Lineup.is_valid == False,  # noqa: E712
            )
            .all()
        )

        sent = 0
        for lineup, user in invalid_pairs:
            if not user.email:
                continue
            try:
                send_over_budget_notification(
                    to_email  = user.email,
                    username  = user.username,
                    stage_name= stage.name,
                    stage_id  = stage.id,
                    total_cost= lineup.total_cost or 0,
                )
                sent += 1
            except Exception as exc:
                logger.error(
                    "over_budget_reminder: erro ao enviar para user=%s: %s",
                    user.id, exc,
                )

        _over_budget_reminder_sent.add(stage.id)
        if sent:
            logger.info(
                "over_budget_reminder: stage %s — %d emails enviados (1h antes do close)",
                stage.id, sent,
            )

    except Exception as exc:
        logger.error(
            "over_budget_reminder: erro stage %s: %s", stage.id, exc, exc_info=True,
        )


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


# ── Job 2: scoring ────────────────────────────────────────────────────────────

def _scoring_job() -> None:
    from app.jobs.scoring_job import run_scoring_job
    run_scoring_job()


# ── Job 3: pricing ────────────────────────────────────────────────────────────

def _pricing_job() -> None:
    from app.jobs.pricing import run_pricing_job
    run_pricing_job()


# ── Job 4: match_import ───────────────────────────────────────────────────────

def _match_import_job() -> None:
    from app.jobs.match_import_job import run_match_import_job
    run_match_import_job()


# ── Factory ───────────────────────────────────────────────────────────────────

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
        _scoring_job,
        trigger="interval",
        minutes=1,
        id="scoring",
        name="Daily lineup scoring (Fase 7)",
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

    scheduler.add_job(
        _match_import_job,
        trigger="interval",
        minutes=2,
        id="match_import",
        name="Auto match import via stage_day.match_schedule",
        max_instances=1,
        misfire_grace_time=60,
    )

    return scheduler
