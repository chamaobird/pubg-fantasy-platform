# app/routers/admin/stage_sync.py
"""
Admin endpoints para o Stage Sync Scheduler.

POST   /admin/stage-sync              — criar schedule
GET    /admin/stage-sync              — listar (filtros: stage_id, status)
PATCH  /admin/stage-sync/{id}         — editar interval_min, run_until, notes ou cancelar
POST   /admin/stage-sync/{id}/run-now — trigger imediato fora do intervalo
POST   /admin/stage-sync/{id}/cancel  — cancelar schedule ativo/pendente
"""
from __future__ import annotations
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status as http_status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin
from app.models.stage_sync_schedule import StageSyncSchedule
from app.models.user import User
from app.schemas.stage_sync import StageSyncCreate, StageSyncResponse, StageSyncUpdate

router = APIRouter(
    prefix="/admin/stage-sync",
    tags=["Admin — Stage Sync Scheduler"],
    dependencies=[Depends(require_admin)],
)

VALID_STATUSES = {"pending", "active", "completed", "cancelled"}


def _get_or_404(db: Session, schedule_id: int) -> StageSyncSchedule:
    obj = db.query(StageSyncSchedule).filter(StageSyncSchedule.id == schedule_id).first()
    if not obj:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Schedule {schedule_id} não encontrado",
        )
    return obj


def _to_response(sched: StageSyncSchedule, stage_name: Optional[str] = None) -> StageSyncResponse:
    r = StageSyncResponse.model_validate(sched)
    r.stage_name = stage_name
    return r


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("", response_model=StageSyncResponse, status_code=201)
def create_schedule(
    body: StageSyncCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    from app.models.stage import Stage

    stage = db.query(Stage).filter(Stage.id == body.stage_id).first()
    if not stage:
        raise HTTPException(status_code=404, detail=f"Stage {body.stage_id} não encontrado")
    if not stage.pubg_tournament_id:
        raise HTTPException(
            status_code=409,
            detail="Stage não tem pubg_tournament_id. Atribua um antes de criar o sync.",
        )

    sched = StageSyncSchedule(
        stage_id=body.stage_id,
        tournament_id=body.tournament_id,
        interval_min=body.interval_min,
        run_from=body.run_from,
        run_until=body.run_until,
        status="pending",
        notes=body.notes,
    )
    db.add(sched)
    db.commit()
    db.refresh(sched)
    return _to_response(sched, stage.name)


@router.get("", response_model=list[StageSyncResponse])
def list_schedules(
    stage_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    from app.models.stage import Stage

    q = db.query(StageSyncSchedule)
    if stage_id:
        q = q.filter(StageSyncSchedule.stage_id == stage_id)
    if status:
        if status not in VALID_STATUSES:
            raise HTTPException(status_code=422, detail=f"status inválido: {status}")
        q = q.filter(StageSyncSchedule.status == status)

    scheds = q.order_by(StageSyncSchedule.id.desc()).all()

    stage_ids = {s.stage_id for s in scheds}
    stages = (
        {s.id: s.name for s in db.query(Stage.id, Stage.name).filter(Stage.id.in_(stage_ids)).all()}
        if stage_ids else {}
    )

    return [_to_response(s, stages.get(s.stage_id)) for s in scheds]


@router.patch("/{schedule_id}", response_model=StageSyncResponse)
def update_schedule(
    schedule_id: int,
    body: StageSyncUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    sched = _get_or_404(db, schedule_id)

    if sched.status in ("completed", "cancelled"):
        raise HTTPException(
            status_code=409,
            detail=f"Schedule já está {sched.status} — não pode ser editado",
        )

    updates = body.model_dump(exclude_unset=True)

    if "status" in updates and updates["status"] != "cancelled":
        raise HTTPException(
            status_code=422,
            detail="Via PATCH só é permitido status=cancelled. Use /cancel para cancelar.",
        )

    for k, v in updates.items():
        setattr(sched, k, v)

    db.add(sched)
    db.commit()
    db.refresh(sched)
    return _to_response(sched)


@router.post("/{schedule_id}/run-now")
def run_now(
    schedule_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Trigger imediato — ignora o intervalo configurado."""
    from app.services.stage_sync_service import trigger_now
    try:
        return trigger_now(db, schedule_id)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@router.get("/by-stage/{stage_id}")
def get_schedule_by_stage(
    stage_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """
    Retorna o StageSyncSchedule ativo/pendente para uma stage,
    incluindo unresolved players do último run (se houver).
    """
    import json
    from app.models.stage import Stage

    stage = db.query(Stage).filter(Stage.id == stage_id).first()
    if not stage:
        raise HTTPException(status_code=404, detail=f"Stage {stage_id} não encontrada")

    sched = (
        db.query(StageSyncSchedule)
        .filter(StageSyncSchedule.stage_id == stage_id)
        .order_by(StageSyncSchedule.id.desc())
        .first()
    )

    if not sched:
        return {
            "configured": False,
            "tournament_id": stage.pubg_tournament_id,
            "stage_name": stage.name,
        }

    notes_data: dict = {}
    if sched.notes:
        try:
            notes_data = json.loads(sched.notes)
        except (ValueError, TypeError):
            pass

    return {
        "configured": True,
        "schedule_id": sched.id,
        "stage_name": stage.name,
        "tournament_id": sched.tournament_id,
        "status": sched.status,
        "interval_min": sched.interval_min,
        "run_from": sched.run_from.isoformat() if sched.run_from else None,
        "run_until": sched.run_until.isoformat() if sched.run_until else None,
        "last_run_at": sched.last_run_at.isoformat() if sched.last_run_at else None,
        "runs_count": sched.runs_count,
        "last_import_count": notes_data.get("last_import_count", 0),
        "last_unresolved": notes_data.get("last_unresolved", []),
    }


@router.post("/{schedule_id}/cancel")
def cancel_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    sched = _get_or_404(db, schedule_id)
    if sched.status in ("completed", "cancelled"):
        raise HTTPException(
            status_code=409, detail=f"Schedule já está {sched.status}"
        )
    sched.status = "cancelled"
    db.add(sched)
    db.commit()
    return {"schedule_id": schedule_id, "status": "cancelled"}
