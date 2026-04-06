# app/jobs/lineup_control.py
"""
APScheduler Job — Lineup Control / Fase 4 / #041

Roda a cada minuto e gerencia as transições de lineup_status na Stage:
  closed → open   (quando now() >= stage.lineup_open_at)
  open   → locked (quando now() >= stage.lineup_close_at)

Antes do lock: replica lineups do dia anterior para usuários sem lineup (#042).

Regras:
  - Transições automáticas só ocorrem se o status atual for o esperado
    (ex: só abre se estiver 'closed', só trava se estiver 'open')
  - Admin pode forçar qualquer transição manualmente via endpoint (#043)
  - Nunca lança exceção — erros são logados para não derrubar o scheduler
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Stage, StageDay
from app.services.lineup import replicate_all_missing_lineups

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Job principal — chamado pelo APScheduler a cada minuto
# ---------------------------------------------------------------------------

def run_lineup_control() -> None:
    """
    Verifica todas as Stages ativas e aplica transições de status automáticas.
    """
    db: Session = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        _process_stage_transitions(db, now)
    except Exception as exc:
        logger.error("[LineupControl] Erro inesperado no job: %s", exc, exc_info=True)
    finally:
        db.close()


def _process_stage_transitions(db: Session, now: datetime) -> None:
    # Apenas stages que podem precisar de transição
    stages = (
        db.query(Stage)
        .filter(Stage.lineup_status.in_(["closed", "open"]))
        .all()
    )

    for stage in stages:
        try:
            _check_stage(db, stage, now)
        except Exception as exc:
            logger.error(
                "[LineupControl] Erro ao processar stage_id=%s: %s",
                stage.id, exc, exc_info=True,
            )


def _check_stage(db: Session, stage: Stage, now: datetime) -> None:
    if stage.lineup_status == "closed":
        if stage.lineup_open_at and now >= stage.lineup_open_at:
            _open_stage(db, stage)

    elif stage.lineup_status == "open":
        if stage.lineup_close_at and now >= stage.lineup_close_at:
            _lock_stage(db, stage)


def _open_stage(db: Session, stage: Stage) -> None:
    stage.lineup_status = "open"
    db.commit()
    logger.info("[LineupControl] Stage %s ('%s') → OPEN", stage.id, stage.name)


def _lock_stage(db: Session, stage: Stage) -> None:
    # Identifica o StageDay ativo (o que será jogado hoje)
    today = datetime.now(timezone.utc).date()
    stage_day = (
        db.query(StageDay)
        .filter(StageDay.stage_id == stage.id, StageDay.date == today)
        .first()
    )

    # Replica lineups antes de travar
    if stage_day:
        try:
            summary = replicate_all_missing_lineups(db, stage_day.id)
            logger.info(
                "[LineupControl] Replicação antes do lock: stage_day=%s — %s",
                stage_day.id, summary,
            )
        except Exception as exc:
            logger.error(
                "[LineupControl] Erro na replicação stage_day=%s: %s",
                stage_day.id, exc, exc_info=True,
            )

    stage.lineup_status = "locked"
    db.commit()
    logger.info("[LineupControl] Stage %s ('%s') → LOCKED", stage.id, stage.name)


# ---------------------------------------------------------------------------
# Override manual de emergência (#043)
# ---------------------------------------------------------------------------

def force_stage_status(
    db: Session,
    stage_id: int,
    new_status: str,
) -> Stage:
    """
    Força a transição de lineup_status de uma Stage para qualquer valor válido.
    Usado pelo endpoint admin de emergência (#043).

    Args:
        db:         sessão SQLAlchemy
        stage_id:   ID da Stage
        new_status: 'closed' | 'open' | 'locked'

    Returns:
        Stage atualizada

    Raises:
        ValueError: se stage não encontrada ou status inválido
    """
    valid_statuses = {"closed", "open", "locked"}
    if new_status not in valid_statuses:
        raise ValueError(
            f"Status inválido: '{new_status}'. Use: {sorted(valid_statuses)}"
        )

    stage = db.query(Stage).filter(Stage.id == stage_id).first()
    if not stage:
        raise ValueError(f"Stage {stage_id} não encontrada")

    old_status = stage.lineup_status
    stage.lineup_status = new_status
    db.commit()
    db.refresh(stage)

    logger.warning(
        "[LineupControl] OVERRIDE MANUAL: stage=%s '%s' — %s → %s",
        stage.id, stage.name, old_status, new_status,
    )
    return stage
