# app/routers/admin/championships.py
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin
from app.models.championship import Championship
from app.models.user import User
from app.schemas.championship import (
    ChampionshipCreate,
    ChampionshipResponse,
    ChampionshipUpdate,
)

router = APIRouter(
    prefix="/admin/championships",
    tags=["Admin — Championships"],
    dependencies=[Depends(require_admin)],
)


# ── Helper ────────────────────────────────────────────────────────────────────

def _get_or_404(db: Session, championship_id: int) -> Championship:
    obj = db.query(Championship).filter(Championship.id == championship_id).first()
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Championship {championship_id} not found",
        )
    return obj


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("", response_model=ChampionshipResponse, status_code=status.HTTP_201_CREATED)
def create_championship(
    body: ChampionshipCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> Championship:
    championship = Championship(**body.model_dump())
    db.add(championship)
    db.commit()
    db.refresh(championship)
    return championship


@router.get("", response_model=list[ChampionshipResponse])
def list_championships(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> list[Championship]:
    q = db.query(Championship)
    if not include_inactive:
        q = q.filter(Championship.is_active == True)  # noqa: E712
    return q.order_by(Championship.id.desc()).all()


@router.get("/{championship_id}", response_model=ChampionshipResponse)
def get_championship(
    championship_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> Championship:
    return _get_or_404(db, championship_id)


@router.patch("/{championship_id}", response_model=ChampionshipResponse)
def update_championship(
    championship_id: int,
    body: ChampionshipUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> Championship:
    championship = _get_or_404(db, championship_id)

    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(championship, field, value)

    db.commit()
    db.refresh(championship)
    return championship


@router.delete("/{championship_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_championship(
    championship_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> None:
    """Soft delete — sets is_active=False. Data is preserved."""
    championship = _get_or_404(db, championship_id)
    if not championship.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Championship is already inactive",
        )
    championship.is_active = False
    db.commit()
