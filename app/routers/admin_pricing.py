"""
XAMA Fantasy — Admin Pricing Router
=====================================
  POST /admin/tournaments/{id}/day-zero
  GET  /admin/tournaments/{id}/pricing-preview
  POST /admin/tournaments/{id}/apply-pricing

O parâmetro opcional `gf_day` ativa o modo intra-Grand Final:
  - Filtra as partidas do T19 pelo day especificado
  - Usa PHASE_WEIGHTS_IN_GF (T19 com maior peso)
  - Permite repricing entre dias da Grand Final
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.pricing import (
    DAY_ZERO_PRICE,
    DEFAULT_PRICE,
    GRAND_FINAL_TOURNAMENT_ID,
    NORM_MAX,
    NORM_MIN,
    PHASE_WEIGHTS_IN_GF,
    PHASE_WEIGHTS_PRE_GF,
    PhaseStats,
    PlayerPricingData,
    apply_day_zero,
    calculate_prices_for_group,
)
from app.database import get_db
from app.models.match import Match, MatchPlayerStat
from app.models.player import Player, PlayerPriceHistory
from app.models.tournament import Tournament

router = APIRouter(prefix="/admin", tags=["admin-pricing"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class PhaseStatsOut(BaseModel):
    tournament_id: int
    pts_per_match: float
    matches_played: int
    weight_original: float
    weight_effective: float


class PriceComponentsOut(BaseModel):
    phases_used: list[PhaseStatsOut]
    weighted_avg: float
    raw_score: float
    final_price: float
    formula_version: str


class PlayerPricePreviewItem(BaseModel):
    player_id: int
    player_name: str
    current_price: float
    suggested_price: float
    delta: float
    delta_pct: Optional[float]
    no_history: bool
    components: Optional[PriceComponentsOut]


class PricingPreviewResponse(BaseModel):
    target_tournament_id: int
    championship_id: Optional[int]
    circuit_tournament_ids: list[int]
    phase_weights: dict[str, float]
    mode: str                          # "pre_gf" ou "in_gf_day_{N}"
    players_with_history: int
    players_without_history: int
    norm_min: float
    norm_max: float
    items: list[PlayerPricePreviewItem]


class ApplyPricingRequest(BaseModel):
    reason: Optional[str] = None
    norm_min: float = NORM_MIN
    norm_max: float = NORM_MAX
    gf_day: Optional[int] = None           # se informado, ativa modo intra-GF
    self_contained: bool = False            # se True, usa só o torneio alvo como fonte
    source_tournament_id: Optional[int] = None  # busca stats de outro torneio por nome


class ApplyPricingResponse(BaseModel):
    applied_at: str
    players_updated: int
    players_at_default: int
    reason: str
    mode: str
    norm_min: float
    norm_max: float


class DayZeroResponse(BaseModel):
    applied_at: str
    players_updated: int
    price_applied: float


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_tournament_or_404(db: Session, tournament_id: int) -> Tournament:
    t = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not t:
        raise HTTPException(status_code=404, detail=f"Torneio {tournament_id} não encontrado.")
    return t


def _get_circuit_tournament_ids(db: Session, championship_id: int) -> list[int]:
    rows = (
        db.query(Tournament.id)
        .filter(Tournament.championship_id == championship_id)
        .all()
    )
    return [r.id for r in rows]


def _fetch_phase_stats(
    db: Session,
    player_names: list[str],
    tournament_ids: list[int],
) -> dict[str, list[PhaseStats]]:
    """Agrega total_fantasy_points e matches_played por jogador por fase."""
    if not player_names or not tournament_ids:
        return {}

    rows = (
        db.query(
            Player.name,
            Match.tournament_id,
            func.sum(MatchPlayerStat.fantasy_points).label("total_pts"),
            func.count(MatchPlayerStat.id).label("matches"),
        )
        .join(MatchPlayerStat, MatchPlayerStat.player_id == Player.id)
        .join(Match, Match.id == MatchPlayerStat.match_id)
        .filter(
            Player.name.in_(player_names),
            Match.tournament_id.in_(tournament_ids),
        )
        .group_by(Player.name, Match.tournament_id)
        .all()
    )

    result: dict[str, list[PhaseStats]] = {}
    for row in rows:
        if row.name not in result:
            result[row.name] = []
        result[row.name].append(PhaseStats(
            tournament_id=row.tournament_id,
            total_fantasy_points=float(row.total_pts or 0),
            matches_played=int(row.matches),
        ))
    return result


def _fetch_gf_day_stats(
    db: Session,
    player_names: list[str],
    gf_tournament_id: int,
    gf_day: int,
) -> dict[str, PhaseStats]:
    """
    Agrega stats dos jogadores apenas para as partidas de um day específico
    dentro do torneio da Grand Final.
    """
    rows = (
        db.query(
            Player.name,
            func.sum(MatchPlayerStat.fantasy_points).label("total_pts"),
            func.count(MatchPlayerStat.id).label("matches"),
        )
        .join(MatchPlayerStat, MatchPlayerStat.player_id == Player.id)
        .join(Match, Match.id == MatchPlayerStat.match_id)
        .filter(
            Player.name.in_(player_names),
            Match.tournament_id == gf_tournament_id,
            Match.day == gf_day,
        )
        .group_by(Player.name)
        .all()
    )

    return {
        row.name: PhaseStats(
            tournament_id=gf_tournament_id,
            total_fantasy_points=float(row.total_pts or 0),
            matches_played=int(row.matches),
        )
        for row in rows
    }


def _fetch_stats_by_name_suffix(
    db: Session,
    player_names: list[str],
    source_tournament_id: int,
) -> dict[str, "PhaseStats"]:
    """
    Busca stats do source_tournament_id cruzando por sufixo de nome.
    Ex: jogador "FE_Haven_-" no T21 busca "%Haven_-%" no T7.
    Retorna dict: player_name_t21 -> PhaseStats
    """
    result = {}
    for full_name in player_names:
        # Extrai sufixo: "FE_Haven_-" -> "Haven_-"
        parts = full_name.split("_", 1)
        suffix = parts[1] if len(parts) > 1 else full_name

        row = db.query(
            MatchPlayerStat.player_id,
            func.sum(MatchPlayerStat.fantasy_points).label("total_pts"),
            func.count(MatchPlayerStat.id).label("matches"),
        ).join(Match, Match.id == MatchPlayerStat.match_id
        ).join(Player, Player.id == MatchPlayerStat.player_id
        ).filter(
            Match.tournament_id == source_tournament_id,
            Player.name.ilike(f"%{suffix}%"),
        ).group_by(MatchPlayerStat.player_id).first()

        if row and row.matches > 0:
            result[full_name] = PhaseStats(
                tournament_id=source_tournament_id,
                total_fantasy_points=float(row.total_pts or 0),
                matches_played=int(row.matches),
            )
    return result


def _build_inputs(
    db: Session,
    target: Tournament,
    gf_day: Optional[int] = None,
    self_contained: bool = False,
    source_tournament_id: Optional[int] = None,
) -> tuple[list[PlayerPricingData], list[int], dict[int, float], str]:
    """
    Monta inputs para calculate_prices_for_group.

    Modos:
      self_contained=True  → usa só o torneio alvo como fonte (PAS, torneios únicos)
      gf_day=N             → modo intra-Grand Final, filtra T_GF pelo day N
      padrão               → usa PHASE_WEIGHTS_PRE_GF com torneios do championship

    Retorna (inputs, circuit_ids, phase_weights, mode_label)
    """
    target_players = (
        db.query(Player)
        .filter(Player.tournament_id == target.id)
        .all()
    )
    if not target_players:
        return [], [], {}, "pre_gf"

    circuit_ids: list[int] = []
    if target.championship_id:
        circuit_ids = _get_circuit_tournament_ids(db, target.championship_id)

    # Modo self_contained: usa só o torneio alvo
    if self_contained:
        all_weights = {target.id: 100.0}
        source_ids = [target.id]
        mode = f"self_contained_T{target.id}"
    # Modo intra-Grand Final
    elif gf_day is not None:
        all_weights = PHASE_WEIGHTS_IN_GF
        historical_ids = [
            tid for tid in all_weights
            if tid != GRAND_FINAL_TOURNAMENT_ID
        ]
        extra_ids = [tid for tid in historical_ids if tid not in circuit_ids]
        source_ids = list(set(circuit_ids + extra_ids))
        mode = f"in_gf_day_{gf_day}"
    else:
        all_weights = PHASE_WEIGHTS_PRE_GF
        extra_ids = [tid for tid in all_weights if tid not in circuit_ids]
        source_ids = list(set(circuit_ids + extra_ids))
        mode = "pre_gf"

    player_names = [p.name for p in target_players]

    # Modo source_tournament_id: busca stats de outro torneio por sufixo de nome
    if source_tournament_id is not None:
        suffix_stats = _fetch_stats_by_name_suffix(db, player_names, source_tournament_id)
        inputs_result: list[PlayerPricingData] = [
            PlayerPricingData(
                player_id=p.id,
                player_name=p.name,
                current_price=float(p.fantasy_cost or DAY_ZERO_PRICE),
                phases=[suffix_stats[p.name]] if p.name in suffix_stats else [],
            )
            for p in target_players
        ]
        phase_weights_used = {source_tournament_id: 100.0}
        mode_label = f"source_T{source_tournament_id}"
        return inputs_result, [source_tournament_id], phase_weights_used, mode_label

    # Stats das fases históricas
    historical_stats = _fetch_phase_stats(db, player_names, source_ids)

    # Stats do day da GF (apenas no modo intra-GF)
    gf_day_stats: dict[str, PhaseStats] = {}
    if gf_day is not None:
        gf_day_stats = _fetch_gf_day_stats(
            db, player_names, GRAND_FINAL_TOURNAMENT_ID, gf_day
        )

    inputs: list[PlayerPricingData] = []
    for p in target_players:
        phases = list(historical_stats.get(p.name, []))

        # Adiciona stats do day da GF como uma "fase" separada com tournament_id=T19
        if gf_day is not None and p.name in gf_day_stats:
            gf_phase = gf_day_stats[p.name]
            # Remove qualquer entrada T19 que veio do histórico geral e substitui
            phases = [ph for ph in phases if ph["tournament_id"] != GRAND_FINAL_TOURNAMENT_ID]
            phases.append(gf_phase)

        inputs.append(PlayerPricingData(
            player_id=p.id,
            player_name=p.name,
            current_price=float(p.fantasy_cost or DAY_ZERO_PRICE),
            phases=phases,
        ))

    return inputs, circuit_ids, all_weights, mode


def _persist_results(
    db: Session,
    results: list[dict],
    reason: str,
    now: datetime,
) -> tuple[int, int]:
    updated = at_default = 0
    for r in results:
        player = db.query(Player).filter(Player.id == r["player_id"]).first()
        if not player:
            continue
        old_price = float(player.fantasy_cost or DAY_ZERO_PRICE)
        new_price = r["suggested_price"]
        player.fantasy_cost = new_price
        player.computed_price = new_price
        player.price_updated_at = now
        db.add(PlayerPriceHistory(
            player_id=player.id,
            old_price=old_price,
            new_price=new_price,
            changed_at=now,
            reason=reason,
            formula_components_json=json.dumps(r["components"]) if r["components"] else None,
        ))
        if r["no_history"]:
            at_default += 1
        else:
            updated += 1
    db.commit()
    return updated, at_default


# ---------------------------------------------------------------------------
# POST /admin/tournaments/{id}/day-zero
# ---------------------------------------------------------------------------

@router.post(
    "/tournaments/{tournament_id}/day-zero",
    response_model=DayZeroResponse,
    summary="Dia Zero — todos os jogadores recebem 25 cr",
)
def day_zero(tournament_id: int, db: Session = Depends(get_db)):
    target = _get_tournament_or_404(db, tournament_id)
    players = db.query(Player).filter(Player.tournament_id == target.id).all()
    if not players:
        raise HTTPException(status_code=422, detail="Nenhum jogador encontrado.")

    inputs = [
        {"player_id": p.id, "player_name": p.name,
         "current_price": float(p.fantasy_cost or 0), "phases": []}
        for p in players
    ]
    results = apply_day_zero(inputs)
    now = datetime.now(timezone.utc)
    updated, _ = _persist_results(db, results, reason="day_zero", now=now)
    return DayZeroResponse(
        applied_at=now.isoformat(),
        players_updated=updated,
        price_applied=DAY_ZERO_PRICE,
    )


# ---------------------------------------------------------------------------
# GET /admin/tournaments/{id}/pricing-preview
# ---------------------------------------------------------------------------

@router.get(
    "/tournaments/{tournament_id}/pricing-preview",
    response_model=PricingPreviewResponse,
    summary="Previsão de preços — sem persistência",
)
def pricing_preview(
    tournament_id: int,
    norm_min: float = Query(NORM_MIN),
    norm_max: float = Query(NORM_MAX),
    gf_day: Optional[int] = Query(
        None,
        description="Dia da Grand Final a usar como fonte (ex: 1). Ativa modo intra-GF.",
    ),
    self_contained: bool = Query(
        False,
        description="Se True, usa só o próprio torneio como fonte de stats. Ideal para torneios únicos como o PAS T7.",
    ),
    source_tournament_id: Optional[int] = Query(
        None,
        description="Busca stats deste torneio cruzando jogadores por nome. Ideal para Cup Weeks do PAS.",
    ),
    db: Session = Depends(get_db),
):
    """
    Calcula preços sugeridos sem persistir.

    Sem `gf_day`: usa PHASE_WEIGHTS_PRE_GF (histórico do circuito).
    Com `gf_day=1`: usa PHASE_WEIGHTS_IN_GF com stats do Dia 1 da GF.
    """
    target = _get_tournament_or_404(db, tournament_id)
    inputs, circuit_ids, phase_weights, mode = _build_inputs(
        db, target, gf_day, self_contained, source_tournament_id
    )

    if not inputs:
        raise HTTPException(status_code=422, detail="Nenhum jogador encontrado.")

    results = calculate_prices_for_group(
        inputs, norm_min=norm_min, norm_max=norm_max, phase_weights=phase_weights
    )

    items: list[PlayerPricePreviewItem] = []
    for r in results:
        comp_out = None
        if r["components"] and r["components"].get("formula_version") != "day_zero":
            comp = r["components"]
            comp_out = PriceComponentsOut(
                phases_used=[PhaseStatsOut(**ph) for ph in comp.get("phases_used", [])],
                weighted_avg=comp["weighted_avg"],
                raw_score=comp["raw_score"],
                final_price=comp["final_price"],
                formula_version=comp["formula_version"],
            )
        delta_pct = (
            round((r["delta"] / r["current_price"]) * 100, 1)
            if r["current_price"] else None
        )
        items.append(PlayerPricePreviewItem(
            player_id=r["player_id"],
            player_name=r["player_name"],
            current_price=r["current_price"],
            suggested_price=r["suggested_price"],
            delta=r["delta"],
            delta_pct=delta_pct,
            no_history=r["no_history"],
            components=comp_out,
        ))

    items.sort(key=lambda x: x.suggested_price, reverse=True)

    return PricingPreviewResponse(
        target_tournament_id=tournament_id,
        championship_id=target.championship_id,
        circuit_tournament_ids=circuit_ids,
        phase_weights={str(k): v for k, v in phase_weights.items()},
        mode=mode,
        players_with_history=sum(1 for i in items if not i.no_history),
        players_without_history=sum(1 for i in items if i.no_history),
        norm_min=norm_min,
        norm_max=norm_max,
        items=items,
    )


# ---------------------------------------------------------------------------
# POST /admin/tournaments/{id}/apply-pricing
# ---------------------------------------------------------------------------

@router.post(
    "/tournaments/{tournament_id}/apply-pricing",
    response_model=ApplyPricingResponse,
    summary="Aplica preços e grava histórico",
)
def apply_pricing(
    tournament_id: int,
    body: ApplyPricingRequest,
    db: Session = Depends(get_db),
):
    """
    Aplica os preços calculados.

    Sem `gf_day`: modo pré-Grand Final (histórico do circuito).
    Com `gf_day=1`: modo intra-GF usando stats do Dia 1 da Grand Final.
    """
    target = _get_tournament_or_404(db, tournament_id)
    inputs, _, phase_weights, mode = _build_inputs(
        db, target, body.gf_day, body.self_contained, body.source_tournament_id
    )

    if not inputs:
        raise HTTPException(status_code=422, detail="Nenhum jogador encontrado.")

    results = calculate_prices_for_group(
        inputs, norm_min=body.norm_min, norm_max=body.norm_max,
        phase_weights=phase_weights,
    )

    now = datetime.now(timezone.utc)
    default_reason = (
        f"repricing_gf_day{body.gf_day}_{now.strftime('%Y%m%d')}"
        if body.gf_day
        else f"repricing_{now.strftime('%Y%m%d')}"
    )
    reason = body.reason or default_reason
    updated, at_default = _persist_results(db, results, reason=reason, now=now)

    return ApplyPricingResponse(
        applied_at=now.isoformat(),
        players_updated=updated,
        players_at_default=at_default,
        reason=reason,
        mode=mode,
        norm_min=body.norm_min,
        norm_max=body.norm_max,
    )
