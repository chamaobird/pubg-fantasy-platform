import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.pricing import calculate_player_price
from app.database import get_db
from app.models.player import Player, PlayerPriceHistory
from app.models.user import User
from app.schemas.player import (
    PlayerCreate,
    PlayerOut,
    PlayerUpdate,
    PriceHistoryOut,
    RecalculatePriceRequest,
)
from app.services.auth import get_current_user, require_admin

router = APIRouter(prefix="/players", tags=["players"])


@router.get("/", response_model=list[PlayerOut])
def list_players(
    team_id: int | None = None,
    is_active: bool = True,
    db: Session = Depends(get_db),
):
    q = db.query(Player).filter(Player.is_active == is_active)
    if team_id:
        q = q.filter(Player.team_id == team_id)
    return q.all()


@router.post("/", response_model=PlayerOut, status_code=201)
def create_player(
    payload: PlayerCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    player = Player(**payload.model_dump())
    db.add(player)
    db.commit()
    db.refresh(player)
    return player


@router.get("/{player_id}", response_model=PlayerOut)
def get_player(player_id: int, db: Session = Depends(get_db)):
    player = db.get(Player, player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    return player


@router.patch("/{player_id}", response_model=PlayerOut)
def update_player(
    player_id: int,
    payload: PlayerUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    player = db.get(Player, player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(player, field, value)
    db.commit()
    db.refresh(player)
    return player


@router.get("/{player_id}/price-history", response_model=list[PriceHistoryOut])
def price_history(player_id: int, db: Session = Depends(get_db)):
    player = db.get(Player, player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    return player.price_history


@router.post("/{player_id}/recalculate-price", response_model=PlayerOut)
def recalculate_price(
    player_id: int,
    payload: RecalculatePriceRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    player = db.get(Player, player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    new_price, components = calculate_player_price(payload.model_dump())

    # Record the change so users can audit exactly how price was set
    history = PlayerPriceHistory(
        player_id=player_id,
        old_price=float(player.price),
        new_price=new_price,
        reason=payload.reason,
        formula_components_json=json.dumps(components),
    )
    db.add(history)

    player.price = new_price
    player.price_updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(player)
    return player
