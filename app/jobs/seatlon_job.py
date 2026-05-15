# app/jobs/seatlon_job.py
"""
Seatlon Monitor Job — roda a cada 6 horas via APScheduler.

Detecta novos tournament IDs ativos no seatlon.eu e envia email ao admin
quando IDs relevantes (am-pas, eu-pec, as-pgs...) não estão atribuídos
a nenhum Stage.pubg_tournament_id.
"""
from __future__ import annotations

import logging

from app.database import SessionLocal
from app.services.seatlon_monitor import scan_new_tournaments

logger = logging.getLogger(__name__)


def run_seatlon_monitor() -> None:
    db = SessionLocal()
    try:
        result = scan_new_tournaments(db)
        logger.info(
            "[SeatloNJob] fetched=%d relevant_active=%d new=%d email_sent=%s ids=%s",
            result["fetched"],
            result["relevant_active"],
            result["new"],
            result["email_sent"],
            result["new_ids"],
        )
    except Exception as exc:
        logger.error("[SeatloNJob] Erro: %s", exc, exc_info=True)
    finally:
        db.close()
