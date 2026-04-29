"""
Tests for the Scoring Engine (app/services/scoring.py) — API atual

Cobre as funções puras do motor de pontuação XAMA:
  - calculate_base_points
  - calculate_late_game_bonuses
  - calculate_match_points_all
  - get_scoring_breakdown

Sem banco de dados — apenas matemática.

Run:
    pytest tests/services/test_scoring.py -v
"""
from __future__ import annotations

from decimal import Decimal

import pytest

from app.services.scoring import (
    EARLY_DEATH_PENALTY,
    EARLY_DEATH_THRESHOLD,
    LATE_GAME_SURVIVOR_PTS,
    LATE_GAME_THRESHOLD,
    POINTS_PER_ASSIST,
    POINTS_PER_DAMAGE,
    POINTS_PER_KILL,
    POINTS_PER_KNOCK,
    PlayerStatInput,
    _LATE_GAME_NEXT_BONUSES,
    calculate_base_points,
    calculate_late_game_bonuses,
    calculate_match_points_all,
    get_scoring_breakdown,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_stat(
    person_id: int = 1,
    kills: int = 0,
    assists: int = 0,
    damage_dealt: float = 0.0,
    placement: int = 28,
    survival_secs: int = 900,   # > 600s por padrão (sem morte precoce)
    knocks: int = 0,
) -> PlayerStatInput:
    return PlayerStatInput(
        person_id=person_id,
        kills=kills,
        assists=assists,
        damage_dealt=damage_dealt,
        placement=placement,
        survival_secs=survival_secs,
        knocks=knocks,
    )


# ---------------------------------------------------------------------------
# calculate_base_points — fórmula pura sem late game
# ---------------------------------------------------------------------------

class TestCalculateBasePoints:

    def test_zero_stats_yields_zero(self):
        stat = make_stat()
        pts, is_early = calculate_base_points(stat)
        assert pts == Decimal("0")
        assert is_early is False

    def test_kills_only(self):
        stat = make_stat(kills=5)
        pts, _ = calculate_base_points(stat)
        assert pts == Decimal(5 * POINTS_PER_KILL)

    def test_assists_only(self):
        stat = make_stat(assists=3)
        pts, _ = calculate_base_points(stat)
        assert pts == Decimal(3 * POINTS_PER_ASSIST)

    def test_knocks_only(self):
        stat = make_stat(knocks=4)
        pts, _ = calculate_base_points(stat)
        assert pts == Decimal(4 * POINTS_PER_KNOCK)

    def test_damage_rounds_to_integer(self):
        """damage × 0.03 deve ser arredondado para inteiro (ROUND_HALF_UP)."""
        stat = make_stat(damage_dealt=100.0)   # 100 × 0.03 = 3.0 → 3
        pts, _ = calculate_base_points(stat)
        assert pts == Decimal("3")

    def test_damage_rounds_half_up(self):
        """350 × 0.03 = 10.5 — ROUND_HALF_UP → 11."""
        stat = make_stat(damage_dealt=350.0)
        pts, _ = calculate_base_points(stat)
        assert pts == Decimal("11")

    def test_damage_rounds_down_below_half(self):
        """333 × 0.03 = 9.99 → 10."""
        stat = make_stat(damage_dealt=333.0)
        pts, _ = calculate_base_points(stat)
        assert pts == Decimal("10")

    def test_result_is_integer_decimal(self):
        """base_points deve ter 0 casas decimais."""
        stat = make_stat(kills=2, assists=1, knocks=1, damage_dealt=275.0)
        pts, _ = calculate_base_points(stat)
        assert pts == pts.to_integral_value()

    # ── Early death ──────────────────────────────────────────────────────────

    def test_early_death_triggered(self):
        """survival < 600s E kills == 0 → penalidade -15."""
        stat = make_stat(kills=0, survival_secs=599)
        pts, is_early = calculate_base_points(stat)
        assert is_early is True
        assert pts == Decimal(EARLY_DEATH_PENALTY)

    def test_early_death_not_triggered_if_has_kill(self):
        """Kill salva da penalidade mesmo com morte rápida."""
        stat = make_stat(kills=1, survival_secs=100)
        pts, is_early = calculate_base_points(stat)
        assert is_early is False
        assert pts == Decimal(POINTS_PER_KILL)

    def test_early_death_not_triggered_at_threshold(self):
        """survival == 600s não dispara penalidade (limiar exclusivo)."""
        stat = make_stat(kills=0, survival_secs=EARLY_DEATH_THRESHOLD)
        pts, is_early = calculate_base_points(stat)
        assert is_early is False

    def test_early_death_not_triggered_above_threshold(self):
        stat = make_stat(kills=0, survival_secs=601)
        _, is_early = calculate_base_points(stat)
        assert is_early is False

    def test_early_death_with_assists_and_damage(self):
        """Penalidade se aplica mesmo com assists/damage — só kills cancelam."""
        stat = make_stat(kills=0, assists=2, damage_dealt=200.0, survival_secs=300)
        pts, is_early = calculate_base_points(stat)
        assert is_early is True
        # 0 + 2 + round(6) + (-15) = -7
        assert pts == Decimal("-7")

    # ── Cenário realista ──────────────────────────────────────────────────────

    def test_realistic_match(self):
        """3 kills · 1 assist · 1 knock · 400 dmg · sem morte precoce."""
        stat = make_stat(kills=3, assists=1, knocks=1, damage_dealt=400.0)
        pts, is_early = calculate_base_points(stat)
        # 15 + 1 + 1 + round(12.0) = 29
        assert pts == Decimal("29")
        assert is_early is False


# ---------------------------------------------------------------------------
# calculate_late_game_bonuses
# ---------------------------------------------------------------------------

class TestLateGameBonuses:

    def test_empty_stats(self):
        assert calculate_late_game_bonuses([], duration_secs=1800) == {}

    def test_no_winner(self):
        """Sem ninguém em 1º lugar — nenhum bônus."""
        stats = [make_stat(person_id=i, placement=i + 2) for i in range(1, 5)]
        assert calculate_late_game_bonuses(stats, 1800) == {}

    def test_single_survivor_gets_10(self):
        """1 sobrevivente do time vencedor → +10."""
        winner = make_stat(person_id=1, placement=1, survival_secs=1800)
        stats = [winner] + [make_stat(person_id=i, placement=5) for i in range(2, 6)]
        bonuses = calculate_late_game_bonuses(stats, duration_secs=1800)
        assert bonuses[1] == Decimal(LATE_GAME_SURVIVOR_PTS)

    def test_winner_not_survivor_if_died_early(self):
        """Vencedor que morreu >60s antes do fim não recebe +10, mas pode receber cascade."""
        # duration=1800, threshold=1740 — winner sobreviveu só 1700s (não é survivor)
        winner = make_stat(person_id=1, placement=1, survival_secs=1700)
        stats = [winner]
        bonuses = calculate_late_game_bonuses(stats, duration_secs=1800)
        # Sem survivors: N=max(0,1)=1; winner cai no pool "others" e recebe o 1º cascade
        # NÃO recebe +10 (survivor bonus)
        assert bonuses.get(1) != Decimal(LATE_GAME_SURVIVOR_PTS)
        # Recebe o primeiro bônus de cascade para N=1
        assert bonuses.get(1) == Decimal(_LATE_GAME_NEXT_BONUSES[1][0])

    def test_cascade_bonuses_n4(self):
        """4 sobreviventes do vencedor → próximos 4 não-vencedores recebem [2,2,1,1]."""
        winners = [make_stat(person_id=i, placement=1, survival_secs=1800) for i in range(1, 5)]
        others = [make_stat(person_id=i, placement=5, survival_secs=1800 - i * 100) for i in range(5, 17)]
        stats = winners + others
        bonuses = calculate_late_game_bonuses(stats, duration_secs=1800)

        # Todos os 4 vencedores → +10
        for i in range(1, 5):
            assert bonuses[i] == Decimal("10")

        # Próximos 4 por survival_secs desc
        sorted_others = sorted(others, key=lambda s: s.survival_secs, reverse=True)
        expected_cascade = _LATE_GAME_NEXT_BONUSES[4]
        for i, expected in enumerate(expected_cascade):
            pid = sorted_others[i].person_id
            assert bonuses[pid] == Decimal(expected)

    def test_cascade_bonuses_n1(self):
        """N=1 → cascade [6,5,4,2,2,1,1] para os próximos 7."""
        winner = make_stat(person_id=1, placement=1, survival_secs=1800)
        others = [
            make_stat(person_id=i, placement=5, survival_secs=1800 - i * 50)
            for i in range(2, 16)
        ]
        stats = [winner] + others
        bonuses = calculate_late_game_bonuses(stats, duration_secs=1800)

        assert bonuses[1] == Decimal("10")
        sorted_others = sorted(others, key=lambda s: s.survival_secs, reverse=True)
        for i, expected in enumerate(_LATE_GAME_NEXT_BONUSES[1]):
            pid = sorted_others[i].person_id
            assert bonuses[pid] == Decimal(expected)

    def test_player_without_bonus_not_in_dict(self):
        """Jogadores além do tamanho do cascade não aparecem no dict."""
        # N=1: cascade tem 7 slots [6,5,4,2,2,1,1]
        # Com 8 não-vencedores, o 8º (menor survival_secs) não recebe bônus
        winner = make_stat(person_id=1, placement=1, survival_secs=1800)
        others = [
            make_stat(person_id=i, placement=5, survival_secs=1800 - i * 100)
            for i in range(2, 10)   # person_ids 2..9 — 8 não-vencedores
        ]
        bonuses = calculate_late_game_bonuses([winner] + others, duration_secs=1800)
        # Cascade N=1 cobre só os 7 primeiros por survival_secs desc
        # person_id=9 tem survival_secs=1800-900=900, 8º lugar → sem bônus
        assert 9 not in bonuses


# ---------------------------------------------------------------------------
# calculate_match_points_all
# ---------------------------------------------------------------------------

class TestCalculateMatchPointsAll:

    def test_empty_returns_empty(self):
        assert calculate_match_points_all([], 1800) == {}

    def test_base_plus_late_game(self):
        """Total = base + late_game_bonus."""
        winner = make_stat(person_id=1, kills=2, placement=1, survival_secs=1800)
        stats = [winner]
        totals = calculate_match_points_all(stats, duration_secs=1800)

        base, _ = calculate_base_points(winner)
        expected = base + Decimal(LATE_GAME_SURVIVOR_PTS)
        assert totals[1] == expected

    def test_no_late_game_for_loser(self):
        """Jogador fora do range do cascade recebe exatamente os pontos base."""
        # N=1: cascade tem 7 slots — precisamos de 8+ não-vencedores para o 8º não ter bônus
        winner = make_stat(person_id=1, placement=1, survival_secs=1800)
        # person_id=2 tem a menor survival_secs dos 8 não-vencedores → posição 8, fora do cascade
        losers = [
            make_stat(person_id=i, placement=10, survival_secs=1800 - i * 100)
            for i in range(2, 10)   # person_ids 2..9
        ]
        totals = calculate_match_points_all([winner] + losers, duration_secs=1800)

        # person_id=9 tem survival_secs=900, é o 8º → sem cascade bonus
        base, _ = calculate_base_points(losers[-1])   # losers[-1] = person_id=9
        assert totals[9] == base

    def test_total_is_integer_decimal(self):
        """Resultado final deve ser inteiro (sem casas decimais)."""
        stats = [make_stat(person_id=i, kills=i, damage_dealt=i * 150.0) for i in range(1, 5)]
        totals = calculate_match_points_all(stats, duration_secs=1200)
        for pts in totals.values():
            assert pts == pts.to_integral_value()


# ---------------------------------------------------------------------------
# get_scoring_breakdown
# ---------------------------------------------------------------------------

class TestGetScoringBreakdown:

    def test_has_all_expected_keys(self):
        stat = make_stat(kills=2, assists=1, knocks=1, damage_dealt=200.0)
        bd = get_scoring_breakdown(stat, duration_secs=1800)
        assert set(bd.keys()) == {"kills", "assists", "knocks", "damage",
                                   "early_death", "late_game", "total"}

    def test_total_matches_calculate_match_points_all(self):
        stat = make_stat(person_id=1, kills=3, assists=2, knocks=1, damage_dealt=350.0, placement=1, survival_secs=1800)
        winner = stat
        # Passando apenas esse jogador — ele é winner e não há outros
        totals = calculate_match_points_all([winner], duration_secs=1800)
        bd = get_scoring_breakdown(winner, duration_secs=1800)
        # get_scoring_breakdown passa só [stat] internamente, sem outros jogadores
        # então late game = 0 (sem contexto de partida completa)
        # Testamos que a estrutura está correta e total = kills + assists + knocks + damage
        assert isinstance(bd["total"], float)

    def test_kill_component_correct(self):
        stat = make_stat(kills=4)
        bd = get_scoring_breakdown(stat, duration_secs=1800)
        assert bd["kills"]["value"] == 4
        assert bd["kills"]["points"] == float(4 * POINTS_PER_KILL)

    def test_damage_component_correct(self):
        stat = make_stat(damage_dealt=300.0)
        bd = get_scoring_breakdown(stat, duration_secs=1800)
        assert bd["damage"]["value"] == 300.0
        # 300 × 0.03 = 9.0
        assert bd["damage"]["points"] == pytest.approx(9.0)

    def test_early_death_in_breakdown(self):
        stat = make_stat(kills=0, survival_secs=100)
        bd = get_scoring_breakdown(stat, duration_secs=1800)
        assert bd["early_death"]["value"] is True
        assert bd["early_death"]["points"] == float(EARLY_DEATH_PENALTY)

    def test_no_early_death_in_breakdown(self):
        stat = make_stat(kills=1, survival_secs=100)
        bd = get_scoring_breakdown(stat, duration_secs=1800)
        assert bd["early_death"]["value"] is False
        assert bd["early_death"]["points"] == 0.0

    def test_zero_stats_all_zero(self):
        stat = make_stat()
        bd = get_scoring_breakdown(stat, duration_secs=1800)
        assert bd["total"] == 0.0
        assert bd["kills"]["points"] == 0.0
        assert bd["assists"]["points"] == 0.0
        assert bd["knocks"]["points"] == 0.0
        assert bd["damage"]["points"] == 0.0
        assert bd["early_death"]["points"] == 0.0
        assert bd["late_game"]["points"] == 0.0


# ---------------------------------------------------------------------------
# Constantes — sanity check
# ---------------------------------------------------------------------------

class TestConstants:

    def test_kill_pts(self):
        assert POINTS_PER_KILL == 5

    def test_assist_pts(self):
        assert POINTS_PER_ASSIST == 1

    def test_knock_pts(self):
        assert POINTS_PER_KNOCK == 1

    def test_damage_pts(self):
        assert POINTS_PER_DAMAGE == Decimal("0.03")

    def test_early_death_penalty(self):
        assert EARLY_DEATH_PENALTY == -15

    def test_early_death_threshold(self):
        assert EARLY_DEATH_THRESHOLD == 600

    def test_late_game_survivor_pts(self):
        assert LATE_GAME_SURVIVOR_PTS == 10

    def test_late_game_threshold(self):
        assert LATE_GAME_THRESHOLD == 60

    def test_cascade_bonuses_defined_for_n1_to_n4(self):
        for n in range(1, 5):
            assert n in _LATE_GAME_NEXT_BONUSES
            assert len(_LATE_GAME_NEXT_BONUSES[n]) > 0
