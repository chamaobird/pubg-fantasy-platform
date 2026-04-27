# app/routers/admin/championship_groups.py
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin
from app.models.championship import Championship
from app.models.championship_group import ChampionshipGroup, ChampionshipGroupMember
from app.models.user import User
from app.schemas.championship_group import (
    ChampionshipGroupCreate,
    ChampionshipGroupMemberAdd,
    ChampionshipGroupResponse,
    ChampionshipGroupUpdate,
)

router = APIRouter(
    prefix="/admin/championship-groups",
    tags=["Admin — Championship Groups"],
    dependencies=[Depends(require_admin)],
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_or_404(db: Session, group_id: int) -> ChampionshipGroup:
    obj = db.query(ChampionshipGroup).filter(ChampionshipGroup.id == group_id).first()
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Championship group {group_id} not found",
        )
    return obj


def _to_response(group: ChampionshipGroup) -> ChampionshipGroupResponse:
    return ChampionshipGroupResponse(
        id=group.id,
        name=group.name,
        short_name=group.short_name,
        is_active=group.is_active,
        display_order=group.display_order,
        championship_ids=[m.championship_id for m in group.members],
        created_at=group.created_at,
    )


# ── CRUD de grupos ────────────────────────────────────────────────────────────

@router.post("", response_model=ChampionshipGroupResponse, status_code=status.HTTP_201_CREATED)
def create_group(
    body: ChampionshipGroupCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> ChampionshipGroupResponse:
    group = ChampionshipGroup(**body.model_dump())
    db.add(group)
    db.commit()
    db.refresh(group)
    return _to_response(group)


@router.get("", response_model=list[ChampionshipGroupResponse])
def list_groups(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> list[ChampionshipGroupResponse]:
    q = db.query(ChampionshipGroup)
    if not include_inactive:
        q = q.filter(ChampionshipGroup.is_active == True)  # noqa: E712
    groups = q.order_by(ChampionshipGroup.display_order, ChampionshipGroup.id).all()
    return [_to_response(g) for g in groups]


@router.get("/{group_id}", response_model=ChampionshipGroupResponse)
def get_group(
    group_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> ChampionshipGroupResponse:
    return _to_response(_get_or_404(db, group_id))


@router.patch("/{group_id}", response_model=ChampionshipGroupResponse)
def update_group(
    group_id: int,
    body: ChampionshipGroupUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> ChampionshipGroupResponse:
    group = _get_or_404(db, group_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(group, field, value)
    db.commit()
    db.refresh(group)
    return _to_response(group)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_group(
    group_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> None:
    """Soft delete — sets is_active=False."""
    group = _get_or_404(db, group_id)
    if not group.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Group is already inactive",
        )
    group.is_active = False
    db.commit()


# ── Gerenciamento de membros ──────────────────────────────────────────────────

@router.post(
    "/{group_id}/members",
    response_model=ChampionshipGroupResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Adicionar championship ao grupo",
)
def add_member(
    group_id: int,
    body: ChampionshipGroupMemberAdd,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> ChampionshipGroupResponse:
    group = _get_or_404(db, group_id)

    # Valida que o championship existe
    champ = db.query(Championship).filter(Championship.id == body.championship_id).first()
    if not champ:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Championship {body.championship_id} not found",
        )

    # Verifica se já é membro
    existing = db.query(ChampionshipGroupMember).filter(
        ChampionshipGroupMember.group_id == group_id,
        ChampionshipGroupMember.championship_id == body.championship_id,
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Championship {body.championship_id} is already in this group",
        )

    member = ChampionshipGroupMember(
        group_id=group_id,
        championship_id=body.championship_id,
        display_order=body.display_order,
    )
    db.add(member)
    db.commit()
    db.refresh(group)
    return _to_response(group)


@router.delete(
    "/{group_id}/members/{championship_id}",
    response_model=ChampionshipGroupResponse,
    summary="Remover championship do grupo",
)
def remove_member(
    group_id: int,
    championship_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> ChampionshipGroupResponse:
    group = _get_or_404(db, group_id)

    member = db.query(ChampionshipGroupMember).filter(
        ChampionshipGroupMember.group_id == group_id,
        ChampionshipGroupMember.championship_id == championship_id,
    ).first()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Championship {championship_id} is not in this group",
        )

    db.delete(member)
    db.commit()
    db.refresh(group)
    return _to_response(group)
