# ADD TO app/routers/admin.py
# (or paste as a new file app/routers/players_admin.py and register in main.py)
#
# This adds two endpoints:
#   POST /admin/players/bulk-upsert/{tournament_id}
#   GET  /admin/players/resolution-check/{tournament_id}
#
# If adding to existing admin.py, just append the two route functions and
# their schemas — the router, _require_admin, and imports are already there.

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Player, User
from app.services.player_sync import PlayerRosterEntry, bulk_upsert_players

router = APIRouter(prefix="/admin", tags=["Admin"])


def _require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required.")
    return current_user


# ─────────────────────────────────────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────────────────────────────────────

class PlayerRosterEntryBody(BaseModel):
    name:         str
    pubg_id:      Optional[str]  = Field(None, description="PUBG accountId, e.g. account.abc123")
    team_name:    Optional[str]  = None
    region:       Optional[str]  = None
    nationality:  Optional[str]  = None
    position:     Optional[str]  = Field(None, description="IGL | Fragger | Sniper | Support")
    fantasy_cost: float          = Field(10.0, ge=1.0, le=50.0)


class BulkUpsertBody(BaseModel):
    players:                  list[PlayerRosterEntryBody] = Field(..., min_length=1)
    reset_tournament_players: bool = Field(
        False,
        description=(
            "If true, clears existing tournament assignments before upserting. "
            "Use when replacing a full roster between tournament phases."
        ),
    )


class BulkUpsertResponse(BaseModel):
    tournament_id: int
    created:       int
    updated:       int
    errors:        list[str]
    players:       list[dict]


class ResolutionCheckResponse(BaseModel):
    tournament_id:    int
    total_players:    int
    with_pubg_id:     int
    without_pubg_id:  int
    coverage_pct:     float
    sample_no_pubg_id: list[str]   # first 10 names without pubg_id


# ─────────────────────────────────────────────────────────────────────────────
# POST /admin/players/bulk-upsert/{tournament_id}
# ─────────────────────────────────────────────────────────────────────────────

# ── Example request body ──────────────────────────────────────────────────────
# {
#   "players": [
#     {
#       "name": "Paraboy",
#       "pubg_id": "account.a1b2c3d4e5f6",
#       "team_name": "Nova Esports",
#       "region": "AS",
#       "position": "Fragger",
#       "fantasy_cost": 18.0
#     },
#     {
#       "name": "Pio",
#       "pubg_id": "account.xxxxxxxxxxxx",
#       "team_name": "Natus Vincere",
#       "region": "EU",
#       "position": "IGL",
#       "fantasy_cost": 14.0
#     }
#   ]
# }
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/players/bulk-upsert/{tournament_id}",
    response_model=BulkUpsertResponse,
    status_code=status.HTTP_200_OK,
    summary="Bulk upsert players for a tournament",
    description=(
        "Creates or updates player rows for a tournament from a JSON roster.\n\n"
        "**Upsert key:** `pubg_id` (if provided), otherwise name match within tournament.\n\n"
        "**Safe to re-run:** existing players are updated, not duplicated.\n\n"
        "**Typical pre-tournament flow:**\n"
        "1. Prepare roster JSON with real PUBG `accountId`s from liquipedia/pubgesports.com\n"
        "2. POST to this endpoint\n"
        "3. GET `/admin/players/resolution-check/{id}` to verify coverage\n"
        "4. Run `import-matches-from-pubg` — participants will now resolve"
    ),
)
def bulk_upsert_players_endpoint(
    tournament_id: int,
    body: BulkUpsertBody,
    db: Session = Depends(get_db),
    _admin: User = Depends(_require_admin),
):
    entries = [
        PlayerRosterEntry(
            name=p.name,
            pubg_id=p.pubg_id,
            team_name=p.team_name,
            region=p.region,
            nationality=p.nationality,
            position=p.position,
            fantasy_cost=p.fantasy_cost,
        )
        for p in body.players
    ]

    try:
        result = bulk_upsert_players(
            db,
            tournament_id,
            entries,
            reset_tournament_players=body.reset_tournament_players,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))

    return BulkUpsertResponse(tournament_id=tournament_id, **result)


# ─────────────────────────────────────────────────────────────────────────────
# GET /admin/players/resolution-check/{tournament_id}
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/players/resolution-check/{tournament_id}",
    response_model=ResolutionCheckResponse,
    summary="Check how many players have a real pubg_id set",
    description=(
        "Shows what % of your tournament players have a `pubg_id` populated. "
        "A player without `pubg_id` will only resolve via name-matching, "
        "which is less reliable. Aim for 100% before the event starts."
    ),
)
def resolution_check(
    tournament_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(_require_admin),
):
    players = (
        db.query(Player)
        .filter(Player.tournament_id == tournament_id)
        .all()
    )

    if not players:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No players found for tournament {tournament_id}. Run bulk-upsert first.",
        )

    total        = len(players)
    with_id      = sum(1 for p in players if p.pubg_id)
    without_id   = total - with_id
    coverage_pct = round(with_id / total * 100, 1)
    sample       = [p.name for p in players if not p.pubg_id][:10]

    return ResolutionCheckResponse(
        tournament_id=tournament_id,
        total_players=total,
        with_pubg_id=with_id,
        without_pubg_id=without_id,
        coverage_pct=coverage_pct,
        sample_no_pubg_id=sample,
    )


# ─────────────────────────────────────────────────────────────────────────────
# POST /admin/players/bulk-set-live-ids
# Sets live_pubg_id for players by matching on name or pubg_id
# ─────────────────────────────────────────────────────────────────────────────

class LiveIdEntry(BaseModel):
    """Map one player to their live-server PUBG account ID."""
    player_name:  Optional[str] = Field(None, description="Match by Player.name (case-insensitive)")
    pubg_id:      Optional[str] = Field(None, description="Match by Player.pubg_id (exact)")
    live_pubg_id: str           = Field(..., description="account.XXXXX from live server match data")


class BulkSetLiveIdsBody(BaseModel):
    entries: list[LiveIdEntry] = Field(..., min_length=1)


@router.post(
    "/players/bulk-set-live-ids",
    summary="Bulk-set live_pubg_id on Player records",
    description=(
        "Maps players to their personal Steam account IDs (live_pubg_id) so that "
        "Live Server (steam shard) match imports can resolve player stats. "
        "Match by player_name (case-insensitive) or pubg_id (exact). "
        "Already-set values are overwritten."
    ),
)
def bulk_set_live_ids(
    body: BulkSetLiveIdsBody,
    db: Session = Depends(get_db),
    _admin: User = Depends(_require_admin),
):
    updated = []
    not_found = []

    for entry in body.entries:
        player = None
        if entry.pubg_id:
            player = db.query(Player).filter(Player.pubg_id == entry.pubg_id).first()
        if player is None and entry.player_name:
            player = (
                db.query(Player)
                .filter(Player.name.ilike(entry.player_name))
                .first()
            )
        if player is None:
            not_found.append({"player_name": entry.player_name, "pubg_id": entry.pubg_id})
            continue

        player.live_pubg_id = entry.live_pubg_id
        updated.append({"player_id": player.id, "name": player.name, "live_pubg_id": entry.live_pubg_id})

    db.commit()
    return {
        "updated_count": len(updated),
        "not_found_count": len(not_found),
        "updated": updated,
        "not_found": not_found,
    }
