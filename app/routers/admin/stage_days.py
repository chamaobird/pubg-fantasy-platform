# app/routers/admin/stage_days.py
from __future__ import annotations
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin
from app.models.stage import Stage
from app.models.stage_day import StageDay
from app.models.user import User
from app.schemas.stage_day import StageDayCreate, StageDayResponse, StageDayUpdate

router = APIRouter(
    prefix="/admin/stage-days",
    tags=["Admin — Stage Days"],
    dependencies=[Depends(require_admin)],
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_or_404(db: Session, stage_day_id: int) -> StageDay:
    obj = db.query(StageDay).filter(StageDay.id == stage_day_id).first()
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"StageDay {stage_day_id} not found",
        )
    return obj


def _validate_stage(db: Session, stage_id: int) -> Stage:
    stage = db.query(Stage).filter(Stage.id == stage_id).first()
    if not stage:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Stage {stage_id} not found",
        )
    return stage


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("", response_model=StageDayResponse, status_code=status.HTTP_201_CREATED)
def create_stage_day(
    body: StageDayCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> StageDay:
    _validate_stage(db, body.stage_id)

    # Enforce unique day_number per stage
    existing = (
        db.query(StageDay)
        .filter(
            StageDay.stage_id == body.stage_id,
            StageDay.day_number == body.day_number,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Stage {body.stage_id} already has a day with day_number={body.day_number}",
        )

    stage_day = StageDay(**body.model_dump())
    db.add(stage_day)
    db.commit()
    db.refresh(stage_day)
    return stage_day


@router.get("", response_model=list[StageDayResponse])
def list_stage_days(
    stage_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> list[StageDay]:
    q = db.query(StageDay)
    if stage_id is not None:
        q = q.filter(StageDay.stage_id == stage_id)
    return q.order_by(StageDay.stage_id, StageDay.day_number).all()


@router.get("/{stage_day_id}", response_model=StageDayResponse)
def get_stage_day(
    stage_day_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> StageDay:
    return _get_or_404(db, stage_day_id)


@router.patch("/{stage_day_id}", response_model=StageDayResponse)
def update_stage_day(
    stage_day_id: int,
    body: StageDayUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> StageDay:
    stage_day = _get_or_404(db, stage_day_id)

    updates = body.model_dump(exclude_unset=True)

    # If changing day_number, check uniqueness within stage
    if "day_number" in updates:
        conflict = (
            db.query(StageDay)
            .filter(
                StageDay.stage_id == stage_day.stage_id,
                StageDay.day_number == updates["day_number"],
                StageDay.id != stage_day_id,
            )
            .first()
        )
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Stage {stage_day.stage_id} already has a day with day_number={updates['day_number']}",
            )

    for field, value in updates.items():
        setattr(stage_day, field, value)

    db.commit()
    db.refresh(stage_day)
    return stage_day


@router.delete("/{stage_day_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_stage_day(
    stage_day_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> None:
    """Hard delete — only allowed if stage day has no matches attached."""
    from app.models.match import Match

    stage_day = _get_or_404(db, stage_day_id)

    has_matches = db.query(Match).filter(Match.stage_day_id == stage_day_id).first()
    if has_matches:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete a stage day that already has matches imported.",
        )

    db.delete(stage_day)
    db.commit()
