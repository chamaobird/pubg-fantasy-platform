# app/routers/admin/seatlon.py
"""
Admin endpoints para o Seatlon Monitor.

POST /admin/seatlon/scan
  Trigger manual do monitor. Retorna novos tournament IDs detectados
  e indica se email foi enviado ao ADMIN_EMAIL.

GET /admin/seatlon/assigned
  Lista todos os Stage.pubg_tournament_id já atribuídos no banco.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin
from app.models.user import User

router = APIRouter(
    prefix="/admin/seatlon",
    tags=["Admin — Seatlon Monitor"],
    dependencies=[Depends(require_admin)],
)


@router.post("/scan")
def scan_seatlon(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> dict:
    """
    Trigger manual do Seatlon Monitor.

    Busca tournament IDs ativos no seatlon.eu e retorna os que ainda não
    estão atribuídos a nenhum Stage.pubg_tournament_id.

    Envia email ao ADMIN_EMAIL se ADMIN_EMAIL estiver configurado e houver novos IDs.
    """
    from app.services.seatlon_monitor import scan_new_tournaments
    return scan_new_tournaments(db)


@router.get("/unassigned")
def list_unassigned_tournament_ids(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> dict:
    """
    Lista tournament IDs ativos no seatlon.eu que ainda não estão atribuídos
    a nenhum Stage. Não envia email — usado pela UI de admin para o painel
    de atribuição rápida.
    """
    from app.services.seatlon_monitor import (
        _fetch_seatlon_tournaments,
        _get_assigned_tournament_ids,
        _is_relevant,
    )

    tournaments = _fetch_seatlon_tournaments()
    assigned = _get_assigned_tournament_ids(db)

    unassigned = [
        {
            "tournament_id": t.tournament_id,
            "matches_count": t.matches_count,
            "pubg_created_at": t.pubg_created_at[:10] if t.pubg_created_at else None,
        }
        for t in tournaments
        if t.active and _is_relevant(t.tournament_id) and t.tournament_id not in assigned
    ]

    return {"count": len(unassigned), "unassigned": unassigned}


@router.get("/assigned")
def list_assigned_tournament_ids(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> dict:
    """
    Lista todos os pubg_tournament_id já atribuídos a stages no banco,
    com o nome do stage e championship associado.
    """
    from app.models.championship import Championship
    from app.models.stage import Stage
    from sqlalchemy.orm import joinedload

    stages = (
        db.query(Stage)
        .options(joinedload(Stage.championship))
        .filter(Stage.pubg_tournament_id.isnot(None))
        .order_by(Stage.id.desc())
        .all()
    )

    return {
        "count": len(stages),
        "assignments": [
            {
                "stage_id":            s.id,
                "stage_name":          s.name,
                "championship_name":   s.championship.name if s.championship else None,
                "pubg_tournament_id":  s.pubg_tournament_id,
                "shard":               s.shard,
            }
            for s in stages
        ],
    }
