# app/services/pricing.py
"""
Pricing service — Fase 5

Algoritmo:
  1. Para cada Roster da stage, busca as últimas pricing_n_matches MatchStat da Person
     (qualquer championship, ordenado por created_at DESC)
  2. Calcula pts_per_match_efetivo = média simples das últimas N partidas
  3. Coleta o valor de todos os jogadores com histórico e monta a régua
     [price_min .. price_max] com distribuição configurável (atualmente: linear)
  4. Newcomers (newcomer_to_tier=True) ou jogadores sem nenhuma MatchStat
     recebem pricing_newcomer_cost
  5. Grava fantasy_cost no Roster e registra RosterPriceHistory
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.roster import Roster, RosterPriceHistory
from app.models.stage import Stage
from app.models.match_stat import MatchStat

logger = logging.getLogger(__name__)


# ── distribuição ──────────────────────────────────────────────────────────────

def _interpolate(value: float, v_min: float, v_max: float, p_min: int, p_max: int) -> int:
    """
    Interpola linearmente `value` no intervalo [v_min, v_max]
    e retorna o custo correspondente em [p_min, p_max].

    Se v_min == v_max (todos os jogadores têm a mesma performance),
    retorna o ponto médio da régua.
    """
    if v_max == v_min:
        return round((p_min + p_max) / 2)
    t = (value - v_min) / (v_max - v_min)  # 0.0 .. 1.0
    return round(p_min + t * (p_max - p_min))


def _apply_distribution(
    value: float,
    v_min: float,
    v_max: float,
    p_min: int,
    p_max: int,
    distribution: str,
) -> int:
    """
    Ponto de extensão: adicione novos modelos de distribuição aqui no futuro.
    Hoje apenas 'linear' está implementado.
    """
    if distribution == "linear":
        return _interpolate(value, v_min, v_max, p_min, p_max)

    logger.warning(
        "pricing_distribution=%r não implementado, usando 'linear'.", distribution
    )
    return _interpolate(value, v_min, v_max, p_min, p_max)


# ── helpers de banco ──────────────────────────────────────────────────────────

def _get_effective_ppm(person_id: int, n_matches: int, db: Session) -> Optional[float]:
    """
    Retorna a média de xama_points das últimas `n_matches` partidas da Person,
    independente de championship ou stage.
    Retorna None se não houver nenhuma partida ou todos os valores forem nulos.
    """
    rows = (
        db.query(MatchStat.xama_points)
        .filter(
            MatchStat.person_id == person_id,
            MatchStat.xama_points.isnot(None),
        )
        .order_by(MatchStat.created_at.desc())
        .limit(n_matches)
        .all()
    )

    if not rows:
        return None

    values = [float(r.xama_points) for r in rows]
    return sum(values) / len(values)


def _record_price_history(
    roster_id: int,
    cost: int,
    source: str,
    stage_day_id: Optional[int],
    db: Session,
) -> None:
    history = RosterPriceHistory(
        roster_id=roster_id,
        stage_day_id=stage_day_id,
        cost=cost,
        source=source,
        recorded_at=datetime.now(timezone.utc),
    )
    db.add(history)


# ── API pública ───────────────────────────────────────────────────────────────

def calculate_stage_pricing(
    stage_id: int,
    db: Session,
    *,
    stage_day_id: Optional[int] = None,
    source: str = "auto",
) -> dict:
    """
    Recalcula fantasy_cost de todos os Roster ativos da stage.

    Parâmetros:
        stage_id     — ID da Stage a recalcular
        db           — sessão SQLAlchemy Session
        stage_day_id — se fornecido, associa o RosterPriceHistory ao dia
        source       — 'auto' (scheduler) ou 'manual'

    Retorna:
        {"updated": int, "skipped": int, "newcomers": int}
    """
    # 1. Carrega a stage com configurações de pricing
    stage: Optional[Stage] = db.get(Stage, stage_id)
    if stage is None:
        raise ValueError(f"Stage {stage_id} não encontrada.")

    # 2. Carrega todos os Roster ativos da stage
    rosters: list[Roster] = (
        db.query(Roster)
        .filter(Roster.stage_id == stage_id, Roster.is_available == True)  # noqa: E712
        .all()
    )

    if not rosters:
        logger.info("Stage %d: nenhum roster ativo encontrado.", stage_id)
        return {"updated": 0, "skipped": 0, "newcomers": 0}

    # 3. Calcula pts_per_match_efetivo para cada jogador
    ppm_map: dict[int, Optional[float]] = {
        roster.id: _get_effective_ppm(roster.person_id, stage.pricing_n_matches, db)
        for roster in rosters
    }

    # 4. Monta a régua apenas com jogadores que têm histórico E não são newcomers
    eligible_ppms = [
        ppm_map[r.id]
        for r in rosters
        if ppm_map[r.id] is not None and not r.newcomer_to_tier
    ]

    v_min = min(eligible_ppms) if eligible_ppms else 0.0
    v_max = max(eligible_ppms) if eligible_ppms else 0.0

    logger.info(
        "Stage %d: régua ppm [%.2f .. %.2f] → custo [%d .. %d] (%s)",
        stage_id, v_min, v_max, stage.price_min, stage.price_max, stage.pricing_distribution,
    )

    # 5. Aplica custo a cada roster
    updated = skipped = newcomers = 0

    for roster in rosters:
        ppm = ppm_map[roster.id]

        # Newcomer ou sem histórico → custo fixo
        if roster.newcomer_to_tier or ppm is None:
            new_cost = stage.pricing_newcomer_cost
            newcomers += 1
        else:
            new_cost = _apply_distribution(
                ppm, v_min, v_max, stage.price_min, stage.price_max,
                stage.pricing_distribution,
            )

        # Não grava se não houve mudança
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

    cost=None → remove o override (volta a exibir fantasy_cost calculado).
    Não dispara recálculo de pricing — cost_override é independente.
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
