# app/services/team_standings.py
"""
Engine de standings por time usando pontuação oficial do torneio PUBG:
  - Pontos de sobrevivência: 10/6/5/4/3/2/1/1 para colocações 1-8, 0 para 9-16
  - Pontos de kill: 1 por kill (soma dos 4 jogadores do time por partida)

Usado para resolver faceoffs e sugerir chaves por performance.
"""
from __future__ import annotations
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import text

SURVIVAL_PTS: dict[int, int] = {1: 10, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 1}


def calculate_team_tournament_standings(
    championship_id: int,
    db: Session,
    stage_ids: Optional[list[int]] = None,
) -> list[dict]:
    """
    Calcula o standing de cada time em um campeonato usando a fórmula do torneio.

    Args:
        championship_id: ID do campeonato
        db: sessão do banco
        stage_ids: restringir a stages específicas (None = todas do campeonato)

    Returns:
        Lista ordenada por total_pts desc, cada item:
        {
          rank, team_name,
          total_pts, survival_pts, kill_pts,
          matches_played,
          match_breakdown: [{match_id, placement, survival_pts, kills, kill_pts, match_pts}]
        }
    """
    # 1. Busca os stage_ids do campeonato se não fornecidos
    if stage_ids is None:
        rows = db.execute(text(
            "SELECT id FROM stage WHERE championship_id = :cid AND is_active = true ORDER BY id"
        ), {"cid": championship_id}).fetchall()
        stage_ids = [r[0] for r in rows]

    if not stage_ids:
        return []

    # 2. Pega todos os match_stats das stages, com team_name via roster
    # placement = colocação do time naquela partida (todos os membros têm o mesmo winPlace)
    # Usamos MIN(placement) por time por partida para obter a colocação final do time
    query = text("""
        SELECT
            ms.match_id,
            r.team_name,
            MIN(ms.placement)       AS team_placement,
            SUM(ms.kills)           AS team_kills
        FROM match_stat ms
        JOIN match m ON m.id = ms.match_id
        JOIN stage_day sd ON sd.id = m.stage_day_id
        JOIN roster r ON r.person_id = ms.person_id AND r.stage_id = sd.stage_id
        WHERE sd.stage_id = ANY(:sids)
          AND ms.person_id IS NOT NULL
          AND r.is_available = true
        GROUP BY ms.match_id, r.team_name
        ORDER BY ms.match_id, r.team_name
    """)
    rows = db.execute(query, {"sids": stage_ids}).fetchall()

    # 3. Agrega por time
    team_data: dict[str, dict] = {}

    for row in rows:
        team = row.team_name
        if not team:
            continue

        placement = row.team_placement or 99
        kills = int(row.team_kills or 0)
        surv_pts = SURVIVAL_PTS.get(placement, 0)
        kill_pts = kills
        match_pts = surv_pts + kill_pts

        if team not in team_data:
            team_data[team] = {
                "team_name": team,
                "total_pts": 0,
                "survival_pts": 0,
                "kill_pts": 0,
                "matches_played": 0,
                "match_breakdown": [],
            }

        team_data[team]["total_pts"] += match_pts
        team_data[team]["survival_pts"] += surv_pts
        team_data[team]["kill_pts"] += kill_pts
        team_data[team]["matches_played"] += 1
        team_data[team]["match_breakdown"].append({
            "match_id": row.match_id,
            "placement": placement,
            "survival_pts": surv_pts,
            "kills": kills,
            "kill_pts": kill_pts,
            "match_pts": match_pts,
        })

    # 4. Ordena e atribui rank
    ranked = sorted(team_data.values(), key=lambda t: t["total_pts"], reverse=True)
    for i, entry in enumerate(ranked):
        entry["rank"] = i + 1

    return ranked


def suggest_faceoff_pairs(
    championship_id: int,
    db: Session,
    source_stage_ids: Optional[list[int]] = None,
) -> list[dict]:
    """
    Sugere 8 pares de faceoff para um campeonato de 16 times.
    Critério: ranqueia times por pts_per_match médio nas stages de origem
    (histórico pré-finals), depois pareia #1vs#2, #3vs#4, etc.

    Args:
        championship_id: ID do campeonato das Finals
        db: sessão
        source_stage_ids: stages anteriores para calcular performance histórica.
                          Se None, usa o próprio campeonato (útil se já tem dados).

    Returns:
        Lista de 8 dicts: [{seed_a, team_a, seed_b, team_b, avg_pts_a, avg_pts_b}]
    """
    if source_stage_ids:
        sids = source_stage_ids
    else:
        # Usa as stages do próprio campeonato
        rows = db.execute(text(
            "SELECT id FROM stage WHERE championship_id = :cid AND is_active = true ORDER BY id"
        ), {"cid": championship_id}).fetchall()
        sids = [r[0] for r in rows]

    if not sids:
        return []

    # Média de pontos XAMA por partida por time (usando person_stage_stat ou match_stat)
    rows = db.execute(text("""
        SELECT
            r.team_name,
            COUNT(DISTINCT ms.match_id)                             AS matches,
            ROUND(AVG(ms.xama_points)::numeric, 2)                  AS avg_xama_per_player,
            ROUND(SUM(ms.xama_points)::numeric / NULLIF(COUNT(DISTINCT ms.match_id), 0), 2)
                                                                    AS team_pts_per_match
        FROM match_stat ms
        JOIN match m ON m.id = ms.match_id
        JOIN stage_day sd ON sd.id = m.stage_day_id
        JOIN roster r ON r.person_id = ms.person_id AND r.stage_id = sd.stage_id
        WHERE sd.stage_id = ANY(:sids)
          AND ms.person_id IS NOT NULL
          AND r.is_available = true
        GROUP BY r.team_name
        HAVING COUNT(DISTINCT ms.match_id) > 0
        ORDER BY team_pts_per_match DESC NULLS LAST
    """), {"sids": sids}).fetchall()

    if not rows:
        return []

    ranked_teams = [
        {
            "seed": i + 1,
            "team_name": r.team_name,
            "matches": r.matches,
            "team_pts_per_match": float(r.team_pts_per_match or 0),
        }
        for i, r in enumerate(rows)
    ]

    # Pareia #1vs#2, #3vs#4...
    pairs = []
    for i in range(0, len(ranked_teams) - 1, 2):
        a = ranked_teams[i]
        b = ranked_teams[i + 1]
        pairs.append({
            "seed_a": a["seed"],
            "team_a_name": a["team_name"],
            "pts_per_match_a": a["team_pts_per_match"],
            "seed_b": b["seed"],
            "team_b_name": b["team_name"],
            "pts_per_match_b": b["team_pts_per_match"],
        })
        # sem limite fixo — suporta qualquer número de times

    return pairs
