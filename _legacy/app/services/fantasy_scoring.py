"""
Computes fantasy points for a FantasyTeam based on match results.
Captain's points are doubled.
"""
import json

from sqlalchemy.orm import Session

from app.models.fantasy import FantasyTeam
from app.models.match import Match
from app.models.tournament import ScoringRule


def _get_placement_multiplier(placement: int, rule_json: str | None) -> float:
    if not rule_json:
        return 1.0
    mapping: dict = json.loads(rule_json)
    # Keys: "1", "2", "3", "4-10", "11+"
    for key, mult in mapping.items():
        if "-" in key:
            lo, hi = key.split("-")
            if int(lo) <= placement <= int(hi):
                return float(mult)
        elif "+" in key:
            if placement >= int(key.replace("+", "")):
                return float(mult)
        elif placement == int(key):
            return float(mult)
    return 1.0


def score_fantasy_team(fantasy_team: FantasyTeam, db: Session) -> float:
    """
    Iterate over all matches in the tournament and accumulate points
    for each player in the fantasy team's entries.
    """
    rule: ScoringRule | None = (
        db.query(ScoringRule)
        .filter(ScoringRule.tournament_id == fantasy_team.tournament_id)
        .first()
    )

    matches = (
        db.query(Match)
        .filter(Match.tournament_id == fantasy_team.tournament_id)
        .all()
    )

    player_ids = {entry.player_id for entry in fantasy_team.entries}
    captain_id = fantasy_team.captain_player_id
    total = 0.0

    for match in matches:
        if not match.results_json:
            continue
        results: list[dict] = json.loads(match.results_json)

        for result in results:
            pid = result.get("player_id")
            if pid not in player_ids:
                continue

            kills = result.get("kills", 0)
            damage = result.get("damage", 0)
            placement = result.get("placement", 16)
            survival_minutes = result.get("survival_minutes", 0)

            kill_pts = kills * (rule.kill_points if rule else 15.0)
            dmg_pts = (damage / 100.0) * (rule.damage_per_100 if rule else 5.0)
            surv_pts = survival_minutes * (rule.survival_points if rule else 1.0)
            penalty = (rule.early_death_penalty if rule else -5.0) if survival_minutes < 2 else 0.0
            placement_mult = _get_placement_multiplier(
                placement, rule.placement_multiplier_json if rule else None
            )

            player_pts = (kill_pts + dmg_pts + surv_pts + penalty) * placement_mult

            # Captain bonus: double points
            if pid == captain_id:
                player_pts *= 2

            total += player_pts

    return round(total, 2)
