# app/routers/admin/roster.py
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin
from app.models.person import Person
from app.models.roster import Roster
from app.models.stage import Stage
from app.models.user import User
from app.schemas.roster import RosterCreate, RosterResponse, RosterUpdate

router = APIRouter(
    prefix="/admin/stages/{stage_id}/roster",
    tags=["Admin — Roster"],
    dependencies=[Depends(require_admin)],
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_stage_or_404(db: Session, stage_id: int) -> Stage:
    obj = db.query(Stage).filter(Stage.id == stage_id).first()
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Stage {stage_id} not found",
        )
    return obj


def _get_roster_or_404(db: Session, roster_id: int, stage_id: int) -> Roster:
    obj = (
        db.query(Roster)
        .filter(Roster.id == roster_id, Roster.stage_id == stage_id)
        .first()
    )
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Roster entry {roster_id} not found for stage {stage_id}",
        )
    return obj


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("", response_model=RosterResponse, status_code=status.HTTP_201_CREATED)
def add_to_roster(
    stage_id: int,
    body: RosterCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> Roster:
    _get_stage_or_404(db, stage_id)

    # Validate person exists and is active
    person = db.query(Person).filter(Person.id == body.person_id).first()
    if not person:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Person {body.person_id} not found",
        )
    if not person.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Person {body.person_id} is inactive",
        )

    # Prevent duplicates
    existing = (
        db.query(Roster)
        .filter(Roster.stage_id == stage_id, Roster.person_id == body.person_id)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Person {body.person_id} is already in the roster for stage {stage_id}",
        )

    roster = Roster(stage_id=stage_id, **body.model_dump())
    db.add(roster)
    db.commit()
    db.refresh(roster)
    return roster


@router.get("", response_model=list[RosterResponse])
def list_roster(
    stage_id: int,
    include_unavailable: bool = False,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> list[Roster]:
    _get_stage_or_404(db, stage_id)

    q = db.query(Roster).filter(Roster.stage_id == stage_id)
    if not include_unavailable:
        q = q.filter(Roster.is_available == True)  # noqa: E712
    return q.order_by(Roster.id).all()


@router.patch("/{roster_id}", response_model=RosterResponse)
def update_roster_entry(
    stage_id: int,
    roster_id: int,
    body: RosterUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> Roster:
    roster = _get_roster_or_404(db, roster_id, stage_id)

    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(roster, field, value)

    db.commit()
    db.refresh(roster)
    return roster


@router.delete("/{roster_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_from_roster(
    stage_id: int,
    roster_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> None:
    """Hard delete — only allowed if this roster entry has no lineup usage."""
    from app.models.lineup import LineupPlayer

    roster = _get_roster_or_404(db, roster_id, stage_id)

    in_lineup = (
        db.query(LineupPlayer)
        .filter(LineupPlayer.roster_id == roster_id)
        .first()
    )
    if in_lineup:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Cannot remove a player from roster while they appear in user lineups. "
                "Set is_available=false instead."
            ),
        )

    db.delete(roster)
    db.commit()
