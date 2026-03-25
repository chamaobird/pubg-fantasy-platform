# app/services/historical.py
"""
Service layer for historical match import and player pricing.
Two import modes
────────────────
body-driven (fetch_from_pubg=False, default):
    Caller passes a list[MatchInput] built from the request body.
    No external HTTP calls. Used by the existing import-matches endpoint.
API-driven  (fetch_from_pubg=True):
    Caller passes a pubg_tournament_id string.
    This service calls PubgClient, resolves participants → Player rows,
    and then runs the same core persistence logic.
Player resolution strategy
──────────────────────────
Priority 1: Player.pubg_id == participant.pubg_account_id  (exact, reliable)
Priority 2: Player.name    == participant.pubg_name        (fuzzy fallback)
If neither matches, the participant is skipped and logged as a warning.
This means imports work today with seeded/fake data, and improve
automatically once you populate real pubg_id values on your Player rows.
"""
from __future__ import annotations
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.models import Match, MatchPlayerStat, Player, Tournament, Team, PlayerPriceHistory

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Pricing constants
# ─────────────────────────────────────────────────────────────────────────────
BASE_PRICE   = 10.0
PRICE_FACTOR = 0.5
MIN_PRICE    = 5.0
MAX_PRICE    = 30.0

# ─────────────────────────────────────────────────────────────────────────────
# Input DTOs (used by both modes)
# ─────────────────────────────────────────────────────────────────────────────
@dataclass
class PlayerStatInput:
    player_id:     int
    kills:         int   = 0
    assists:       int   = 0
    damage_dealt:  float = 0.0
    placement:     int   = 28
    survival_secs: int   = 0
    headshots:     int   = 0
    knocks:        int   = 0

@dataclass
class MatchInput:
    pubg_match_id: str
    map_name:      Optional[str]
    played_at:     Optional[datetime]
    duration_secs: int
    player_stats:  list[PlayerStatInput] = field(default_factory=list)
    match_number:  Optional[int]         = None
    phase:         Optional[str]         = None
    day:           Optional[int]         = None
    group_label:   Optional[str]         = None  # "A", "B", "C", "D" — null = no groups

# ─────────────────────────────────────────────────────────────────────────────
# Section 1 – Player resolution (API mode only)
# ─────────────────────────────────────────────────────────────────────────────
def _build_player_lookup(db: Session, tournament_id: int) -> dict[str, int]:
    """
    Build a lookup dict for resolving PUBG API participants → Player.id.
    Returns a dict keyed by both pubg_id and lowercase name:
        {"account.abc123": 7, "someplayername": 7, ...}
    Scoping:
    - Primary:  players where Player.tournament_id == tournament_id
    - Fallback: all players, in case tournament_id is NULL on seeded players
                (logs a warning so you know name-matching is in effect)
    Resolution order in _resolve_player_id():
        1. pubg_account_id  → Player.pubg_id  (exact)
        2. pubg_name        → Player.name     (case-insensitive fallback)
    """
    players = (
        db.query(Player)
        .filter(Player.tournament_id == tournament_id)
        .all()
    )
    if not players:
        logger.warning(
            "_build_player_lookup: no players found with tournament_id=%s. "
            "Falling back to ALL players for name-based resolution. "
            "Set Player.tournament_id on your seeded players to improve accuracy.",
            tournament_id,
        )
        players = db.query(Player).all()
    lookup: dict[str, int] = {}
    for p in players:
        if p.pubg_id:
            lookup[p.pubg_id] = p.id
        if p.name:
            lookup[p.name.lower()] = p.id
    logger.info(
        "_build_player_lookup: %s players loaded for tournament %s (%s entries in lookup)",
        len(players),
        tournament_id,
        len(lookup),
    )
    return lookup

def _resolve_player_id(
    lookup: dict[str, int],
    pubg_account_id: str,
    pubg_name: str,
) -> Optional[int]:
    """
    Try pubg_account_id first, then lowercase name.
    Returns None if unresolved (caller skips and logs warning).
    """
    if pubg_account_id and pubg_account_id in lookup:
        return lookup[pubg_account_id]
    if pubg_name and pubg_name.lower() in lookup:
        return lookup[pubg_name.lower()]
    return None

# ─────────────────────────────────────────────────────────────────────────────
# Section 2 – Core persistence (shared by both modes)
# ─────────────────────────────────────────────────────────────────────────────
def _compute_fantasy_points(stat: PlayerStatInput) -> tuple[float, int]:
    """
    Retorna (base_points, penalty_count).
    base_points = pontos sem bônus late game
    Fórmula XAMA de pontuação.
    kill        × 10
    assist      × 1
    knock       × 1
    damage      × 0.03
    headshot    → 0 (não pontua)
    survival    → 0 (não pontua)
    morte precoce → -15 (se survival < 360s E kills == 0)
    Bônus late game calculado separadamente por _compute_late_game_bonus().
    Capitão aplica multiplicador 1.25x na camada de lineup scoring.
    """
    kill_pts   = (stat.kills  or 0) * 10
    assist_pts = (stat.assists or 0) * 1
    knock_pts  = (stat.knocks  or 0) * 1
    dmg_pts    = (stat.damage_dealt or 0.0) * 0.03
    # Morte precoce: survival < 6 minutos E zero kills
    is_early_death = (stat.survival_secs or 0) < 600 and (stat.kills or 0) == 0
    early_death = -15.0 if is_early_death else 0.0
    penalty_count = 1 if is_early_death else 0
    base = kill_pts + assist_pts + knock_pts + dmg_pts + early_death
    return base, penalty_count  # late_game_bonus é adicionado pelo _compute_late_game_bonus

def _compute_late_game_bonus(all_stats: list) -> dict:
    """
    Calcula o bônus late game por jogador para uma partida.
    Regra:
      - Time vencedor (placement=1): sobreviventes = jogadores com
        survival_secs >= duration_secs - 60s (aproximação de "estava vivo")
      - N = número de sobreviventes do time vencedor
      - Os sobreviventes ganham +10 cada
      - Os próximos a morrer (ordenados por survival_secs desc) ganham:
          N=4: 4 jogadores → [2, 2, 1, 1]
          N=3: 5 jogadores → [4, 2, 2, 1, 1]
          N=2: 6 jogadores → [5, 4, 2, 2, 1, 1]
          N=1: 7 jogadores → [6, 5, 4, 2, 2, 1, 1]
    Retorna dict {player_id: bonus_pts}
    """
    if not all_stats:
        return {}
    winners = [s for s in all_stats if (s.placement or 99) == 1]
    if not winners:
        return {}
    max_survival = max((s.survival_secs or 0) for s in all_stats)
    survivor_threshold = max_survival - 60
    survivors = [s for s in winners if (s.survival_secs or 0) >= survivor_threshold]
    N = len(survivors)
    if N == 0:
        N = 1
        survivors = sorted(winners, key=lambda s: s.survival_secs or 0, reverse=True)[:1]
    bonus_table = {
        4: [2, 2, 1, 1],
        3: [4, 2, 2, 1, 1],
        2: [5, 4, 2, 2, 1, 1],
        1: [6, 5, 4, 2, 2, 1, 1],
    }
    extra_bonuses = bonus_table.get(N, [])
    bonus: dict = {}
    for s in survivors:
        bonus[s.player_id] = bonus.get(s.player_id, 0) + 10
    non_survivors = sorted(
        [s for s in all_stats if s.player_id not in {s2.player_id for s2 in survivors}],
        key=lambda s: s.survival_secs or 0,
        reverse=True,
    )
    for i, pts in enumerate(extra_bonuses):
        if i < len(non_survivors):
            pid = non_survivors[i].player_id
            bonus[pid] = bonus.get(pid, 0) + pts
    return bonus


def import_matches(
    db: Session,
    tournament_id: int,
    matches: list[MatchInput],
) -> dict:
    """
    Persist a list of MatchInput objects. Idempotent on pubg_match_id.
    Returns {"created": N, "skipped": N, "errors": [...]}

    Auto-lock: se lineup_open=True e pelo menos 1 match for criado,
    seta lineup_open=False automaticamente (lineup lock).
    """
    tournament = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not tournament:
        raise ValueError(f"Tournament {tournament_id} not found")
    created = 0
    skipped = 0
    errors: list[str] = []
    for match_input in matches:
        # ── Idempotency check ─────────────────────────────────────────────
        if db.query(Match).filter(Match.pubg_match_id == match_input.pubg_match_id).first():
            logger.info("Skipping already-imported match %s", match_input.pubg_match_id)
            skipped += 1
            continue
        try:
            match = Match(
                pubg_match_id=match_input.pubg_match_id,
                tournament_id=tournament_id,
                map_name=match_input.map_name,
                played_at=match_input.played_at,
                duration_secs=match_input.duration_secs,
                match_number=match_input.match_number,
                phase=match_input.phase,
                day=match_input.day,
                group_label=match_input.group_label,
            )
            db.add(match)
            db.flush()  # get match.id before committing
            # ── Calcula bônus late game para toda a partida ──────────────
            late_game_bonus = _compute_late_game_bonus(match_input.player_stats)
            for stat_input in match_input.player_stats:
                player_exists = (
                    db.query(Player.id).filter(Player.id == stat_input.player_id).scalar()
                )
                if not player_exists:
                    logger.warning(
                        "Player %s not found — skipping stat row for match %s",
                        stat_input.player_id,
                        match_input.pubg_match_id,
                    )
                    continue
                base_pts, pen_count = _compute_fantasy_points(stat_input)
                bonus_pts = late_game_bonus.get(stat_input.player_id, 0)
                db.add(
                    MatchPlayerStat(
                        match_id=match.id,
                        player_id=stat_input.player_id,
                        kills=stat_input.kills,
                        assists=stat_input.assists,
                        damage_dealt=stat_input.damage_dealt,
                        placement=stat_input.placement,
                        survival_secs=stat_input.survival_secs,
                        headshots=stat_input.headshots,
                        knocks=stat_input.knocks,
                        base_points=base_pts,
                        late_game_bonus=bonus_pts,
                        fantasy_points=base_pts + bonus_pts,
                        penalty_count=pen_count,
                        wins_count=1 if (stat_input.placement or 0) == 1 else 0,
                    )
                )
            db.commit()
            created += 1
            logger.info("Imported match %s (id=%s)", match_input.pubg_match_id, match.id)
            # ── Score all lineups for this match ─────────────────────────
            try:
                from app.services.lineup_scoring import score_all_lineups_for_match
                scoring_result = score_all_lineups_for_match(match.id, db)
                logger.info(
                    "Scored %s lineups for match %s",
                    scoring_result["lineups_scored"],
                    match.id,
                )
            except Exception as scoring_exc:  # noqa: BLE001
                logger.error(
                    "Scoring failed for match %s (import still counts): %s",
                    match.id,
                    scoring_exc,
                )
        except Exception as exc:  # noqa: BLE001
            db.rollback()
            msg = f"Failed to import match {match_input.pubg_match_id}: {exc}"
            logger.error(msg)
            errors.append(msg)

    # ── Auto-lock: fecha lineup_open quando o primeiro match é importado ──
    # Roda após o loop para garantir que pelo menos 1 match foi persistido.
    # Funciona tanto para import manual quanto para scheduler/API.
    if created > 0 and tournament.lineup_open:
        tournament.lineup_open = False
        db.add(tournament)
        db.commit()
        logger.info(
            "[lineup-lock] Tournament %s lineup_open → False (%s match(es) imported)",
            tournament_id,
            created,
        )

    return {"created": created, "skipped": skipped, "errors": errors}


# ─────────────────────────────────────────────────────────────────────────────
# Section 3 – API-driven import (fetch_from_pubg=True path)
# ─────────────────────────────────────────────────────────────────────────────
def import_matches_from_pubg(
    db: Session,
    tournament_id: int,
    pubg_tournament_id: str,
    match_group_map: dict | None = None,
) -> dict:
    """
    Fetch all matches for pubg_tournament_id from the PUBG API and import them.
    Steps:
        1. Call PubgClient.list_tournament_matches() → list of match IDs
        2. For each ID call PubgClient.get_match()   → RawMatch DTO
        3. Resolve RawPlayerStat.pubg_account_id / pubg_name → Player.id
        4. Build MatchInput objects and call import_matches() (same as body mode)
    Returns the same {"created", "skipped", "errors"} dict as import_matches().

    match_group_map: optional dict mapping PUBG match UUID → group_label (e.g. "A").
        When provided, each newly imported match gets its group_label set.
        Useful for scrims with groups (A/B/C/D) not encoded in the PUBG API response.
        Example: {"b951fa9e-6a6a-4b23-8ecf-fcf07e0eb208": "A", ...}
    """
    from app.core.config import settings
    from app.services.pubg_client import PubgApiError, PubgClient, RawMatch
    client = PubgClient(api_key=settings.PUBG_API_KEY, shard=settings.PUBG_SHARD)
    # ── 1. Get match ID list ──────────────────────────────────────────────
    try:
        match_ids = client.list_tournament_matches(pubg_tournament_id)
    except PubgApiError as exc:
        raise ValueError(
            f"Could not list matches for tournament '{pubg_tournament_id}': {exc}"
        ) from exc
    if not match_ids:
        return {"created": 0, "skipped": 0, "errors": [], "match_ids_found": 0}
    # ── 2. Build player lookup for this tournament ────────────────────────
    player_lookup = _build_player_lookup(db, tournament_id)
    if not player_lookup:
        logger.warning(
            "No players found for tournament %s — stats will all be skipped. "
            "Make sure players are seeded before importing matches.",
            tournament_id,
        )
    # ── 3. Fetch each match and convert to MatchInput ─────────────────────
    match_inputs: list[MatchInput] = []
    fetch_errors: list[str] = []
    for match_id in match_ids:
        try:
            raw: RawMatch = client.get_match(match_id)
        except PubgApiError as exc:
            msg = f"Failed to fetch PUBG match {match_id}: {exc}"
            logger.error(msg)
            fetch_errors.append(msg)
            continue
        # ── Resolve participants → Player.id ──────────────────────────────
        resolved_stats: list[PlayerStatInput] = []
        unresolved_names: list[str] = []
        for rps in raw.player_stats:
            player_id = _resolve_player_id(
                player_lookup,
                rps.pubg_account_id,
                rps.pubg_name,
            )
            if player_id is None:
                unresolved_names.append(rps.pubg_name)
                continue
            resolved_stats.append(
                PlayerStatInput(
                    player_id=player_id,
                    kills=rps.kills,
                    assists=rps.assists,
                    damage_dealt=rps.damage_dealt,
                    placement=rps.placement,
                    survival_secs=rps.survival_secs,
                    headshots=rps.headshots,
                    knocks=rps.knocks,
                )
            )
        if unresolved_names:
            logger.warning(
                "Match %s: %s participant(s) unresolved (not in your players table): %s",
                match_id,
                len(unresolved_names),
                unresolved_names[:10],
            )
        group_lbl = (match_group_map or {}).get(match_id)
        match_inputs.append(
            MatchInput(
                pubg_match_id=raw.pubg_match_id,
                map_name=raw.map_name,
                played_at=raw.played_at,
                duration_secs=raw.duration_secs,
                player_stats=resolved_stats,
                group_label=group_lbl,
            )
        )
    # ── 4. All fetches failed → surface as error ──────────────────────────
    if not match_inputs and fetch_errors:
        raise ValueError(
            {
                "message": "All PUBG API fetches failed.",
                "errors": fetch_errors,
            }
        )
    # ── 5. Reuse the same persistence core ───────────────────────────────
    result = import_matches(db, tournament_id, match_inputs)
    result["errors"] = fetch_errors + result.get("errors", [])
    result["match_ids_found"] = len(match_ids)
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Section 4 – Direct-UUID import (provide match IDs explicitly)
# ─────────────────────────────────────────────────────────────────────────────
def import_matches_by_pubg_ids(
    db: Session,
    tournament_id: int,
    pubg_match_ids: list[dict],  # list of {"id": str, "group_label": str | None}
) -> dict:
    """
    Like import_matches_from_pubg but skips the tournament-roster lookup.
    Useful when matches are not yet listed under the PUBG tournament endpoint
    (e.g. scrim matches available via wasdefy but not yet in the API roster).
    Steps:
        1. For each supplied match UUID call PubgClient.get_match()
        2. Resolve participants → Player.id
        3. Call import_matches() (same persistence core)
    """
    from app.core.config import settings
    from app.services.pubg_client import PubgApiError, PubgClient, RawMatch
    client = PubgClient(api_key=settings.PUBG_API_KEY, shard=settings.PUBG_SHARD)
    player_lookup = _build_player_lookup(db, tournament_id)
    if not player_lookup:
        logger.warning(
            "No players found for tournament %s — stats will all be skipped.",
            tournament_id,
        )
    match_inputs: list[MatchInput] = []
    fetch_errors: list[str] = []
    for entry in pubg_match_ids:
        match_id = entry["id"]
        group_lbl = entry.get("group_label")
        try:
            raw: RawMatch = client.get_match(match_id)
        except PubgApiError as exc:
            msg = f"Failed to fetch PUBG match {match_id}: {exc}"
            logger.error(msg)
            fetch_errors.append(msg)
            continue
        except Exception as exc:          # <-- ESTE É O FIX CRÍTICO
            msg = f"Unexpected error fetching match {match_id}: {exc}"
            logger.error(msg)
            fetch_errors.append(msg)
            continue

        resolved_stats: list[PlayerStatInput] = []
        unresolved_names: list[str] = []
        for rps in raw.player_stats:
            player_id = _resolve_player_id(player_lookup, rps.pubg_account_id, rps.pubg_name)
            if player_id is None:
                unresolved_names.append(rps.pubg_name)
                continue
            resolved_stats.append(
                PlayerStatInput(
                    player_id=player_id,
                    kills=rps.kills,
                    assists=rps.assists,
                    damage_dealt=rps.damage_dealt,
                    placement=rps.placement,
                    survival_secs=rps.survival_secs,
                    headshots=rps.headshots,
                    knocks=rps.knocks,
                )
            )
        if unresolved_names:
            logger.warning(
                "Match %s: %s participant(s) unresolved: %s",
                match_id, len(unresolved_names), unresolved_names[:10],
            )
        match_inputs.append(
            MatchInput(
                pubg_match_id=raw.pubg_match_id,
                map_name=raw.map_name,
                played_at=raw.played_at,
                duration_secs=raw.duration_secs,
                player_stats=resolved_stats,
                group_label=group_lbl,
            )
        )
    if not match_inputs and fetch_errors:
        raise ValueError({"message": "All PUBG API fetches failed.", "errors": fetch_errors})
    result = import_matches(db, tournament_id, match_inputs)
    result["errors"] = fetch_errors + result.get("errors", [])
    result["match_ids_found"] = len(pubg_match_ids)
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Section 4 – Pricing (unchanged)
# ─────────────────────────────────────────────────────────────────────────────
def _last_n_stats_for_player(
    db: Session,
    player_id: int,
    tournament_id: int,
    n: int,
) -> list[MatchPlayerStat]:
    return (
        db.query(MatchPlayerStat)
        .join(Match, MatchPlayerStat.match_id == Match.id)
        .filter(
            MatchPlayerStat.player_id == player_id,
            Match.tournament_id == tournament_id,
        )
        .order_by(Match.played_at.desc())
        .limit(n)
        .all()
    )

def _compute_player_price(
    stats_50: list[MatchPlayerStat],
    stats_10: list[MatchPlayerStat],
) -> dict:
    if not stats_50:
        return {
            "avg_kills_50": 0.0, "avg_damage_50": 0.0,
            "avg_placement_50": 0.0, "avg_kills_10": 0.0,
            "expected_fantasy": 0.0, "final_price": BASE_PRICE,
        }
    n50 = len(stats_50)
    n10 = len(stats_10)
    avg_kills_50     = sum(s.kills        for s in stats_50) / n50
    avg_damage_50    = sum(s.damage_dealt for s in stats_50) / n50
    avg_placement_50 = sum(s.placement    for s in stats_50) / n50
    avg_kills_10     = (sum(s.kills for s in stats_10) / n10) if n10 > 0 else avg_kills_50
    kills_score      = avg_kills_50 * 3
    damage_score     = avg_damage_50 / 100
    placement_score  = max(0.0, (20.0 - avg_placement_50) * 0.5)
    form_bonus       = (avg_kills_10 - avg_kills_50) * 2
    expected_fantasy = kills_score + damage_score + placement_score + form_bonus
    raw_price        = BASE_PRICE + expected_fantasy * PRICE_FACTOR
    final_price      = max(MIN_PRICE, min(MAX_PRICE, raw_price))
    return {
        "avg_kills_50": avg_kills_50, "avg_damage_50": avg_damage_50,
        "avg_placement_50": avg_placement_50, "avg_kills_10": avg_kills_10,
        "expected_fantasy": expected_fantasy, "final_price": final_price,
    }

def recalculate_prices(
    db: Session,
    tournament_id: int,
    dry_run: bool = False,
) -> dict:
    tournament = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not tournament:
        raise ValueError(f"Tournament {tournament_id} not found")
    player_ids: list[int] = [
        row[0]
        for row in (
            db.query(MatchPlayerStat.player_id)
            .join(Match, MatchPlayerStat.match_id == Match.id)
            .filter(Match.tournament_id == tournament_id)
            .distinct()
            .all()
        )
    ]
    if not player_ids:
        return {
            "updated": 0,
            "dry_run": dry_run,
            "tournament_id": tournament_id,
            "players": [],
        }
    results = []
    updated = 0
    for player_id in player_ids:
        stats_50 = _last_n_stats_for_player(db, player_id, tournament_id, n=50)
        stats_10 = stats_50[:10]
        if not stats_50:
            logger.warning("Player %s has no stats — skipping", player_id)
            continue
        price_data = _compute_player_price(stats_50, stats_10)
        results.append({"player_id": player_id, **price_data})
        if not dry_run:
            player = db.query(Player).filter(Player.id == player_id).first()
            if player is None:
                logger.warning("Player %s not found in players table — skipping", player_id)
                continue
            player.avg_kills_50     = price_data["avg_kills_50"]
            player.avg_damage_50    = price_data["avg_damage_50"]
            player.avg_placement_50 = price_data["avg_placement_50"]
            player.avg_kills_10     = price_data["avg_kills_10"]
            old_price = float(player.fantasy_cost or 0.0)
            new_price = price_data["final_price"]
            player.computed_price   = new_price
            player.fantasy_cost     = new_price
            player.price_updated_at = datetime.now(timezone.utc)
            if round(old_price, 2) != round(new_price, 2):
                import json
                db.add(PlayerPriceHistory(
                    player_id               = player.id,
                    old_price               = old_price,
                    new_price               = new_price,
                    reason                  = f"recalculate-tournament-{tournament_id}",
                    formula_components_json = json.dumps(price_data),
                ))
                updated += 1
    if not dry_run and updated > 0:
        db.commit()
        logger.info(
            "Committed prices for %s players in tournament %s",
            updated,
            tou