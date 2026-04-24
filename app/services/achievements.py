# app/services/achievements.py
"""
Achievements Service

Conquistas desbloqueadas automaticamente com base em eventos da plataforma.
As definições ficam em código (ACHIEVEMENTS dict) — sem tabela de definições no DB.
Apenas user_achievement é persistido.

Pontos de hook:
  - check_post_submit()   → chamado em submit_lineup() após commit
  - check_post_scoring()  → chamado em score_stage_day() para cada usuário pontuado
  - check_post_stage_lock() → chamado após scoring completo de stage (rescore/score-day)
"""
from __future__ import annotations

import logging
from typing import Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.achievement import UserAchievement

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Definições dos achievements
# ---------------------------------------------------------------------------

ACHIEVEMENTS: dict[str, dict] = {
    "first_lineup": {
        "name": "Primeira Escalação",
        "description": "Submeteu sua primeira lineup na plataforma.",
        "icon": "🏁",
    },
    "budget_master": {
        "name": "Mestre do Orçamento",
        "description": "Usou 99 ou mais de 100 créditos no budget de uma lineup.",
        "icon": "💰",
    },
    "top1_day": {
        "name": "Campeão do Dia",
        "description": "Terminou em 1º lugar no ranking de um dia.",
        "icon": "🏆",
    },
    "top3_day": {
        "name": "Pódio",
        "description": "Terminou entre os 3 primeiros no ranking de um dia.",
        "icon": "🥉",
    },
    "top3_stage": {
        "name": "Elite",
        "description": "Terminou entre os 3 primeiros no ranking de um campeonato.",
        "icon": "🎖",
    },
    "captain_ace": {
        "name": "Capitão Certeiro",
        "description": "Seu capitão marcou 30 ou mais pontos em um único dia.",
        "icon": "⭐",
    },
    "perfect_pick": {
        "name": "Olho Clínico",
        "description": "Escalou o jogador com mais pontos do dia.",
        "icon": "👁",
    },
    "streak_3": {
        "name": "Consistente",
        "description": "Ficou no top 10 por 3 dias consecutivos em um campeonato.",
        "icon": "🔥",
    },
}


# ---------------------------------------------------------------------------
# Core — unlock seguro (idempotente)
# ---------------------------------------------------------------------------

def unlock_achievement(
    db: Session,
    user_id: str,
    key: str,
    context: Optional[dict] = None,
) -> bool:
    """
    Desbloqueia um achievement para o usuário.
    Retorna True se foi desbloqueado agora, False se já existia.
    Nunca lança exceção — erros são logados.
    """
    if key not in ACHIEVEMENTS:
        logger.warning("[Achievements] Chave desconhecida: %r", key)
        return False

    existing = (
        db.query(UserAchievement)
        .filter(UserAchievement.user_id == user_id, UserAchievement.key == key)
        .first()
    )
    if existing:
        return False

    try:
        ua = UserAchievement(user_id=user_id, key=key, context=context)
        db.add(ua)
        db.flush()
        logger.info("[Achievements] user=%s desbloqueou: %s", user_id, key)
        return True
    except IntegrityError:
        db.rollback()
        return False


# ---------------------------------------------------------------------------
# Hook: pós-submissão de lineup
# ---------------------------------------------------------------------------

def check_post_submit(
    db: Session,
    user_id: str,
    total_cost: int,
) -> None:
    """
    Chamado logo após submit_lineup() bem-sucedido (antes do commit final).
    Verifica: first_lineup, budget_master.
    """
    # first_lineup — só válido se o usuário ainda não tem nenhum achievement
    # (simples: tentamos desbloquear, o unlock é idempotente)
    from app.models.lineup import Lineup
    lineup_count = (
        db.query(Lineup)
        .filter(Lineup.user_id == user_id)
        .count()
    )
    if lineup_count <= 1:  # acabou de criar o primeiro
        unlock_achievement(db, user_id, "first_lineup")

    # budget_master — usou 99+ de 100
    if total_cost >= 99:
        unlock_achievement(db, user_id, "budget_master")


# ---------------------------------------------------------------------------
# Hook: pós-scoring de um dia
# ---------------------------------------------------------------------------

def check_post_scoring(
    db: Session,
    user_id: str,
    stage_day_id: int,
    stage_id: int,
    day_rank: Optional[int],
    captain_pts: float,
) -> None:
    """
    Chamado após score_stage_day() para cada usuário afetado.
    Verifica: top1_day, top3_day, captain_ace, perfect_pick, streak_3.
    """
    from app.models.user_stat import UserDayStat, UserStageStat
    from app.models.stage_day import StageDay

    # top1_day / top3_day
    if day_rank is not None:
        if day_rank == 1:
            unlock_achievement(db, user_id, "top1_day", {"stage_day_id": stage_day_id})
        if day_rank <= 3:
            unlock_achievement(db, user_id, "top3_day", {"stage_day_id": stage_day_id})

    # captain_ace — capitão marcou 30+ pts
    if captain_pts >= 30:
        unlock_achievement(db, user_id, "captain_ace", {"stage_day_id": stage_day_id})

    # perfect_pick — escalou o jogador com mais pontos do dia
    _check_perfect_pick(db, user_id, stage_day_id)

    # streak_3 — top 10 por 3 dias consecutivos
    _check_streak_3(db, user_id, stage_id)


def _check_perfect_pick(db: Session, user_id: str, stage_day_id: int) -> None:
    """Verifica se o usuário escalou o jogador com mais pontos do dia."""
    from app.models.lineup import Lineup, LineupPlayer
    from app.models.roster import Roster
    from app.models.match_stat import MatchStat
    from app.models.match import Match
    from sqlalchemy import func

    # Jogador com mais xama_points no dia
    top_person = (
        db.query(MatchStat.person_id)
        .join(Match, MatchStat.match_id == Match.id)
        .filter(Match.stage_day_id == stage_day_id)
        .group_by(MatchStat.person_id)
        .order_by(func.sum(MatchStat.xama_points).desc())
        .first()
    )
    if not top_person:
        return

    # Verifica se o usuário tinha esse jogador na lineup (titular)
    lineup = (
        db.query(Lineup)
        .filter(Lineup.user_id == user_id, Lineup.stage_day_id == stage_day_id)
        .first()
    )
    if not lineup:
        return

    person_ids_in_lineup = {
        lp.roster.person_id
        for lp in lineup.players
        if lp.slot_type == "titular" and lp.roster
    }

    if top_person.person_id in person_ids_in_lineup:
        unlock_achievement(db, user_id, "perfect_pick", {"stage_day_id": stage_day_id})


def _check_streak_3(db: Session, user_id: str, stage_id: int) -> None:
    """Verifica se o usuário ficou top 10 por 3 dias consecutivos na stage."""
    from app.models.user_stat import UserDayStat
    from app.models.stage_day import StageDay

    days_in_top10 = (
        db.query(UserDayStat)
        .join(StageDay, UserDayStat.stage_day_id == StageDay.id)
        .filter(
            UserDayStat.user_id == user_id,
            StageDay.stage_id == stage_id,
            UserDayStat.rank <= 10,
            UserDayStat.rank.isnot(None),
        )
        .order_by(StageDay.day_number)
        .all()
    )

    if len(days_in_top10) < 3:
        return

    # Verifica consecutividade pelos day_numbers
    day_numbers = []
    for stat in days_in_top10:
        day = db.query(StageDay).filter(StageDay.id == stat.stage_day_id).first()
        if day:
            day_numbers.append(day.day_number)

    day_numbers.sort()
    consecutive = 1
    for i in range(1, len(day_numbers)):
        if day_numbers[i] == day_numbers[i - 1] + 1:
            consecutive += 1
            if consecutive >= 3:
                unlock_achievement(db, user_id, "streak_3", {"stage_id": stage_id})
                return
        else:
            consecutive = 1


# ---------------------------------------------------------------------------
# Hook: pós-lock de stage (top3_stage)
# ---------------------------------------------------------------------------

def check_post_stage_lock(db: Session, stage_id: int) -> None:
    """
    Chamado após rescore/scoring completo de uma stage.
    Verifica top3_stage para todos os usuários com rank <= 3.
    """
    from app.models.user_stat import UserStageStat
    from app.models.stage import Stage

    stage = db.query(Stage).filter(Stage.id == stage_id).first()
    stage_name = stage.name if stage else f"Stage {stage_id}"

    top3 = (
        db.query(UserStageStat)
        .filter(
            UserStageStat.stage_id == stage_id,
            UserStageStat.rank <= 3,
            UserStageStat.rank.isnot(None),
        )
        .all()
    )

    for stat in top3:
        unlock_achievement(
            db, stat.user_id, "top3_stage",
            {"stage_id": stage_id, "stage_name": stage_name, "rank": stat.rank},
        )
