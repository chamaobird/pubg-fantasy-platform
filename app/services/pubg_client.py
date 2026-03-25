# app/services/pubg_client.py
"""
Thin HTTP client for the PUBG API.

Responsibilities
────────────────
- list_tournament_matches(pubg_tournament_id) → list[str]   (match IDs)
- get_match(match_id)                         → RawMatch     (parsed DTO)

Everything in this file is pure I/O — no SQLAlchemy, no FastAPI.
The service layer (historical.py) owns the DB mapping.

PUBG API reference
──────────────────
Tournaments:  GET https://api.pubg.com/tournaments/{id}
Match:        GET https://api.pubg.com/shards/{shard}/matches/{id}

Important shard note
────────────────────
Tournament endpoints are shard-less (use api.pubg.com directly).
Match endpoints are shard-scoped. Tournament match IDs from the
roster endpoint always belong to the "official" shard, which for
esports is typically "tournament" or "steam". If you get 404s on
matches, set PUBG_SHARD=tournament in your .env.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

import requests

logger = logging.getLogger(__name__)

# Base URLs — kept as constants so we can patch them in tests
_TOURNAMENT_BASE = "https://api.pubg.com"
_MATCH_BASE      = "https://api.pubg.com/shards/{shard}"


# ─────────────────────────────────────────────────────────────────────────────
# DTOs — plain Python, no ORM dependency
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class RawPlayerStat:
    """One participant's stats as returned by the PUBG API match endpoint."""
    pubg_account_id: str          # participant.relationships.participant.data.id
    pubg_name:       str          # participant.attributes.stats.name
    kills:           int
    assists:         int
    damage_dealt:    float
    placement:       int          # winPlace in PUBG API (1 = winner)
    survival_secs:   int
    headshots:       int
    knocks:          int          # DBNOs in PUBG API


@dataclass
class RawMatch:
    """
    Parsed representation of one PUBG API match.
    The service layer maps this to MatchInput + list[PlayerStatInput].
    """
    pubg_match_id: str
    map_name:      Optional[str]
    played_at:     Optional[datetime]
    duration_secs: int
    player_stats:  list[RawPlayerStat] = field(default_factory=list)


# ─────────────────────────────────────────────────────────────────────────────
# Client
# ─────────────────────────────────────────────────────────────────────────────

class PubgApiError(Exception):
    """Raised when the PUBG API returns a non-2xx status."""
    def __init__(self, status_code: int, body: str):
        self.status_code = status_code
        super().__init__(f"PUBG API {status_code}: {body}")


class PubgClient:
    def __init__(self, api_key: str, shard: str = "steam"):
        self.api_key = api_key
        self.shard   = shard
        self._session = requests.Session()
        self._session.headers.update(
            {
                "Authorization": f"Bearer {api_key}",
                "Accept":        "application/vnd.api+json",
            }
        )

    # ── Internal helpers ──────────────────────────────────────────────────

    def _get(self, url: str) -> dict:
        try:
            resp = self.session.get(url, timeout=25)
        except requests.exceptions.Timeout:
            raise PubgApiError(408, f"Timeout fetching {url}")
        except requests.exceptions.RequestException as exc:
            raise PubgApiError(503, f"Connection error fetching {url}: {exc}")
        if not resp.ok:
            raise PubgApiError(resp.status_code, resp.text)
        return resp.json()

    # ── Public methods ────────────────────────────────────────────────────

    def list_tournaments(self) -> list[dict]:
        """Return all tournaments the API knows about (id + createdAt)."""
        data = self._get(f"{_TOURNAMENT_BASE}/tournaments")
        return [
            {
                "id":         t["id"],
                "created_at": t["attributes"]["createdAt"],
            }
            for t in data.get("data", [])
        ]

    def list_tournament_matches(self, pubg_tournament_id: str) -> list[str]:
        """
        Return all match IDs for a tournament.

        Calls GET /tournaments/{id} and extracts the relationships.matches
        array. Returns a list of match ID strings, e.g.:
            ["4efd9d9d-...", "cc6c196c-...", ...]

        These IDs are then passed individually to get_match().
        """
        data = self._get(f"{_TOURNAMENT_BASE}/tournaments/{pubg_tournament_id}")

        # The PUBG API nests match IDs under data.relationships.matches.data
        try:
            matches_data = data["data"]["relationships"]["matches"]["data"]
        except KeyError:
            logger.warning(
                "Tournament %s has no matches relationship in API response",
                pubg_tournament_id,
            )
            return []

        match_ids = [m["id"] for m in matches_data if m.get("type") == "match"]
        logger.info(
            "Tournament %s has %s match(es) in PUBG API",
            pubg_tournament_id,
            len(match_ids),
        )
        return match_ids

    def get_match(self, match_id: str) -> RawMatch:
        """
        Fetch and parse one match from the PUBG API.

        Returns a RawMatch DTO with a flat list of RawPlayerStat objects.

        PUBG API JSON structure (abbreviated):
        {
          "data": {
            "id": "...",
            "attributes": {
              "mapName": "Baltic_Main",       ← Erangel
              "createdAt": "2026-03-07T...",
              "duration": 1823               ← seconds
            },
            "relationships": {
              "rosters": { "data": [{"id":"...", "type":"roster"}, ...] }
            }
          },
          "included": [
            {"type":"roster",      "id":"...", "attributes": {"stats": {"rank": 1, ...}},
             "relationships": {"participants": {"data": [{"id":"...", "type":"participant"}]}}},
            {"type":"participant", "id":"...", "attributes": {"stats": {
              "name":         "PlayerName",
              "playerId":     "account.abc123",
              "kills":        3,
              "assists":      1,
              "damageDealt":  450.5,
              "winPlace":     2,
              "timeSurvived": 1650.0,
              "headshotKills":1,
              "DBNOs":        2
            }}}
          ]
        }
        """
        shard_base = _MATCH_BASE.format(shard=self.shard)
        payload = self._get(f"{shard_base}/matches/{match_id}")

        data_node   = payload["data"]
        attrs       = data_node["attributes"]
        included    = payload.get("included", [])

        # ── Parse top-level match fields ──────────────────────────────────
        played_at: Optional[datetime] = None
        raw_ts = attrs.get("createdAt")
        if raw_ts:
            try:
                played_at = datetime.fromisoformat(raw_ts.replace("Z", "+00:00"))
            except ValueError:
                logger.warning("Could not parse match createdAt: %s", raw_ts)

        raw_match = RawMatch(
            pubg_match_id=match_id,
            map_name=_normalise_map_name(attrs.get("mapName")),
            played_at=played_at,
            duration_secs=int(attrs.get("duration", 0)),
        )

        # ── Index included objects by type+id for O(1) lookup ─────────────
        rosters_by_id:      dict[str, dict] = {}
        participants_by_id: dict[str, dict] = {}

        for item in included:
            item_type = item.get("type")
            item_id   = item.get("id")
            if item_type == "roster":
                rosters_by_id[item_id] = item
            elif item_type == "participant":
                participants_by_id[item_id] = item

        # ── Walk rosters → participants to get placement + stats ──────────
        roster_ids = [
            r["id"]
            for r in data_node["relationships"].get("rosters", {}).get("data", [])
        ]

        for roster_id in roster_ids:
            roster = rosters_by_id.get(roster_id)
            if not roster:
                continue

            placement = int(
                roster["attributes"]["stats"].get("rank", 28)
            )

            participant_refs = (
                roster["relationships"]
                .get("participants", {})
                .get("data", [])
            )

            for pref in participant_refs:
                participant = participants_by_id.get(pref["id"])
                if not participant:
                    continue

                stats = participant["attributes"]["stats"]

                raw_match.player_stats.append(
                    RawPlayerStat(
                        pubg_account_id=stats.get("playerId", ""),
                        pubg_name=stats.get("name", ""),
                        kills=int(stats.get("kills", 0)),
                        assists=int(stats.get("assists", 0)),
                        damage_dealt=float(stats.get("damageDealt", 0.0)),
                        placement=placement,
                        survival_secs=int(stats.get("timeSurvived", 0)),
                        headshots=int(stats.get("headshotKills", 0)),
                        knocks=int(stats.get("DBNOs", 0)),
                    )
                )

        logger.info(
            "Parsed match %s: %s participants on %s",
            match_id,
            len(raw_match.player_stats),
            raw_match.map_name,
        )
        return raw_match


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

_MAP_NAME_MAP = {
    "Baltic_Main":   "Erangel",
    "Erangel_Main":  "Erangel",
    "Desert_Main":   "Miramar",
    "Savage_Main":   "Sanhok",
    "DihorOtok_Main":"Vikendi",
    "Summerland_Main":"Karakin",
    "Tiger_Main":    "Taego",
    "Neon_Main":     "Rondo",
}

def _normalise_map_name(raw: Optional[str]) -> Optional[str]:
    """Convert PUBG internal map IDs to human-readable names."""
    if not raw:
        return None
    return _MAP_NAME_MAP.get(raw, raw)