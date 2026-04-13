# app/routers/lineups.py
"""
Router — Lineups / Fase 4

Endpoints de usuário:
  POST /lineups/                     Submeter lineup para um StageDay
  GET  /lineups/{stage_day_id}       Buscar lineup do usuário para um dia
  GET  /lineups/stage/{stage_id}     Listar todos os lineups do usuário na stage

Endpoints admin:
  POST /admin/stages/{stage_id}/force-status   Override manual de lineup_status (#043)
  GET  /admin/stages/{stage_id}/lineups        Todos os lineups de uma stage (admin)

Status válidos para lineup_status:
  closed  — padrão; lineup não visível nem editável
  preview — stage visível com roster/stats mas lineup desabilitado (aguardando confirmação)
  open    — lineup aberto para montagem
  locked  — stage encerrada; lineup visível mas não editável
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.jobs.lineup_control import force_stage_status
from app.models import Lineup, Stage, StageDay
from app.services.lineup import submit_lineup

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Lineups"])

VALID_STATUSES = {"closed", "open", "locked", "preview"}


# ---------------------------------------------------------------------------
# Schemas de request
# ---------------------------------------------------------------------------

class SubmitLineupRequest(BaseModel):
    stage_day_id:       int
    titular_roster_ids: list[int]
    reserve_roster_id:  int
    captain_roster_id:  int

    @field_validator("titular_roster_ids")
    @classmethod
    def validate_titulares(cls, v: list[int]) -> list[int]:
        if len(v) != 4:
            raise ValueError("São necessários exatamente 4 titulares")
        return v


class ForceStatusRequest(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in VALID_STATUSES:
            raise ValueError(f"Status deve ser um de: {', '.join(sorted(VALID_STATUSES))}")
        return v


# ---------------------------------------------------------------------------
# Schemas de resposta
# ---------------------------------------------------------------------------

class LineupPlayerOut(BaseModel):
    id:            int
    roster_id:     int
    slot_type:     str
    is_captain:    bool
    locked_cost:   Optional[int]
    points_earned: Optional[float]

    model_config = {"from_attributes": True}


class LineupOut(BaseModel):
    id:                 int
    user_id:            str
    stage_day_id:       int
    is_auto_replicated: bool
    is_valid:           bool
    total_cost:         Optional[int]
    total_points:       Optional[float]
    players:            list[LineupPlayerOut]

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Endpoints de usuário
# ---------------------------------------------------------------------------

@router.post(
    "/lineups/",
    response_model=LineupOut,
    summary="Submeter lineup",
    description=(
        "Cria ou substitui o lineup do usuário autenticado para o StageDay informado. "
        "A stage deve estar com lineup_status='open'. "
        "Status 'preview' não permite submissão. "
        "O `captain_roster_id` deve ser um dos `titular_roster_ids`. "
        "O capitão recebe multiplicador ×1.3 nos pontos."
    ),
)
def submit_lineup_endpoint(
    body: SubmitLineupRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    try:
        lineup = submit_lineup(
            db                 = db,
            user_id            = str(current_user.id),
            stage_day_id       = body.stage_day_id,
            titular_roster_ids = body.titular_roster_ids,
            reserve_roster_id  = body.reserve_roster_id,
            captain_roster_id  = body.captain_roster_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    return lineup


@router.get(
    "/lineups/{stage_day_id}",
    response_model=LineupOut,
    summary="Buscar meu lineup do dia",
)
def get_my_lineup(
    stage_day_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    lineup = (
        db.query(Lineup)
        .filter(
            Lineup.user_id      == str(current_user.id),
            Lineup.stage_day_id == stage_day_id,
        )
        .first()
    )
    if not lineup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nenhum lineup encontrado para este dia",
        )
    return lineup


@router.get(
    "/lineups/stage/{stage_id}",
    response_model=list[LineupOut],
    summary="Listar meus lineups na stage",
)
def get_my_lineups_for_stage(
    stage_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    lineups = (
        db.query(Lineup)
        .join(StageDay, Lineup.stage_day_id == StageDay.id)
        .filter(
            StageDay.stage_id == stage_id,
            Lineup.user_id    == str(current_user.id),
        )
        .order_by(StageDay.day_number)
        .all()
    )
    return lineups


# ---------------------------------------------------------------------------
# Endpoints admin
# ---------------------------------------------------------------------------

@router.post(
    "/admin/stages/{stage_id}/force-status",
    summary="[Admin] Override manual de lineup_status",
    description=(
        "Força a transição de lineup_status para qualquer valor válido. "
        "Valores aceitos: closed, open, locked, preview. "
        "Use 'preview' para abrir a visualização do roster/stats sem permitir montagem de lineup. "
        "Use em emergências quando o APScheduler falhar ou o horário precisar "
        "ser ajustado manualmente. Ação é logada como OVERRIDE MANUAL."
    ),
)
def force_status_endpoint(
    stage_id: int,
    body: ForceStatusRequest,
    db: Session = Depends(get_db),
    _admin = Depends(require_admin),
):
    try:
        stage = force_stage_status(db, stage_id, body.status)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))

    return {
        "stage_id":      stage.id,
        "stage_name":    stage.name,
        "lineup_status": stage.lineup_status,
        "message":       f"Status forçado para '{stage.lineup_status}' com sucesso",
    }


@router.get(
    "/admin/stages/{stage_id}/lineups",
    response_model=list[LineupOut],
    summary="[Admin] Todos os lineups de uma stage",
)
def admin_list_lineups(
    stage_id: int,
    stage_day_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _admin = Depends(require_admin),
):
    q = (
        db.query(Lineup)
        .join(StageDay, Lineup.stage_day_id == StageDay.id)
        .filter(StageDay.stage_id == stage_id)
    )
    if stage_day_id:
        q = q.filter(Lineup.stage_day_id == stage_day_id)

    return q.order_by(StageDay.day_number, Lineup.user_id).all()
