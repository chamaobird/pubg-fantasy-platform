"""
XAMA Fantasy — Pricing Engine (Fórmula B unificada)
=====================================================

Fonte única de verdade para fantasy_cost.
Depreca calculate_fantasy_cost() de pubg_api.py (Fórmula A)
e a lógica hardcoded em PriceBreakdown.jsx (Fórmula C).

Fórmula base (Fórmula B):
    placement_score = (total_teams − avg_placement) / (total_teams − 1) × 10
    base_score      = kills×KILL_WEIGHT
                    + (damage/100)×DAMAGE_WEIGHT
                    + survival_min×SURVIVAL_WEIGHT
                    + placement_score×PLACEMENT_WEIGHT
    raw_price       = BASE_PRICE + base_score × SCORE_MULTIPLIER

Ponderação entre fases:
    blended = recent_stats × WEIGHT_RECENT + historical_stats × WEIGHT_HISTORICAL
    (se só um dos dois existir, usa 100% desse)

Normalização por grupo:
    O menor preço do grupo → NORM_MIN (10 cr)
    O maior preço          → NORM_MAX (35 cr)
    Os demais interpolados linearmente
    Jogadores sem histórico algum → DEFAULT_PRICE (15 cr), fora da normalização

Os pesos são constantes nomeadas no topo — fáceis de ajustar sem tocar na lógica.
"""

from __future__ import annotations

import math
from typing import Optional, TypedDict

# ---------------------------------------------------------------------------
# Constantes configuráveis
# ---------------------------------------------------------------------------

# Pesos internos da fórmula
KILL_WEIGHT: float = 2.5
DAMAGE_WEIGHT: float = 1.8        # aplicado sobre (avg_damage / 100)
SURVIVAL_WEIGHT: float = 1.2      # por minuto sobrevivido
PLACEMENT_WEIGHT: float = 3.0     # sobre placement_score 0–10

BASE_PRICE: float = 5.0
SCORE_MULTIPLIER: float = 0.5

# Limites pré-normalização (clamp de segurança)
MIN_PRICE_RAW: float = 5.0
MAX_PRICE_RAW: float = 50.0

# Intervalo de saída após normalização
NORM_MIN: float = 10.0
NORM_MAX: float = 35.0

# Preço fixo para jogadores sem histórico algum (fora da normalização)
DEFAULT_PRICE: float = 15.0

# Ponderação entre fases
WEIGHT_RECENT: float = 0.65       # fase imediatamente anterior
WEIGHT_HISTORICAL: float = 0.35   # demais fases do campeonato

# Tamanho padrão do lobby (usado no placement_score)
DEFAULT_TOTAL_TEAMS: int = 16

DEFAULT_GAMES_WINDOW: int = 10    # mantido para compatibilidade com código existente


# ---------------------------------------------------------------------------
# Tipos
# ---------------------------------------------------------------------------

class PriceComponents(TypedDict):
    """Detalhamento completo do cálculo — gravado em formula_components_json."""
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
    final_price: float             # preço após normalização
    had_recent_phase: bool
    had_other_phases: bool
    formula_version: str


class PlayerStats(TypedDict):
    """Stats agregados de um jogador em uma janela de partidas."""
    avg_kills: float
    avg_damage: float
    avg_placement: float
    avg_survival_minutes: float
    matches_played: int


# ---------------------------------------------------------------------------
# Helpers internos
# ---------------------------------------------------------------------------

def _placement_score(avg_placement: float, total_teams: int = DEFAULT_TOTAL_TEAMS) -> float:
    """Converte colocação média em score 0–10. 1º lugar → 10.0, último → 0.0."""
    if total_teams <= 1:
        return 10.0
    return max(0.0, (total_teams - avg_placement) / (total_teams - 1) * 10.0)


def _raw_price(stats: dict, total_teams: int = DEFAULT_TOTAL_TEAMS) -> tuple[float, dict]:
    """
    Aplica a Fórmula B e retorna (raw_price, componentes).
    raw_price ainda não está normalizado.
    """
    avg_kills = float(stats.get("avg_kills", 0))
    avg_damage = float(stats.get("avg_damage", 0))
    avg_survival = float(stats.get("avg_survival_minutes", 0))
    avg_placement = float(stats.get("avg_placement", total_teams))
    games = int(stats.get("games_considered", stats.get("matches_played", DEFAULT_GAMES_WINDOW)))

    kill_component = avg_kills * KILL_WEIGHT
    damage_component = (avg_damage / 100.0) * DAMAGE_WEIGHT
    survival_component = avg_survival * SURVIVAL_WEIGHT
    placement_component = _placement_score(avg_placement, total_teams) * PLACEMENT_WEIGHT

    base_score = kill_component + damage_component + survival_component + placement_component
    raw = BASE_PRICE + base_score * SCORE_MULTIPLIER
    raw = max(MIN_PRICE_RAW, min(MAX_PRICE_RAW, raw))

    components = {
        "avg_kills": avg_kills,
        "avg_damage": avg_damage,
        "avg_survival_minutes": avg_survival,
        "avg_placement": avg_placement,
        "total_teams": total_teams,
        "games_considered": games,
        "kill_component": round(kill_component, 4),
        "damage_component": round(damage_component, 4),
        "survival_component": round(survival_component, 4),
        "placement_component": round(placement_component, 4),
        "base_score": round(base_score, 4),
        "raw_price": round(raw, 4),
        "final_price": round(raw, 2),  # sobrescrito após normalização
        "had_recent_phase": False,     # preenchido pelo caller
        "had_other_phases": False,
        "formula_version": "B_v2",
    }
    return raw, components


# ---------------------------------------------------------------------------
# API pública — cálculo individual (compatibilidade + uso direto)
# ---------------------------------------------------------------------------

def calculate_player_price(stats: dict) -> tuple[float, PriceComponents]:
    """
    Calcula o preço de um jogador a partir de stats pré-agregados.
    Mantém a mesma assinatura do módulo anterior.

    stats esperado:
        avg_kills, avg_damage, avg_survival_minutes, avg_placement,
        total_teams (opcional, default 16), games_considered (opcional)

    Retorna (final_price, components).
    Nota: sem normalização de grupo — use calculate_prices_for_group()
    quando processar um torneio inteiro.
    """
    total_teams = int(stats.get("total_teams", DEFAULT_TOTAL_TEAMS))
    raw, components = _raw_price(stats, total_teams)
    final = round(raw, 2)
    components["final_price"] = final
    return final, components  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Ponderação de fases
# ---------------------------------------------------------------------------

def blend_stats(
    recent: Optional[PlayerStats],
    historical: Optional[PlayerStats],
) -> Optional[PlayerStats]:
    """
    Combina stats da fase recente (WEIGHT_RECENT = 65%) com
    stats de fases anteriores do campeonato (WEIGHT_HISTORICAL = 35%).

    Regras de fallback:
      - Só recent     → usa recent (100%)
      - Só historical → usa historical (100%)
      - Nenhum        → retorna None (jogador sem histórico)
    """
    if recent is None and historical is None:
        return None
    if recent is None:
        return historical
    if historical is None:
        return recent

    def w(a: float, b: float) -> float:
        return WEIGHT_RECENT * a + WEIGHT_HISTORICAL * b

    return PlayerStats(
        avg_kills=w(recent["avg_kills"], historical["avg_kills"]),
        avg_damage=w(recent["avg_damage"], historical["avg_damage"]),
        avg_placement=w(recent["avg_placement"], historical["avg_placement"]),
        avg_survival_minutes=w(recent["avg_survival_minutes"], historical["avg_survival_minutes"]),
        matches_played=recent["matches_played"] + historical["matches_played"],
    )


# ---------------------------------------------------------------------------
# Normalização de grupo
# ---------------------------------------------------------------------------

def normalize_prices(
    raw_prices: list[float],
    norm_min: float = NORM_MIN,
    norm_max: float = NORM_MAX,
) -> list[float]:
    """
    Normaliza uma lista de preços para [norm_min, norm_max].
    Se todos os valores forem iguais (ex: estreia coletiva), retorna a média do intervalo.
    """
    if not raw_prices:
        return []

    mn, mx = min(raw_prices), max(raw_prices)

    if math.isclose(mn, mx, rel_tol=1e-6):
        mid = round((norm_min + norm_max) / 2, 2)
        return [mid] * len(raw_prices)

    return [
        round(norm_min + ((p - mn) / (mx - mn)) * (norm_max - norm_min), 2)
        for p in raw_prices
    ]


# ---------------------------------------------------------------------------
# API principal — cálculo por grupo (repricing de fase)
# ---------------------------------------------------------------------------

def calculate_prices_for_group(
    players: list[dict],
    norm_min: float = NORM_MIN,
    norm_max: float = NORM_MAX,
    total_teams: int = DEFAULT_TOTAL_TEAMS,
) -> list[dict]:
    """
    Calcula e normaliza os preços para um grupo de jogadores de uma fase.

    Cada item de `players` deve ter:
        player_id:        int
        player_name:      str
        current_price:    float
        recent_stats:     PlayerStats | None   ← fase imediatamente anterior
        historical_stats: PlayerStats | None   ← outras fases do campeonato

    Retorna lista de dicts na mesma ordem:
        player_id, player_name, current_price,
        suggested_price, delta, no_history, components: PriceComponents
    """
    results: list[dict] = []
    eligible_indices: list[int] = []   # índices dos jogadores que entram na normalização
    raw_scores: list[float] = []

    for p in players:
        blended = blend_stats(p.get("recent_stats"), p.get("historical_stats"))

        if blended is None:
            results.append({
                "player_id": p["player_id"],
                "player_name": p["player_name"],
                "current_price": p["current_price"],
                "suggested_price": DEFAULT_PRICE,
                "delta": round(DEFAULT_PRICE - p["current_price"], 2),
                "no_history": True,
                "components": None,
            })
            continue

        stats_dict = {
            "avg_kills": blended["avg_kills"],
            "avg_damage": blended["avg_damage"],
            "avg_survival_minutes": blended["avg_survival_minutes"],
            "avg_placement": blended["avg_placement"],
            "games_considered": blended["matches_played"],
            "total_teams": total_teams,
        }

        raw, components = _raw_price(stats_dict, total_teams)
        components["had_recent_phase"] = p.get("recent_stats") is not None
        components["had_other_phases"] = p.get("historical_stats") is not None

        eligible_indices.append(len(results))
        raw_scores.append(raw)

        results.append({
            "player_id": p["player_id"],
            "player_name": p["player_name"],
            "current_price": p["current_price"],
            "suggested_price": 0.0,   # preenchido após normalização
            "delta": 0.0,
            "no_history": False,
            "components": components,
        })

    # Normalizar apenas jogadores com histórico
    normalized = normalize_prices(raw_scores, norm_min, norm_max)

    for list_idx, norm_price in zip(eligible_indices, normalized):
        result = results[list_idx]
        result["suggested_price"] = norm_price
        result["delta"] = round(norm_price - result["current_price"], 2)
        result["components"]["final_price"] = norm_price

    return results
