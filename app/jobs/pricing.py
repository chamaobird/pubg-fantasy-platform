# app/jobs/pricing.py
"""
Job de recálculo automático de pricing — #053

Roda a cada 30 minutos (agendado via APScheduler).
Recalcula o fantasy_cost de todas as stages ativas cujo lineup ainda não
está locked — onde o pricing ainda pode impactar decisões de usuário.
"""
from __future__ import annotations

import logging

from app.database import SessionLocal
from app.models.stage import Stage
from app.services import pricing as pricing_service

logger = logging.getLogger(__name__)


def run_pricing_job() -> None:
    """Entry point chamado pelo APScheduler."""
    db = SessionLocal()
    try:
        _recalculate_active_stages(db)
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Erro no job de pricing — rollback realizado.")
    finally:
        db.close()


def _recalculate_active_stages(db) -> None:
    stages: list[Stage] = (
        db.query(Stage)
        .filter(
            Stage.is_active == True,  # noqa: E712
            Stage.lineup_status.in_(["closed", "open"]),
        )
        .all()
    )

    if not stages:
        logger.debug("Pricing job: nenhuma stage elegível para recálculo.")
        return

    logger.info("Pricing job: recalculando %d stage(s).", len(stages))

    total_updated = total_skipped = total_newcomers = 0

    for stage in stages:
        try:
            summary = pricing_service.calculate_stage_pricing(
                stage_id=stage.id,
                db=db,
                source="auto",
            )
            total_updated += summary["updated"]
            total_skipped += summary["skipped"]
            total_newcomers += summary["newcomers"]
        except Exception:
            logger.exception(
                "Pricing job: erro ao recalcular stage_id=%d — continuando.", stage.id
            )

    logger.info(
        "Pricing job concluído — updated=%d skipped=%d newcomers=%d",
        total_updated, total_skipped, total_newcomers,
    )
