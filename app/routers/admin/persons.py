# app/routers/admin/persons.py
from __future__ import annotations
from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin
from app.models.person import Person
from app.models.person_alias import PersonAlias
from app.models.player_account import PlayerAccount
from app.models.user import User
from app.schemas.person import (
    PersonAliasCreate,
    PersonAliasResponse,
    PersonCreate,
    PersonDetailResponse,
    PersonResponse,
    PersonUpdate,
    PlayerAccountCreate,
    PlayerAccountCloseRequest,
    PlayerAccountResponse,
)

router = APIRouter(
    prefix="/admin/persons",
    tags=["Admin — Persons"],
    dependencies=[Depends(require_admin)],
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_person_or_404(db: Session, person_id: int) -> Person:
    obj = db.query(Person).filter(Person.id == person_id).first()
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Person {person_id} not found",
        )
    return obj


def _get_account_or_404(db: Session, account_id: int, person_id: int) -> PlayerAccount:
    obj = (
        db.query(PlayerAccount)
        .filter(
            PlayerAccount.id == account_id,
            PlayerAccount.person_id == person_id,
        )
        .first()
    )
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"PlayerAccount {account_id} not found for person {person_id}",
        )
    return obj


# ── Person endpoints ──────────────────────────────────────────────────────────

@router.post("", response_model=PersonResponse, status_code=status.HTTP_201_CREATED)
def create_person(
    body: PersonCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> Person:
    person = Person(display_name=body.display_name)
    db.add(person)
    db.commit()
    db.refresh(person)
    return person


@router.get("", response_model=list[PersonResponse])
def list_persons(
    search: Optional[str] = Query(None, description="Filter by display_name (case-insensitive)"),
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> list[Person]:
    q = db.query(Person)
    if not include_inactive:
        q = q.filter(Person.is_active == True)  # noqa: E712
    if search:
        q = q.filter(Person.display_name.ilike(f"%{search}%"))
    return q.order_by(Person.display_name).all()


@router.get("/{person_id}", response_model=PersonDetailResponse)
def get_person(
    person_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> Person:
    return _get_person_or_404(db, person_id)


@router.patch("/{person_id}", response_model=PersonResponse)
def update_person(
    person_id: int,
    body: PersonUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> Person:
    person = _get_person_or_404(db, person_id)

    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(person, field, value)

    db.commit()
    db.refresh(person)
    return person


# ── PlayerAccount endpoints ───────────────────────────────────────────────────

@router.post(
    "/{person_id}/accounts",
    response_model=PlayerAccountResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_account(
    person_id: int,
    body: PlayerAccountCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> PlayerAccount:
    _get_person_or_404(db, person_id)

    # Check for duplicate active account_id + shard
    conflict = (
        db.query(PlayerAccount)
        .filter(
            PlayerAccount.account_id == body.account_id,
            PlayerAccount.shard == body.shard,
            PlayerAccount.active_until.is_(None),
        )
        .first()
    )
    if conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"An active PlayerAccount with account_id='{body.account_id}' "
                f"and shard='{body.shard}' already exists for person {conflict.person_id}"
            ),
        )

    account = PlayerAccount(
        person_id=person_id,
        account_id=body.account_id,
        shard=body.shard,
        alias=body.alias,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


@router.patch(
    "/{person_id}/accounts/{account_id}",
    response_model=PlayerAccountResponse,
)
def close_account(
    person_id: int,
    account_id: int,
    body: PlayerAccountCloseRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> PlayerAccount:
    """Set active_until to mark when this account/alias stopped being used."""
    account = _get_account_or_404(db, account_id, person_id)

    if account.active_until is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Account is already closed (active_until is already set)",
        )

    account.active_until = body.active_until
    db.commit()
    db.refresh(account)
    return account


# ── PersonAlias endpoints ─────────────────────────────────────────────────────

@router.post(
    "/{person_id}/aliases",
    response_model=PersonAliasResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_alias(
    person_id: int,
    body: PersonAliasCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> PersonAlias:
    _get_person_or_404(db, person_id)

    conflict = db.query(PersonAlias).filter(PersonAlias.alias == body.alias).first()
    if conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Alias '{body.alias}' already exists for person {conflict.person_id}",
        )

    alias = PersonAlias(person_id=person_id, alias=body.alias)
    db.add(alias)
    db.commit()
    db.refresh(alias)
    return alias


@router.delete(
    "/{person_id}/aliases/{alias_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_alias(
    person_id: int,
    alias_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> None:
    alias = (
        db.query(PersonAlias)
        .filter(PersonAlias.id == alias_id, PersonAlias.person_id == person_id)
        .first()
    )
    if not alias:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alias {alias_id} not found for person {person_id}",
        )
    db.delete(alias)
    db.commit()
