# app/services/player_sync.py
"""
Service for bulk-upserting players for a specific tournament.

Used to seed real player rosters (name + pubg_id + team) before a
tournament starts, so that import-matches-from-pubg can resolve
participants correctly.

Design decisions
────────────────
- Upsert key: pubg_id if present, else name (case-insensitive).
  This means re-running with updated data is always safe.
- Team lookup: by name, case-insensitive. Team is created if not found.
  Teams in this app are global (no tournament_id), so we just ensure
  the team row exists.
- Player.tournament_id is set explicitly so _build_player_lookup can
  scope by tournament without a Team join.
- PlayerPriceHistory is NOT touched here — pricing stays separate.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

from sqlalchemy.orm import Session

from app.models import Player, Team, Tournament

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Input DTO
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class PlayerRosterEntry:
    """One player row from the roster JSON/CSV."""
    name:        str
    pubg_id:     Optional[str] = None   # account.xxxx from PUBG API
    team_name:   Optional[str] = None   # e.g. "Nova Esports", "Natus Vincere"
    region:      Optional[str] = None
    nationality: Optional[str] = None
    position:    Optional[str] = None   # IGL | Fragger | Sniper | Support
    fantasy_cost: float = 10.0


# ─────────────────────────────────────────────────────────────────────────────
# Team helper
# ─────────────────────────────────────────────────────────────────────────────

from sqlalchemy.orm import Session
from app.models import Team

def _get_or_create_team(db, team_name: str) -> "Team":
    """
    Find team by name (case-insensitive) or create it.
    Only sets `name` — no region, no logo. Teams are global lookup rows.
    """
    from app.models import Team  # local to avoid circular at module level
 
    team = (
        db.query(Team)
        .filter(Team.name.ilike(team_name.strip()))
        .first()
    )
    if not team:
        team = Team(name=team_name.strip())
        db.add(team)
        db.flush()
 
        import logging
        logging.getLogger(__name__).info("Created new team: %s", team_name)
 
    return team


# ─────────────────────────────────────────────────────────────────────────────
# Core upsert logic
# ─────────────────────────────────────────────────────────────────────────────

def bulk_upsert_players(
    db: Session,
    tournament_id: int,
    entries: list[PlayerRosterEntry],
    *,
    reset_tournament_players: bool = False,
) -> dict:
    """
    Upsert a list of players for a tournament.

    Upsert key (in priority order):
        1. pubg_id match  (Player.pubg_id == entry.pubg_id)
        2. name match     (case-insensitive, within same tournament)

    If reset_tournament_players=True, clears Player.tournament_id for all
    existing players in this tournament before upserting. Use this when
    you want to replace the full roster (e.g. team changes between phases).

    Returns:
        {
            "created":  int,
            "updated":  int,
            "errors":   list[str],
            "players":  list[{"id": int, "name": str, "action": "created"|"updated"}]
        }
    """
    tournament = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not tournament:
        raise ValueError(f"Tournament {tournament_id} not found")

    if reset_tournament_players:
        db.query(Player).filter(Player.tournament_id == tournament_id).update(
            {"tournament_id": None}, synchronize_session=False
        )
        db.flush()
        logger.info("Cleared tournament_id for existing players in tournament %s", tournament_id)

    created = 0
    updated = 0
    errors: list[str] = []
    player_results: list[dict] = []

    for entry in entries:
        try:
            player = _resolve_existing_player(db, entry, tournament_id)
            action = "updated" if player else "created"

            if player is None:
                player = Player(name=entry.name)
                db.add(player)

            # ── Always update these fields on upsert ──────────────────────
            player.name          = entry.name
            player.tournament_id = tournament_id
            player.fantasy_cost  = entry.fantasy_cost

            if entry.pubg_id:
                player.pubg_id = entry.pubg_id
            if entry.region:
                player.region = entry.region
            if entry.nationality:
                player.nationality = entry.nationality
            if entry.position:
                player.position = entry.position

            # ── Team lookup/create ────────────────────────────────────────
            if entry.team_name:
                team = _get_or_create_team(db, entry.team_name)
                player.team_id = team.id

            db.flush()

            if action == "created":
                created += 1
            else:
                updated += 1

            player_results.append({"id": player.id, "name": player.name, "action": action})
            logger.debug("%s player: %s (pubg_id=%s)", action, player.name, player.pubg_id)

        except Exception as exc:  # noqa: BLE001
            db.rollback()
            msg = f"Failed to upsert player '{entry.name}': {exc}"
            logger.error(msg)
            errors.append(msg)

    db.commit()
    logger.info(
        "bulk_upsert_players: tournament=%s created=%s updated=%s errors=%s",
        tournament_id, created, updated, len(errors),
    )

    return {
        "created": created,
        "updated": updated,
        "errors":  errors,
        "players": player_results,
    }


def _resolve_existing_player(
    db: Session,
    entry: PlayerRosterEntry,
    tournament_id: int,
) -> Optional[Player]:
    """Try to find an existing Player row for this entry."""
    # Priority 1: pubg_id (globally unique)
    if entry.pubg_id:
        player = db.query(Player).filter(Player.pubg_id == entry.pubg_id).first()
        if player:
            return player

    # Priority 2: name match within this tournament
    player = (
        db.query(Player)
        .filter(
            Player.tournament_id == tournament_id,
            Player.name.ilike(entry.name.strip()),
        )
        .first()
    )
    return player
