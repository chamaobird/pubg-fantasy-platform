# app/routers/leagues.py
"""
Endpoints de Ligas Privadas.

POST /leagues/                          → criar liga
GET  /leagues/                          → minhas ligas
GET  /leagues/{id}                      → detalhe (membro ou owner)
POST /leagues/join/{invite_code}        → entrar com código
GET  /leagues/{id}/leaderboard/{stage_id} → leaderboard filtrado pelos membros
DELETE /leagues/{id}                    → deletar liga (owner)
DELETE /leagues/{id}/members/{user_id} → remover membro (owner)
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.dependencies import get_current_user
from app.models.league import League, LeagueMember
from app.models.stage import Stage
from app.models.user import User
from app.services.league import create_league, join_league, get_league_leaderboard

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/leagues", tags=["Leagues"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class CreateLeagueRequest(BaseModel):
    name: str
    championship_id: int
    max_members: int = 50


class MemberOut(BaseModel):
    user_id: str
    username: Optional[str]
    avatar_url: Optional[str]
    joined_at: str
    is_owner: bool


class LeagueOut(BaseModel):
    id: int
    name: str
    championship_id: int
    championship_name: Optional[str]
    invite_code: str
    max_members: int
    member_count: int
    is_owner: bool
    created_at: str


class LeagueDetailOut(LeagueOut):
    members: list[MemberOut]


class LeaderboardEntryOut(BaseModel):
    rank: int
    user_id: str
    username: Optional[str]
    avatar_url: Optional[str]
    total_points: float
    days_played: int
    survival_secs: int
    captain_pts: float
    global_rank: Optional[int]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _assert_member(league: League, user_id: str) -> None:
    ids = {m.user_id for m in league.members}
    if user_id not in ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não é membro desta liga",
        )


def _assert_owner(league: League, user_id: str) -> None:
    if league.owner_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas o dono da liga pode realizar esta ação",
        )


def _build_league_out(league: League, user_id: str, db: Session) -> LeagueOut:
    from app.models.championship import Championship
    champ = db.query(Championship).filter(Championship.id == league.championship_id).first()
    return LeagueOut(
        id=league.id,
        name=league.name,
        championship_id=league.championship_id,
        championship_name=champ.name if champ else None,
        invite_code=league.invite_code,
        max_members=league.max_members,
        member_count=len(league.members),
        is_owner=league.owner_id == user_id,
        created_at=league.created_at.isoformat(),
    )


def _build_league_detail(league: League, user_id: str, db: Session) -> LeagueDetailOut:
    from app.models.championship import Championship
    champ = db.query(Championship).filter(Championship.id == league.championship_id).first()

    # Busca usernames dos membros
    member_user_ids = [m.user_id for m in league.members]
    user_map = {
        u.id: u
        for u in db.query(User).filter(User.id.in_(member_user_ids)).all()
    }

    members_out = [
        MemberOut(
            user_id=m.user_id,
            username=user_map.get(m.user_id, User()).username if m.user_id in user_map else None,
            avatar_url=user_map.get(m.user_id, User()).avatar_url if m.user_id in user_map else None,
            joined_at=m.joined_at.isoformat(),
            is_owner=m.user_id == league.owner_id,
        )
        for m in sorted(league.members, key=lambda x: x.joined_at)
    ]

    return LeagueDetailOut(
        id=league.id,
        name=league.name,
        championship_id=league.championship_id,
        championship_name=champ.name if champ else None,
        invite_code=league.invite_code,
        max_members=league.max_members,
        member_count=len(league.members),
        is_owner=league.owner_id == user_id,
        created_at=league.created_at.isoformat(),
        members=members_out,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("", response_model=LeagueDetailOut, status_code=status.HTTP_201_CREATED)
def create_league_endpoint(
    body: CreateLeagueRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LeagueDetailOut:
    """Cria uma nova liga privada. O criador é automaticamente o dono e primeiro membro."""
    try:
        league = create_league(
            db=db,
            owner_id=current_user.id,
            name=body.name,
            championship_id=body.championship_id,
            max_members=body.max_members,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))

    return _build_league_detail(league, current_user.id, db)


@router.get("", response_model=list[LeagueOut])
def list_my_leagues(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[LeagueOut]:
    """Lista todas as ligas que o usuário participa (como dono ou membro)."""
    memberships = (
        db.query(LeagueMember)
        .filter(LeagueMember.user_id == current_user.id)
        .all()
    )
    league_ids = [m.league_id for m in memberships]
    leagues = (
        db.query(League)
        .filter(League.id.in_(league_ids), League.is_active == True)  # noqa: E712
        .order_by(League.created_at.desc())
        .all()
    )
    return [_build_league_out(lg, current_user.id, db) for lg in leagues]


@router.get("/{league_id}", response_model=LeagueDetailOut)
def get_league(
    league_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LeagueDetailOut:
    """Retorna detalhes da liga, incluindo membros. Requer ser membro."""
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Liga não encontrada")
    _assert_member(league, current_user.id)
    return _build_league_detail(league, current_user.id, db)


@router.post("/join/{invite_code}", response_model=LeagueDetailOut)
def join_league_endpoint(
    invite_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LeagueDetailOut:
    """Entra em uma liga pelo código de convite."""
    try:
        league = join_league(db=db, user_id=current_user.id, invite_code=invite_code)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    return _build_league_detail(league, current_user.id, db)


@router.get("/{league_id}/leaderboard/{stage_id}", response_model=list[LeaderboardEntryOut])
def get_league_leaderboard_endpoint(
    league_id: int,
    stage_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[LeaderboardEntryOut]:
    """Leaderboard da liga filtrado pelos membros para a stage informada."""
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Liga não encontrada")
    _assert_member(league, current_user.id)

    try:
        rows = get_league_leaderboard(db=db, league=league, stage_id=stage_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))

    return [LeaderboardEntryOut(**row) for row in rows]


@router.delete("/{league_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_league(
    league_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Deleta a liga. Apenas o dono pode fazer isso."""
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Liga não encontrada")
    _assert_owner(league, current_user.id)
    db.delete(league)
    db.commit()
    logger.info("[League] Liga id=%s deletada por user=%s", league_id, current_user.id)


@router.delete("/{league_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    league_id: int,
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Remove um membro da liga. Apenas o dono pode fazer isso. Dono não pode se remover."""
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Liga não encontrada")
    _assert_owner(league, current_user.id)

    if user_id == league.owner_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="O dono não pode ser removido da liga. Delete a liga para encerrá-la.",
        )

    member = db.query(LeagueMember).filter(
        LeagueMember.league_id == league_id,
        LeagueMember.user_id == user_id,
    ).first()
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membro não encontrado")

    db.delete(member)
    db.commit()
