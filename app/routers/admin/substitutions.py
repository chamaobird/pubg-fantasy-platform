# app/routers/admin/substitutions.py
"""
Admin — Substituições de jogadores por stage.

POST   /admin/stages/{stage_id}/substitutions          → registra substituição + add sub ao roster
GET    /admin/stages/{stage_id}/substitutions          → lista substituições da stage
DELETE /admin/stages/{stage_id}/substitutions/{sub_id} → remove substituição
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin
from app.models.person import Person
from app.models.roster import Roster
from app.models.stage import Stage
from app.models.substitution import StageSubstitution
from app.models.user import User

router = APIRouter(
    prefix="/admin/stages/{stage_id}/substitutions",
    tags=["Admin — Substituições"],
    dependencies=[Depends(require_admin)],
)


# ── Schemas ───────────────────────────────────────────────────────────────────

class SubstitutionCreate(BaseModel):
    out_person_id: int
    in_person_id: int


class SubstitutionOut(BaseModel):
    id: int
    stage_id: int
    out_person_id: int
    out_person_name: Optional[str]
    in_person_id: int
    in_person_name: Optional[str]
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_stage_or_404(db: Session, stage_id: int) -> Stage:
    stage = db.query(Stage).get(stage_id)
    if not stage:
        raise HTTPException(status_code=404, detail="Stage não encontrada.")
    return stage


def _get_person_or_404(db: Session, person_id: int) -> Person:
    person = db.query(Person).get(person_id)
    if not person:
        raise HTTPException(status_code=404, detail=f"Person {person_id} não encontrada.")
    return person


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=list[SubstitutionOut])
def list_substitutions(stage_id: int, db: Session = Depends(get_db)):
    _get_stage_or_404(db, stage_id)
    rows = (
        db.query(StageSubstitution)
        .filter(StageSubstitution.stage_id == stage_id)
        .order_by(StageSubstitution.created_at)
        .all()
    )
    result = []
    for s in rows:
        result.append(SubstitutionOut(
            id=s.id,
            stage_id=s.stage_id,
            out_person_id=s.out_person_id,
            out_person_name=s.out_person.display_name if s.out_person else None,
            in_person_id=s.in_person_id,
            in_person_name=s.in_person.display_name if s.in_person else None,
            created_at=s.created_at,
        ))
    return result


@router.post("", response_model=SubstitutionOut, status_code=status.HTTP_201_CREATED)
def create_substitution(
    stage_id: int,
    body: SubstitutionCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    stage = _get_stage_or_404(db, stage_id)
    out_person = _get_person_or_404(db, body.out_person_id)
    in_person  = _get_person_or_404(db, body.in_person_id)

    if body.out_person_id == body.in_person_id:
        raise HTTPException(status_code=400, detail="out_person e in_person não podem ser o mesmo.")

    # Idempotente: se já existe substituição para esse out_person nessa stage, atualiza
    existing = (
        db.query(StageSubstitution)
        .filter(StageSubstitution.stage_id == stage_id, StageSubstitution.out_person_id == body.out_person_id)
        .first()
    )
    if existing:
        existing.in_person_id = body.in_person_id
        sub = existing
    else:
        sub = StageSubstitution(
            stage_id=stage_id,
            out_person_id=body.out_person_id,
            in_person_id=body.in_person_id,
        )
        db.add(sub)

    # Garante que in_person está no roster da stage como is_available=False
    roster_entry = (
        db.query(Roster)
        .filter(Roster.stage_id == stage_id, Roster.person_id == body.in_person_id)
        .first()
    )
    if not roster_entry:
        # Determina team_name a partir do out_person (mesmo time)
        out_roster = (
            db.query(Roster)
            .filter(Roster.stage_id == stage_id, Roster.person_id == body.out_person_id)
            .first()
        )
        team_name = out_roster.team_name if out_roster else None
        db.add(Roster(
            stage_id=stage_id,
            person_id=body.in_person_id,
            team_name=team_name,
            is_available=False,
        ))

    db.commit()
    db.refresh(sub)

    return SubstitutionOut(
        id=sub.id,
        stage_id=sub.stage_id,
        out_person_id=sub.out_person_id,
        out_person_name=out_person.display_name,
        in_person_id=sub.in_person_id,
        in_person_name=in_person.display_name,
    )


@router.delete("/{sub_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_substitution(
    stage_id: int,
    sub_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    _get_stage_or_404(db, stage_id)
    sub = db.query(StageSubstitution).filter(
        StageSubstitution.id == sub_id,
        StageSubstitution.stage_id == stage_id,
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Substituição não encontrada.")
    db.delete(sub)
    db.commit()
