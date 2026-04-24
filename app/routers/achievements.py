# app/routers/achievements.py
"""
Endpoints de Achievements.

GET /achievements/definitions   → lista todas as conquistas possíveis (público)
GET /achievements/me            → minhas conquistas desbloqueadas (auth)
GET /achievements/user/{id}     → conquistas de outro usuário (público)
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.dependencies import get_current_user
from app.models.achievement import UserAchievement
from app.models.user import User
from app.services.achievements import ACHIEVEMENTS

router = APIRouter(prefix="/achievements", tags=["Achievements"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class AchievementDefinition(BaseModel):
    key: str
    name: str
    description: str
    icon: str


class UserAchievementOut(BaseModel):
    key: str
    name: str
    description: str
    icon: str
    unlocked_at: str  # ISO string
    context: Optional[dict] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_achievement_out(ua: UserAchievement) -> UserAchievementOut:
    defn = ACHIEVEMENTS.get(ua.key, {})
    return UserAchievementOut(
        key=ua.key,
        name=defn.get("name", ua.key),
        description=defn.get("description", ""),
        icon=defn.get("icon", "🏅"),
        unlocked_at=ua.unlocked_at.isoformat(),
        context=ua.context,
    )


def _get_user_achievements(db: Session, user_id: str) -> list[UserAchievementOut]:
    records = (
        db.query(UserAchievement)
        .filter(UserAchievement.user_id == user_id)
        .order_by(UserAchievement.unlocked_at.desc())
        .all()
    )
    return [_build_achievement_out(ua) for ua in records]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/definitions",
    response_model=list[AchievementDefinition],
    summary="Lista todas as conquistas possíveis",
)
def list_definitions() -> list[AchievementDefinition]:
    return [
        AchievementDefinition(key=k, **v)
        for k, v in ACHIEVEMENTS.items()
    ]


@router.get(
    "/me",
    response_model=list[UserAchievementOut],
    summary="Minhas conquistas desbloqueadas",
)
def get_my_achievements(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[UserAchievementOut]:
    return _get_user_achievements(db, current_user.id)


@router.get(
    "/user/{user_id}",
    response_model=list[UserAchievementOut],
    summary="Conquistas de outro usuário",
)
def get_user_achievements(
    user_id: str,
    db: Session = Depends(get_db),
) -> list[UserAchievementOut]:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Usuário {user_id} não encontrado",
        )
    return _get_user_achievements(db, user_id)
