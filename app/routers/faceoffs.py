# app/routers/faceoffs.py
"""
Endpoints públicos de Faceoffs.

GET  /faceoffs?championship_id=X  → lista faceoffs (% escondido se open)
POST /faceoffs/{id}/vote          → registra ou troca voto (requer login)
GET  /faceoffs/{id}/my-vote       → voto do usuário logado
"""
from __future__ import annotations
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, get_current_user_optional
from app.models.championship import Championship
from app.models.faceoff import Faceoff, FaceoffVote
from app.models.user import User

router = APIRouter(prefix="/faceoffs", tags=["Faceoffs"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class VoteIn(BaseModel):
    voted_for: str  # "a" ou "b"


class FaceoffPublicOut(BaseModel):
    id: int
    championship_id: int
    team_a_name: str
    team_b_name: str
    seed_a: Optional[int]
    seed_b: Optional[int]
    status: str
    winner_team_name: Optional[str]
    # Percentagens — None enquanto status == "open" (revelado ao fechar)
    pct_a: Optional[float]
    pct_b: Optional[float]
    total_votes: int
    my_vote: Optional[str]  # "a", "b" ou None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_out(f: Faceoff, user_id: Optional[str], reveal_pct: bool) -> dict:
    votes_a = sum(1 for v in f.votes if v.voted_for == "a")
    votes_b = sum(1 for v in f.votes if v.voted_for == "b")
    total = votes_a + votes_b

    if reveal_pct:
        if total > 0:
            pct_a = round(votes_a / total * 100, 1)
            pct_b = round(votes_b / total * 100, 1)
        else:
            pct_a = pct_b = 0.0   # encerrado sem votos — exibe 0%/0%
    else:
        pct_a = pct_b = None

    my_vote = None
    if user_id:
        vote = next((v for v in f.votes if v.user_id == user_id), None)
        my_vote = vote.voted_for if vote else None

    return {
        "id": f.id,
        "championship_id": f.championship_id,
        "team_a_name": f.team_a_name,
        "team_b_name": f.team_b_name,
        "seed_a": f.seed_a,
        "seed_b": f.seed_b,
        "status": f.status,
        "winner_team_name": f.winner_team_name,
        "pct_a": pct_a,
        "pct_b": pct_b,
        "total_votes": total,
        "my_vote": my_vote,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("")
def list_faceoffs(
    championship_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Lista faceoffs públicos.
    - championship_id: filtra por campeonato (opcional)
    - status: filtra por status (ex: 'open')
    - draft: nunca aparece para usuários
    - status open: percentagens escondidas
    - status closed/resolved: percentagens reveladas
    """
    q = db.query(Faceoff).filter(Faceoff.status != "draft")

    if championship_id is not None:
        # Filtro por campeonato específico — mostra todos (inclusive de championships encerrados)
        q = q.filter(Faceoff.championship_id == championship_id)
    else:
        # Feed geral (ex: dashboard) — exclui championships encerrados para não poluir o feed
        q = (
            q.join(Championship, Faceoff.championship_id == Championship.id)
            .filter(Championship.finished_at.is_(None))
        )

    if status_filter:
        q = q.filter(Faceoff.status == status_filter)
    faceoffs = q.order_by(Faceoff.id).all()

    user_id = current_user.id if current_user else None
    return [
        _build_out(f, user_id, reveal_pct=(f.status in {"closed", "resolved"}))
        for f in faceoffs
    ]


@router.post("/{faceoff_id}/vote", status_code=status.HTTP_200_OK)
def cast_vote(
    faceoff_id: int,
    body: VoteIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.voted_for not in {"a", "b"}:
        raise HTTPException(status_code=422, detail="voted_for deve ser 'a' ou 'b'")

    f = db.query(Faceoff).filter(Faceoff.id == faceoff_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Faceoff não encontrado")
    if f.status != "open":
        raise HTTPException(status_code=409, detail="Votação não está aberta para este faceoff")

    existing = db.query(FaceoffVote).filter(
        FaceoffVote.faceoff_id == faceoff_id,
        FaceoffVote.user_id == current_user.id,
    ).first()

    if existing:
        # Troca de voto permitida enquanto open
        existing.voted_for = body.voted_for
    else:
        db.add(FaceoffVote(
            faceoff_id=faceoff_id,
            user_id=current_user.id,
            voted_for=body.voted_for,
        ))

    db.commit()
    db.refresh(f)
    # Retorna estado atualizado (sem revelar %)
    return _build_out(f, current_user.id, reveal_pct=False)


@router.get("/{faceoff_id}/my-vote")
def get_my_vote(
    faceoff_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vote = db.query(FaceoffVote).filter(
        FaceoffVote.faceoff_id == faceoff_id,
        FaceoffVote.user_id == current_user.id,
    ).first()
    return {"voted_for": vote.voted_for if vote else None}
