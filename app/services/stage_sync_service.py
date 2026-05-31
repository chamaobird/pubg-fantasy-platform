# app/services/stage_sync_service.py
"""
Stage Sync Scheduler — executa match import + scoring para stages com
pubg_tournament_id configurado, dentro de uma janela de tempo definida pelo admin.

Fluxo por tick (a cada 5 min via APScheduler):
  Para cada StageSyncSchedule com status in (pending, active):
    1. Se run_from > now → pula (janela futura)
    2. Se run_until < now → marca completed
    3. Se intervalo não passou → pula
    4. Executa _execute_sync: chama _process_day para cada stage_day do stage
    5. Atualiza last_run_at, runs_count, status
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.stage_sync_schedule import StageSyncSchedule

logger = logging.getLogger(__name__)


# ── Entry point do APScheduler ────────────────────────────────────────────────

def run_due_schedules(db: Session) -> dict:
    """Verifica e executa todos os schedules devidos. Chamado a cada 5 min."""
    now = datetime.now(timezone.utc)

    schedules = (
        db.query(StageSyncSchedule)
        .filter(StageSyncSchedule.status.in_(["pending", "active"]))
        .all()
    )

    ran = completed = skipped = 0

    for sched in schedules:
        try:
            outcome = _maybe_run(db, sched, now)
            if outcome == "ran":
                ran += 1
            elif outcome == "completed":
                completed += 1
            else:
                skipped += 1
        except Exception as exc:
            logger.error(
                "[StageSyncService] schedule=%s erro inesperado: %s",
                sched.id, exc, exc_info=True,
            )

    return {"ran": ran, "completed": completed, "skipped": skipped}


# ── Lógica de decisão ─────────────────────────────────────────────────────────

def _maybe_run(db: Session, sched: StageSyncSchedule, now: datetime) -> str:
    """Decide se executa o schedule. Retorna 'ran' | 'completed' | 'skipped'."""

    # Janela futura ainda não chegou
    if sched.run_from and now < sched.run_from:
        return "skipped"

    # Passou do run_until — encerra
    if now > sched.run_until:
        sched.status = "completed"
        db.add(sched)
        db.commit()
        logger.info("[StageSyncService] schedule=%s → completed (expirou sem runs)", sched.id)
        return "completed"

    # Verifica intervalo desde o último run
    if sched.last_run_at is not None:
        next_run = sched.last_run_at + timedelta(minutes=int(sched.interval_min))
        if now < next_run:
            return "skipped"

    # Executa
    _execute_sync(db, sched, now)

    # Atualiza status
    sched.status = "completed" if now >= sched.run_until else "active"
    db.add(sched)
    db.commit()

    if sched.status == "completed":
        logger.info("[StageSyncService] schedule=%s → completed após run #%d", sched.id, sched.runs_count)

    return "ran"


# ── Execução do sync ──────────────────────────────────────────────────────────

def _execute_sync(db: Session, sched: StageSyncSchedule, now: datetime) -> None:
    """
    Para pc-tournament: descobre partidas via tournament API e atribui ao StageDay
    correto pelo played_at — sem precisar de match_schedule.
    Para steam: fallback ao path antigo (match_schedule obrigatório).
    """
    from app.models.stage import Stage

    stage = db.query(Stage).filter(Stage.id == sched.stage_id).first()
    if not stage:
        logger.warning("[StageSyncService] schedule=%s — stage=%s não encontrado", sched.id, sched.stage_id)
        _bump(sched, now)
        return

    if not stage.pubg_tournament_id:
        logger.warning("[StageSyncService] schedule=%s — stage=%s sem pubg_tournament_id", sched.id, sched.stage_id)
        _bump(sched, now)
        return

    if stage.shard == "pc-tournament":
        new_imports, unresolved = _execute_tournament_sync(db, sched, stage, now)
        # Store unresolved in notes for admin visibility
        import json
        try:
            notes_data = json.loads(sched.notes) if sched.notes else {}
        except (ValueError, TypeError):
            notes_data = {}
        notes_data["last_unresolved"] = sorted(unresolved)
        notes_data["last_import_count"] = new_imports
        sched.notes = json.dumps(notes_data)
    else:
        new_imports = _execute_legacy_sync(db, sched, stage, now)
        unresolved = []

    _bump(sched, now)
    logger.info(
        "[StageSyncService] schedule=%s stage=%s run#%d — %d novos imports, %d unresolved",
        sched.id, sched.stage_id, sched.runs_count, new_imports, len(unresolved),
    )


def _execute_tournament_sync(
    db: Session,
    sched: StageSyncSchedule,
    stage,
    now: datetime,
) -> tuple[int, list[str]]:
    """
    Descobre todos os matches do tournament API, atribui ao StageDay correto
    pelo played_at vs lineup_close_at, importa e auto-pontua se limpo.
    """
    from app.models.stage_day import StageDay
    from app.services.match_discovery import discover_matches_tournament_with_dates
    from app.services.import_ import import_stage_matches
    from sqlalchemy import text as sql_text

    # Get stage days ordered by day_number
    days = (
        db.query(StageDay)
        .filter(StageDay.stage_id == stage.id)
        .order_by(StageDay.day_number)
        .all()
    )
    if not days:
        logger.info("[StageSyncService] stage=%s — sem stage_days", stage.id)
        return 0, []

    # Already-imported match IDs for this stage (any day)
    imported_rows = db.execute(
        sql_text("""
            SELECT m.pubg_match_id FROM match m
            JOIN stage_day sd ON sd.id = m.stage_day_id
            WHERE sd.stage_id = :sid
        """),
        {"sid": stage.id},
    ).fetchall()
    already_imported = {r[0] for r in imported_rows}

    # Fetch all matches from tournament API
    matches_with_dates = discover_matches_tournament_with_dates(stage.pubg_tournament_id)
    if not matches_with_dates:
        logger.info("[StageSyncService] stage=%s — nenhum match na tournament API", stage.id)
        return 0, []

    new_to_import: list[tuple[str, int]] = []  # (pubg_match_id, stage_day_id)
    for pubg_match_id, played_at_str in matches_with_dates.items():
        if pubg_match_id in already_imported:
            continue
        target_day = _find_day_for_match(days, played_at_str)
        if not target_day:
            continue
        # Don't import Day N matches before first_match_at of that day
        if target_day.first_match_at and played_at_str:
            try:
                played_at = datetime.fromisoformat(played_at_str.replace("Z", "+00:00"))
                if played_at < target_day.first_match_at:
                    continue
            except ValueError:
                pass
        new_to_import.append((pubg_match_id, target_day.id))

    if not new_to_import:
        return 0, []

    # Group by stage_day_id for batch import
    from collections import defaultdict
    by_day: dict[int, list[str]] = defaultdict(list)
    for mid, day_id in new_to_import:
        by_day[day_id].append(mid)

    total_imported = 0
    all_unresolved: list[str] = []

    for day_id, match_ids in by_day.items():
        try:
            result = import_stage_matches(
                db=db,
                stage_id=stage.id,
                pubg_match_ids=match_ids,
                stage_day_id=day_id,
                force_reprocess=False,
            )
            total_imported += result.get("imported", 0)
            all_unresolved.extend(result.get("unresolved_players", []))
        except Exception as exc:
            logger.error("[StageSyncService] Erro import day=%s: %s", day_id, exc, exc_info=True)

    # Auto-score each day that has all its matches AND no unresolved players
    if total_imported > 0 and not all_unresolved:
        for day in days:
            _maybe_auto_score(db, day, stage)
    elif all_unresolved:
        logger.warning(
            "[StageSyncService] stage=%s — auto-score bloqueado: %d alias(es) não resolvido(s): %s",
            stage.id, len(all_unresolved), all_unresolved,
        )

    return total_imported, list(set(all_unresolved))


def _find_day_for_match(days: list, played_at_str) -> object | None:
    """
    Determina o StageDay correto para um match pelo seu played_at.

    Regra: match pertence ao dia N quando played_at >= Day_N.lineup_close_at
    e (played_at < Day_{N+1}.lineup_close_at ou Day N é o último).
    Fallback: último dia se sem timestamp.
    """
    if not played_at_str or not days:
        return days[-1] if days else None

    try:
        played_at = datetime.fromisoformat(played_at_str.replace("Z", "+00:00"))
    except ValueError:
        return days[-1] if days else None

    # Find the last day whose lineup_close_at <= played_at
    target = None
    for day in days:
        if day.lineup_close_at and played_at >= day.lineup_close_at:
            target = day
    return target or days[0]


def _maybe_auto_score(db: Session, stage_day, stage) -> None:
    """Auto-score um StageDay se end_date passou e há match_stats."""
    from datetime import timezone as tz
    from app.jobs.scoring_job import _has_match_stats

    now = datetime.now(tz.utc)
    end_passed = stage.end_date and now >= stage.end_date

    # For independent_lineups: score each day independently when its next day starts
    # or when end_date passed for the last day
    if stage.independent_lineups:
        # Check if this day's window has closed (next day started or end_date passed)
        from app.models.stage_day import StageDay
        next_day = (
            db.query(StageDay)
            .filter(
                StageDay.stage_id == stage.id,
                StageDay.day_number == stage_day.day_number + 1,
            )
            .first()
        )
        day_window_closed = (
            (next_day and next_day.lineup_close_at and now >= next_day.lineup_close_at)
            or (not next_day and end_passed)
        )
        if not day_window_closed:
            return
    else:
        if not end_passed:
            return

    if not _has_match_stats(db, stage_day.id):
        return

    try:
        from app.services.lineup_scoring import score_stage_day, calculate_day_ranks
        summary = score_stage_day(db, stage_day.id)
        calculate_day_ranks(db, stage_day.id)
        db.commit()
        logger.info("[StageSyncService] Auto-scoring stage_day=%s: %s", stage_day.id, summary)
    except Exception as exc:
        db.rollback()
        logger.error("[StageSyncService] Erro auto-score stage_day=%s: %s", stage_day.id, exc, exc_info=True)


def _execute_legacy_sync(db: Session, sched: StageSyncSchedule, stage, now: datetime) -> int:
    """Fallback para stages steam que usam match_schedule."""
    from app.models.stage_day import StageDay
    from app.jobs.match_import_job import _process_day

    days = (
        db.query(StageDay)
        .filter(
            StageDay.stage_id == sched.stage_id,
            StageDay.match_schedule.isnot(None),
        )
        .all()
    )

    if not days:
        logger.info("[StageSyncService] schedule=%s stage=%s — sem stage_days com match_schedule", sched.id, sched.stage_id)
        return 0

    new_imports = 0
    for day in days:
        before = _count_processed(day)
        try:
            _process_day(db, day, now)
        except Exception as exc:
            logger.error("[StageSyncService] schedule=%s stage_day=%s erro: %s", sched.id, day.id, exc, exc_info=True)
        after = _count_processed(day)
        new_imports += max(0, after - before)

    return new_imports


def _bump(sched: StageSyncSchedule, now: datetime) -> None:
    sched.last_run_at = now
    sched.runs_count = (sched.runs_count or 0) + 1


def _count_processed(day) -> int:
    return sum(1 for e in (day.match_schedule or []) if e.get("processed_at"))


# ── Trigger manual ────────────────────────────────────────────────────────────

def trigger_now(db: Session, schedule_id: int) -> dict:
    """Admin trigger imediato — ignora o intervalo normal."""
    sched = db.query(StageSyncSchedule).filter(StageSyncSchedule.id == schedule_id).first()
    if not sched:
        raise ValueError(f"Schedule {schedule_id} não encontrado")
    if sched.status == "cancelled":
        raise ValueError("Schedule cancelado — não pode ser executado")

    now = datetime.now(timezone.utc)
    _execute_sync(db, sched, now)

    sched.status = "completed" if now >= sched.run_until else "active"
    db.add(sched)
    db.commit()

    return {
        "schedule_id": schedule_id,
        "ran_at": now.isoformat(),
        "runs_count": sched.runs_count,
        "status": sched.status,
    }
