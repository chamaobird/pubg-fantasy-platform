# app/routers/admin/scoring.py
"""
Admin Router — Scoring Manual / Fase 8 / #090 #091

Endpoints:
  POST /admin/stages/{stage_id}/score-day
       Dispara o scoring de um StageDay específico manualmente.
       Útil após import tardio de matches ou correção de MatchStat.

  POST /admin/stages/{stage_id}/rescore
       Re-executa o scoring de TODOS os StageDays da stage.
       Útil após reprocess em lote ou correção de captain_multiplier.

Ambos são idempotentes — sobrescrevem pontos anteriores.
Todos os endpoints são admin-only (require_admin dependency).
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from datetime import timedelta

from app.database import get_db
from app.dependencies import require_admin
from app.services.lineup_scoring import rescore_stage, score_stage_day, ensure_participant_stats
from app.jobs.scoring_job import _has_match_stats
from app.models import Lineup, Stage, StageDay

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/stages", tags=["Admin — Scoring"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ScoreDayRequest(BaseModel):
    stage_day_id: int


class ExtendDeadlineRequest(BaseModel):
    minutes: int


# ---------------------------------------------------------------------------
# #090 — Scoring manual de um StageDay
# ---------------------------------------------------------------------------

@router.post(
    "/{stage_id}/score-day",
    summary="Disparar scoring manual de um StageDay",
    description=(
        "Calcula points_earned de todos os LineupPlayers do dia informado, "
        "atualiza Lineup.total_points, UserDayStat e UserStageStat. "
        "Idempotente — pode ser re-executado após correções. "
        "Não exige que a stage esteja locked."
    ),
)
def score_day_endpoint(
    stage_id: int,
    body: ScoreDayRequest,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    # Valida que o StageDay pertence à stage informada
    stage_day = (
        db.query(StageDay)
        .filter(
            StageDay.id == body.stage_day_id,
            StageDay.stage_id == stage_id,
        )
        .first()
    )
    if not stage_day:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"StageDay {body.stage_day_id} não encontrado na stage {stage_id}",
        )

    if not _has_match_stats(db, body.stage_day_id):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"StageDay {body.stage_day_id} não possui MatchStats importados. "
                "Execute o import de matches antes de pontuar."
            ),
        )

    try:
        from app.services.lineup_scoring import calculate_day_ranks
        summary = score_stage_day(db, body.stage_day_id)
        calculate_day_ranks(db, body.stage_day_id)
        db.commit()
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        db.rollback()
        logger.exception(
            "[AdminScoring] Erro no score-day stage=%s stage_day=%s",
            stage_id, body.stage_day_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno durante scoring: {exc}",
        )

    return {
        "ok": True,
        "stage_id": stage_id,
        **summary,
    }


# ---------------------------------------------------------------------------
# #091 — Rescore completo da stage
# ---------------------------------------------------------------------------

@router.post(
    "/{stage_id}/rescore",
    summary="Re-executar scoring completo de uma stage",
    description=(
        "Re-executa score_stage_day para todos os StageDays da stage, "
        "em ordem cronológica. Recalcula ranks ao final. "
        "Útil após reprocess em lote, correção de MatchStat ou mudança de captain_multiplier. "
        "Idempotente — sobrescreve pontos anteriores."
    ),
)
def rescore_stage_endpoint(
    stage_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    try:
        summary = rescore_stage(db, stage_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        db.rollback()
        logger.exception("[AdminScoring] Erro no rescore stage=%s", stage_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno durante rescore: {exc}",
        )

    return {
        "ok": True,
        "stage_id": stage_id,
        **summary,
    }


# ---------------------------------------------------------------------------
# Backfill de stats para usuários sem registros (lineup sem UserStageStat)
# ---------------------------------------------------------------------------

@router.post(
    "/{stage_id}/backfill-stats",
    summary="Criar stats placeholder para usuários sem registros no leaderboard",
    description=(
        "Para cada usuário que tem lineup em algum StageDay da stage mas ainda não "
        "tem UserDayStat/UserStageStat (e.g., stage ainda aberta, scoring não rodou), "
        "cria registros com 0 pontos. Garante que apareçam no leaderboard imediatamente. "
        "Idempotente — não altera stats de usuários já pontuados."
    ),
)
def backfill_stats(
    stage_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    days = (
        db.query(StageDay)
        .filter(StageDay.stage_id == stage_id)
        .all()
    )
    if not days:
        raise HTTPException(status_code=404, detail=f"Stage {stage_id} não encontrada ou sem days")

    processed = 0
    for day in days:
        lineups = (
            db.query(Lineup)
            .filter(Lineup.stage_day_id == day.id, Lineup.is_valid == True)  # noqa: E712
            .all()
        )
        for lineup in lineups:
            ensure_participant_stats(db, lineup.user_id, day.id, stage_id)
            processed += 1

    db.commit()
    logger.info("[AdminScoring] backfill-stats: stage=%s — %d lineups processados", stage_id, processed)
    return {"ok": True, "stage_id": stage_id, "lineups_processed": processed}


# ---------------------------------------------------------------------------
# Notificação manual de lineup aberta
# ---------------------------------------------------------------------------

@router.post(
    "/{stage_id}/notify-lineup-open",
    summary="Disparar notificação de lineup aberta manualmente",
    description=(
        "Envia email de 'lineup aberta' para todos os usuários verificados. "
        "Útil quando a stage já estava open antes desta feature existir, "
        "ou para reenviar uma notificação perdida. Idempotente."
    ),
)
def notify_lineup_open(
    stage_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    stage = db.query(Stage).filter(Stage.id == stage_id).first()
    if not stage:
        raise HTTPException(status_code=404, detail=f"Stage {stage_id} não encontrada")

    from app.services.email import broadcast_lineup_open
    close_iso = stage.lineup_close_at.isoformat() if stage.lineup_close_at else None

    try:
        result = broadcast_lineup_open(
            db=db,
            stage_name=stage.name,
            stage_id=stage_id,
            close_iso=close_iso,
        )
    except Exception as exc:
        logger.exception("[AdminScoring] Erro ao enviar notificações stage=%s", stage_id)
        raise HTTPException(status_code=500, detail=f"Erro ao enviar emails: {exc}")

    return {"ok": True, "stage_id": stage_id, **result}


# ---------------------------------------------------------------------------
# Extensão de prazo de fechamento (lineup_close_at)
# ---------------------------------------------------------------------------

@router.post(
    "/{stage_id}/extend-deadline",
    summary="Estender prazo de fechamento do lineup",
    description=(
        "Adiciona N minutos ao lineup_close_at atual da stage. "
        "Útil durante eventos com atrasos de transmissão ou delay de início. "
        "Só funciona se lineup_close_at já estiver definido."
    ),
)
def extend_deadline(
    stage_id: int,
    body: ExtendDeadlineRequest,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    stage = db.query(Stage).filter(Stage.id == stage_id).first()
    if not stage:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Stage {stage_id} não encontrada")

    if not stage.lineup_close_at:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Stage não possui lineup_close_at definido. Defina-o antes de estender.",
        )

    if body.minutes <= 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="minutes deve ser um valor positivo",
        )

    old_close = stage.lineup_close_at
    stage.lineup_close_at = old_close + timedelta(minutes=body.minutes)
    db.commit()

    logger.info(
        "[AdminScoring] extend-deadline stage=%s: %s → %s (+%dmin)",
        stage_id, old_close.isoformat(), stage.lineup_close_at.isoformat(), body.minutes,
    )

    return {
        "ok": True,
        "stage_id": stage_id,
        "extended_by_minutes": body.minutes,
        "old_lineup_close_at": old_close.isoformat(),
        "new_lineup_close_at": stage.lineup_close_at.isoformat(),
    }
