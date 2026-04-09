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

from app.database import get_db
from app.dependencies import require_admin
from app.services.lineup_scoring import rescore_stage, score_stage_day
from app.jobs.scoring_job import _has_match_stats
from app.models import StageDay

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/stages", tags=["Admin — Scoring"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ScoreDayRequest(BaseModel):
    stage_day_id: int


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
