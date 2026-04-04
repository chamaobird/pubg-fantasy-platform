"""
Tests for the Scoring Engine (app/services/scoring.py)

These tests cover the pure functions that calculate fantasy points.
No database needed — just math in, points out.

Run with:
    pytest tests/services/test_scoring.py -v
"""

import pytest

from app.services.scoring import (
    PLACEMENT_POINTS,
    POINTS_PER_ASSIST,
    POINTS_PER_DAMAGE,
    POINTS_PER_HEADSHOT,
    POINTS_PER_KILL,
    POINTS_PER_KNOCK,
    POINTS_PER_SECOND,
    calculate_match_points,
    get_scoring_breakdown,
)


# ---------------------------------------------------------------------------
# calculate_match_points — the core formula
# ---------------------------------------------------------------------------


class TestCalculateMatchPoints:
    """Tests for the main scoring formula."""

    def test_kills_only(self):
        """Each kill is worth POINTS_PER_KILL (10.0)."""
        pts = calculate_match_points(
            kills=5, assists=0, damage_dealt=0, placement=28, survival_secs=0
        )
        assert pts == 5 * POINTS_PER_KILL

    def test_assists_only(self):
        """Each assist is worth POINTS_PER_ASSIST (4.0)."""
        pts = calculate_match_points(
            kills=0, assists=3, damage_dealt=0, placement=28, survival_secs=0
        )
        assert pts == 3 * POINTS_PER_ASSIST

    def test_damage_only(self):
        """200 damage at 0.05 per point = 10.0 pts."""
        pts = calculate_match_points(
            kills=0, assists=0, damage_dealt=200.0, placement=28, survival_secs=0
        )
        assert pts == 200.0 * POINTS_PER_DAMAGE

    def test_survival_only(self):
        """20 minutes (1200s) at 0.01/s = 12.0 pts."""
        pts = calculate_match_points(
            kills=0, assists=0, damage_dealt=0, placement=28, survival_secs=1200
        )
        assert pts == 1200 * POINTS_PER_SECOND

    def test_headshots_and_knocks(self):
        """Bonus stats stack on top of base."""
        pts = calculate_match_points(
            kills=0, assists=0, damage_dealt=0, placement=28, survival_secs=0,
            headshots=4, knocks=6,
        )
        expected = 4 * POINTS_PER_HEADSHOT + 6 * POINTS_PER_KNOCK
        assert pts == expected

    def test_all_zeroes(self):
        """A player who did nothing and placed last gets 0."""
        pts = calculate_match_points(
            kills=0, assists=0, damage_dealt=0, placement=28, survival_secs=0
        )
        assert pts == 0.0

    def test_result_is_rounded_to_two_decimals(self):
        """Fractional damage shouldn't produce floating point noise."""
        pts = calculate_match_points(
            kills=0, assists=0, damage_dealt=123.456, placement=28, survival_secs=0
        )
        assert pts == round(123.456 * POINTS_PER_DAMAGE, 2)

    def test_docstring_example(self):
        """Verify the example from the function docstring:
        kills=6, assists=2, damage=420, placement=2, survival=1800s = 127.0
        """
        pts = calculate_match_points(
            kills=6, assists=2, damage_dealt=420, placement=2, survival_secs=1800
        )
        # 60 + 8 + 21 + 20 + 18 = 127.0
        assert pts == 127.0

    def test_full_game_realistic_scenario(self):
        """A solid competitive game: 1st place, good stats, full game."""
        pts = calculate_match_points(
            kills=8, assists=3, damage_dealt=650.0, placement=1,
            survival_secs=1800, headshots=3, knocks=5,
        )
        expected = (
            8 * POINTS_PER_KILL           # 80.0
            + 3 * POINTS_PER_ASSIST       # 12.0
            + 650.0 * POINTS_PER_DAMAGE   # 32.5
            + PLACEMENT_POINTS[1]         # 25.0
            + 1800 * POINTS_PER_SECOND    # 18.0
            + 3 * POINTS_PER_HEADSHOT     # 6.0
            + 5 * POINTS_PER_KNOCK        # 5.0
        )
        assert pts == round(expected, 2)

    def test_early_death_low_stats(self):
        """Died early, bad placement, minimal contribution."""
        pts = calculate_match_points(
            kills=0, assists=1, damage_dealt=47.0, placement=20, survival_secs=90
        )
        expected = (
            0                             # kills
            + 1 * POINTS_PER_ASSIST       # 4.0
            + 47.0 * POINTS_PER_DAMAGE    # 2.35
            + PLACEMENT_POINTS.get(20, 0) # 0.0
            + 90 * POINTS_PER_SECOND      # 0.9
        )
        assert pts == round(expected, 2)


# ---------------------------------------------------------------------------
# Placement points — every position in the table matters
# ---------------------------------------------------------------------------


class TestPlacementPoints:
    """Placement is a lookup table, not a multiplier. Test the edges."""

    @pytest.mark.parametrize("placement,expected_pts", [
        (1, 25.0),
        (2, 20.0),
        (3, 16.0),
    ])
    def test_top_3_placements(self, placement, expected_pts):
        pts = calculate_match_points(
            kills=0, assists=0, damage_dealt=0,
            placement=placement, survival_secs=0,
        )
        assert pts == expected_pts

    @pytest.mark.parametrize("placement", [13, 14, 15])
    def test_bottom_scoring_placements(self, placement):
        """Positions 13-15 all get 1 point."""
        pts = calculate_match_points(
            kills=0, assists=0, damage_dealt=0,
            placement=placement, survival_secs=0,
        )
        assert pts == 1.0

    @pytest.mark.parametrize("placement", [16, 20, 28])
    def test_no_points_below_cutoff(self, placement):
        """Positions 16+ get zero placement points."""
        pts = calculate_match_points(
            kills=0, assists=0, damage_dealt=0,
            placement=placement, survival_secs=0,
        )
        assert pts == 0.0

    def test_placement_table_is_monotonically_decreasing(self):
        """Higher placement (lower number) should always give more points."""
        sorted_placements = sorted(PLACEMENT_POINTS.keys())
        for i in range(len(sorted_placements) - 1):
            better = sorted_placements[i]
            worse = sorted_placements[i + 1]
            assert PLACEMENT_POINTS[better] >= PLACEMENT_POINTS[worse], (
                f"Placement {better} ({PLACEMENT_POINTS[better]} pts) should be "
                f">= placement {worse} ({PLACEMENT_POINTS[worse]} pts)"
            )


# ---------------------------------------------------------------------------
# get_scoring_breakdown — the detailed audit dict
# ---------------------------------------------------------------------------


class TestGetScoringBreakdown:
    """The breakdown should match calculate_match_points and expose each component."""

    def test_total_matches_calculate_match_points(self):
        """The breakdown total must always equal the main function's result."""
        kwargs = dict(
            kills=4, assists=2, damage_dealt=310.5,
            placement=5, survival_secs=1500,
            headshots=2, knocks=3,
        )
        total = calculate_match_points(**kwargs)
        breakdown = get_scoring_breakdown(**kwargs)
        assert breakdown["total"] == total

    def test_breakdown_has_all_components(self):
        breakdown = get_scoring_breakdown(
            kills=1, assists=1, damage_dealt=100,
            placement=10, survival_secs=600,
        )
        expected_keys = {"kills", "assists", "damage", "placement",
                         "survival", "headshots", "knocks", "total"}
        assert set(breakdown.keys()) == expected_keys

    def test_each_component_has_value_and_points(self):
        """Every component (except total) should expose raw value + points."""
        breakdown = get_scoring_breakdown(
            kills=2, assists=1, damage_dealt=100,
            placement=3, survival_secs=600,
        )
        for key in ["kills", "assists", "damage", "survival", "headshots", "knocks"]:
            assert "value" in breakdown[key]
            assert "points" in breakdown[key]

    def test_individual_component_values(self):
        breakdown = get_scoring_breakdown(
            kills=3, assists=0, damage_dealt=0,
            placement=28, survival_secs=0,
        )
        assert breakdown["kills"]["value"] == 3
        assert breakdown["kills"]["points"] == 30.0
        assert breakdown["total"] == 30.0

    def test_zero_game_breakdown(self):
        """All-zero input should produce all-zero output."""
        breakdown = get_scoring_breakdown(
            kills=0, assists=0, damage_dealt=0,
            placement=28, survival_secs=0,
        )
        assert breakdown["total"] == 0.0
        for key in ["kills", "assists", "damage", "survival", "headshots", "knocks"]:
            assert breakdown[key]["points"] == 0.0
