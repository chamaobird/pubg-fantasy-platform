# app/routers/admin/rosters.py
"""
Endpoints administrativos de Pricing — Fase 5

  PATCH /admin/pricing/rosters/{roster_id}/cost-override     (#052)
  POST  /admin/pricing/stages/{stage_id}/recalculate-pricing (#053)
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin
from app.models.user import User
from app.services import pricing as pricing_service

router = APIRouter(
    prefix="/admin/pricing",
    tags=["Admin — Pricing"],
    dependencies=[Depends(require_admin)],
)


# ── Schemas ───────────────────────────────────────────────────────────────────

class CostOverrideRequest(BaseModel):
    cost: Optional[int] = Field(
        None,
        ge=1,
        le=999,
        description="Novo valor de custo manual. Envie null para remover o override.",
    )
    stage_day_id: Optional[int] = Field(
        None,
        description="ID do StageDay associado ao registro de auditoria (opcional).",
    )


class CostOverrideResponse(BaseModel):
    roster_id: int
    fantasy_cost: Optional[float]
    cost_override: Optional[float]
    effective_cost: Optional[float]

    model_config = {"from_attributes": True}


class RecalculatePricingResponse(BaseModel):
    stage_id: int
    updated: int
    skipped: int
    newcomers: int


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.patch(
    "/rosters/{roster_id}/cost-override",
    response_model=CostOverrideResponse,
    summary="Override manual de custo de um jogador",
    description=(
        "Seta ou remove o `cost_override` de um Roster. "
        "O override é exibido no lugar do custo calculado mas **não** bloqueia "
        "recálculos automáticos futuros de `fantasy_cost`."
    ),
)
def set_cost_override(
    roster_id: int,
    body: CostOverrideRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    try:
        roster = pricing_service.apply_cost_override(
            roster_id=roster_id,
            cost=body.cost,
            db=db,
            stage_day_id=body.stage_day_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))

    db.commit()
    return CostOverrideResponse(
        roster_id=roster.id,
        fantasy_cost=roster.fantasy_cost,
        cost_override=roster.cost_override,
        effective_cost=roster.effective_cost,
    )


@router.post(
    "/stages/{stage_id}/recalculate-pricing",
    response_model=RecalculatePricingResponse,
    summary="Dispara recálculo manual de pricing para uma stage",
    description=(
        "Força o recálculo imediato de `fantasy_cost` para todos os Rosters ativos "
        "da stage. Útil para correções pontuais fora do ciclo automático do scheduler."
    ),
)
def recalculate_pricing(
    stage_id: int,
    stage_day_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    try:
        result = pricing_service.calculate_stage_pricing(
            stage_id=stage_id,
            db=db,
            stage_day_id=stage_day_id,
            source="manual",
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))

    db.commit()
    return RecalculatePricingResponse(stage_id=stage_id, **result)
