"""
XAMA Fantasy — Pricing Engine
==============================
Fonte única de verdade para fantasy_cost.

Lógica de precificação:

  DIA ZERO (início do circuito)
    Todos os jogadores recebem DAY_ZERO_PRICE (25 cr).

  OSCILAÇÃO entre fases (pré-Grand Final)
    Métrica: pts_per_match ponderado por fase via PHASE_WEIGHTS_PRE_GF.

  OSCILAÇÃO intra-Grand Final (entre dias)
    Métrica: pts_per_match do dia anterior da Grand Final (peso maior)
    + histórico das fases anteriores (pesos menores).
    Usa PHASE_WEIGHTS_IN_GF — T19 entra com o maior peso.
    O admin especifica qual day do T19 usar via parâmetro `gf_day`.

Renormalização automática:
    Se o jogador não jogou uma fase, o peso dela é ignorado
    e os pesos restantes são renormalizados para somar 100%.
"""

from __future__ import annotations

import math
from typing import TypedDict

# ---------------------------------------------------------------------------
# Constantes configuráveis
# ---------------------------------------------------------------------------

DAY_ZERO_PRICE: float = 25.0
NORM_MIN: float = 12.0
NORM_MAX: float = 35.0
DEFAULT_PRICE: float = 15.0

# Pesos pré-Grand Final (usado no primeiro pricing antes da GF começar)
PHASE_WEIGHTS_PRE_GF: dict[int, float] = {
    20: 50.0,   # Survival Stage · Series Final (mais recente)
    15: 25.0,   # Final Stage · Series 1
    14: 10.0,   # Survival Stage · Series 1
    13: 10.0,   # Winners Stage · Series 1
    12:  5.0,   # Group/Winners Stage · Series 1
}

# Pesos intra-Grand Final (usado entre dias da GF)
# T19 entra com o maior peso — o dia anterior da GF é o mais relevante
PHASE_WEIGHTS_IN_GF: dict[int, float] = {
    19: 50.0,   # Grand Final · dia anterior (filtrado por day)
    20: 25.0,   # Survival Stage · Series Final
    15: 15.0,   # Final Stage · Series 1
    13:  7.0,   # Winners Stage · Series 1
    12:  3.0,   # Group/Winners Stage · Series 1
}

# Alias padrão — usado quando não especificado
PHASE_WEIGHTS = PHASE_WEIGHTS_PRE_GF

# ID do torneio da Grand Final (para filtro por day)
GRAND_FINAL_TOURNAMENT_ID: int = 19


# ---------------------------------------------------------------------------
# Tipos
# ---------------------------------------------------------------------------

class PhaseStats(TypedDict):
    tournament_id: int
    total_fantasy_points: float
    matches_played: int


class PlayerPricingData(TypedDict):
    player_id: int
    player_name: str
    current_price: float
    phases: list[PhaseStats]


# ---------------------------------------------------------------------------
# Cálculo ponderado
# ---------------------------------------------------------------------------

def _weighted_pts_per_match(
    phases: list[PhaseStats],
    phase_weights: dict[int, float],
) -> tuple[float | None, list[dict]]:
    """
    Calcula o pts_per_match ponderado para um jogador.
    Ignora fases com matches_played == 0 ou sem peso definido.
    Renormaliza os pesos das fases jogadas para somar 100%.
    """
    eligible = [
        p for p in phases
        if p["matches_played"] > 0 and p["tournament_id"] in phase_weights
    ]

    if not eligible:
        return None, []

    total_weight = sum(phase_weights[p["tournament_id"]] for p in eligible)
    weighted_sum = 0.0
    details = []

    for p in eligible:
        w_orig = phase_weights[p["tournament_id"]]
        w_eff = w_orig / total_weight
        ppm = p["total_fantasy_points"] / p["matches_played"]
        weighted_sum += ppm * w_eff
        details.append({
            "tournament_id": p["tournament_id"],
            "pts_per_match": round(ppm, 4),
            "matches_played": p["matches_played"],
            "weight_original": round(w_orig, 2),
            "weight_effective": round(w_eff * 100, 2),
        })

    details.sort(key=lambda x: x["tournament_id"], reverse=True)
    return weighted_sum, details


# ---------------------------------------------------------------------------
# Normalização
# ---------------------------------------------------------------------------

def normalize_prices(
    raw_scores: list[float],
    norm_min: float = NORM_MIN,
    norm_max: float = NORM_MAX,
) -> list[float]:
    if not raw_scores:
        return []
    mn, mx = min(raw_scores), max(raw_scores)
    if math.isclose(mn, mx, rel_tol=1e-6):
        mid = round((norm_min + norm_max) / 2, 2)
        return [mid] * len(raw_scores)
    return [
        round(norm_min + ((s - mn) / (mx - mn)) * (norm_max - norm_min), 2)
        for s in raw_scores
    ]


# ---------------------------------------------------------------------------
# API principal
# ---------------------------------------------------------------------------

def apply_day_zero(players: list[dict]) -> list[dict]:
    """Dia Zero: todos recebem DAY_ZERO_PRICE."""
    return [
        {
            "player_id": p["player_id"],
            "player_name": p["player_name"],
            "current_price": p["current_price"],
            "suggested_price": DAY_ZERO_PRICE,
            "delta": round(DAY_ZERO_PRICE - p["current_price"], 2),
            "no_history": False,
            "components": {
                "phases_used": [],
                "weighted_avg": 0.0,
                "raw_score": 0.0,
                "final_price": DAY_ZERO_PRICE,
                "formula_version": "day_zero",
            },
        }
        for p in players
    ]


def calculate_prices_for_group(
    players: list[PlayerPricingData],
    norm_min: float = NORM_MIN,
    norm_max: float = NORM_MAX,
    phase_weights: dict[int, float] = PHASE_WEIGHTS_PRE_GF,
) -> list[dict]:
    """
    Calcula e normaliza os preços de um grupo de jogadores.

    Cada jogador em `players` deve ter:
        player_id, player_name, current_price,
        phases: [{tournament_id, total_fantasy_points, matches_played}]

    Para repricing intra-Grand Final, passe phase_weights=PHASE_WEIGHTS_IN_GF
    e garanta que as phases do T19 já estejam filtradas pelo day correto.
    """
    results: list[dict] = []
    eligible_indices: list[int] = []
    raw_scores: list[float] = []

    for p in players:
        weighted_avg, details = _weighted_pts_per_match(p["phases"], phase_weights)

        if weighted_avg is None:
            results.append({
                "player_id": p["player_id"],
                "player_name": p["player_name"],
                "current_price": p["current_price"],
                "suggested_price": DEFAULT_PRICE,
                "delta": round(DEFAULT_PRICE - p["current_price"], 2),
                "no_history": True,
                "components": {
                    "phases_used": [],
                    "weighted_avg": 0.0,
                    "raw_score": 0.0,
                    "final_price": DEFAULT_PRICE,
                    "formula_version": "xama_pts_per_match_v1",
                },
            })
            continue

        raw_scores.append(weighted_avg)
        eligible_indices.append(len(results))

        results.append({
            "player_id": p["player_id"],
            "player_name": p["player_name"],
            "current_price": p["current_price"],
            "suggested_price": 0.0,
            "delta": 0.0,
            "no_history": False,
            "components": {
                "phases_used": details,
                "weighted_avg": round(weighted_avg, 4),
                "raw_score": round(weighted_avg, 4),
                "final_price": 0.0,
                "formula_version": "xama_pts_per_match_v1",
            },
        })

    normalized = normalize_prices(raw_scores, norm_min, norm_max)

    for list_idx, norm_price in zip(eligible_indices, normalized):
        r = results[list_idx]
        r["suggested_price"] = norm_price
        r["delta"] = round(norm_price - r["current_price"], 2)
        r["components"]["final_price"] = norm_price

    return results
