# app/routers/admin/roster.py
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import require_admin
from app.models.person import Person
from app.models.roster import Roster
from app.models.stage import Stage
from app.models.user import User
from app.schemas.roster import RosterCreate, RosterResponse, RosterUpdate
from app.schemas.team import (
    ImportTeamRequest,
    ImportTeamResponse,
    ImportedPlayer,
    SkippedPlayer,
)

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
) -> list[RosterResponse]:
    _get_stage_or_404(db, stage_id)

    q = (
        db.query(Roster)
        .options(joinedload(Roster.person))
        .filter(Roster.stage_id == stage_id)
    )
    if not include_unavailable:
        q = q.filter(Roster.is_available == True)  # noqa: E712
    rosters = q.order_by(Roster.id).all()

    return [
        RosterResponse(
            id=r.id,
            stage_id=r.stage_id,
            person_id=r.person_id,
            person_name=r.person.display_name if r.person else None,
            team_name=r.team_name,
            fantasy_cost=float(r.fantasy_cost) if r.fantasy_cost is not None else None,
            cost_override=float(r.cost_override) if r.cost_override is not None else None,
            effective_cost=float(r.effective_cost) if r.effective_cost is not None else None,
            newcomer_to_tier=r.newcomer_to_tier,
            is_available=r.is_available,
            created_at=r.created_at,
        )
        for r in rosters
    ]


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


@router.post("/import-team", status_code=status.HTTP_200_OK)
def import_team_to_roster(
    stage_id: int,
    body: ImportTeamRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> ImportTeamResponse:
    """
    Importa todos os membros ativos de um time para o roster da stage.
    Jogadores já presentes no roster são reportados em 'skipped' — nunca duplicados.
    """
    from app.models.team import Team
    from app.models.team_member import TeamMember

    _get_stage_or_404(db, stage_id)

    team = db.query(Team).filter(Team.id == body.team_id).first()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Time {body.team_id} não encontrado",
        )

    active_members = (
        db.query(TeamMember)
        .options(joinedload(TeamMember.person))
        .filter(TeamMember.team_id == body.team_id, TeamMember.left_at.is_(None))
        .all()
    )

    if not active_members:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"O time '{team.name}' não possui membros ativos.",
        )

    added: list[ImportedPlayer] = []
    skipped: list[SkippedPlayer] = []

    for member in active_members:
        person = member.person
        if not person or not person.is_active:
            skipped.append(SkippedPlayer(
                person_id=member.person_id,
                person_name=person.display_name if person else f"id={member.person_id}",
                reason="Jogador inativo",
            ))
            continue

        existing = (
            db.query(Roster)
            .filter(Roster.stage_id == stage_id, Roster.person_id == person.id)
            .first()
        )
        if existing:
            skipped.append(SkippedPlayer(
                person_id=person.id,
                person_name=person.display_name,
                reason="Já está no roster desta stage",
            ))
            continue

        roster_entry = Roster(
            stage_id=stage_id,
            person_id=person.id,
            team_name=team.tag,
        )
        db.add(roster_entry)
        added.append(ImportedPlayer(person_id=person.id, person_name=person.display_name))

    db.commit()

    return ImportTeamResponse(
        team_id=team.id,
        team_name=team.name,
        stage_id=stage_id,
        added=added,
        skipped=skipped,
    )


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
