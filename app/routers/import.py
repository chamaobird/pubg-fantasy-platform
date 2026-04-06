# app/routers/admin/import_.py
"""
Admin Router — Import de Matches / Fase 3

Endpoints:
  POST /admin/stages/{stage_id}/import-matches
       Importa uma lista de pubg_match_ids para a Stage.
       Shard herdado automaticamente — não exposto no request.

  POST /admin/stages/{stage_id}/reprocess-match
       Reprocessa um match já importado (rebusca API + recalcula stats).

  POST /admin/stages/{stage_id}/recalculate-stage-stats
       Reconstrói PERSON_STAGE_STAT do zero para a Stage.
       Útil após correções manuais ou reprocess em lote.

Todos os endpoints são admin-only (require_admin dependency).
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin  # já existente nas fases anteriores
from app.services.import_ import import_stage_matches, reprocess_match
from app.services.scoring import recalculate_person_stage_stat

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/stages", tags=["Admin — Import"])


# ---------------------------------------------------------------------------
# Schemas de request
# ---------------------------------------------------------------------------

class ImportMatchesRequest(BaseModel):
    pubg_match_ids: list[str]
    stage_day_id:   Optional[int] = None
    force_reprocess: bool = False

    @field_validator("pubg_match_ids")
    @classmethod
    def validate_match_ids(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("pubg_match_ids não pode ser vazio")
        if len(v) > 50:
            raise ValueError("Máximo de 50 matches por request")
        cleaned = [m.strip() for m in v if m.strip()]
        if not cleaned:
            raise ValueError("Nenhum match_id válido encontrado")
        return cleaned


class ReprocessMatchRequest(BaseModel):
    pubg_match_id: str

    @field_validator("pubg_match_id")
    @classmethod
    def validate_match_id(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("pubg_match_id não pode ser vazio")
        return v


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/{stage_id}/import-matches",
    summary="Importar matches para uma Stage",
    description=(
        "Importa uma lista de matches da PUBG API para a Stage informada. "
        "O shard é herdado automaticamente da Stage — não é necessário informá-lo. "
        "Matches já existentes são skippados (ou reprocessados se force_reprocess=true)."
    ),
)
def import_matches_endpoint(
    stage_id: int,
    body: ImportMatchesRequest,
    db: Session = Depends(get_db),
    _admin = Depends(require_admin),
):
    try:
        result = import_stage_matches(
            db             = db,
            stage_id       = stage_id,
            pubg_match_ids = body.pubg_match_ids,
            stage_day_id   = body.stage_day_id,
            force_reprocess= body.force_reprocess,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        logger.exception("[Import] Erro inesperado no endpoint import-matches stage=%s", stage_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno durante import: {exc}",
        )

    return result


@router.post(
    "/{stage_id}/reprocess-match",
    summary="Reprocessar um match específico",
    description=(
        "Rebusca o match da PUBG API (usando o shard da Stage) e recalcula "
        "MATCH_STAT e PERSON_STAGE_STAT. Idempotente — pode ser chamado múltiplas vezes. "
        "O match deve já existir no banco (use import-matches primeiro)."
    ),
)
def reprocess_match_endpoint(
    stage_id: int,
    body: ReprocessMatchRequest,
    db: Session = Depends(get_db),
    _admin = Depends(require_admin),
):
    try:
        result = reprocess_match(
            db            = db,
            pubg_match_id = body.pubg_match_id,
            stage_id      = stage_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.exception(
            "[Import] Erro inesperado no reprocess match=%s stage=%s",
            body.pubg_match_id, stage_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno durante reprocess: {exc}",
        )

    return result


@router.post(
    "/{stage_id}/recalculate-stage-stats",
    summary="Recalcular PERSON_STAGE_STAT do zero",
    description=(
        "Apaga e reconstrói todos os PERSON_STAGE_STAT da Stage somando os "
        "MATCH_STAT existentes. Use após correções manuais ou reprocess em lote."
    ),
)
def recalculate_stage_stats_endpoint(
    stage_id: int,
    db: Session = Depends(get_db),
    _admin = Depends(require_admin),
):
    try:
        result = recalculate_person_stage_stat(db=db, stage_id=stage_id)
        db.commit()
    except Exception as exc:
        logger.exception("[Import] Erro no recalculate-stage-stats stage=%s", stage_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno: {exc}",
        )

    return result
