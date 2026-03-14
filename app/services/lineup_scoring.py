# app/services/lineup_scoring.py
"""
Lineup scoring service — Twire-style fantasy points per Lineup per Match.

Flow:
  MatchPlayerStat (raw stats, one row per player per match)
      ↓  score_lineup_for_match()
  LineupScore     (per-lineup per-match aggregation)
      ↓  sum
  Lineup.total_points

Formula (driven by ScoringRule; falls back to defaults if none configured):
  kill_pts    = kills × kill_points                   (default 15.0)
  dmg_pts     = (damage_dealt / 100) × damage_per_100 (default 5.0)
  surv_pts    = (survival_secs / 60) × survival_points (default 1.0 /min)
  penalty     = early_death_penalty if survival < 2 min (default -5.0)
  player_pts  = (kill_pts + dmg_pts + surv_pts + penalty) × placement_mult
  captain earns 2× (base + bonus)
  reserve adds their own points when ≥1 starter is absent

Public API:
  score_lineup_for_match(lineup_id, match_id, db)  → LineupScore
  score_all_lineups_for_match(match_id, db)        → summary dict
"""

import json
import logging
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.lineup import Lineup
from app.models.match import LineupScore, Match, MatchPlayerStat
from app.models.tournament import ScoringRule

logger = logging.getLogger(__name__)

# ── Defaults (used when no ScoringRule row exists for the tournament) ─────────
_DEFAULT_KILL_PTS       = 15.0
_DEFAULT_DAMAGE_PER_100 =  5.0
_DEFAULT_SURVIVAL_PTS   =  1.0   # per minute alive
_DEFAULT_EARLY_PENALTY  = -5.0   # if survival < 2 min


# ── Pure helpers (no DB — easily unit-tested) ─────────────────────────────────

def _get_placement_multiplier(placement: int, rule_json: Optional[str]) -> float:
    """
    Parse placement_multiplier_json and return the multiplier for a placement.
    Expected JSON format: {"1": 1.5, "2": 1.3, "3-5": 1.1, "6-10": 1.0, "11+": 0.8}
    Returns 1.0 when no rule is configured or placement is not matched.
    """
    if not rule_json:
        return 1.0
    try:
        mapping: dict = json.loads(rule_json)
    except (json.JSONDecodeError, TypeError):
        return 1.0

    for key, mult in mapping.items():
        key = str(key).strip()
        if "-" in key:
            lo, hi = key.split("-", 1)
            if int(lo) <= placement <= int(hi):
                return float(mult)
        elif key.endswith("+"):
            if placement >= int(key[:-1]):
                return float(mult)
        else:
            if placement == int(key):
                return float(mult)
    return 1.0


def _compute_player_pts(stat: MatchPlayerStat, rule: Optional[ScoringRule]) -> float:
    """
    Compute raw fantasy points for one player in one match.
    Pure function: receives the ORM row, returns a float.
    """
    kill_pts = (stat.kills or 0) * (float(rule.kill_points) if rule else _DEFAULT_KILL_PTS)

    dmg_pts = ((stat.damage_dealt or 0.0) / 100.0) * (
        float(rule.damage_per_100) if rule else _DEFAULT_DAMAGE_PER_100
    )

    survival_minutes = (stat.survival_secs or 0) / 60.0
    surv_pts = survival_minutes * (float(rule.survival_points) if rule else _DEFAULT_SURVIVAL_PTS)

    penalty = (
        (float(rule.early_death_penalty) if rule else _DEFAULT_EARLY_PENALTY)
        if survival_minutes < 2.0
        else 0.0
    )

    placement_mult = _get_placement_multiplier(
        stat.placement or 28,
        rule.placement_multiplier_json if rule else None,
    )

    return (kill_pts + dmg_pts + surv_pts + penalty) * placement_mult


# ── Internal DB helper ────────────────────────────────────────────────────────

def _rebuild_lineup_total(lineup: Lineup, db: Session) -> None:
    """Recompute Lineup.total_points as the sum of all its LineupScore rows."""
    total = (
        db.query(func.sum(LineupScore.final_points))
        .filter(LineupScore.lineup_id == lineup.id)
        .scalar()
    ) or 0.0
    lineup.total_points = round(float(total), 2)


# ── Public service functions ──────────────────────────────────────────────────

def score_lineup_for_match(
    lineup_id: int,
    match_id: int,
    db: Session,
) -> LineupScore:
    """
    Compute and persist the LineupScore for one Lineup in one Match.

    Steps:
      1. Load Lineup, Match, ScoringRule.
      2. Index all MatchPlayerStat rows for this match by player_id.
      3. Sum pts for the 4 starters; track any absent starters.
      4. Add captain bonus (captain's pts counted a second time → net 2×).
      5. If ≥1 starter is absent AND a reserve exists → add reserve's pts.
      6. Upsert LineupScore, then rebuild Lineup.total_points.

    Does NOT commit — caller is responsible for db.commit().
    Raises ValueError for unknown lineup_id or match_id.
    """
    lineup = db.query(Lineup).filter(Lineup.id == lineup_id).first()
    if not lineup:
        raise ValueError(f"Lineup {lineup_id} not found")

    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise ValueError(f"Match {match_id} not found")

    rule: Optional[ScoringRule] = (
        db.query(ScoringRule)
        .filter(ScoringRule.tournament_id == match.tournament_id)
        .first()
    )

    # Index stats for O(1) lookup
    stats_by_player: dict[int, MatchPlayerStat] = {
        s.player_id: s
        for s in db.query(MatchPlayerStat)
        .filter(MatchPlayerStat.match_id == match_id)
        .all()
    }

    # ── Starters (slots 1-4 from lineup_players, ordered by slot) ────────────
    starter_ids = [p.id for p in lineup.players]
    base_points = 0.0
    absent_starter_ids: list[int] = []

    for pid in starter_ids:
        stat = stats_by_player.get(pid)
        if stat:
            base_points += _compute_player_pts(stat, rule)
        else:
            absent_starter_ids.append(pid)
            logger.debug(
                f"[lineup_scoring] Lineup {lineup_id}: starter {pid} "
                f"has no stat in match {match_id}"
            )

    # ── Captain bonus ─────────────────────────────────────────────────────────
    # Captain's pts are already in base_points; we add them once more
    # so the captain effectively earns 2× their raw score.
    captain_stat = stats_by_player.get(lineup.captain_player_id)
    captain_bonus = _compute_player_pts(captain_stat, rule) if captain_stat else 0.0

    # ── Reserve activation ────────────────────────────────────────────────────
    reserve_activated = False
    reserve_points = 0.0

    if absent_starter_ids and lineup.reserve_player_id:
        reserve_stat = stats_by_player.get(lineup.reserve_player_id)
        if reserve_stat:
            reserve_points = _compute_player_pts(reserve_stat, rule)
            reserve_activated = True
            logger.debug(
                f"[lineup_scoring] Lineup {lineup_id}: reserve {lineup.reserve_player_id} "
                f"activated ({len(absent_starter_ids)} absent starter(s))"
            )

    # ── Round and sum ─────────────────────────────────────────────────────────
    base_points    = round(base_points,    2)
    captain_bonus  = round(captain_bonus,  2)
    reserve_points = round(reserve_points, 2)
    final_points   = round(base_points + captain_bonus + reserve_points, 2)

    # ── Upsert LineupScore ────────────────────────────────────────────────────
    ls = (
        db.query(LineupScore)
        .filter(
            LineupScore.lineup_id == lineup_id,
            LineupScore.match_id == match_id,
        )
        .first()
    )
    if ls:
        ls.base_points       = base_points
        ls.captain_bonus     = captain_bonus
        ls.reserve_points    = reserve_points
        ls.reserve_activated = reserve_activated
        ls.final_points      = final_points
    else:
        ls = LineupScore(
            lineup_id         = lineup_id,
            match_id          = match_id,
            base_points       = base_points,
            captain_bonus     = captain_bonus,
            reserve_points    = reserve_points,
            reserve_activated = reserve_activated,
            final_points      = final_points,
        )
        db.add(ls)

    db.flush()  # ensure ls.id is populated before rebuilding total

    _rebuild_lineup_total(lineup, db)

    logger.info(
        f"[lineup_scoring] Lineup {lineup_id} | Match {match_id} | "
        f"base={base_points} captain_bonus={captain_bonus} "
        f"reserve={reserve_points} (activated={reserve_activated}) "
        f"final={final_points} | lineup_total={lineup.total_points}"
    )

    return ls


def score_all_lineups_for_match(match_id: int, db: Session) -> dict:
    """
    Score every Lineup in the match's tournament for the given match.
    Commits once at the end.
    Returns a summary dict suitable for direct use as a JSON response.
    """
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise ValueError(f"Match {match_id} not found")

    lineups = (
        db.query(Lineup)
        .filter(Lineup.tournament_id == match.tournament_id)
        .all()
    )

    scored: int = 0
    errors: list[dict] = []

    for lineup in lineups:
        try:
            score_lineup_for_match(lineup.id, match_id, db)
            scored += 1
        except Exception as exc:
            logger.error(
                f"[lineup_scoring] Failed lineup {lineup.id} for match {match_id}: {exc}"
            )
            errors.append({"lineup_id": lineup.id, "error": str(exc)})

    db.commit()

    logger.info(
        f"[lineup_scoring] Match {match_id}: {scored} lineups scored, {len(errors)} errors"
    )

    return {
        "match_id":       match_id,
        "tournament_id":  match.tournament_id,
        "lineups_scored": scored,
        "errors":         errors,
    }
