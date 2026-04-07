# app/routers/stages.py
"""
Router público — Stages / Fase 6

Endpoints de usuário (sem autenticação obrigatória):
  GET /stages/                              → Listar stages ativas
  GET /stages/{stage_id}                    → Detalhe de uma stage
  GET /stages/{stage_id}/days              → Stage days com status de abertura
  GET /stages/{stage_id}/roster            → Jogadores com effective_cost
  GET /stages/{stage_id}/roster/{roster_id}/price-history → Histórico de preços
"""
from __future__ import annotations

from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.roster import Roster, RosterPriceHistory
from app.models.stage import Stage
from app.models.stage_day import StageDay

router = APIRouter(prefix="/stages", tags=["Stages"])


# ── Schemas de resposta ───────────────────────────────────────────────────────

class StageOut(BaseModel):
    id: int
    championship_id: int
    name: str
    short_name: str
    shard: str
    lineup_status: str          # closed | open | locked
    lineup_size: int
    price_min: int
    price_max: int
    pricing_newcomer_cost: int
    is_active: bool
    # Campos de conveniência para o frontend
    lineup_open: bool           # True quando lineup_status == "open"

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_stage(cls, s: Stage) -> "StageOut":
        return cls(
            id=s.id,
            championship_id=s.championship_id,
            name=s.name,
            short_name=s.short_name,
            shard=s.shard,
            lineup_status=s.lineup_status,
            lineup_size=s.lineup_size,
            price_min=s.price_min,
            price_max=s.price_max,
            pricing_newcomer_cost=s.pricing_newcomer_cost,
            is_active=s.is_active,
            lineup_open=(s.lineup_status == "open"),
        )


class StageDayOut(BaseModel):
    id: int
    stage_id: int
    day_number: int
    date: Optional[datetime]
    is_active: bool

    model_config = {"from_attributes": True}


class RosterPlayerOut(BaseModel):
    """
    Versão pública do Roster — expõe effective_cost e nome do jogador.
    """
    id: int                         # roster_id — usado na submissão de lineup
    person_id: int
    person_name: Optional[str]      # Person.display_name
    team_name: Optional[str]
    fantasy_cost: Optional[int]     # Preço calculado automaticamente
    cost_override: Optional[int]    # Override manual (se existir)
    effective_cost: Optional[int]   # cost_override ?? fantasy_cost
    newcomer_to_tier: bool
    is_available: bool

    model_config = {"from_attributes": True}


class PriceHistoryOut(BaseModel):
    id: int
    roster_id: int
    stage_day_id: Optional[int]
    cost: int
    source: str                     # auto | override
    recorded_at: datetime

    model_config = {"from_attributes": True}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_stage_or_404(db: Session, stage_id: int) -> Stage:
    stage = db.get(Stage, stage_id)
    if stage is None or not stage.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Stage {stage_id} não encontrada ou inativa.",
        )
    return stage


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get(
    "/",
    response_model=list[StageOut],
    summary="Listar stages ativas",
    description=(
        "Retorna todas as stages ativas. "
        "Use o campo `lineup_open` para filtrar apenas aquelas com lineup aberto. "
        "Query param `open_only=true` aplica esse filtro no servidor."
    ),
)
def list_stages(
    open_only: bool = Query(False, description="Se true, retorna apenas stages com lineup_status='open'"),
    championship_id: Optional[int] = Query(None, description="Filtrar por championship"),
    db: Session = Depends(get_db),
) -> list[StageOut]:
    q = db.query(Stage).filter(Stage.is_active == True)  # noqa: E712

    if open_only:
        q = q.filter(Stage.lineup_status == "open")

    if championship_id is not None:
        q = q.filter(Stage.championship_id == championship_id)

    stages = q.order_by(Stage.id.desc()).all()
    return [StageOut.from_orm_stage(s) for s in stages]


@router.get(
    "/{stage_id}",
    response_model=StageOut,
    summary="Detalhe de uma stage",
)
def get_stage(
    stage_id: int,
    db: Session = Depends(get_db),
) -> StageOut:
    stage = _get_stage_or_404(db, stage_id)
    return StageOut.from_orm_stage(stage)


@router.get(
    "/{stage_id}/days",
    response_model=list[StageDayOut],
    summary="Stage days de uma stage",
    description="Retorna os dias da stage em ordem. Use para saber qual stage_day_id enviar no lineup.",
)
def list_stage_days(
    stage_id: int,
    db: Session = Depends(get_db),
) -> list[StageDayOut]:
    _get_stage_or_404(db, stage_id)

    days = (
        db.query(StageDay)
        .filter(StageDay.stage_id == stage_id)
        .order_by(StageDay.day_number)
        .all()
    )
    return days


@router.get(
    "/{stage_id}/roster",
    response_model=list[RosterPlayerOut],
    summary="Jogadores disponíveis da stage com custo",
    description=(
        "Retorna todos os Rosters ativos da stage com `effective_cost` calculado. "
        "O `id` retornado é o `roster_id` — use-o na submissão de lineup."
    ),
)
def list_stage_roster(
    stage_id: int,
    db: Session = Depends(get_db),
) -> list[RosterPlayerOut]:
    _get_stage_or_404(db, stage_id)

    rosters = (
        db.query(Roster)
        .options(joinedload(Roster.person))
        .filter(
            Roster.stage_id == stage_id,
            Roster.is_available == True,  # noqa: E712
        )
        .order_by(Roster.id)
        .all()
    )

    result = []
    for r in rosters:
        result.append(
            RosterPlayerOut(
                id=r.id,
                person_id=r.person_id,
                person_name=r.person.display_name if r.person else None,
                team_name=r.team_name,
                fantasy_cost=r.fantasy_cost,
                cost_override=r.cost_override,
                effective_cost=r.effective_cost,
                newcomer_to_tier=r.newcomer_to_tier,
                is_available=r.is_available,
            )
        )
    return result


@router.get(
    "/{stage_id}/roster/{roster_id}/price-history",
    response_model=list[PriceHistoryOut],
    summary="Histórico de preços de um jogador",
    description=(
        "Retorna o histórico de `fantasy_cost` e overrides de um Roster, "
        "ordenado do mais recente para o mais antigo."
    ),
)
def get_price_history(
    stage_id: int,
    roster_id: int,
    limit: int = Query(30, ge=1, le=200),
    db: Session = Depends(get_db),
) -> list[PriceHistoryOut]:
    _get_stage_or_404(db, stage_id)

    # Verifica que o roster pertence à stage
    roster = (
        db.query(Roster)
        .filter(Roster.id == roster_id, Roster.stage_id == stage_id)
        .first()
    )
    if roster is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Roster {roster_id} não encontrado na stage {stage_id}.",
        )

    history = (
        db.query(RosterPriceHistory)
        .filter(RosterPriceHistory.roster_id == roster_id)
        .order_by(RosterPriceHistory.recorded_at.desc())
        .limit(limit)
        .all()
    )
    return history
