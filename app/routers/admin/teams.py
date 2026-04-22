# app/routers/admin/teams.py
"""
Endpoints administrativos de Times

  POST   /admin/teams                               — criar time
  GET    /admin/teams                               — listar times (filtros: region, is_active, q)
  GET    /admin/teams/{team_id}                     — detalhes do time com membros
  PATCH  /admin/teams/{team_id}                     — atualizar time
  POST   /admin/teams/{team_id}/members             — adicionar jogador ao time
  DELETE /admin/teams/{team_id}/members/{person_id} — remover jogador do time (seta left_at)
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import require_admin
from app.models.person import Person
from app.models.team import Team
from app.models.team_member import TeamMember
from app.models.user import User
from app.schemas.team import (
    AddMemberRequest,
    TeamCreate,
    TeamMemberInfo,
    TeamResponse,
    TeamUpdate,
)

router = APIRouter(
    prefix="/admin/teams",
    tags=["Admin — Teams"],
    dependencies=[Depends(require_admin)],
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_team_or_404(db: Session, team_id: int) -> Team:
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Time {team_id} não encontrado",
        )
    return team


def _build_team_response(team: Team, db: Session) -> TeamResponse:
    members_q = (
        db.query(TeamMember)
        .options(joinedload(TeamMember.person))
        .filter(TeamMember.team_id == team.id, TeamMember.left_at.is_(None))
        .order_by(TeamMember.joined_at)
        .all()
    )
    active_members = [
        TeamMemberInfo(
            person_id=m.person_id,
            person_name=m.person.display_name if m.person else "?",
            joined_at=m.joined_at,
            left_at=m.left_at,
        )
        for m in members_q
    ]
    return TeamResponse(
        id=team.id,
        name=team.name,
        tag=team.tag,
        region=team.region,
        logo_path=team.logo_path,
        is_active=team.is_active,
        created_at=team.created_at,
        active_member_count=len(active_members),
        active_members=active_members,
    )


# ── CRUD Times ────────────────────────────────────────────────────────────────

@router.post("", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
def create_team(
    body: TeamCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> TeamResponse:
    team = Team(**body.model_dump())
    db.add(team)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Já existe um time com esse nome ou tag.",
        )
    db.refresh(team)
    return _build_team_response(team, db)


@router.get("", response_model=list[TeamResponse])
def list_teams(
    region: Optional[str] = Query(None, description="Filtrar por região"),
    is_active: Optional[bool] = Query(None, description="Filtrar por status"),
    q: Optional[str] = Query(None, description="Buscar por nome ou tag"),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> list[TeamResponse]:
    query = db.query(Team)
    if region is not None:
        query = query.filter(Team.region == region)
    if is_active is not None:
        query = query.filter(Team.is_active == is_active)
    if q:
        like = f"%{q}%"
        query = query.filter(
            Team.name.ilike(like) | Team.tag.ilike(like)
        )
    teams = query.order_by(Team.region, Team.name).all()
    return [_build_team_response(t, db) for t in teams]


@router.get("/{team_id}", response_model=TeamResponse)
def get_team(
    team_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> TeamResponse:
    team = _get_team_or_404(db, team_id)
    return _build_team_response(team, db)


@router.patch("/{team_id}", response_model=TeamResponse)
def update_team(
    team_id: int,
    body: TeamUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> TeamResponse:
    team = _get_team_or_404(db, team_id)
    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(team, field, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Já existe um time com esse nome ou tag.",
        )
    db.refresh(team)
    return _build_team_response(team, db)


# ── Membros ───────────────────────────────────────────────────────────────────

@router.post("/{team_id}/members", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
def add_member(
    team_id: int,
    body: AddMemberRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> TeamResponse:
    team = _get_team_or_404(db, team_id)

    person = db.query(Person).filter(Person.id == body.person_id).first()
    if not person:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Person {body.person_id} não encontrado",
        )
    if not person.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{person.display_name} está inativo e não pode ser adicionado a um time.",
        )

    # Checa se já está neste mesmo time (ativo)
    already_here = (
        db.query(TeamMember)
        .filter(
            TeamMember.team_id == team_id,
            TeamMember.person_id == body.person_id,
            TeamMember.left_at.is_(None),
        )
        .first()
    )
    if already_here:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{person.display_name} já é membro ativo deste time.",
        )

    # O índice parcial uq_team_member_active_person garante que não há outro time ativo.
    # Capturamos a IntegrityError para dar uma mensagem clara.
    member = TeamMember(
        team_id=team_id,
        person_id=body.person_id,
        joined_at=body.joined_at or datetime.now(tz=timezone.utc),
    )
    db.add(member)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        # Descobre em qual time o jogador já está para mensagem útil
        other = (
            db.query(TeamMember)
            .options(joinedload(TeamMember.team))
            .filter(
                TeamMember.person_id == body.person_id,
                TeamMember.left_at.is_(None),
            )
            .first()
        )
        other_name = other.team.name if other and other.team else "outro time"
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"{person.display_name} já é membro ativo de '{other_name}'. "
                "Remova-o do time atual antes de adicioná-lo aqui."
            ),
        )

    return _build_team_response(team, db)


@router.delete("/{team_id}/members/{person_id}", response_model=TeamResponse)
def remove_member(
    team_id: int,
    person_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> TeamResponse:
    team = _get_team_or_404(db, team_id)

    member = (
        db.query(TeamMember)
        .filter(
            TeamMember.team_id == team_id,
            TeamMember.person_id == person_id,
            TeamMember.left_at.is_(None),
        )
        .first()
    )
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Person {person_id} não é membro ativo deste time.",
        )

    member.left_at = datetime.now(tz=timezone.utc)
    db.commit()
    return _build_team_response(team, db)
