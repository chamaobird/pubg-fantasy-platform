"""
Tests for the Pricing Engine (app/core/pricing.py)

The pricing engine has three layers:
  1. _weighted_pts_per_match  — weighted average across tournament phases
  2. normalize_prices         — linear scaling to a [min, max] credit range
  3. apply_day_zero / calculate_prices_for_group — top-level API

All pure functions, no DB — just data in, prices out.

Run with:
    pytest tests/core/test_pricing.py -v
"""

import pytest

from app.core.pricing import (
    DAY_ZERO_PRICE,
    DEFAULT_PRICE,
    NORM_MAX,
    NORM_MIN,
    PHASE_WEIGHTS_IN_GF,
    PHASE_WEIGHTS_PRE_GF,
    _weighted_pts_per_match,
    apply_day_zero,
    calculate_prices_for_group,
    normalize_prices,
)


# ---------------------------------------------------------------------------
# Helpers — build test data without repetition
# ---------------------------------------------------------------------------


def make_phase(tournament_id: int, total_pts: float, matches: int) -> dict:
    """Shortcut to build a PhaseStats dict."""
    return {
        "tournament_id": tournament_id,
        "total_fantasy_points": total_pts,
        "matches_played": matches,
    }


def make_player(
    player_id: int,
    name: str,
    current_price: float,
    phases: list[dict],
) -> dict:
    """Shortcut to build a PlayerPricingData dict."""
    return {
        "player_id": player_id,
        "player_name": name,
        "current_price": current_price,
        "phases": phases,
    }


# ---------------------------------------------------------------------------
# _weighted_pts_per_match
# ---------------------------------------------------------------------------


class TestWeightedPtsPerMatch:
    """Core calculation: weighted average of pts/match across phases."""

    def test_single_phase(self):
        """One phase = that phase's pts/match, weight is 100%."""
        phases = [make_phase(20, total_pts=100.0, matches=10)]
        avg, details = _weighted_pts_per_match(phases, PHASE_WEIGHTS_PRE_GF)

        assert avg == pytest.approx(10.0)
        assert len(details) == 1
        assert details[0]["weight_effective"] == 100.0

    def test_two_phases_with_renormalization(self):
        """When only 2 of 5 phases are played, weights renormalize to 100%."""
        phases = [
            make_phase(20, total_pts=100.0, matches=10),  # 10 ppm, weight 50
            make_phase(15, total_pts=50.0,  matches=10),  # 5 ppm,  weight 25
        ]
        avg, details = _weighted_pts_per_match(phases, PHASE_WEIGHTS_PRE_GF)

        # Renormalized: T20 = 50/75 = 66.67%, T15 = 25/75 = 33.33%
        expected = 10.0 * (50 / 75) + 5.0 * (25 / 75)
        assert avg == pytest.approx(expected, rel=1e-4)

    def test_no_eligible_phases_returns_none(self):
        """Player with no match history gets None."""
        phases = [make_phase(20, total_pts=0.0, matches=0)]
        avg, details = _weighted_pts_per_match(phases, PHASE_WEIGHTS_PRE_GF)

        assert avg is None
        assert details == []

    def test_unknown_tournament_id_is_ignored(self):
        """Phases with IDs not in the weight table are skipped."""
        phases = [make_phase(999, total_pts=500.0, matches=10)]
        avg, details = _weighted_pts_per_match(phases, PHASE_WEIGHTS_PRE_GF)

        assert avg is None
        assert details == []

    def test_empty_phases_list(self):
        phases = []
        avg, details = _weighted_pts_per_match(phases, PHASE_WEIGHTS_PRE_GF)

        assert avg is None
        assert details == []

    def test_details_contain_expected_fields(self):
        phases = [make_phase(20, total_pts=80.0, matches=8)]
        _, details = _weighted_pts_per_match(phases, PHASE_WEIGHTS_PRE_GF)

        d = details[0]
        assert d["tournament_id"] == 20
        assert d["pts_per_match"] == 10.0
        assert d["matches_played"] == 8
        assert "weight_original" in d
        assert "weight_effective" in d

    def test_grand_final_weights(self):
        """PHASE_WEIGHTS_IN_GF gives T19 the highest weight."""
        phases = [
            make_phase(19, total_pts=120.0, matches=6),  # 20 ppm
            make_phase(20, total_pts=80.0,  matches=8),  # 10 ppm
        ]
        avg, details = _weighted_pts_per_match(phases, PHASE_WEIGHTS_IN_GF)

        # T19 weight 50, T20 weight 25 → renorm: 66.67% / 33.33%
        expected = 20.0 * (50 / 75) + 10.0 * (25 / 75)
        assert avg == pytest.approx(expected, rel=1e-4)

    def test_details_sorted_by_tournament_id_descending(self):
        phases = [
            make_phase(12, total_pts=30.0, matches=6),
            make_phase(20, total_pts=80.0, matches=8),
            make_phase(15, total_pts=50.0, matches=5),
        ]
        _, details = _weighted_pts_per_match(phases, PHASE_WEIGHTS_PRE_GF)

        ids = [d["tournament_id"] for d in details]
        assert ids == sorted(ids, reverse=True)


# ---------------------------------------------------------------------------
# normalize_prices
# ---------------------------------------------------------------------------


class TestNormalizePrices:
    """Linear scaling of raw scores into a [min, max] credit range."""

    def test_basic_normalization(self):
        """Lowest score → NORM_MIN, highest → NORM_MAX."""
        result = normalize_prices([5.0, 10.0, 15.0])

        assert result[0] == NORM_MIN       # lowest
        assert result[-1] == NORM_MAX      # highest
        assert result[1] == pytest.approx((NORM_MIN + NORM_MAX) / 2, abs=0.01)

    def test_two_values(self):
        result = normalize_prices([0.0, 100.0])
        assert result == [NORM_MIN, NORM_MAX]

    def test_custom_range(self):
        result = normalize_prices([0.0, 100.0], norm_min=10.0, norm_max=50.0)
        assert result == [10.0, 50.0]

    def test_all_equal_scores_get_midpoint(self):
        """When everyone has the same score, all get the midpoint."""
        result = normalize_prices([7.0, 7.0, 7.0])

        mid = round((NORM_MIN + NORM_MAX) / 2, 2)
        assert result == [mid, mid, mid]

    def test_single_player_gets_midpoint(self):
        result = normalize_prices([42.0])
        mid = round((NORM_MIN + NORM_MAX) / 2, 2)
        assert result == [mid]

    def test_empty_list(self):
        assert normalize_prices([]) == []

    def test_preserves_order(self):
        """Output order matches input order, not sorted."""
        result = normalize_prices([15.0, 5.0, 10.0])

        assert result[0] > result[1]  # 15 > 5 in output too
        assert result[2] > result[1]  # 10 > 5
        assert result[0] > result[2]  # 15 > 10

    def test_results_are_rounded_to_two_decimals(self):
        result = normalize_prices([1.0, 2.0, 3.0])
        for price in result:
            assert price == round(price, 2)


# ---------------------------------------------------------------------------
# apply_day_zero
# ---------------------------------------------------------------------------


class TestApplyDayZero:
    """Day zero = everyone gets the same flat price."""

    def test_all_players_get_day_zero_price(self):
        players = [
            {"player_id": 1, "player_name": "Alice", "current_price": 10.0},
            {"player_id": 2, "player_name": "Bob",   "current_price": 30.0},
        ]
        result = apply_day_zero(players)

        assert len(result) == 2
        for r in result:
            assert r["suggested_price"] == DAY_ZERO_PRICE

    def test_delta_reflects_change_from_current(self):
        players = [
            {"player_id": 1, "player_name": "A", "current_price": 10.0},
        ]
        result = apply_day_zero(players)[0]
        assert result["delta"] == DAY_ZERO_PRICE - 10.0

    def test_empty_list(self):
        assert apply_day_zero([]) == []

    def test_components_indicate_day_zero_formula(self):
        players = [
            {"player_id": 1, "player_name": "A", "current_price": 25.0},
        ]
        result = apply_day_zero(players)[0]
        assert result["components"]["formula_version"] == "day_zero"
        assert result["no_history"] is False


# ---------------------------------------------------------------------------
# calculate_prices_for_group — the full pipeline
# ---------------------------------------------------------------------------


class TestCalculatePricesForGroup:
    """End-to-end: phases → weighted avg → normalize → result dicts."""

    def test_two_players_spread_across_range(self):
        """Best player → NORM_MAX, worst → NORM_MIN."""
        players = [
            make_player(1, "Star",  25.0, [make_phase(20, 200.0, 10)]),  # 20 ppm
            make_player(2, "Bench", 25.0, [make_phase(20, 50.0,  10)]),  # 5 ppm
        ]
        result = calculate_prices_for_group(players)

        prices = {r["player_id"]: r["suggested_price"] for r in result}
        assert prices[1] == NORM_MAX
        assert prices[2] == NORM_MIN

    def test_player_without_history_gets_default_price(self):
        """No match data → DEFAULT_PRICE, flagged as no_history."""
        players = [
            make_player(1, "Veteran", 25.0, [make_phase(20, 100.0, 10)]),
            make_player(2, "Rookie",  25.0, []),
        ]
        result = calculate_prices_for_group(players)

        rookie = next(r for r in result if r["player_id"] == 2)
        assert rookie["suggested_price"] == DEFAULT_PRICE
        assert rookie["no_history"] is True

    def test_all_players_no_history(self):
        players = [
            make_player(1, "A", 25.0, []),
            make_player(2, "B", 25.0, [make_phase(20, 0.0, 0)]),
        ]
        result = calculate_prices_for_group(players)

        for r in result:
            assert r["suggested_price"] == DEFAULT_PRICE
            assert r["no_history"] is True

    def test_single_eligible_player_gets_midpoint(self):
        """One player with data → midpoint (can't normalize a single value)."""
        players = [
            make_player(1, "Solo", 25.0, [make_phase(20, 100.0, 10)]),
        ]
        result = calculate_prices_for_group(players)

        mid = round((NORM_MIN + NORM_MAX) / 2, 2)
        assert result[0]["suggested_price"] == mid

    def test_custom_norm_range(self):
        players = [
            make_player(1, "A", 25.0, [make_phase(20, 200.0, 10)]),
            make_player(2, "B", 25.0, [make_phase(20, 50.0,  10)]),
        ]
        result = calculate_prices_for_group(
            players, norm_min=5.0, norm_max=50.0
        )

        prices = {r["player_id"]: r["suggested_price"] for r in result}
        assert prices[1] == 50.0
        assert prices[2] == 5.0

    def test_delta_is_suggested_minus_current(self):
        players = [
            make_player(1, "A", 20.0, [make_phase(20, 100.0, 10)]),
        ]
        result = calculate_prices_for_group(players)[0]
        assert result["delta"] == round(
            result["suggested_price"] - 20.0, 2
        )

    def test_components_include_formula_version(self):
        players = [
            make_player(1, "A", 25.0, [make_phase(20, 100.0, 10)]),
        ]
        result = calculate_prices_for_group(players)[0]
        assert result["components"]["formula_version"] == "xama_pts_per_match_v1"

    def test_uses_grand_final_weights(self):
        """Passing PHASE_WEIGHTS_IN_GF changes which phases matter."""
        players = [
            make_player(1, "A", 25.0, [
                make_phase(19, 200.0, 10),  # GF phase — high weight in IN_GF
                make_phase(20, 80.0,  10),
            ]),
            make_player(2, "B", 25.0, [
                make_phase(19, 80.0,  10),
                make_phase(20, 200.0, 10),  # Strong in T20, but low weight in IN_GF
            ]),
        ]
        result = calculate_prices_for_group(
            players, phase_weights=PHASE_WEIGHTS_IN_GF
        )

        prices = {r["player_id"]: r["suggested_price"] for r in result}
        # Player 1 dominated the GF phase → should be more expensive
        assert prices[1] > prices[2]

    def test_empty_players_list(self):
        assert calculate_prices_for_group([]) == []

    def test_mixed_eligible_and_no_history(self):
        """No-history players don't affect normalization of eligible players."""
        players = [
            make_player(1, "Star",   25.0, [make_phase(20, 200.0, 10)]),
            make_player(2, "Bench",  25.0, [make_phase(20, 50.0,  10)]),
            make_player(3, "Rookie", 25.0, []),
        ]
        result = calculate_prices_for_group(players)

        prices = {r["player_id"]: r["suggested_price"] for r in result}
        assert prices[1] == NORM_MAX
        assert prices[2] == NORM_MIN
        assert prices[3] == DEFAULT_PRICE
