# app/routers/feedback.py
"""
Feedback endpoints.

POST /feedback          — envia feedback (público; associa user_id se token presente)
GET  /admin/feedback    — lista feedbacks (admin only, paginado)
"""
from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.limiter import limiter
from app.database import get_db
from app.dependencies import require_admin
from app.models.feedback import Feedback
from app.models.user import User
from app.schemas.feedback import FeedbackCreate, FeedbackOut
from app.services.auth import decode_access_token, get_user_by_id

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Feedback"])

# HTTPBearer optional — não levanta 403 se ausente
_optional_bearer = HTTPBearer(auto_error=False)


def _optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_optional_bearer),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Tenta autenticar o usuário, mas não exige auth."""
    if not credentials:
        return None
    payload = decode_access_token(credentials.credentials)
    if not payload:
        return None
    return get_user_by_id(db, payload["sub"])


# ── POST /feedback ────────────────────────────────────────────────────────────

@router.post("/feedback", status_code=status.HTTP_201_CREATED, response_model=FeedbackOut)
@limiter.limit("5/minute")
def submit_feedback(
    request: Request,
    body: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(_optional_user),
):
    """Envia feedback. Público; associa user_id se autenticado."""
    fb = Feedback(
        user_id=current_user.id if current_user else None,
        page=body.page,
        message=body.message,
        rating=body.rating,
        user_agent=body.user_agent or request.headers.get("user-agent", "")[:300],
    )
    db.add(fb)
    db.commit()
    db.refresh(fb)
    logger.info("Feedback recebido id=%s user=%s page=%s", fb.id, fb.user_id, fb.page)
    return fb


# ── GET /admin/feedback ───────────────────────────────────────────────────────

@router.get("/admin/feedback", response_model=List[FeedbackOut])
def list_feedback(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Lista feedbacks recebidos (admin only). Ordem: mais recente primeiro."""
    return (
        db.query(Feedback)
        .order_by(Feedback.created_at.desc())
        .offset(skip)
        .limit(min(limit, 200))
        .all()
    )
