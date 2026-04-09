# app/services/pricing.py
"""
Pricing service — Fase 5 + Bloco B (refatoração)

Algoritmo novo (exponential decay + tier_weight):
  Para cada jogador, busca as últimas 50 partidas globais (qualquer championship),
  filtra as com mais de 150 dias, e descarta jogadores com menos de 20 partidas válidas.

  Para cada partida válida:
    decay = e^(-0.02 × dias_atras)
    score = xama_points × tier_weight × decay

  ppm_ponderado = Σ(score) / Σ(tier_weight × decay)

  Régua linear: ppm_ponderado → [price_min .. price_max]
  Pisos: price_min (hard floor), pricing_newcomer_cost (para histórico insuficiente)

Parâmetros globais configuráveis:
  DECAY_LAMBDA      = 0.02   (velocidade de queda exponencial)
  MAX_DAYS          = 150    (corte hard de antiguidade em dias)
  MAX_MATCHES       = 50     (máximo de partidas consideradas)
  MIN_VALID_MATCHES = 20     (mínimo para não ser tratado como newcomer)
"""
from __future__ import annotations

import logging
import math
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.championship import Championship
from app.models.match import Match
from app.models.match_stat import MatchStat
from app.models.roster import Roster, RosterPriceHistory
from app.models.stage import Stage
from app.models.stage_day import StageDay

logger = logging.getLogger(__name__)

# ── Parâmetros globais do algoritmo ───────────────────────────────────────────

DECAY_LAMBDA      = 0.02   # λ da curva e^(-λ × dias)
MAX_DAYS          = 150    # corte hard: partidas mais antigas são ignoradas
MAX_MATCHES       = 50     # máximo de partidas no histórico
MIN_VALID_MATCHES = 20     # mínimo de partidas válidas para calcular preço


# ── Cálculo de ppm ponderado ──────────────────────────────────────────────────

def _get_weighted_ppm(
    person_id: int,
    db: Session,
    now: datetime,
) -> Optional[float]:
    """
    Calcula o ppm ponderado de um jogador usando o algoritmo exponencial
    com tier_weight por championship.

    Retorna None se o jogador tiver menos de MIN_VALID_MATCHES partidas válidas.
    """
    # Busca as últimas MAX_MATCHES partidas com dados de data e championship
    rows = (
        db.query(
            MatchStat.xama_points,
            Match.played_at,
            Championship.tier_weight,
        )
        .join(Match, MatchStat.match_id == Match.id)
        .join(StageDay, Match.stage_day_id == StageDay.id)
        .join(Stage, StageDay.stage_id == Stage.id)
        .join(Championship, Stage.championship_id == Championship.id)
        .filter(
            MatchStat.person_id == person_id,
            MatchStat.xama_points.isnot(None),
            Match.played_at.isnot(None),
        )
        .order_by(Match.played_at.desc())
        .limit(MAX_MATCHES)
        .all()
    )

    if not rows:
        return None

    weighted_sum = 0.0
    weight_sum   = 0.0
    valid_count  = 0

    for xama_points, played_at, tier_weight in rows:
        # Normaliza timezone
        if played_at.tzinfo is None:
            played_at = played_at.replace(tzinfo=timezone.utc)

        days_ago = (now - played_at).total_seconds() / 86400.0

        # Corte hard: ignora partidas muito antigas
        if days_ago > MAX_DAYS:
            continue

        decay      = math.exp(-DECAY_LAMBDA * days_ago)
        tw         = float(tier_weight or 1.0)
        pts        = float(xama_points)

        weighted_sum += pts * tw * decay
        weight_sum   += tw * decay
        valid_count  += 1

    # Histórico insuficiente → tratado como newcomer
    if valid_count < MIN_VALID_MATCHES:
        return None

    if weight_sum == 0:
        return None

    return weighted_sum / weight_sum


# ── Distribuição ──────────────────────────────────────────────────────────────

def _interpolate(
    value: float,
    v_min: float,
    v_max: float,
    p_min: int,
    p_max: int,
) -> int:
    """
    Interpola linearmente `value` no intervalo [v_min, v_max]
    retornando custo em [p_min, p_max].
    Se v_min == v_max retorna ponto médio.
    """
    if v_max == v_min:
        return round((p_min + p_max) / 2)
    t = (value - v_min) / (v_max - v_min)
    return round(p_min + t * (p_max - p_min))


def _apply_distribution(
    value: float,
    v_min: float,
    v_max: float,
    p_min: int,
    p_max: int,
    distribution: str,
) -> int:
    if distribution == "linear":
        return _interpolate(value, v_min, v_max, p_min, p_max)
    logger.warning("pricing_distribution=%r não implementado, usando linear.", distribution)
    return _interpolate(value, v_min, v_max, p_min, p_max)


# ── Histórico de preços ───────────────────────────────────────────────────────

def _record_price_history(
    roster_id: int,
    cost: int,
    source: str,
    stage_day_id: Optional[int],
    db: Session,
) -> None:
    db.add(RosterPriceHistory(
        roster_id    = roster_id,
        stage_day_id = stage_day_id,
        cost         = cost,
        source       = source,
        recorded_at  = datetime.now(timezone.utc),
    ))


# ── API pública ───────────────────────────────────────────────────────────────

def calculate_stage_pricing(
    stage_id: int,
    db: Session,
    *,
    stage_day_id: Optional[int] = None,
    source: str = "auto",
) -> dict:
    """
    Recalcula fantasy_cost de todos os Roster ativos da stage
    usando o algoritmo de decay exponencial com tier_weight.

    Retorna: {"updated": int, "skipped": int, "newcomers": int}
    """
    stage: Optional[Stage] = db.get(Stage, stage_id)
    if stage is None:
        raise ValueError(f"Stage {stage_id} não encontrada.")

    rosters: list[Roster] = (
        db.query(Roster)
        .filter(Roster.stage_id == stage_id, Roster.is_available == True)  # noqa: E712
        .all()
    )

    if not rosters:
        logger.info("Stage %d: nenhum roster ativo encontrado.", stage_id)
        return {"updated": 0, "skipped": 0, "newcomers": 0}

    now = datetime.now(timezone.utc)

    # Calcula ppm ponderado para cada jogador
    ppm_map: dict[int, Optional[float]] = {
        roster.id: _get_weighted_ppm(roster.person_id, db, now)
        for roster in rosters
    }

    # Monta a régua apenas com jogadores elegíveis (têm histórico, não são newcomers)
    eligible_ppms = [
        ppm_map[r.id]
        for r in rosters
        if ppm_map[r.id] is not None and not r.newcomer_to_tier
    ]

    v_min = min(eligible_ppms) if eligible_ppms else 0.0
    v_max = max(eligible_ppms) if eligible_ppms else 0.0

    logger.info(
        "Stage %d: régua ppm [%.2f .. %.2f] → custo [%d .. %d] (%s) | λ=%.2f max_days=%d",
        stage_id, v_min, v_max,
        stage.price_min, stage.price_max,
        stage.pricing_distribution,
        DECAY_LAMBDA, MAX_DAYS,
    )

    updated = skipped = newcomers = 0

    for roster in rosters:
        ppm = ppm_map[roster.id]

        # Newcomer explícito ou histórico insuficiente → custo fixo
        if roster.newcomer_to_tier or ppm is None:
            new_cost = stage.pricing_newcomer_cost
            newcomers += 1
        else:
            new_cost = _apply_distribution(
                ppm, v_min, v_max,
                stage.price_min, stage.price_max,
                stage.pricing_distribution,
            )
            # Garante piso absoluto
            new_cost = max(stage.price_min, new_cost)

        if roster.fantasy_cost == new_cost:
            skipped += 1
            continue

        roster.fantasy_cost = new_cost
        _record_price_history(roster.id, new_cost, source, stage_day_id, db)
        updated += 1

    db.flush()
    logger.info(
        "Stage %d: pricing concluído — updated=%d skipped=%d newcomers=%d",
        stage_id, updated, skipped, newcomers,
    )
    return {"updated": updated, "skipped": skipped, "newcomers": newcomers}


def apply_cost_override(
    roster_id: int,
    cost: Optional[int],
    db: Session,
    *,
    stage_day_id: Optional[int] = None,
) -> Roster:
    """
    Seta (ou remove) cost_override de um Roster e grava auditoria.
    cost=None → remove o override.
    """
    roster: Optional[Roster] = db.get(Roster, roster_id)
    if roster is None:
        raise ValueError(f"Roster {roster_id} não encontrado.")

    roster.cost_override = cost

    if cost is not None:
        _record_price_history(roster_id, cost, "override", stage_day_id, db)

    db.flush()
    logger.info(
        "Roster %d: cost_override → %s",
        roster_id,
        cost if cost is not None else "removido",
    )
    return roster
