"""
XAMA Fantasy — Admin Pricing Router
=====================================
Dois endpoints para o fluxo de repricing entre fases:

  GET  /admin/tournaments/{id}/pricing-preview
       Calcula preços sugeridos SEM persistir nada.

  POST /admin/tournaments/{id}/apply-pricing
       Aplica os preços, atualiza fantasy_cost e grava PlayerPriceHistory.

Fluxo esperado:
  1. Fase anterior encerra (tournament.status = "finished")
  2. Admin acessa o preview para conferir os preços sugeridos
  3. Admin confirma → chama apply-pricing
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
    DEFAULT_PRICE,
    NORM_MAX,
    NORM_MIN,
    PlayerStats,
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

class PriceComponentsOut(BaseModel):
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
    had_recent_phase: bool
    had_other_phases: bool
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
    source_tournament_id: Optional[int]
    players_with_history: int
    players_without_history: int
    norm_min: float
    norm_max: float
    items: list[PlayerPricePreviewItem]


class ApplyPricingRequest(BaseModel):
    source_tournament_id: Optional[int] = None
    reason: Optional[str] = None
    norm_min: float = NORM_MIN
    norm_max: float = NORM_MAX


class ApplyPricingResponse(BaseModel):
    applied_at: str
    players_updated: int
    players_at_default: int
    reason: str


# ---------------------------------------------------------------------------
# Helpers de dados
# ---------------------------------------------------------------------------

def _get_tournament_or_404(db: Session, tournament_id: int) -> Tournament:
    t = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not t:
        raise HTTPException(status_code=404, detail=f"Torneio {tournament_id} não encontrado.")
    return t


def _get_stats_for_player_ids(
    db: Session,
    player_ids: list[int],
    tournament_id: int,
) -> dict[int, PlayerStats]:
    """
    Agrega stats de match_player_stats para uma lista de player_ids
    dentro de um torneio específico.
    """
    if not player_ids:
        return {}

    rows = (
        db.query(
            MatchPlayerStat.player_id,
            func.count(MatchPlayerStat.id).label("matches"),
            func.avg(MatchPlayerStat.kills).label("avg_kills"),
            func.avg(MatchPlayerStat.damage_dealt).label("avg_damage"),
            func.avg(MatchPlayerStat.placement).label("avg_placement"),
            func.avg(MatchPlayerStat.survival_secs / 60.0).label("avg_survival_min"),
        )
        .join(Match, Match.id == MatchPlayerStat.match_id)
        .filter(
            MatchPlayerStat.player_id.in_(player_ids),
            Match.tournament_id == tournament_id,
        )
        .group_by(MatchPlayerStat.player_id)
        .all()
    )

    return {
        row.player_id: PlayerStats(
            avg_kills=float(row.avg_kills or 0),
            avg_damage=float(row.avg_damage or 0),
            avg_placement=float(row.avg_placement or 16),
            avg_survival_minutes=float(row.avg_survival_min or 0),
            matches_played=int(row.matches),
        )
        for row in rows
    }


def _resolve_recent_tournament(
    db: Session,
    target: Tournament,
    source_tournament_id: Optional[int],
) -> Optional[Tournament]:
    """
    Resolve o torneio fonte dos stats recentes.
    Se source_tournament_id for fornecido, usa ele diretamente.
    Caso contrário, tenta inferir pelo championship_id e phase_order (futuro).
    Por agora, retorna None quando não fornecido explicitamente.
    """
    if source_tournament_id:
        return _get_tournament_or_404(db, source_tournament_id)
    return None


def _build_inputs(
    db: Session,
    target: Tournament,
    source_tournament_id: Optional[int],
) -> tuple[list[dict], Optional[Tournament]]:
    """
    Monta a lista de inputs para calculate_prices_for_group.

    Para cada jogador do torneio alvo:
      - recent_stats: stats no torneio fonte (via player.name, já que player_id muda entre fases)
      - historical_stats: None por enquanto (extensível na próxima iteração)
    """
    target_players = (
        db.query(Player)
        .filter(Player.tournament_id == target.id)
        .all()
    )
    if not target_players:
        return [], None

    recent_t = _resolve_recent_tournament(db, target, source_tournament_id)
    recent_stats_by_name: dict[str, PlayerStats] = {}

    if recent_t:
        player_names = [p.name for p in target_players]
        recent_players = (
            db.query(Player)
            .filter(
                Player.tournament_id == recent_t.id,
                Player.name.in_(player_names),
            )
            .all()
        )
        if recent_players:
            recent_ids = [rp.id for rp in recent_players]
            stats_by_id = _get_stats_for_player_ids(db, recent_ids, recent_t.id)
            for rp in recent_players:
                if rp.id in stats_by_id:
                    recent_stats_by_name[rp.name] = stats_by_id[rp.id]

    inputs = [
        {
            "player_id": p.id,
            "player_name": p.name,
            "current_price": float(p.fantasy_cost or DEFAULT_PRICE),
            "recent_stats": recent_stats_by_name.get(p.name),
            "historical_stats": None,  # extensível: adicionar outras fases aqui
        }
        for p in target_players
    ]

    return inputs, recent_t


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
    source_tournament_id: Optional[int] = Query(
        None,
        description="Torneio de origem dos stats. Obrigatório até que a detecção automática por phase_order seja implementada.",
    ),
    norm_min: float = Query(NORM_MIN, description="Menor preço após normalização"),
    norm_max: float = Query(NORM_MAX, description="Maior preço após normalização"),
    db: Session = Depends(get_db),
):
    """
    Calcula os preços sugeridos para os jogadores do torneio alvo
    com base nas performances do torneio fonte.

    **Não persiste nada.** Use para conferir antes de chamar apply-pricing.
    """
    target = _get_tournament_or_404(db, tournament_id)
    inputs, recent_t = _build_inputs(db, target, source_tournament_id)

    if not inputs:
        raise HTTPException(
            status_code=422,
            detail=f"Nenhum jogador encontrado no torneio {tournament_id}.",
        )

    results = calculate_prices_for_group(
        inputs,
        norm_min=norm_min,
        norm_max=norm_max,
        total_teams=target.max_teams or 16,
    )

    items: list[PlayerPricePreviewItem] = []
    for r in results:
        comp_out = None
        if r["components"]:
            comp_out = PriceComponentsOut(**r["components"])

        delta_pct = None
        if r["current_price"]:
            delta_pct = round((r["delta"] / r["current_price"]) * 100, 1)

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
        source_tournament_id=recent_t.id if recent_t else None,
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
    summary="Aplica preços calculados e grava histórico",
)
def apply_pricing(
    tournament_id: int,
    body: ApplyPricingRequest,
    db: Session = Depends(get_db),
):
    """
    Aplica os preços sugeridos aos jogadores do torneio:
    - Atualiza `fantasy_cost` e `computed_price`
    - Grava `PlayerPriceHistory` com componentes detalhados
    - Jogadores sem histórico recebem DEFAULT_PRICE e também são logados
    """
    target = _get_tournament_or_404(db, tournament_id)
    inputs, recent_t = _build_inputs(db, target, body.source_tournament_id)

    if not inputs:
        raise HTTPException(
            status_code=422,
            detail=f"Nenhum jogador encontrado no torneio {tournament_id}.",
        )

    results = calculate_prices_for_group(
        inputs,
        norm_min=body.norm_min,
        norm_max=body.norm_max,
        total_teams=target.max_teams or 16,
    )

    source_label = f"T{recent_t.id}" if recent_t else "manual"
    reason = body.reason or f"recalc_from_{source_label}"
    now = datetime.now(timezone.utc)
    updated = 0
    at_default = 0

    for r in results:
        player = db.query(Player).filter(Player.id == r["player_id"]).first()
        if not player:
            continue

        old_price = float(player.fantasy_cost or DEFAULT_PRICE)
        new_price = r["suggested_price"]

        player.fantasy_cost = new_price
        player.computed_price = new_price
        player.price_updated_at = now

        components_json = (
            json.dumps(r["components"])
            if r["components"]
            else json.dumps({"note": "no_history", "default_price": DEFAULT_PRICE})
        )

        db.add(PlayerPriceHistory(
            player_id=player.id,
            old_price=old_price,
            new_price=new_price,
            changed_at=now,
            reason=reason,
            formula_components_json=components_json,
        ))

        if r["no_history"]:
            at_default += 1
        else:
            updated += 1

    db.commit()

    return ApplyPricingResponse(
        applied_at=now.isoformat(),
        players_updated=updated,
        players_at_default=at_default,
        reason=reason,
    )
