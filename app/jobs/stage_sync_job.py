# app/jobs/stage_sync_job.py
"""
Stage Sync Job — roda a cada 5 minutos via APScheduler.

Varre StageSyncSchedule ativos/pendentes e executa match import + scoring
para stages com pubg_tournament_id, dentro da janela run_from → run_until
configurada pelo admin.
"""
from __future__ import annotations

import logging

from app.database import SessionLocal

logger = logging.getLogger(__name__)


def run_stage_sync_schedules() -> None:
    db = SessionLocal()
    try:
        from app.services.stage_sync_service import run_due_schedules
        result = run_due_schedules(db)
        if result["ran"] or result["completed"]:
            logger.info(
                "[StageSyncJob] ran=%d completed=%d skipped=%d",
                result["ran"], result["completed"], result["skipped"],
            )
    except Exception as exc:
        logger.error("[StageSyncJob] Erro inesperado: %s", exc, exc_info=True)
    finally:
        db.close()
