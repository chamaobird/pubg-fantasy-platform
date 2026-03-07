# app/services/scoring.py
"""
Scoring Engine — Warzone Fantasy

Responsável por:
  1. Calcular fantasy_points de um jogador em uma partida (calculate_match_points)
  2. Persistir MatchPlayerStat com os pontos calculados
  3. Atualizar incrementalmente PlayerScore (ranking acumulado por liga)
  4. Atualizar total_points de cada FantasyTeam que contenha o jogador

Fórmula de pontuação (todas as fontes documentadas abaixo):
  ┌─────────────────────────────────────────────────────────────┐
  │  Kills         × 10.0  pts cada                            │
  │  Assists       ×  4.0  pts cada                            │
  │  Damage        ×  0.05 pts por ponto de dano               │
  │  Placement     → tabela PLACEMENT_POINTS (1º=25, 2º=20...) │
  │  Survival      ×  0.01 pts por segundo vivo                │
  │  Headshots     ×  2.0  pts cada (bônus)                    │
  │  Knocks        ×  1.0  pts cada (bônus)                    │
  └─────────────────────────────────────────────────────────────┘

Para alterar a fórmula, edite apenas as constantes abaixo.
"""

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import (
    Match,
    MatchPlayerStat,
    Player,
    PlayerScore,
    FantasyTeam,
    FantasyLeague,
    fantasy_team_players,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# CONSTANTES DA FÓRMULA — edite aqui para ajustar a pontuação
# ---------------------------------------------------------------------------

POINTS_PER_KILL     = 10.0
POINTS_PER_ASSIST   =  4.0
POINTS_PER_DAMAGE   =  0.05   # por ponto de dano (ex: 200 dano = 10 pts)
POINTS_PER_SECOND   =  0.01   # por segundo vivo (ex: 20 min = 12 pts)
POINTS_PER_HEADSHOT =  2.0    # bônus por headshot
POINTS_PER_KNOCK    =  1.0    # bônus por knockdown

# Tabela de pontos por colocação final
# Posições não listadas recebem 0 pontos
PLACEMENT_POINTS: dict[int, float] = {
    1:  25.0,
    2:  20.0,
    3:  16.0,
    4:  13.0,
    5:  11.0,
    6:   9.0,
    7:   7.0,
    8:   6.0,
    9:   5.0,
    10:  4.0,
    11:  3.0,
    12:  2.0,
    13:  1.0,
    14:  1.0,
    15:  1.0,
    # 16-28 → 0 pontos
}


# ---------------------------------------------------------------------------
# CÁLCULO PURO (sem DB) — testável isoladamente
# ---------------------------------------------------------------------------

def calculate_match_points(
    kills: int,
    assists: int,
    damage_dealt: float,
    placement: int,
    survival_secs: int,
    headshots: int = 0,
    knocks: int = 0,
) -> float:
    """
    Calcula os fantasy points de um jogador em uma partida.
    Função pura: não acessa banco, fácil de testar e auditar.

    Exemplo (jogador top):
        kills=6, assists=2, damage=420, placement=2, survival=1800s
        = 60 + 8 + 21 + 20 + 18 = 127.0 pts
    """
    pts  = kills         * POINTS_PER_KILL
    pts += assists       * POINTS_PER_ASSIST
    pts += damage_dealt  * POINTS_PER_DAMAGE
    pts += PLACEMENT_POINTS.get(placement, 0.0)
    pts += survival_secs * POINTS_PER_SECOND
    pts += headshots     * POINTS_PER_HEADSHOT
    pts += knocks        * POINTS_PER_KNOCK

    return round(pts, 2)


def get_scoring_breakdown(
    kills: int,
    assists: int,
    damage_dealt: float,
    placement: int,
    survival_secs: int,
    headshots: int = 0,
    knocks: int = 0,
) -> dict:
    """
    Retorna o detalhamento completo da pontuação — útil para exibir
    ao usuário como os pontos foram calculados.
    """
    breakdown = {
        "kills":     {"value": kills,         "multiplier": POINTS_PER_KILL,     "points": round(kills * POINTS_PER_KILL, 2)},
        "assists":   {"value": assists,        "multiplier": POINTS_PER_ASSIST,   "points": round(assists * POINTS_PER_ASSIST, 2)},
        "damage":    {"value": damage_dealt,   "multiplier": POINTS_PER_DAMAGE,   "points": round(damage_dealt * POINTS_PER_DAMAGE, 2)},
        "placement": {"value": placement,      "table":      PLACEMENT_POINTS,    "points": PLACEMENT_POINTS.get(placement, 0.0)},
        "survival":  {"value": survival_secs,  "multiplier": POINTS_PER_SECOND,   "points": round(survival_secs * POINTS_PER_SECOND, 2)},
        "headshots": {"value": headshots,      "multiplier": POINTS_PER_HEADSHOT, "points": round(headshots * POINTS_PER_HEADSHOT, 2)},
        "knocks":    {"value": knocks,         "multiplier": POINTS_PER_KNOCK,    "points": round(knocks * POINTS_PER_KNOCK, 2)},
    }
    breakdown["total"] = round(sum(v["points"] for v in breakdown.values()), 2)
    return breakdown


# ---------------------------------------------------------------------------
# PERSISTÊNCIA — grava stats e atualiza rankings no banco
# ---------------------------------------------------------------------------

def process_match_stats(
    db: Session,
    match: Match,
    player_stats_raw: list[dict],
) -> dict:
    """
    Processa todas as stats de uma partida recém-ingerida da PUBG API:

      1. Para cada jogador: cria/atualiza MatchPlayerStat com fantasy_points
      2. Atualiza PlayerScore acumulado (ranking global de jogadores)
      3. Atualiza total_points de cada FantasyTeam afetada

    Args:
        db:               sessão SQLAlchemy aberta
        match:            objeto Match já persistido
        player_stats_raw: lista de dicts com as stats brutas da PUBG API

    Returns:
        dict com resumo: quantos jogadores processados, total de pts distribuídos
    """
    processed     = 0
    total_pts     = 0.0
    fantasy_teams_to_update: set[int] = set()

    for raw in player_stats_raw:
        pubg_id = raw.get("pubg_id", "")
        if not pubg_id or pubg_id == "ai":
            continue

        player = db.query(Player).filter(Player.pubg_id == pubg_id).first()
        if not player:
            logger.debug(f"[Scoring] Player {pubg_id} não encontrado no banco, pulando.")
            continue

        kills         = int(raw.get("kills", 0))
        assists       = int(raw.get("assists", 0))
        damage_dealt  = float(raw.get("damageDealt", raw.get("damage_dealt", 0.0)))
        placement     = int(raw.get("winPlace", raw.get("placement", 28)))
        survival_secs = int(raw.get("timeSurvived", raw.get("survival_secs", 0)))
        headshots     = int(raw.get("headshotKills", raw.get("headshots", 0)))
        knocks        = int(raw.get("DBNOs", raw.get("knocks", 0)))

        pts = calculate_match_points(
            kills=kills,
            assists=assists,
            damage_dealt=damage_dealt,
            placement=placement,
            survival_secs=survival_secs,
            headshots=headshots,
            knocks=knocks,
        )

        # Upsert MatchPlayerStat
        stat = (
            db.query(MatchPlayerStat)
            .filter(
                MatchPlayerStat.match_id  == match.id,
                MatchPlayerStat.player_id == player.id,
            )
            .first()
        )
        if stat:
            old_pts = stat.fantasy_points
            _decrement_player_score(db, player.id, match, old_pts)
            stat.kills          = kills
            stat.assists        = assists
            stat.damage_dealt   = damage_dealt
            stat.placement      = placement
            stat.survival_secs  = survival_secs
            stat.headshots      = headshots
            stat.knocks         = knocks
            stat.fantasy_points = pts
        else:
            stat = MatchPlayerStat(
                match_id       = match.id,
                player_id      = player.id,
                kills          = kills,
                assists        = assists,
                damage_dealt   = damage_dealt,
                placement      = placement,
                survival_secs  = survival_secs,
                headshots      = headshots,
                knocks         = knocks,
                fantasy_points = pts,
            )
            db.add(stat)

        _increment_player_score(db, player, match, kills, assists, damage_dealt, pts)

        ft_ids = _get_fantasy_team_ids_for_player(db, player.id, match.tournament_id)
        fantasy_teams_to_update.update(ft_ids)

        processed += 1
        total_pts += pts
        logger.debug(
            f"[Scoring] {player.name}: {pts} pts "
            f"(k={kills} a={assists} d={damage_dealt:.0f} p={placement})"
        )

    db.flush()

    for ft_id in fantasy_teams_to_update:
        _recalculate_fantasy_team_total(db, ft_id)

    db.commit()

    logger.info(
        f"[Scoring] Match {match.pubg_match_id}: "
        f"{processed} jogadores, {total_pts:.1f} pts distribuídos, "
        f"{len(fantasy_teams_to_update)} fantasy teams atualizadas"
    )

    return {
        "match_id":              match.id,
        "pubg_match_id":         match.pubg_match_id,
        "players_processed":     processed,
        "total_points_awarded":  total_pts,
        "fantasy_teams_updated": len(fantasy_teams_to_update),
    }


# ---------------------------------------------------------------------------
# HELPERS INTERNOS
# ---------------------------------------------------------------------------

def _increment_player_score(
    db: Session,
    player: Player,
    match: Match,
    kills: int,
    assists: int,
    damage_dealt: float,
    pts: float,
) -> None:
    """Adiciona os pontos do match ao PlayerScore acumulado de cada liga do torneio."""
    if not match.tournament_id:
        return

    leagues = (
        db.query(FantasyLeague)
        .filter(FantasyLeague.tournament_id == match.tournament_id)
        .all()
    )

    for league in leagues:
        score = (
            db.query(PlayerScore)
            .filter(
                PlayerScore.player_id == player.id,
                PlayerScore.league_id == league.id,
            )
            .first()
        )
        if score:
            score.total_points   += pts
            score.total_kills    += kills
            score.total_assists  += assists
            score.total_damage   += damage_dealt
            score.matches_scored += 1
            score.last_updated   = datetime.now(timezone.utc)
        else:
            score = PlayerScore(
                player_id      = player.id,
                league_id      = league.id,
                total_points   = pts,
                total_kills    = kills,
                total_assists  = assists,
                total_damage   = damage_dealt,
                matches_scored = 1,
            )
            db.add(score)


def _decrement_player_score(
    db: Session,
    player_id: int,
    match: Match,
    old_pts: float,
) -> None:
    """Remove pontos antigos do PlayerScore (usado no re-processamento de um match)."""
    if not match.tournament_id:
        return

    leagues = (
        db.query(FantasyLeague)
        .filter(FantasyLeague.tournament_id == match.tournament_id)
        .all()
    )
    for league in leagues:
        score = (
            db.query(PlayerScore)
            .filter(
                PlayerScore.player_id == player_id,
                PlayerScore.league_id == league.id,
            )
            .first()
        )
        if score:
            score.total_points   = max(0.0, score.total_points - old_pts)
            score.matches_scored = max(0,   score.matches_scored - 1)


def _get_fantasy_team_ids_for_player(
    db: Session,
    player_id: int,
    tournament_id: int | None,
) -> list[int]:
    """Retorna IDs das FantasyTeams que contêm o jogador e participam do torneio."""
    if not tournament_id:
        return []

    rows = (
        db.query(fantasy_team_players.c.fantasy_team_id)
        .join(FantasyTeam, FantasyTeam.id == fantasy_team_players.c.fantasy_team_id)
        .join(FantasyLeague, FantasyLeague.id == FantasyTeam.league_id)
        .filter(
            fantasy_team_players.c.player_id == player_id,
            FantasyLeague.tournament_id == tournament_id,
        )
        .all()
    )
    return [r[0] for r in rows]


def _recalculate_fantasy_team_total(db: Session, fantasy_team_id: int) -> None:
    """
    Recalcula o total_points de uma FantasyTeam somando os PlayerScores
    de todos os seus 4 jogadores na liga correspondente.
    """
    ft = db.query(FantasyTeam).filter(FantasyTeam.id == fantasy_team_id).first()
    if not ft:
        return

    total = 0.0
    for player in ft.players:
        score = (
            db.query(PlayerScore)
            .filter(
                PlayerScore.player_id == player.id,
                PlayerScore.league_id == ft.league_id,
            )
            .first()
        )
        if score:
            total += score.total_points

    ft.total_points = round(total, 2)
    logger.debug(f"[Scoring] FantasyTeam {ft.id} '{ft.name}': {ft.total_points} pts")
