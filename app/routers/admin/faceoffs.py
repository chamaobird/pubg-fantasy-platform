# app/routers/admin/faceoffs.py
"""
Admin endpoints para gerenciar faceoffs.

GET  /admin/faceoffs/suggest          → sugere 8 pares baseado em performance
POST /admin/faceoffs/bulk             → cria múltiplos faceoffs (draft)
GET  /admin/faceoffs                  → lista faceoffs (filtro por championship)
PATCH /admin/faceoffs/{id}            → editar par ou status
POST /admin/faceoffs/{id}/resolve     → calcula vencedor pelo standing do campeonato
DELETE /admin/faceoffs/{id}           → remove faceoff (apenas draft)
"""
from __future__ import annotations
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin
from app.models.faceoff import Faceoff
from app.models.user import User
from app.services.team_standings import calculate_team_tournament_standings, suggest_faceoff_pairs

router = APIRouter(
    prefix="/admin/faceoffs",
    tags=["Admin — Faceoffs"],
    dependencies=[Depends(require_admin)],
)

VALID_STATUSES = {"draft", "open", "closed", "resolved"}
# Admin pode avançar OU reverter status livremente
VALID_TRANSITIONS = {
    "draft":    {"open"},
    "open":     {"draft", "closed"},
    "closed":   {"open", "resolved"},
    "resolved": {"closed"},   # permite reverter para corrigir
}


# ── Schemas ───────────────────────────────────────────────────────────────────

class FaceoffPairIn(BaseModel):
    team_a_name: str
    team_b_name: str
    seed_a: Optional[int] = None
    seed_b: Optional[int] = None


class FaceoffBulkIn(BaseModel):
    championship_id: int
    pairs: list[FaceoffPairIn]


class FaceoffUpdateIn(BaseModel):
    team_a_name: Optional[str] = None
    team_b_name: Optional[str] = None
    seed_a: Optional[int] = None
    seed_b: Optional[int] = None
    status: Optional[str] = None
    winner_team_name: Optional[str] = None  # override manual do vencedor


class FaceoffOut(BaseModel):
    id: int
    championship_id: int
    team_a_name: str
    team_b_name: str
    seed_a: Optional[int]
    seed_b: Optional[int]
    status: str
    winner_team_name: Optional[str]
    votes_a: int = 0
    votes_b: int = 0
    total_votes: int = 0

    model_config = {"from_attributes": True}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _vote_counts(faceoff: Faceoff) -> dict:
    a = sum(1 for v in faceoff.votes if v.voted_for == "a")
    b = sum(1 for v in faceoff.votes if v.voted_for == "b")
    return {"votes_a": a, "votes_b": b, "total_votes": a + b}


def _to_out(f: Faceoff) -> dict:
    return {
        "id": f.id,
        "championship_id": f.championship_id,
        "team_a_name": f.team_a_name,
        "team_b_name": f.team_b_name,
        "seed_a": f.seed_a,
        "seed_b": f.seed_b,
        "status": f.status,
        "winner_team_name": f.winner_team_name,
        **_vote_counts(f),
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/suggest")
def suggest_pairs(
    championship_id: int = Query(...),
    source_stage_ids: Optional[str] = Query(None, description="IDs de stages de origem separados por vírgula"),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """
    Sugere 8 pares de faceoff para o campeonato.
    source_stage_ids: stages anteriores para medir performance (ex: playoffs).
    Se omitido, usa as stages do próprio campeonato.
    """
    sids = [int(x) for x in source_stage_ids.split(",") if x.strip()] if source_stage_ids else None
    pairs = suggest_faceoff_pairs(championship_id, db, source_stage_ids=sids)
    if not pairs:
        raise HTTPException(status_code=404, detail="Nenhum dado de partida encontrado para sugerir pares")
    return pairs


@router.post("/bulk", status_code=status.HTTP_201_CREATED)
def bulk_create(
    body: FaceoffBulkIn,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Cria múltiplos faceoffs em status draft."""
    created = []
    for pair in body.pairs:
        f = Faceoff(
            championship_id=body.championship_id,
            team_a_name=pair.team_a_name.strip(),
            team_b_name=pair.team_b_name.strip(),
            seed_a=pair.seed_a,
            seed_b=pair.seed_b,
            status="draft",
        )
        db.add(f)
        created.append(f)
    db.commit()
    for f in created:
        db.refresh(f)
    return [_to_out(f) for f in created]


@router.get("")
def list_faceoffs(
    championship_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    q = db.query(Faceoff)
    if championship_id:
        q = q.filter(Faceoff.championship_id == championship_id)
    faceoffs = q.order_by(Faceoff.id).all()
    return [_to_out(f) for f in faceoffs]


@router.patch("/{faceoff_id}")
def update_faceoff(
    faceoff_id: int,
    body: FaceoffUpdateIn,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    f = db.query(Faceoff).filter(Faceoff.id == faceoff_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Faceoff não encontrado")

    updates = body.model_dump(exclude_unset=True)

    if "status" in updates:
        new_st = updates["status"]
        if new_st not in VALID_STATUSES:
            raise HTTPException(status_code=422, detail=f"Status inválido: {new_st}")
        if new_st not in VALID_TRANSITIONS.get(f.status, set()):
            raise HTTPException(
                status_code=409,
                detail=f"Transição inválida: {f.status} → {new_st}",
            )
        # Ao reverter de resolved, limpa o vencedor (a menos que o admin já envie um novo)
        if f.status == "resolved" and new_st != "resolved" and "winner_team_name" not in updates:
            f.winner_team_name = None

    for field, value in updates.items():
        setattr(f, field, value)

    db.commit()
    db.refresh(f)
    return _to_out(f)


@router.post("/{faceoff_id}/resolve")
def resolve_faceoff(
    faceoff_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """
    Calcula o vencedor do faceoff usando o standing oficial do torneio
    (pontos de sobrevivência + kills) acumulado nas stages do campeonato.
    """
    f = db.query(Faceoff).filter(Faceoff.id == faceoff_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Faceoff não encontrado")
    if f.status == "resolved":
        raise HTTPException(status_code=409, detail="Faceoff já resolvido")

    standings = calculate_team_tournament_standings(f.championship_id, db)
    if not standings:
        raise HTTPException(status_code=422, detail="Nenhum dado de partida encontrado no campeonato")

    rank_map = {s["team_name"]: s["rank"] for s in standings}
    rank_a = rank_map.get(f.team_a_name)
    rank_b = rank_map.get(f.team_b_name)

    if rank_a is None and rank_b is None:
        raise HTTPException(
            status_code=422,
            detail=f"Nenhum dos times ({f.team_a_name}, {f.team_b_name}) encontrado nos standings",
        )

    # Menor rank = melhor colocação = vencedor
    if rank_a is None:
        winner = f.team_b_name
    elif rank_b is None:
        winner = f.team_a_name
    elif rank_a < rank_b:
        winner = f.team_a_name
    elif rank_b < rank_a:
        winner = f.team_b_name
    else:
        winner = None  # empate (improvável mas possível)

    f.winner_team_name = winner
    f.status = "resolved"
    db.commit()
    db.refresh(f)

    result = _to_out(f)
    # Adiciona standings completos para contexto
    result["standings"] = [
        {"rank": s["rank"], "team_name": s["team_name"], "total_pts": s["total_pts"]}
        for s in standings
    ]
    return result


@router.delete("/{faceoff_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_faceoff(
    faceoff_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    f = db.query(Faceoff).filter(Faceoff.id == faceoff_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Faceoff não encontrado")
    if f.status != "draft":
        raise HTTPException(status_code=409, detail="Só é possível deletar faceoffs em status draft")
    db.delete(f)
    db.commit()
