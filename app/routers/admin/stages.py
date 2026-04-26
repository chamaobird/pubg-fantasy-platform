# app/routers/admin/stages.py
from __future__ import annotations
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin
from app.models.championship import Championship
from app.models.stage import Stage
from app.models.user import User
from app.schemas.stage import StageCreate, StageResponse, StageUpdate

router = APIRouter(
    prefix="/admin/stages",
    tags=["Admin — Stages"],
    dependencies=[Depends(require_admin)],
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_or_404(db: Session, stage_id: int) -> Stage:
    obj = db.query(Stage).filter(Stage.id == stage_id).first()
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Stage {stage_id} not found",
        )
    return obj


def _validate_championship(db: Session, championship_id: int) -> Championship:
    champ = db.query(Championship).filter(Championship.id == championship_id).first()
    if not champ:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Championship {championship_id} not found",
        )
    if not champ.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Championship {championship_id} is inactive",
        )
    return champ


def _validate_carries_stats_from(db: Session, stage_ids: list[int]) -> None:
    """Ensure all referenced stage_ids actually exist."""
    for sid in stage_ids:
        if not db.query(Stage).filter(Stage.id == sid).first():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Stage {sid} referenced in carries_stats_from not found",
            )


def _validate_roster_source(db: Session, stage_id: int) -> None:
    if not db.query(Stage).filter(Stage.id == stage_id).first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Stage {stage_id} referenced in roster_source_stage_id not found",
        )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("", response_model=StageResponse, status_code=status.HTTP_201_CREATED)
def create_stage(
    body: StageCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> Stage:
    _validate_championship(db, body.championship_id)

    if body.carries_stats_from:
        _validate_carries_stats_from(db, body.carries_stats_from)

    if body.roster_source_stage_id:
        _validate_roster_source(db, body.roster_source_stage_id)

    stage = Stage(**body.model_dump())
    db.add(stage)
    db.commit()
    db.refresh(stage)
    return stage


@router.get("", response_model=list[StageResponse])
def list_stages(
    championship_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> list[Stage]:
    q = db.query(Stage)
    if championship_id is not None:
        q = q.filter(Stage.championship_id == championship_id)
    return q.order_by(Stage.id.desc()).all()


# ── Tournament match discovery ────────────────────────────────────────────────
# IMPORTANTE: deve ficar ANTES de /{stage_id} — FastAPI respeita ordem de registro.

@router.get("/tournament-matches")
def list_tournament_matches(
    tournament_id: str,
    db: Session = Depends(get_db),
):
    """
    Busca todos os match IDs de um torneio na PUBG API e cruza com o banco
    para indicar quais já foram importados.
    Retorna lista ordenada: novos primeiro, depois importados.
    """
    from app.services.match_discovery import discover_matches_tournament
    from app.models.match import Match

    all_ids = discover_matches_tournament(tournament_id)
    if not all_ids:
        return []

    imported_matches = (
        db.query(Match)
        .filter(Match.pubg_match_id.in_(all_ids))
        .all()
    )
    imported_map = {m.pubg_match_id: m for m in imported_matches}

    result = []
    for mid in all_ids:
        m = imported_map.get(mid)
        result.append({
            "match_id": mid,
            "imported": m is not None,
            "stage_day_id": m.stage_day_id if m else None,
            "played_at": m.played_at.isoformat() if m and m.played_at else None,
        })

    result.sort(key=lambda x: x["imported"])  # novos primeiro
    return result


@router.get("/{stage_id}", response_model=StageResponse)
def get_stage(
    stage_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> Stage:
    return _get_or_404(db, stage_id)


@router.patch("/{stage_id}", response_model=StageResponse)
def update_stage(
    stage_id: int,
    body: StageUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> Stage:
    stage = _get_or_404(db, stage_id)

    updates = body.model_dump(exclude_unset=True)

    if "carries_stats_from" in updates and updates["carries_stats_from"]:
        _validate_carries_stats_from(db, updates["carries_stats_from"])

    if "roster_source_stage_id" in updates and updates["roster_source_stage_id"]:
        _validate_roster_source(db, updates["roster_source_stage_id"])

    # Guard: lineup_status só aceita transições válidas (closed ↔ open ↔ locked)
    # stage_phase é livre — admin pode mudar upcoming/live/finished a qualquer momento
    if "lineup_status" in updates:
        new_status = updates["lineup_status"]
        current = stage.lineup_status
        valid_transitions = {
            "closed": {"open", "locked"},
            "open":   {"locked", "closed"},
            "locked": {"open", "closed"},
        }
        if new_status != current and new_status not in valid_transitions.get(current, set()):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot transition lineup_status from '{current}' to '{new_status}'",
            )

    for field, value in updates.items():
        setattr(stage, field, value)

    db.commit()
    db.refresh(stage)
    return stage


@router.delete("/{stage_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_stage(
    stage_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> None:
    """
    Hard delete — only allowed if stage has no days or matches attached.
    Stages with activity should be managed via championship deactivation.
    """
    from app.models.stage_day import StageDay

    stage = _get_or_404(db, stage_id)

    has_days = db.query(StageDay).filter(StageDay.stage_id == stage_id).first()
    if has_days:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete a stage that already has days. Deactivate the championship instead.",
        )

    db.delete(stage)
    db.commit()
