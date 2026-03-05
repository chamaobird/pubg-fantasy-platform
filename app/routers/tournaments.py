from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.tournament import ScoringRule, Tournament
from app.models.user import User
from app.schemas.tournament import (
    ScoringRuleCreate,
    ScoringRuleOut,
    TournamentCreate,
    TournamentOut,
    TournamentUpdate,
)
from app.services.auth import get_current_user, require_admin

router = APIRouter(prefix="/tournaments", tags=["tournaments"])


@router.get("/", response_model=list[TournamentOut])
def list_tournaments(
    region: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(Tournament)
    if region:
        q = q.filter(Tournament.region == region)
    if status:
        q = q.filter(Tournament.status == status)
    return q.all()


@router.post("/", response_model=TournamentOut, status_code=201)
def create_tournament(
    payload: TournamentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = Tournament(**payload.model_dump(), created_by=current_user.id)
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


@router.get("/{tournament_id}", response_model=TournamentOut)
def get_tournament(tournament_id: int, db: Session = Depends(get_db)):
    t = db.get(Tournament, tournament_id)
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")
    return t


@router.patch("/{tournament_id}", response_model=TournamentOut)
def update_tournament(
    tournament_id: int,
    payload: TournamentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = db.get(Tournament, tournament_id)
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")
    if t.created_by != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(t, field, value)
    db.commit()
    db.refresh(t)
    return t


@router.delete("/{tournament_id}", status_code=204)
def delete_tournament(
    tournament_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    t = db.get(Tournament, tournament_id)
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")
    db.delete(t)
    db.commit()


@router.post("/{tournament_id}/scoring-rules", response_model=ScoringRuleOut, status_code=201)
def set_scoring_rules(
    tournament_id: int,
    payload: ScoringRuleCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    existing = db.query(ScoringRule).filter(ScoringRule.tournament_id == tournament_id).first()
    if existing:
        for field, value in payload.model_dump().items():
            setattr(existing, field, value)
        db.commit()
        db.refresh(existing)
        return existing
    rule = ScoringRule(tournament_id=tournament_id, **payload.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule
