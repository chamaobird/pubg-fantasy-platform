# app/services/lineup_scoring.py
"""
Lineup Scoring Service — Fase 7 / #070 #071 #072

Responsável por:
  #070 — Calcular points_earned por LineupPlayer após cada dia
         (aplicar captain_multiplier configurado na Stage)
  #071 — Atualizar total_points no Lineup após scoring
  #072 — Calcular/atualizar UserDayStat e UserStageStat após cada dia

Fluxo de execução (chamado pelo APScheduler após cada StageDay):
  score_stage_day(db, stage_day_id)
    ├── Para cada Lineup válido do dia:
    │     ├── Para cada LineupPlayer:
    │     │     └── busca MatchStat do person na partida do dia
    │     │         soma fantasy_points de todas as partidas do dia
    │     │         aplica captain_multiplier se is_captain
    │     │         → grava LineupPlayer.points_earned
    │     ├── soma points_earned dos titulares → Lineup.total_points
    │     └── upsert UserDayStat
    └── recalcula UserStageStat para todos os usuários afetados

Notas:
  - Reservas NÃO contam para o total de pontos (só titulares)
  - Idempotente: pode ser re-executado sem duplicar pontos
  - captain_multiplier é lido da Stage (campo configurável por torneio)
  - Se não houver nenhum MatchStat para o dia, points_earned = 0 (não None)
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from app.models import Stage, StageDay
from app.models.lineup import Lineup, LineupPlayer
from app.models.match import Match
from app.models.match_stat import MatchStat
from app.models.roster import Roster
from app.models.user_stat import UserDayStat, UserStageStat

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Entry point principal — chamado pelo APScheduler
# ---------------------------------------------------------------------------

def score_stage_day(db: Session, stage_day_id: int) -> dict:
    """
    Calcula pontos de todos os lineups válidos de um StageDay.

    Args:
        db:            sessão SQLAlchemy
        stage_day_id:  ID do StageDay a ser pontuado

    Returns:
        resumo com contadores

    Raises:
        ValueError: se StageDay não encontrado
    """
    stage_day = db.query(StageDay).filter(StageDay.id == stage_day_id).first()
    if not stage_day:
        raise ValueError(f"StageDay {stage_day_id} não encontrado")

    stage: Stage = stage_day.stage
    captain_multiplier = float(stage.captain_multiplier or 1.3)

    # Pré-carrega todos os MatchStat do dia indexados por person_id
    # (pode haver múltiplas partidas no mesmo dia)
    match_stats_by_person = _load_match_stats_for_day(db, stage_day_id)

    # Todos os lineups válidos do dia
    lineups = (
        db.query(Lineup)
        .filter(
            Lineup.stage_day_id == stage_day_id,
            Lineup.is_valid == True,  # noqa: E712
        )
        .all()
    )

    scored_lineups = 0
    affected_users: set[str] = set()

    for lineup in lineups:
        try:
            _score_lineup(
                db=db,
                lineup=lineup,
                match_stats_by_person=match_stats_by_person,
                captain_multiplier=captain_multiplier,
            )
            affected_users.add(lineup.user_id)
            scored_lineups += 1
        except Exception as exc:
            logger.error(
                "[LineupScoring] Erro ao pontuar lineup_id=%s user=%s: %s",
                lineup.id, lineup.user_id, exc, exc_info=True,
            )

    db.flush()

    # Atualiza UserStageStat para todos os usuários afetados
    for user_id in affected_users:
        _upsert_user_stage_stat(db, user_id, stage.id)

    db.commit()

    logger.info(
        "[LineupScoring] stage_day=%s — %d lineups pontuados, %d usuários afetados",
        stage_day_id, scored_lineups, len(affected_users),
    )
    return {
        "stage_day_id":    stage_day_id,
        "lineups_scored":  scored_lineups,
        "users_affected":  len(affected_users),
        "captain_multiplier": captain_multiplier,
    }


# ---------------------------------------------------------------------------
# Pontuação de um único lineup (#070 + #071 + #072)
# ---------------------------------------------------------------------------

def _score_lineup(
    db: Session,
    lineup: Lineup,
    match_stats_by_person: dict[int, float],
    captain_multiplier: float,
) -> None:
    """
    Calcula points_earned para cada LineupPlayer e atualiza Lineup.total_points
    e UserDayStat.
    """
    total_points = Decimal("0.00")

    for lp in lineup.players:
        raw_pts = match_stats_by_person.get(lp.roster.person_id, 0.0)
        pts = Decimal(str(round(raw_pts, 2)))

        if lp.is_captain:
            pts = (pts * Decimal(str(captain_multiplier))).quantize(Decimal("0.01"))

        lp.points_earned = pts

        # Apenas titulares somam ao total (#071)
        if lp.slot_type == "titular":
            total_points += pts

    lineup.total_points = total_points

    # Upsert UserDayStat (#072)
    _upsert_user_day_stat(db, lineup.user_id, lineup.stage_day_id, total_points)

    logger.debug(
        "[LineupScoring] lineup_id=%s user=%s total=%.2f",
        lineup.id, lineup.user_id, total_points,
    )


# ---------------------------------------------------------------------------
# UserDayStat — upsert (#072)
# ---------------------------------------------------------------------------

def _upsert_user_day_stat(
    db: Session,
    user_id: str,
    stage_day_id: int,
    points: Decimal,
) -> UserDayStat:
    stat = (
        db.query(UserDayStat)
        .filter(
            UserDayStat.user_id == user_id,
            UserDayStat.stage_day_id == stage_day_id,
        )
        .first()
    )
    if stat:
        stat.points = points
        stat.updated_at = datetime.now(timezone.utc)
    else:
        stat = UserDayStat(
            user_id=user_id,
            stage_day_id=stage_day_id,
            points=points,
        )
        db.add(stat)
    return stat


# ---------------------------------------------------------------------------
# UserStageStat — recalculo a partir dos UserDayStat (#072)
# ---------------------------------------------------------------------------

def _upsert_user_stage_stat(
    db: Session,
    user_id: str,
    stage_id: int,
) -> UserStageStat:
    """
    Recalcula UserStageStat somando todos os UserDayStat do usuário na stage.
    Também computa survival_secs e captain_pts para desempate no campeonato.
    Idempotente.
    """
    # total_points + days_played
    result = (
        db.query(
            func.sum(UserDayStat.points).label("total"),
            func.count(UserDayStat.id).label("days"),
        )
        .join(StageDay, UserDayStat.stage_day_id == StageDay.id)
        .filter(
            UserDayStat.user_id == user_id,
            StageDay.stage_id == stage_id,
        )
        .first()
    )

    total_points = Decimal(str(result.total or 0))
    days_played  = int(result.days or 0)

    # captain_pts: soma de points_earned dos jogadores capitão nos lineups válidos
    captain_pts_val = (
        db.query(func.coalesce(func.sum(LineupPlayer.points_earned), 0))
        .join(Lineup, LineupPlayer.lineup_id == Lineup.id)
        .join(StageDay, Lineup.stage_day_id == StageDay.id)
        .filter(
            Lineup.user_id == user_id,
            Lineup.is_valid == True,  # noqa: E712
            StageDay.stage_id == stage_id,
            LineupPlayer.is_captain == True,  # noqa: E712
        )
        .scalar()
    )
    captain_pts = Decimal(str(captain_pts_val or 0))

    # survival_secs: soma do tempo de sobrevivência dos titulares nos lineups válidos
    survival_secs_val = (
        db.query(func.coalesce(func.sum(MatchStat.survival_time), 0))
        .join(Match, MatchStat.match_id == Match.id)
        .join(StageDay, Match.stage_day_id == StageDay.id)
        .join(Roster, MatchStat.person_id == Roster.person_id)
        .join(LineupPlayer, LineupPlayer.roster_id == Roster.id)
        .join(Lineup, and_(
            LineupPlayer.lineup_id == Lineup.id,
            Lineup.user_id == user_id,
            Lineup.stage_day_id == StageDay.id,
            Lineup.is_valid == True,  # noqa: E712
        ))
        .filter(
            StageDay.stage_id == stage_id,
            LineupPlayer.slot_type == "titular",
        )
        .scalar()
    )
    survival_secs = int(survival_secs_val or 0)

    stat = (
        db.query(UserStageStat)
        .filter(
            UserStageStat.user_id == user_id,
            UserStageStat.stage_id == stage_id,
        )
        .first()
    )

    if stat:
        stat.total_points  = total_points
        stat.days_played   = days_played
        stat.survival_secs = survival_secs
        stat.captain_pts   = captain_pts
        stat.updated_at    = datetime.now(timezone.utc)
    else:
        stat = UserStageStat(
            user_id=user_id,
            stage_id=stage_id,
            total_points=total_points,
            days_played=days_played,
            survival_secs=survival_secs,
            captain_pts=captain_pts,
        )
        db.add(stat)

    return stat


# ---------------------------------------------------------------------------
# Recálculo completo de uma stage (admin / reprocess)
# ---------------------------------------------------------------------------

def rescore_stage(db: Session, stage_id: int) -> dict:
    """
    Re-executa score_stage_day para todos os StageDays de uma stage.
    Útil após correção de MatchStat ou reprocess de partidas.

    Idempotente — sobrescreve pontos anteriores.
    """
    stage = db.query(Stage).filter(Stage.id == stage_id).first()
    if not stage:
        raise ValueError(f"Stage {stage_id} não encontrada")

    days = (
        db.query(StageDay)
        .filter(StageDay.stage_id == stage_id)
        .order_by(StageDay.day_number)
        .all()
    )

    total_lineups = 0
    for day in days:
        summary = score_stage_day(db, day.id)
        total_lineups += summary["lineups_scored"]

    # Recalcula ranks após todos os dias
    _recalculate_stage_ranks(db, stage_id)

    logger.info(
        "[LineupScoring] rescore_stage: stage=%s — %d days, %d lineups",
        stage_id, len(days), total_lineups,
    )
    return {
        "stage_id":      stage_id,
        "days_processed": len(days),
        "lineups_scored": total_lineups,
    }


# ---------------------------------------------------------------------------
# Rankings — calculados após scoring completo do dia
# ---------------------------------------------------------------------------

def calculate_day_ranks(db: Session, stage_day_id: int) -> int:
    """
    Calcula e grava UserDayStat.rank para todos os usuários do dia.
    Retorna número de registros atualizados.
    """
    stats = (
        db.query(UserDayStat)
        .filter(UserDayStat.stage_day_id == stage_day_id)
        .order_by(UserDayStat.points.desc())
        .all()
    )

    for rank, stat in enumerate(stats, start=1):
        stat.rank = rank

    db.flush()
    return len(stats)


def _recalculate_stage_ranks(db: Session, stage_id: int) -> int:
    """
    Calcula e grava UserStageStat.rank para uma stage inteira.
    Retorna número de registros atualizados.
    """
    stats = (
        db.query(UserStageStat)
        .filter(UserStageStat.stage_id == stage_id)
        .order_by(UserStageStat.total_points.desc())
        .all()
    )

    for rank, stat in enumerate(stats, start=1):
        stat.rank = rank

    db.flush()
    return len(stats)


# ---------------------------------------------------------------------------
# Helper — carrega MatchStat do dia, agrupados por person_id
# ---------------------------------------------------------------------------

def _load_match_stats_for_day(
    db: Session,
    stage_day_id: int,
) -> dict[int, float]:
    """
    Retorna {person_id: total_fantasy_points} somando todas as partidas do dia.
    """
    from sqlalchemy import func

    rows = (
        db.query(
            MatchStat.person_id,
            func.sum(MatchStat.fantasy_points).label("total_pts"),
        )
        .join(Match, MatchStat.match_id == Match.id)
        .filter(Match.stage_day_id == stage_day_id)
        .group_by(MatchStat.person_id)
        .all()
    )

    return {row.person_id: float(row.total_pts or 0) for row in rows}
