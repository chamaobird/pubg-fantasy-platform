# app/services/league.py
"""
League Service — Liga Privada

Lógica de negócio para criação e gestão de ligas privadas.
Uma liga vincula um grupo de usuários a um championship e permite
ver um leaderboard filtrado apenas pelos membros.
"""
from __future__ import annotations

import logging
import random
import string

from sqlalchemy.orm import Session

from app.models.championship import Championship
from app.models.league import League, LeagueMember
from app.models.stage import Stage
from app.models.user import User
from app.models.user_stat import UserStageStat

logger = logging.getLogger(__name__)

_CODE_CHARS = string.ascii_uppercase + string.digits  # A-Z + 0-9
_CODE_LENGTH = 8
_MAX_RETRIES = 10


# ---------------------------------------------------------------------------
# Geração de invite code único
# ---------------------------------------------------------------------------

def _generate_invite_code(db: Session) -> str:
    for _ in range(_MAX_RETRIES):
        code = "".join(random.choices(_CODE_CHARS, k=_CODE_LENGTH))
        exists = db.query(League).filter(League.invite_code == code).first()
        if not exists:
            return code
    raise RuntimeError("Não foi possível gerar um código único após várias tentativas")


# ---------------------------------------------------------------------------
# Criar liga
# ---------------------------------------------------------------------------

def create_league(
    db: Session,
    owner_id: str,
    name: str,
    championship_id: int,
    max_members: int = 50,
) -> League:
    """
    Cria uma nova liga privada e adiciona o owner como primeiro membro.

    Raises:
        ValueError: se championship não encontrado ou nome inválido
    """
    name = name.strip()
    if not name or len(name) < 3:
        raise ValueError("O nome da liga deve ter pelo menos 3 caracteres")
    if len(name) > 100:
        raise ValueError("O nome da liga deve ter no máximo 100 caracteres")

    champ = db.query(Championship).filter(Championship.id == championship_id).first()
    if not champ:
        raise ValueError(f"Campeonato {championship_id} não encontrado")

    invite_code = _generate_invite_code(db)

    league = League(
        name=name,
        owner_id=owner_id,
        championship_id=championship_id,
        invite_code=invite_code,
        max_members=max_members,
    )
    db.add(league)
    db.flush()

    # Owner entra como primeiro membro
    member = LeagueMember(league_id=league.id, user_id=owner_id)
    db.add(member)
    db.commit()
    db.refresh(league)

    logger.info(
        "[League] Liga criada: id=%s name=%r owner=%s code=%s",
        league.id, league.name, owner_id, invite_code,
    )
    return league


# ---------------------------------------------------------------------------
# Entrar na liga
# ---------------------------------------------------------------------------

def join_league(db: Session, user_id: str, invite_code: str) -> League:
    """
    Adiciona o usuário a uma liga pelo código de convite.

    Raises:
        ValueError: código inválido, liga inativa, já membro, ou lotada
    """
    league = db.query(League).filter(
        League.invite_code == invite_code.upper(),
        League.is_active == True,  # noqa: E712
    ).first()
    if not league:
        raise ValueError("Código de convite inválido ou liga inativa")

    # Já membro?
    existing = db.query(LeagueMember).filter(
        LeagueMember.league_id == league.id,
        LeagueMember.user_id == user_id,
    ).first()
    if existing:
        raise ValueError("Você já é membro desta liga")

    # Verifica limite
    member_count = db.query(LeagueMember).filter(LeagueMember.league_id == league.id).count()
    if member_count >= league.max_members:
        raise ValueError(f"Esta liga já atingiu o limite de {league.max_members} membros")

    member = LeagueMember(league_id=league.id, user_id=user_id)
    db.add(member)
    db.commit()

    logger.info("[League] user=%s entrou na liga id=%s", user_id, league.id)
    return league


# ---------------------------------------------------------------------------
# Leaderboard da liga para uma stage
# ---------------------------------------------------------------------------

def get_league_leaderboard(
    db: Session,
    league: League,
    stage_id: int,
) -> list[dict]:
    """
    Retorna leaderboard filtrado pelos membros da liga para a stage informada.
    Ordem: total_points DESC → survival_secs DESC → captain_pts DESC
    """
    member_ids = [m.user_id for m in league.members]
    if not member_ids:
        return []

    # Valida que a stage pertence ao championship da liga
    stage = db.query(Stage).filter(
        Stage.id == stage_id,
        Stage.championship_id == league.championship_id,
    ).first()
    if not stage:
        raise ValueError(f"Stage {stage_id} não pertence ao campeonato desta liga")

    stats = (
        db.query(UserStageStat)
        .filter(
            UserStageStat.stage_id == stage_id,
            UserStageStat.user_id.in_(member_ids),
        )
        .order_by(
            UserStageStat.total_points.desc(),
            UserStageStat.survival_secs.desc(),
            UserStageStat.captain_pts.desc(),
        )
        .all()
    )

    # Busca usernames
    user_ids = [s.user_id for s in stats]
    username_map = {
        u.id: (u.username, u.avatar_url)
        for u in db.query(User).filter(User.id.in_(user_ids)).all()
    }

    result = []
    for rank, stat in enumerate(stats, start=1):
        username, avatar_url = username_map.get(stat.user_id, (None, None))
        result.append({
            "rank": rank,
            "user_id": stat.user_id,
            "username": username,
            "avatar_url": avatar_url,
            "total_points": float(stat.total_points or 0),
            "days_played": int(stat.days_played or 0),
            "survival_secs": int(stat.survival_secs or 0),
            "captain_pts": float(stat.captain_pts or 0),
            "global_rank": stat.rank,
        })

    return result
