"""
PUBG Fantasy Platform — Transparent Player Pricing Engine
==========================================================

Price Formula (all weights are tunable constants):
    base_score = (avg_kills * KILL_WEIGHT)
               + (avg_damage / 100 * DAMAGE_WEIGHT)
               + (survival_score * SURVIVAL_WEIGHT)
               + (placement_score * PLACEMENT_WEIGHT)

    raw_price  = BASE_PRICE + base_score * SCORE_TO_PRICE_MULTIPLIER
    final_price = clamp(raw_price, MIN_PRICE, MAX_PRICE)

Every component is returned in the result dict so callers can display
exactly how the price was computed (the "transparency" requirement).
"""

from typing import TypedDict

# ---------------------------------------------------------------------------
# Configurable weights — edit these without touching the formula logic
# ---------------------------------------------------------------------------

KILL_WEIGHT: float = 2.5          # points per average kill
DAMAGE_WEIGHT: float = 1.8        # points per avg (damage / 100)
SURVIVAL_WEIGHT: float = 1.2      # points per avg minutes survived (0-30 scale)
PLACEMENT_WEIGHT: float = 3.0     # points per placement score (see _placement_score)

BASE_PRICE: float = 5.0           # minimum starting price (fantasy coins)
SCORE_TO_PRICE_MULTIPLIER: float = 0.5  # converts raw score → price delta

MIN_PRICE: float = 5.0            # floor
MAX_PRICE: float = 50.0           # ceiling

# How many recent games are considered "recent" when stats are pre-aggregated
DEFAULT_GAMES_WINDOW: int = 10


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _placement_score(avg_placement: float, total_teams: int = 16) -> float:
    """
    Convert average placement into a 0–10 score.
    1st place → 10.0, last place → 0.0.
    Uses a linear inversion relative to the lobby size.
    """
    if total_teams <= 1:
        return 10.0
    # Invert: lower placement rank → higher score
    return max(0.0, (total_teams - avg_placement) / (total_teams - 1) * 10.0)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

class PriceComponents(TypedDict):
    avg_kills: float
    avg_damage: float
    avg_survival_minutes: float
    avg_placement: float
    total_teams: int
    games_considered: int
    kill_component: float
    damage_component: float
    survival_component: float
    placement_component: float
    base_score: float
    raw_price: float
    final_price: float


def calculate_player_price(stats: dict) -> tuple[float, PriceComponents]:
    """
    Calculate a player's fantasy price based on recent performance statistics.

    Parameters
    ----------
    stats : dict
        Expected keys (all optional — missing keys default to 0):
            avg_kills           : float  — mean kills per match
            avg_damage          : float  — mean damage dealt per match
            avg_survival_minutes: float  — mean minutes survived per match (0-30)
            avg_placement       : float  — mean finishing position (1 = best)
            total_teams         : int    — typical lobby size (default 16)
            games_considered    : int    — how many games contributed to the averages

    Returns
    -------
    (final_price, components)
        final_price : float          — price to store/display, clamped to [MIN, MAX]
        components  : PriceComponents — every intermediate value for transparency
    """
    avg_kills = float(stats.get("avg_kills", 0))
    avg_damage = float(stats.get("avg_damage", 0))
    avg_survival = float(stats.get("avg_survival_minutes", 0))
    avg_placement = float(stats.get("avg_placement", 16))
    total_teams = int(stats.get("total_teams", 16))
    games_considered = int(stats.get("games_considered", DEFAULT_GAMES_WINDOW))

    # --- Individual components ---
    kill_component = avg_kills * KILL_WEIGHT
    damage_component = (avg_damage / 100.0) * DAMAGE_WEIGHT
    survival_component = avg_survival * SURVIVAL_WEIGHT
    placement_component = _placement_score(avg_placement, total_teams) * PLACEMENT_WEIGHT

    base_score = kill_component + damage_component + survival_component + placement_component

    raw_price = BASE_PRICE + base_score * SCORE_TO_PRICE_MULTIPLIER

    # Clamp to configured bounds
    final_price = round(max(MIN_PRICE, min(MAX_PRICE, raw_price)), 2)

    components: PriceComponents = {
        "avg_kills": avg_kills,
        "avg_damage": avg_damage,
        "avg_survival_minutes": avg_survival,
        "avg_placement": avg_placement,
        "total_teams": total_teams,
        "games_considered": games_considered,
        "kill_component": round(kill_component, 4),
        "damage_component": round(damage_component, 4),
        "survival_component": round(survival_component, 4),
        "placement_component": round(placement_component, 4),
        "base_score": round(base_score, 4),
        "raw_price": round(raw_price, 4),
        "final_price": final_price,
    }

    return final_price, components
