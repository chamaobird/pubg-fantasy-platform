from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.fantasy import FantasyEntry, FantasyTeam
from app.models.player import Player
from app.models.tournament import Tournament
from app.models.user import User
from app.schemas.fantasy import FantasyTeamCreate, FantasyTeamOut, FantasyTeamUpdate
from app.services.auth import get_current_user
from app.services.fantasy_scoring import score_fantasy_team

router = APIRouter(prefix="/fantasy-teams", tags=["fantasy-teams"])


def _validate_lineup(
    player_ids: list[int],
    captain_id: int,
    tournament: Tournament,
    db: Session,
) -> list[Player]:
    if captain_id not in player_ids:
        raise HTTPException(status_code=400, detail="Captain must be in the player list")

    players = db.query(Player).filter(Player.id.in_(player_ids), Player.is_active == True).all()
    if len(players) != len(player_ids):
        raise HTTPException(status_code=400, detail="One or more players not found or inactive")

    total_cost = sum(float(p.price) for p in players)
    if total_cost > float(tournament.budget_limit):
        raise HTTPException(
            status_code=400,
            detail=f"Lineup cost {total_cost:.2f} exceeds budget {tournament.budget_limit:.2f}",
        )
    return players


@router.post("/", response_model=FantasyTeamOut, status_code=201)
def create_fantasy_team(
    payload: FantasyTeamCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tournament = db.get(Tournament, payload.tournament_id)
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    if tournament.status != "active":
        raise HTTPException(status_code=400, detail="Tournament is not active")

    # One fantasy team per user per tournament
    existing = (
        db.query(FantasyTeam)
        .filter(FantasyTeam.user_id == current_user.id, FantasyTeam.tournament_id == payload.tournament_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="You already have a team in this tournament")

    _validate_lineup(payload.player_ids, payload.captain_player_id, tournament, db)

    team = FantasyTeam(
        user_id=current_user.id,
        tournament_id=payload.tournament_id,
        name=payload.name,
        captain_player_id=payload.captain_player_id,
    )
    db.add(team)
    db.flush()  # get team.id before adding entries

    for pid in payload.player_ids:
        db.add(FantasyEntry(fantasy_team_id=team.id, player_id=pid, is_captain=(pid == payload.captain_player_id)))

    db.commit()
    db.refresh(team)
    return team


@router.get("/", response_model=list[FantasyTeamOut])
def my_fantasy_teams(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(FantasyTeam).filter(FantasyTeam.user_id == current_user.id).all()


@router.get("/{team_id}", response_model=FantasyTeamOut)
def get_fantasy_team(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    team = db.get(FantasyTeam, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Fantasy team not found")
    if team.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    return team


@router.patch("/{team_id}", response_model=FantasyTeamOut)
def update_fantasy_team(
    team_id: int,
    payload: FantasyTeamUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    team = db.get(FantasyTeam, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Fantasy team not found")
    if team.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    tournament = db.get(Tournament, team.tournament_id)
    if tournament.status != "active":
        raise HTTPException(status_code=400, detail="Lineup changes only allowed while tournament is active")

    if payload.name:
        team.name = payload.name

    if payload.player_ids is not None:
        captain_id = payload.captain_player_id or team.captain_player_id
        _validate_lineup(payload.player_ids, captain_id, tournament, db)

        # Replace entries
        db.query(FantasyEntry).filter(FantasyEntry.fantasy_team_id == team.id).delete()
        db.flush()
        for pid in payload.player_ids:
            db.add(FantasyEntry(fantasy_team_id=team.id, player_id=pid, is_captain=(pid == captain_id)))
        team.captain_player_id = captain_id

    elif payload.captain_player_id:
        team.captain_player_id = payload.captain_player_id
        db.query(FantasyEntry).filter(FantasyEntry.fantasy_team_id == team.id).update({"is_captain": False})
        db.query(FantasyEntry).filter(
            FantasyEntry.fantasy_team_id == team.id, FantasyEntry.player_id == payload.captain_player_id
        ).update({"is_captain": True})

    db.commit()
    db.refresh(team)
    return team


@router.post("/{team_id}/score", response_model=FantasyTeamOut)
def refresh_score(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Recalculate and persist the total_points for this fantasy team."""
    team = db.get(FantasyTeam, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Fantasy team not found")
    if team.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    team.total_points = score_fantasy_team(team, db)
    db.commit()
    db.refresh(team)
    return team


@router.get("/leaderboard/{tournament_id}", response_model=list[FantasyTeamOut])
def leaderboard(tournament_id: int, db: Session = Depends(get_db)):
    return (
        db.query(FantasyTeam)
        .filter(FantasyTeam.tournament_id == tournament_id)
        .order_by(FantasyTeam.total_points.desc())
        .limit(50)
        .all()
    )
