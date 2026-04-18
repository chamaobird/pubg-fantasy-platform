# app/jobs/match_import_job.py
"""
APScheduler Job — Match Import Automático

Roda a cada 2 minutos e processa o match_schedule de cada StageDay ativo.

Fluxo por entrada do schedule:
  1. Se import_after <= now() e a partida ainda não foi importada:
     a. Descobre match IDs via match_discovery (overlap p/ steam, tournament API p/ pc-tournament)
     b. Importa os matches encontrados via import_stage_matches
     c. Marca a entrada como processada (sets processed_at)
  2. Se for a última entrada do schedule E end_date da Stage passou:
     → dispara scoring do dia automaticamente

Tolerância a atrasos:
  - Se nenhum match for encontrado na primeira tentativa, a entrada permanece
    pendente e será retentada no próximo ciclo (2 min depois).
  - O admin pode importar manualmente pelo painel enquanto isso.

Nunca lança exceção — erros são logados para não derrubar o scheduler.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.stage import Stage
from app.models.stage_day import StageDay
from app.models.match import Match

logger = logging.getLogger(__name__)

# Quantas horas após import_after ainda tentamos (evita rodar indefinidamente)
MAX_RETRY_HOURS = 3


def run_match_import_job() -> None:
    db: Session = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        _process_all_days(db, now)
    except Exception as exc:
        logger.error("[MatchImportJob] Erro inesperado: %s", exc, exc_info=True)
    finally:
        db.close()


def _process_all_days(db: Session, now: datetime) -> None:
    # StageDays ativos com schedule definido, cuja stage está locked (lineup fechado)
    active_days = (
        db.query(StageDay)
        .join(Stage, Stage.id == StageDay.stage_id)
        .filter(
            Stage.is_active == True,           # noqa: E712
            Stage.lineup_status == "locked",
            StageDay.match_schedule.isnot(None),
        )
        .all()
    )

    for stage_day in active_days:
        try:
            _process_day(db, stage_day, now)
        except Exception as exc:
            logger.error(
                "[MatchImportJob] Erro ao processar stage_day=%s: %s",
                stage_day.id, exc, exc_info=True,
            )


def _process_day(db: Session, stage_day: StageDay, now: datetime) -> None:
    schedule: list[dict] = stage_day.match_schedule or []
    stage: Stage = stage_day.stage

    # match IDs já importados para este dia
    already_imported = _get_imported_match_ids(db, stage_day.id)

    pending = [
        entry for entry in schedule
        if not entry.get("processed_at")
        and _is_due(entry, now)
    ]

    if not pending:
        return

    logger.info(
        "[MatchImportJob] stage_day=%s — %d entrada(s) pendente(s)",
        stage_day.id, len(pending),
    )

    imported_any = False
    for entry in pending:
        match_ids = _discover(db, stage, stage_day, entry, already_imported, now)
        if not match_ids:
            logger.info(
                "[MatchImportJob] stage_day=%s match#%s — nenhum match encontrado ainda",
                stage_day.id, entry.get("match_number"),
            )
            continue

        result = _import(db, stage, stage_day, match_ids)
        if result and result.get("imported", 0) > 0:
            entry["processed_at"] = now.isoformat()
            already_imported.update(match_ids)
            imported_any = True
            logger.info(
                "[MatchImportJob] stage_day=%s match#%s — importados %d match(es)",
                stage_day.id, entry.get("match_number"), result["imported"],
            )
        else:
            logger.info(
                "[MatchImportJob] stage_day=%s match#%s — import sem novos matches (já existentes?)",
                stage_day.id, entry.get("match_number"),
            )
            # Mesmo sem novos imports, marca como processado se os matches já existem
            if match_ids and all(mid in already_imported for mid in match_ids):
                entry["processed_at"] = now.isoformat()

    if imported_any:
        # Persiste o schedule atualizado (com processed_at preenchidos)
        stage_day.match_schedule = list(schedule)  # força dirty para JSONB
        stage_day.last_import_at = now
        db.add(stage_day)
        db.commit()

    # Verifica se deve disparar scoring (todos processados + end_date passou)
    all_processed = all(e.get("processed_at") for e in schedule)
    end_passed = stage.end_date and now >= stage.end_date

    if all_processed and end_passed:
        _auto_score(db, stage_day)


def _is_due(entry: dict, now: datetime) -> bool:
    """Verdadeiro se import_after passou e ainda dentro da janela de retry."""
    import_after_raw = entry.get("import_after")
    if not import_after_raw:
        return False
    try:
        import_after = datetime.fromisoformat(import_after_raw.replace("Z", "+00:00"))
    except ValueError:
        return False

    from datetime import timedelta
    cutoff = import_after + timedelta(hours=MAX_RETRY_HOURS)
    return import_after <= now <= cutoff


def _get_imported_match_ids(db: Session, stage_day_id: int) -> set[str]:
    matches = (
        db.query(Match.pubg_match_id)
        .filter(Match.stage_day_id == stage_day_id)
        .all()
    )
    return {row[0] for row in matches}


def _discover(
    db: Session,
    stage: Stage,
    stage_day: StageDay,
    entry: dict,
    already_imported: set[str],
    now: datetime,
) -> list[str]:
    """Descobre match IDs para a entrada do schedule."""
    from datetime import timedelta

    # Se o admin pré-preencheu o pubg_match_id, usa diretamente
    forced_id = entry.get("pubg_match_id")
    if forced_id:
        return [forced_id] if forced_id not in already_imported else []

    import_after_raw = entry.get("import_after", "")
    try:
        reference_dt = datetime.fromisoformat(import_after_raw.replace("Z", "+00:00"))
    except ValueError:
        reference_dt = now

    if stage.shard == "pc-tournament":
        pubg_tournament_id = getattr(stage, "pubg_tournament_id", None)
        if not pubg_tournament_id:
            logger.warning(
                "[MatchImportJob] stage %s usa pc-tournament mas não tem pubg_tournament_id",
                stage.id,
            )
            return []
        from app.services.match_discovery import discover_matches_tournament
        all_ids = discover_matches_tournament(pubg_tournament_id)
        return [mid for mid in all_ids if mid not in already_imported]

    else:  # steam
        from app.services.match_discovery import discover_matches_steam
        return discover_matches_steam(
            db=db,
            stage_id=stage.id,
            reference_dt=reference_dt - timedelta(minutes=5),
            already_imported=already_imported,
        )


def _import(
    db: Session,
    stage: Stage,
    stage_day: StageDay,
    match_ids: list[str],
) -> Optional[dict]:
    """Chama o import service e retorna o resumo."""
    from app.services.import_ import import_stage_matches
    try:
        result = import_stage_matches(
            db=db,
            stage_id=stage.id,
            pubg_match_ids=match_ids,
            stage_day_id=stage_day.id,
            force_reprocess=False,
        )
        return result
    except Exception as exc:
        logger.error(
            "[MatchImportJob] Erro no import stage=%s: %s",
            stage.id, exc, exc_info=True,
        )
        return None


def _auto_score(db: Session, stage_day: StageDay) -> None:
    """Dispara scoring automático do dia após todos os matches importados."""
    from app.services.lineup_scoring import score_stage_day, calculate_day_ranks
    from app.jobs.scoring_job import _has_match_stats

    if not _has_match_stats(db, stage_day.id):
        logger.warning(
            "[MatchImportJob] auto_score: stage_day=%s sem MatchStats, scoring cancelado",
            stage_day.id,
        )
        return

    try:
        summary = score_stage_day(db, stage_day.id)
        calculate_day_ranks(db, stage_day.id)
        db.commit()
        logger.info(
            "[MatchImportJob] Auto-scoring stage_day=%s concluído: %s",
            stage_day.id, summary,
        )
    except Exception as exc:
        db.rollback()
        logger.error(
            "[MatchImportJob] Erro no auto-scoring stage_day=%s: %s",
            stage_day.id, exc, exc_info=True,
        )
