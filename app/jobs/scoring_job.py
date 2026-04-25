# app/jobs/scoring_job.py
"""
APScheduler Job — Daily Scoring / Fase 7 / #070 #071 #072

Roda a cada minuto (junto com lineup_control) e detecta StageDays
que foram travados (lineup_status == 'locked') mas ainda não foram pontuados.

Critério para pontuar um StageDay:
  - Stage com lineup_status == 'locked' (inclui stages live e finished)
  - StageDay com date == hoje (UTC)
  - Existem MatchStats para o dia (partidas já importadas)
  - Lineup.total_points ainda é NULL em pelo menos um lineup válido do dia

Nunca lança exceção — erros são logados para não derrubar o scheduler.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Stage, StageDay
from app.models.lineup import Lineup
from app.models.match import Match
from app.models.match_stat import MatchStat
from app.services.lineup_scoring import calculate_day_ranks, score_stage_day

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Job principal
# ---------------------------------------------------------------------------

def run_scoring_job() -> None:
    """
    Detecta StageDays prontos para scoring e executa.
    """
    db: Session = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        _process_pending_scoring(db, now)
    except Exception as exc:
        logger.error("[ScoringJob] Erro inesperado: %s", exc, exc_info=True)
    finally:
        db.close()


def _process_pending_scoring(db: Session, now: datetime) -> None:
    today     = now.date()
    yesterday = today - timedelta(days=1)

    # Stages com lineup travado — elegíveis para scoring (inclui stage_phase live e finished)
    locked_stages = (
        db.query(Stage)
        .filter(Stage.lineup_status == "locked")
        .all()
    )

    for stage in locked_stages:
        # Aceita date == hoje OU ontem — cobre partidas noturnas que
        # começam antes de meia-noite UTC e terminam no dia seguinte
        stage_day = (
            db.query(StageDay)
            .filter(
                StageDay.stage_id == stage.id,
                StageDay.date.in_([today, yesterday]),
            )
            .first()
        )
        if not stage_day:
            continue

        if not _has_match_stats(db, stage_day.id):
            logger.debug(
                "[ScoringJob] stage_day=%s — sem MatchStats ainda, aguardando import",
                stage_day.id,
            )
            continue

        if not _needs_scoring(db, stage_day.id):
            continue

        try:
            summary = score_stage_day(db, stage_day.id)
            calculate_day_ranks(db, stage_day.id)
            db.commit()
            logger.info(
                "[ScoringJob] stage_day=%s pontuado: %s",
                stage_day.id, summary,
            )
        except Exception as exc:
            db.rollback()
            logger.error(
                "[ScoringJob] Erro ao pontuar stage_day=%s: %s",
                stage_day.id, exc, exc_info=True,
            )


def _has_match_stats(db: Session, stage_day_id: int) -> bool:
    """Verifica se há MatchStat importados para o dia."""
    return (
        db.query(MatchStat)
        .join(Match, MatchStat.match_id == Match.id)
        .filter(Match.stage_day_id == stage_day_id)
        .first()
    ) is not None


def _needs_scoring(db: Session, stage_day_id: int) -> bool:
    """
    Retorna True se existe ao menos um Lineup válido do dia
    com total_points ainda NULL.
    """
    return (
        db.query(Lineup)
        .filter(
            Lineup.stage_day_id == stage_day_id,
            Lineup.is_valid == True,  # noqa: E712
            Lineup.total_points == None,  # noqa: E711
        )
        .first()
    ) is not None
