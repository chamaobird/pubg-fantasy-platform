# app/services/scoring.py
"""
Scoring Engine — Fase 3 / #032

Responsável por:
  1. Calcular fantasy_points de uma PERSON em um MATCH (função pura, testável)
  2. Persistir MATCH_STAT (upsert idempotente)
  3. Atualizar incrementalmente PERSON_STAGE_STAT (acumulado por stage)

Fórmula XAMA (todas as constantes documentadas abaixo):
  ┌─────────────────────────────────────────────────────────────────┐
  │  Kills         × 5      pts                                    │
  │  Assists       × 1      pts                                    │
  │  Knocks        × 1      pts                                    │
  │  Damage        × 0.03   pts por ponto de dano                  │
  │  Morte precoce → −15    se survival < 600s E kills == 0        │
  │  Late game     → bônus por sobreviver até o final (ver abaixo) │
  │  Capitão       → ×1.30  aplicado na camada de lineup scoring   │
  └─────────────────────────────────────────────────────────────────┘

Late game bonus (por partida, calculado sobre o conjunto completo):
  N = sobreviventes do time vencedor (survival >= max_survival - 60s)
  Sobreviventes: +10 cada
  Próximos a morrer (ordenados por survival desc):
    N=4: [2, 2, 1, 1]
    N=3: [4, 2, 2, 1, 1]
    N=2: [5, 4, 2, 2, 1, 1]
    N=1: [6, 5, 4, 2, 2, 1, 1]
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Match, MatchStat, PersonStageStat

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Constantes da fórmula — edite aqui para ajustar pontuação
# ---------------------------------------------------------------------------

POINTS_PER_KILL        =  5.0
POINTS_PER_ASSIST      =  1.0
POINTS_PER_KNOCK       =  1.0
POINTS_PER_DAMAGE      =  0.03   # por ponto de dano
EARLY_DEATH_PENALTY    = -15.0   # survival < 600s E kills == 0
EARLY_DEATH_THRESHOLD  =  600    # segundos (10 minutos)
LATE_GAME_SURVIVOR_PTS =  10.0   # bônus para sobreviventes do time vencedor
LATE_GAME_THRESHOLD    =  60     # segundos antes do fim = "estava vivo"

# Sequências de bônus para jogadores que morreram logo após o vencedor
# Índice = N (número de sobreviventes do time vencedor) − 1
_LATE_GAME_NEXT_BONUSES: dict[int, list[float]] = {
    4: [2, 2, 1, 1],
    3: [4, 2, 2, 1, 1],
    2: [5, 4, 2, 2, 1, 1],
    1: [6, 5, 4, 2, 2, 1, 1],
}


# ---------------------------------------------------------------------------
# DTO interno para cálculo em lote
# ---------------------------------------------------------------------------

@dataclass
class PlayerStatInput:
    """Dados de um jogador em uma partida, já normalizados."""
    person_id:          int
    account_id_used:    str   = ""    # rastreabilidade — account_id da PUBG API
    kills:              int   = 0
    assists:            int   = 0
    damage_dealt:       float = 0.0
    placement:          int   = 28
    survival_secs:      int   = 0
    knocks:             int   = 0
    headshots:          int   = 0


# ---------------------------------------------------------------------------
# Cálculo puro (sem DB) — testável isoladamente
# ---------------------------------------------------------------------------

def calculate_base_points(stat: PlayerStatInput) -> tuple[float, bool]:
    """
    Calcula base_points de um jogador (sem late game bonus).

    Returns:
        (base_pts, is_early_death)
    """
    kill_pts   = stat.kills        * POINTS_PER_KILL
    assist_pts = stat.assists      * POINTS_PER_ASSIST
    knock_pts  = stat.knocks       * POINTS_PER_KNOCK
    dmg_pts    = stat.damage_dealt * POINTS_PER_DAMAGE

    is_early_death = (
        stat.survival_secs < EARLY_DEATH_THRESHOLD
        and stat.kills == 0
    )
    early_death_pts = EARLY_DEATH_PENALTY if is_early_death else 0.0

    base = kill_pts + assist_pts + knock_pts + dmg_pts + early_death_pts
    return round(base, 4), is_early_death


def calculate_late_game_bonuses(
    all_stats: list[PlayerStatInput],
    duration_secs: int,
) -> dict[int, float]:
    """
    Calcula o late game bonus por person_id para uma partida.

    Args:
        all_stats:     todos os PlayerStatInput da partida
        duration_secs: duração total da partida em segundos

    Returns:
        dict {person_id: bonus_pts}  — apenas quem recebe bônus aparece aqui
    """
    if not all_stats:
        return {}

    winners = [s for s in all_stats if s.placement == 1]
    if not winners:
        return {}

    # Threshold: jogadores vivos nos últimos 60s da partida
    survivor_threshold = max(duration_secs - LATE_GAME_THRESHOLD, 0)
    survivors = [s for s in winners if s.survival_secs >= survivor_threshold]
    N = max(len(survivors), 1)

    bonuses: dict[int, float] = {}

    # Sobreviventes do time vencedor
    for s in survivors:
        bonuses[s.person_id] = LATE_GAME_SURVIVOR_PTS

    # Próximos a morrer (todos os jogadores, excluindo sobreviventes do vencedor,
    # ordenados por survival_secs descrescente)
    survivor_ids = {s.person_id for s in survivors}
    others = sorted(
        [s for s in all_stats if s.person_id not in survivor_ids],
        key=lambda s: s.survival_secs,
        reverse=True,
    )
    extra_bonuses = _LATE_GAME_NEXT_BONUSES.get(N, [])
    for i, bonus_pts in enumerate(extra_bonuses):
        if i >= len(others):
            break
        bonuses[others[i].person_id] = bonus_pts

    return bonuses


def calculate_match_points_all(
    all_stats: list[PlayerStatInput],
    duration_secs: int,
) -> dict[int, float]:
    """
    Calcula fantasy_points final (base + late game) para todos os jogadores
    de uma partida. Retorna dict {person_id: total_pts}.
    """
    late_bonuses = calculate_late_game_bonuses(all_stats, duration_secs)
    result: dict[int, float] = {}
    for stat in all_stats:
        base, _ = calculate_base_points(stat)
        bonus = late_bonuses.get(stat.person_id, 0.0)
        result[stat.person_id] = round(base + bonus, 2)
    return result


def get_scoring_breakdown(stat: PlayerStatInput, duration_secs: int) -> dict:
    """
    Retorna o detalhamento completo da pontuação de um jogador em uma partida.
    Útil para exibir ao usuário como os pontos foram calculados.
    """
    base, is_early_death = calculate_base_points(stat)
    late_bonuses = calculate_late_game_bonuses([stat], duration_secs)
    late_bonus = late_bonuses.get(stat.person_id, 0.0)

    return {
        "kills":       {"value": stat.kills,        "multiplier": POINTS_PER_KILL,   "points": round(stat.kills * POINTS_PER_KILL, 2)},
        "assists":     {"value": stat.assists,       "multiplier": POINTS_PER_ASSIST, "points": round(stat.assists * POINTS_PER_ASSIST, 2)},
        "knocks":      {"value": stat.knocks,        "multiplier": POINTS_PER_KNOCK,  "points": round(stat.knocks * POINTS_PER_KNOCK, 2)},
        "damage":      {"value": stat.damage_dealt,  "multiplier": POINTS_PER_DAMAGE, "points": round(stat.damage_dealt * POINTS_PER_DAMAGE, 2)},
        "early_death": {"value": is_early_death,     "points": EARLY_DEATH_PENALTY if is_early_death else 0.0},
        "late_game":   {"value": late_bonus,         "points": late_bonus},
        "total":       round(base + late_bonus, 2),
    }


# ---------------------------------------------------------------------------
# Persistência — MATCH_STAT + PERSON_STAGE_STAT
# ---------------------------------------------------------------------------

def process_match_stats(
    db: Session,
    match: Match,
    all_stats: list[PlayerStatInput],
    duration_secs: int,
) -> dict:
    """
    Persiste MATCH_STAT e atualiza PERSON_STAGE_STAT para uma partida.

    Idempotente: faz upsert em MATCH_STAT. Se um stat já existe (reprocess),
    desconta os pontos antigos do PERSON_STAGE_STAT antes de gravar os novos.

    Args:
        db:            sessão SQLAlchemy aberta
        match:         objeto Match já persistido (com stage_day.stage_id)
        all_stats:     lista de PlayerStatInput da partida
        duration_secs: duração em segundos (necessário para late game bonus)

    Returns:
        resumo com contadores de processamento
    """
    stage_id = match.stage_day.stage_id if match.stage_day else None

    # Calcula todos os pontos de uma vez (inclui late game cross-player)
    final_points = calculate_match_points_all(all_stats, duration_secs)
    late_bonuses = calculate_late_game_bonuses(all_stats, duration_secs)

    processed     = 0
    total_pts     = 0.0
    skipped       = 0

    for stat in all_stats:
        pts     = final_points.get(stat.person_id, 0.0)
        base, _ = calculate_base_points(stat)
        late    = late_bonuses.get(stat.person_id, 0.0)

        # Upsert MATCH_STAT
        existing = (
            db.query(MatchStat)
            .filter(
                MatchStat.match_id   == match.id,
                MatchStat.person_id  == stat.person_id,
            )
            .first()
        )

        if existing:
            # Reprocess: desconta pontos antigos do PERSON_STAGE_STAT
            if stage_id:
                _adjust_person_stage_stat(db, stat.person_id, stage_id, -float(existing.xama_points or 0), reprocess=True)

            existing.account_id_used = stat.account_id_used
            existing.kills           = stat.kills
            existing.assists         = stat.assists
            existing.damage          = stat.damage_dealt
            existing.placement       = stat.placement
            existing.survival_time   = stat.survival_secs
            existing.knocks          = stat.knocks
            existing.base_points     = base
            existing.late_game_bonus = late
            existing.xama_points     = pts
        else:
            new_stat = MatchStat(
                match_id         = match.id,
                person_id        = stat.person_id,
                account_id_used  = stat.account_id_used,
                kills            = stat.kills,
                assists          = stat.assists,
                damage           = stat.damage_dealt,
                placement        = stat.placement,
                survival_time    = stat.survival_secs,
                knocks           = stat.knocks,
                base_points      = base,
                late_game_bonus  = late,
                xama_points      = pts,
            )
            db.add(new_stat)

        # Incrementa PERSON_STAGE_STAT
        if stage_id:
            _adjust_person_stage_stat(db, stat.person_id, stage_id, pts, reprocess=False)

        processed += 1
        total_pts += pts
        logger.debug(
            "[Scoring] person_id=%s: %.2f pts (base=%.2f late=%.2f) "
            "k=%d a=%d d=%.0f p=%d",
            stat.person_id, pts, base, late,
            stat.kills, stat.assists, stat.damage_dealt, stat.placement,
        )

    db.flush()
    logger.info(
        "[Scoring] match_id=%s: %d jogadores, %.1f pts distribuídos",
        match.id, processed, total_pts,
    )

    return {
        "match_id":             match.id,
        "pubg_match_id":        match.pubg_match_id,
        "players_processed":    processed,
        "players_skipped":      skipped,
        "total_points_awarded": round(total_pts, 2),
    }


# ---------------------------------------------------------------------------
# PERSON_STAGE_STAT — acumulado incremental
# ---------------------------------------------------------------------------

def _adjust_person_stage_stat(
    db: Session,
    person_id: int,
    stage_id: int,
    delta_pts: float,
    reprocess: bool,
) -> None:
    """
    Adiciona (ou subtrai, se delta_pts < 0) pontos ao PERSON_STAGE_STAT.
    Cria o registro se não existir.

    Args:
        reprocess: se True, apenas ajusta total_points e matches_played
                   sem incrementar matches_played novamente.
    """
    pss = (
        db.query(PersonStageStat)
        .filter(
            PersonStageStat.person_id == person_id,
            PersonStageStat.stage_id  == stage_id,
        )
        .first()
    )

    # Converte delta para Decimal com 2dp para evitar acumulação de erro de float
    delta = Decimal(str(round(delta_pts, 2)))

    if pss:
        current   = pss.total_xama_points  # já é Decimal (Numeric(10,2))
        new_total = max(Decimal("0"), current + delta)
        pss.total_xama_points = new_total
        if not reprocess:
            pss.matches_played += 1
        if pss.matches_played > 0:
            pss.pts_per_match = (new_total / pss.matches_played).quantize(
                Decimal("0.0001"), rounding=ROUND_HALF_UP
            )
        pss.updated_at = datetime.now(timezone.utc)
    else:
        if delta < 0:
            return
        pss = PersonStageStat(
            person_id         = person_id,
            stage_id          = stage_id,
            total_xama_points = delta,
            matches_played    = 0 if reprocess else 1,
            pts_per_match     = delta if not reprocess else Decimal("0"),
        )
        db.add(pss)


def recalculate_person_stage_stat(
    db: Session,
    stage_id: int,
) -> dict:
    """
    Recalcula PERSON_STAGE_STAT do zero para uma stage, somando todos os
    MATCH_STAT existentes. Usado após reprocess em lote ou correção manual.

    Apaga os registros existentes e reconstrói — não é incremental.
    """
    from app.models import StageDay  # import local

    # Todos os MATCH_STAT da stage via join
    stats = (
        db.query(MatchStat)
        .join(Match, MatchStat.match_id == Match.id)
        .join(StageDay, Match.stage_day_id == StageDay.id)
        .filter(StageDay.stage_id == stage_id)
        .all()
    )

    # Acumula em memória usando Decimal para evitar erro de ponto flutuante
    accum: dict[int, dict] = {}  # person_id → {total_pts, matches}
    for s in stats:
        if s.person_id not in accum:
            accum[s.person_id] = {"total_xama_points": Decimal("0"), "matches": 0}
        accum[s.person_id]["total_xama_points"] += s.xama_points or Decimal("0")
        accum[s.person_id]["matches"] += 1

    # Deleta registros existentes da stage
    db.query(PersonStageStat).filter(
        PersonStageStat.stage_id == stage_id
    ).delete()

    # Recria
    for person_id, data in accum.items():
        total   = data["total_xama_points"]
        matches = data["matches"]
        db.add(PersonStageStat(
            person_id         = person_id,
            stage_id          = stage_id,
            total_xama_points = total,
            matches_played    = matches,
            pts_per_match     = (total / matches).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP) if matches > 0 else Decimal("0"),
        ))

    db.flush()
    logger.info(
        "[Scoring] recalculate_person_stage_stat: stage=%s — %d persons recalculados",
        stage_id, len(accum),
    )
    return {
        "stage_id":        stage_id,
        "persons_updated": len(accum),
        "matches_counted": len(stats),
    }
