# app/routers/historical.py
from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.services.historical import (
    MatchInput,
    PlayerStatInput,
    import_matches,
    import_matches_by_pubg_ids,
    import_matches_from_pubg,
    recalculate_prices,
)

router = APIRouter(prefix="/historical", tags=["Historical"])


# ─────────────────────────────────────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────────────────────────────────────

class PlayerStatBody(BaseModel):
    player_id:     int
    kills:         int   = Field(default=0, ge=0)
    assists:       int   = Field(default=0, ge=0)
    damage_dealt:  float = Field(default=0.0, ge=0)
    placement:     int   = Field(default=28, ge=1, le=28)
    survival_secs: int   = Field(default=0, ge=0)
    headshots:     int   = Field(default=0, ge=0)
    knocks:        int   = Field(default=0, ge=0)


class MatchBody(BaseModel):
    pubg_match_id: str
    map_name:      Optional[str]        = None
    played_at:     Optional[datetime]   = None
    duration_secs: int                  = Field(default=0, ge=0)
    match_number:  Optional[int]        = None
    phase:         Optional[str]        = None
    day:           Optional[int]        = None
    player_stats:  list[PlayerStatBody] = Field(default_factory=list)


class ImportMatchesManualBody(BaseModel):
    """Body for the manual (body-driven) import endpoint."""
    matches: list[MatchBody] = Field(..., min_length=1)


class ImportMatchesApiBody(BaseModel):
    """Body for the PUBG-API-driven import endpoint."""
    pubg_tournament_id: str = Field(
        ...,
        description="PUBG tournament ID as returned by GET /tournaments, e.g. 'eu-race26'",
    )


class ImportMatchesByIdsBody(BaseModel):
    """Body for the direct-UUID import endpoint."""
    pubg_match_ids: list[str] = Field(
        ...,
        min_length=1,
        description="List of PUBG match UUIDs to import directly (bypasses tournament roster lookup).",
    )


class ImportMatchesResponse(BaseModel):
    tournament_id:   int
    created:         int
    skipped:         int
    errors:          list[str]
    match_ids_found: Optional[int] = None


class PlayerPriceResult(BaseModel):
    player_id:        int
    avg_kills_50:     float
    avg_damage_50:    float
    avg_placement_50: float
    avg_kills_10:     float
    expected_fantasy: float
    final_price:      float


class RecalculatePricesResponse(BaseModel):
    tournament_id: int
    updated:       int
    dry_run:       bool
    players:       list[PlayerPriceResult]


# ─────────────────────────────────────────────────────────────────────────────
# Auth guard
# ─────────────────────────────────────────────────────────────────────────────

def _require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    return current_user


# ─────────────────────────────────────────────────────────────────────────────
# POST /historical/import-matches/{tournament_id}
# Mode A: manual body — send {"matches": [...]}
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/import-matches/{tournament_id}",
    response_model=ImportMatchesResponse,
    status_code=status.HTTP_200_OK,
    summary="Import matches from a JSON body",
    description=(
        "Manual import: provide the match data directly in the request body. "
        "Matches already in the DB (matched by `pubg_match_id`) are skipped."
    ),
)
def import_matches_manual(
    tournament_id: int,
    body: ImportMatchesManualBody,
    db: Session = Depends(get_db),
    _admin: User = Depends(_require_admin),
):
    match_inputs: list[MatchInput] = [
        MatchInput(
            pubg_match_id=m.pubg_match_id,
            map_name=m.map_name,
            played_at=m.played_at,
            duration_secs=m.duration_secs,
            player_stats=[
                PlayerStatInput(
                    player_id=ps.player_id,
                    kills=ps.kills,
                    assists=ps.assists,
                    damage_dealt=ps.damage_dealt,
                    placement=ps.placement,
                    survival_secs=ps.survival_secs,
                    headshots=ps.headshots,
                    knocks=ps.knocks,
                )
                for ps in m.player_stats
            ],
            match_number=m.match_number,
            phase=m.phase,
            day=m.day,
        )
        for m in body.matches
    ]

    try:
        result = import_matches(db, tournament_id, match_inputs)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))

    return ImportMatchesResponse(tournament_id=tournament_id, **result)


# ─────────────────────────────────────────────────────────────────────────────
# POST /historical/import-matches-from-pubg/{tournament_id}
# Mode B: PUBG API — send {"pubg_tournament_id": "eu-race26"}
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/import-matches-from-pubg/{tournament_id}",
    response_model=ImportMatchesResponse,
    status_code=status.HTTP_200_OK,
    summary="Fetch and import matches directly from the PUBG API",
    description=(
        "API-driven import: provide a `pubg_tournament_id` (e.g. `eu-race26`). "
        "The backend calls the PUBG API, resolves participants to your Player rows "
        "by `pubg_id` then by `name`, and persists everything. "
        "Already-imported matches are skipped (idempotent). "
        "Unresolved participants are logged as warnings, not errors."
    ),
)
def import_matches_from_pubg_endpoint(
    tournament_id: int,
    body: ImportMatchesApiBody,
    db: Session = Depends(get_db),
    _admin: User = Depends(_require_admin),
):
    try:
        result = import_matches_from_pubg(
            db, tournament_id, body.pubg_tournament_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))

    return ImportMatchesResponse(tournament_id=tournament_id, **result)


# ─────────────────────────────────────────────────────────────────────────────
# POST /historical/import-matches-by-ids/{tournament_id}
# Mode C: supply PUBG match UUIDs directly (skips tournament roster lookup)
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/import-matches-by-ids/{tournament_id}",
    response_model=ImportMatchesResponse,
    status_code=status.HTTP_200_OK,
    summary="Import specific PUBG matches by their UUIDs",
    description=(
        "Direct-UUID import: supply a list of PUBG match UUIDs. "
        "The backend fetches each match from the PUBG API and imports it. "
        "Useful for scrim matches not yet listed in the PUBG tournament roster. "
        "Already-imported matches are skipped (idempotent)."
    ),
)
def import_matches_by_ids_endpoint(
    tournament_id: int,
    body: ImportMatchesByIdsBody,
    db: Session = Depends(get_db),
    _admin: User = Depends(_require_admin),
):
    try:
        result = import_matches_by_pubg_ids(
            db, tournament_id, body.pubg_match_ids
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))
    return ImportMatchesResponse(tournament_id=tournament_id, **result)


# ─────────────────────────────────────────────────────────────────────────────
# POST /historical/recalculate-prices/{tournament_id}
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/recalculate-prices/{tournament_id}",
    response_model=RecalculatePricesResponse,
    status_code=status.HTTP_200_OK,
    summary="Recalculate player fantasy prices from historical stats",
)
def recalculate_prices_endpoint(
    tournament_id: int,
    dry_run: bool = Query(False, description="Preview prices without persisting"),
    db: Session = Depends(get_db),
    _admin: User = Depends(_require_admin),
):
    try:
        result = recalculate_prices(db, tournament_id, dry_run=dry_run)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))

    return RecalculatePricesResponse(
        tournament_id=result["tournament_id"],
        updated=result["updated"],
        dry_run=result["dry_run"],
        players=[PlayerPriceResult(**p) for p in result["players"]],
    )
