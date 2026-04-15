# app/services/lineup.py
"""
Lineup Service — Fase 4 / #040 #042

Responsável por:
  - #040: Montar e validar lineup de um usuário para um STAGE_DAY
  - #042: Replicar lineup do dia anterior (validação de budget e disponibilidade)

Regras de negócio:
  - 4 titulares + 1 reserva por lineup (5 jogadores total)
  - Um dos 4 titulares é marcado como capitão (is_captain=True)
    → multiplicador de pontos ×1.3 aplicado no scoring
  - Todos os jogadores devem estar no Roster da Stage do StageDay
  - Todos os jogadores devem ter is_available=True
  - Budget cap fixo: soma de effective_cost dos titulares + reserva <= 100
  - Um usuário só pode ter UM lineup por stage_day (UniqueConstraint no modelo)
  - Lineup só pode ser submetido/editado enquanto stage.lineup_status == 'open'
  - Status 'preview': stage visível com roster/stats, mas submissão de lineup bloqueada
  - Replicação automática: copia o lineup do dia anterior se válido
    – valida budget e disponibilidade no momento da replicação
    – jogadores indisponíveis são removidos, tornando o lineup inválido

lineup_status válidos:
  closed  — padrão; stage não aparece nas seções ativas
  preview — visível para visualização, lineup desabilitado (aguardando confirmação do roster)
  open    — lineup aberto para montagem
  locked  — stage encerrada; lineup visível mas não editável
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models import Lineup, LineupPlayer, Roster, Stage, StageDay

logger = logging.getLogger(__name__)

# Configuração de slots
TITULAR_COUNT = 4
RESERVE_COUNT = 1
TOTAL_PLAYERS = TITULAR_COUNT + RESERVE_COUNT
BUDGET_CAP    = 100
CAPTAIN_MULTIPLIER = 1.3  # multiplicador de pontos do capitão


# ---------------------------------------------------------------------------
# Submissão de lineup (#040)
# ---------------------------------------------------------------------------

def submit_lineup(
    db: Session,
    user_id: str,
    stage_day_id: int,
    titular_roster_ids: list[int],
    reserve_roster_id: int,
    captain_roster_id: int,
) -> Lineup:
    """
    Cria ou substitui o lineup de um usuário para um STAGE_DAY.

    Args:
        db:                  sessão SQLAlchemy
        user_id:             ID do usuário
        stage_day_id:        ID do StageDay
        titular_roster_ids:  lista de 4 roster_ids para slots titulares
        reserve_roster_id:   roster_id do jogador reserva
        captain_roster_id:   roster_id do capitão (deve estar em titular_roster_ids)

    Returns:
        Lineup criado/atualizado

    Raises:
        ValueError: se qualquer validação falhar
    """
    stage_day = db.query(StageDay).filter(StageDay.id == stage_day_id).first()
    if not stage_day:
        raise ValueError(f"StageDay {stage_day_id} não encontrado")

    stage = stage_day.stage
    _assert_lineup_open(stage)

    # Valida contagem de titulares
    if len(titular_roster_ids) != TITULAR_COUNT:
        raise ValueError(f"São necessários exatamente {TITULAR_COUNT} titulares")

    # Capitão deve ser um dos titulares
    if captain_roster_id not in titular_roster_ids:
        raise ValueError("O capitão deve ser um dos jogadores titulares")

    # Reserva não pode ser titular
    if reserve_roster_id in titular_roster_ids:
        raise ValueError("O jogador reserva não pode ser titular")

    all_roster_ids = titular_roster_ids + [reserve_roster_id]

    # Sem duplicatas
    if len(set(all_roster_ids)) != len(all_roster_ids):
        raise ValueError("Jogadores duplicados no lineup")

    # Carrega e valida rosters
    rosters = _load_and_validate_rosters(db, all_roster_ids, stage.id)
    roster_map = {r.id: r for r in rosters}

    # Valida custo da reserva <= menor custo dos titulares
    titulares = [roster_map[rid] for rid in titular_roster_ids]
    reserva   = roster_map[reserve_roster_id]
    _validate_reserve_cost(reserva, titulares)

    # Valida budget (apenas titulares — reserva não conta)
    total_cost = _validate_budget(titulares)

    # Upsert: remove lineup anterior se existir
    existing = (
        db.query(Lineup)
        .filter(Lineup.user_id == user_id, Lineup.stage_day_id == stage_day_id)
        .first()
    )
    if existing:
        db.delete(existing)
        db.flush()

    # Cria novo lineup
    lineup = Lineup(
        user_id            = user_id,
        stage_day_id       = stage_day_id,
        is_auto_replicated = False,
        is_valid           = True,
        total_cost         = total_cost,
        submitted_at       = datetime.now(timezone.utc),
    )
    db.add(lineup)
    db.flush()  # gera lineup.id

    # Cria LineupPlayers — titulares
    for roster_id in titular_roster_ids:
        roster = roster_map[roster_id]
        db.add(LineupPlayer(
            lineup_id   = lineup.id,
            roster_id   = roster_id,
            slot_type   = "titular",
            is_captain  = (roster_id == captain_roster_id),
            locked_cost = roster.effective_cost,
        ))

    # Cria LineupPlayer — reserva
    db.add(LineupPlayer(
        lineup_id   = lineup.id,
        roster_id   = reserve_roster_id,
        slot_type   = "reserve",
        is_captain  = False,
        locked_cost = reserva.effective_cost,
    ))

    db.commit()
    db.refresh(lineup)

    logger.info(
        "[Lineup] user=%s stage_day=%s — lineup submetido (cost=%s captain=%s)",
        user_id, stage_day_id, total_cost, captain_roster_id,
    )
    return lineup


# ---------------------------------------------------------------------------
# Replicação automática (#042)
# ---------------------------------------------------------------------------

def replicate_lineup_for_day(
    db: Session,
    user_id: str,
    stage_day_id: int,
) -> Optional[Lineup]:
    """
    Replica o lineup do dia anterior para o stage_day informado.
    Chamado pelo APScheduler antes do lock de cada dia.

    Retorna o Lineup criado, ou None se não houver lineup anterior válido
    ou se o usuário já tiver lineup para o dia.

    Nunca lança exceção — erros são logados e retornam None.
    """
    # Usuário já tem lineup para o dia → não replica
    existing = (
        db.query(Lineup)
        .filter(Lineup.user_id == user_id, Lineup.stage_day_id == stage_day_id)
        .first()
    )
    if existing:
        return None

    stage_day = db.query(StageDay).filter(StageDay.id == stage_day_id).first()
    if not stage_day:
        logger.warning("[Lineup] replicate: StageDay %s não encontrado", stage_day_id)
        return None

    # Busca o StageDay anterior (day_number - 1, mesma stage)
    prev_day = (
        db.query(StageDay)
        .filter(
            StageDay.stage_id   == stage_day.stage_id,
            StageDay.day_number == stage_day.day_number - 1,
        )
        .first()
    )
    if not prev_day:
        logger.info(
            "[Lineup] replicate: user=%s — sem dia anterior para stage_day=%s",
            user_id, stage_day_id,
        )
        return None

    # Busca lineup válido do dia anterior
    prev_lineup = (
        db.query(Lineup)
        .filter(
            Lineup.user_id      == user_id,
            Lineup.stage_day_id == prev_day.id,
            Lineup.is_valid     == True,  # noqa: E712
        )
        .first()
    )
    if not prev_lineup:
        logger.info(
            "[Lineup] replicate: user=%s — sem lineup válido no dia anterior",
            user_id,
        )
        return None

    prev_players = prev_lineup.players  # list[LineupPlayer]

    # Valida disponibilidade de cada jogador no dia atual
    titular_players: list[LineupPlayer] = []
    reserve_player:  Optional[LineupPlayer] = None
    is_valid = True

    for lp in prev_players:
        roster = db.query(Roster).filter(Roster.id == lp.roster_id).first()
        if not roster or not roster.is_available:
            logger.warning(
                "[Lineup] replicate: user=%s — roster_id=%s indisponível, lineup marcado inválido",
                user_id, lp.roster_id,
            )
            is_valid = False
            continue

        if lp.slot_type == "titular":
            titular_players.append(lp)
        else:
            reserve_player = lp

    # Calcula custo — apenas titulares, reserva não entra no budget
    titular_ids = [lp.roster_id for lp in titular_players]
    reserve_ids = [reserve_player.roster_id] if reserve_player else []
    all_ids     = titular_ids + reserve_ids

    rosters_available = (
        db.query(Roster).filter(Roster.id.in_(all_ids)).all()
        if all_ids else []
    )
    roster_map_rep = {r.id: r for r in rosters_available}
    total_cost = sum(
        roster_map_rep[rid].effective_cost or 0
        for rid in titular_ids
        if rid in roster_map_rep
    )

    # Cria lineup replicado
    new_lineup = Lineup(
        user_id            = user_id,
        stage_day_id       = stage_day_id,
        is_auto_replicated = True,
        is_valid           = is_valid,
        total_cost         = total_cost,
        submitted_at       = datetime.now(timezone.utc),
    )
    db.add(new_lineup)
    db.flush()

    roster_map = {r.id: r for r in rosters_available}

    for lp in titular_players:
        roster = roster_map.get(lp.roster_id)
        db.add(LineupPlayer(
            lineup_id   = new_lineup.id,
            roster_id   = lp.roster_id,
            slot_type   = "titular",
            is_captain  = lp.is_captain,
            locked_cost = roster.effective_cost if roster else None,
        ))

    if reserve_player:
        roster = roster_map.get(reserve_player.roster_id)
        db.add(LineupPlayer(
            lineup_id   = new_lineup.id,
            roster_id   = reserve_player.roster_id,
            slot_type   = "reserve",
            is_captain  = False,
            locked_cost = roster.effective_cost if roster else None,
        ))

    db.commit()
    db.refresh(new_lineup)

    logger.info(
        "[Lineup] replicate: user=%s stage_day=%s — replicado (valid=%s cost=%s)",
        user_id, stage_day_id, is_valid, total_cost,
    )
    return new_lineup


def replicate_all_missing_lineups(db: Session, stage_day_id: int) -> dict:
    """
    Replica o lineup do dia anterior para TODOS os usuários sem lineup no dia informado.
    Chamado pelo APScheduler antes do lock de cada StageDay.
    """
    stage_day = db.query(StageDay).filter(StageDay.id == stage_day_id).first()
    if not stage_day:
        raise ValueError(f"StageDay {stage_day_id} não encontrado")

    prev_day = (
        db.query(StageDay)
        .filter(
            StageDay.stage_id   == stage_day.stage_id,
            StageDay.day_number == stage_day.day_number - 1,
        )
        .first()
    )
    if not prev_day:
        return {"stage_day_id": stage_day_id, "replicated": 0, "reason": "sem dia anterior"}

    users_prev = (
        db.query(Lineup.user_id)
        .filter(Lineup.stage_day_id == prev_day.id, Lineup.is_valid == True)  # noqa: E712
        .all()
    )
    users_with_prev = {row[0] for row in users_prev}

    users_today = (
        db.query(Lineup.user_id)
        .filter(Lineup.stage_day_id == stage_day_id)
        .all()
    )
    users_with_today = {row[0] for row in users_today}

    to_replicate = users_with_prev - users_with_today

    replicated = 0
    failed = 0
    for user_id in to_replicate:
        try:
            result = replicate_lineup_for_day(db, user_id, stage_day_id)
            if result:
                replicated += 1
        except Exception as exc:
            logger.error(
                "[Lineup] replicate_all: user=%s stage_day=%s — erro: %s",
                user_id, stage_day_id, exc,
            )
            failed += 1

    logger.info(
        "[Lineup] replicate_all: stage_day=%s — %d replicados, %d falhas",
        stage_day_id, replicated, failed,
    )
    return {
        "stage_day_id":     stage_day_id,
        "replicated":       replicated,
        "failed":           failed,
        "total_candidates": len(to_replicate),
    }


# ---------------------------------------------------------------------------
# Helpers internos
# ---------------------------------------------------------------------------

def _assert_lineup_open(stage: Stage) -> None:
    """
    Garante que a stage está com lineup_status='open'.
    'preview' permite visualização mas bloqueia submissão.
    """
    if stage.lineup_status == "preview":
        raise ValueError(
            "Lineup desabilitado — Aguardando confirmação do roster para esta stage."
        )
    if stage.lineup_status != "open":
        raise ValueError(
            f"Lineups não estão abertos para esta stage "
            f"(status atual: '{stage.lineup_status}')"
        )


def _load_and_validate_rosters(
    db: Session,
    roster_ids: list[int],
    stage_id: int,
) -> list[Roster]:
    rosters = (
        db.query(Roster)
        .filter(Roster.id.in_(roster_ids), Roster.stage_id == stage_id)
        .all()
    )

    found_ids = {r.id for r in rosters}
    missing = set(roster_ids) - found_ids
    if missing:
        raise ValueError(
            f"Roster(s) não encontrado(s) nesta stage: {sorted(missing)}"
        )

    unavailable = [r for r in rosters if not r.is_available]
    if unavailable:
        names = [str(r.id) for r in unavailable]
        raise ValueError(f"Jogador(es) indisponível(is): roster_ids={names}")

    return rosters


def _validate_reserve_cost(reserva: Roster, titulares: list[Roster]) -> None:
    """Reserva deve custar <= custo do titular mais barato."""
    min_titular_cost = min(
        (r.effective_cost or 0) for r in titulares
    )
    reserve_cost = reserva.effective_cost or 0
    if reserve_cost > min_titular_cost:
        raise ValueError(
            f"Reserva (custo {reserve_cost}) não pode custar mais que o "
            f"titular mais barato (custo {min_titular_cost})"
        )


def _validate_budget(rosters: list[Roster]) -> int:
    """Valida budget cap dos titulares (reserva não conta). Retorna total_cost."""
    total_cost = sum(r.effective_cost or 0 for r in rosters)
    if total_cost > BUDGET_CAP:
        raise ValueError(
            f"Budget excedido: custo total {total_cost} > cap {BUDGET_CAP}"
        )
    return total_cost
