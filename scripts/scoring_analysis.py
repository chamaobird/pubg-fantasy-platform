"""
Análise de equilíbrio da fórmula de pontuação XAMA.

Execução:
    python -m scripts.scoring_analysis [--stage-id <id>]

Saída: estatísticas por componente de pontuação (kills, damage, late game, etc.)
mostrando quanto cada um contribui para o total.
"""
from __future__ import annotations

import sys
import argparse
from sqlalchemy import func, text

# Garante que o root do projeto está no path
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.match_stat import MatchStat
from app.models.match import Match
from app.models.stage import Stage
from app.models.stage_day import StageDay

# Constantes da fórmula (espelho de scoring.py)
POINTS_PER_KILL    =  5.0
POINTS_PER_ASSIST  =  1.0
POINTS_PER_KNOCK   =  1.0
POINTS_PER_DAMAGE  =  0.03
EARLY_DEATH_PENALTY = -15.0
EARLY_DEATH_THRESHOLD = 600


def run(stage_id: int | None = None):
    db = SessionLocal()
    try:
        q = db.query(MatchStat)
        if stage_id:
            q = (
                q.join(Match, MatchStat.match_id == Match.id)
                 .join(StageDay, Match.stage_day_id == StageDay.id)
                 .filter(StageDay.stage_id == stage_id)
            )

        stats = q.all()
        if not stats:
            print("Nenhum dado encontrado.")
            return

        # Calcula cada componente por jogador-partida
        kill_pts_total    = 0.0
        assist_pts_total  = 0.0
        knock_pts_total   = 0.0
        dmg_pts_total     = 0.0
        early_death_total = 0.0
        late_game_total   = 0.0
        grand_total       = 0.0

        kill_counts    = []
        assist_counts  = []
        knock_counts   = []
        dmg_values     = []
        xama_pts_all   = []

        early_death_count = 0
        zero_kill_count   = 0
        non_zero_kill_count = 0

        for s in stats:
            kills   = int(s.kills or 0)
            assists = int(s.assists or 0)
            knocks  = int(s.knocks or 0)
            dmg     = float(s.damage or 0)
            surv    = int(s.survival_time or 0)
            pts     = float(s.xama_points or 0)
            late    = float(s.late_game_bonus or 0)
            base    = float(s.base_points or 0)

            kp  = kills   * POINTS_PER_KILL
            ap  = assists * POINTS_PER_ASSIST
            knp = knocks  * POINTS_PER_KNOCK
            dp  = dmg     * POINTS_PER_DAMAGE

            is_early = surv < EARLY_DEATH_THRESHOLD and kills == 0
            ep = EARLY_DEATH_PENALTY if is_early else 0.0

            kill_pts_total    += kp
            assist_pts_total  += ap
            knock_pts_total   += knp
            dmg_pts_total     += dp
            early_death_total += ep
            late_game_total   += late
            grand_total       += pts

            kill_counts.append(kills)
            assist_counts.append(assists)
            knock_counts.append(knocks)
            dmg_values.append(dmg)
            xama_pts_all.append(pts)

            if is_early:
                early_death_count += 1
            if kills == 0:
                zero_kill_count += 1
            else:
                non_zero_kill_count += 1

        n = len(stats)

        def pct(v):
            return f"{v / grand_total * 100:+.1f}%" if grand_total else "N/A"

        def avg(lst):
            return sum(lst) / len(lst) if lst else 0

        print(f"\n{'='*60}")
        scope = f"stage_id={stage_id}" if stage_id else "TODOS os dados"
        print(f"  Análise de Pontuação XAMA — {scope}")
        print(f"  {n} linhas jogador-partida")
        print(f"{'='*60}")

        print(f"\n--- CONTRIBUIÇÃO POR COMPONENTE ---")
        print(f"  Kills         {kill_pts_total:>10.1f} pts  {pct(kill_pts_total)}")
        print(f"  Dano          {dmg_pts_total:>10.1f} pts  {pct(dmg_pts_total)}")
        print(f"  Late game     {late_game_total:>10.1f} pts  {pct(late_game_total)}")
        print(f"  Assists       {assist_pts_total:>10.1f} pts  {pct(assist_pts_total)}")
        print(f"  Knocks        {knock_pts_total:>10.1f} pts  {pct(knock_pts_total)}")
        print(f"  Early death   {early_death_total:>10.1f} pts  {pct(early_death_total)}")
        print(f"  {'─'*40}")
        print(f"  TOTAL         {grand_total:>10.1f} pts")

        print(f"\n--- MÉDIAS POR JOGADOR-PARTIDA ---")
        print(f"  xama_points   {avg(xama_pts_all):>8.2f}")
        print(f"  kills         {avg(kill_counts):>8.2f}")
        print(f"  assists       {avg(assist_counts):>8.2f}")
        print(f"  knocks        {avg(knock_counts):>8.2f}")
        print(f"  damage        {avg(dmg_values):>8.0f}")

        print(f"\n--- DISTRIBUIÇÃO DE PONTOS ---")
        # Histograma simples em buckets
        buckets = [0, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 9999]
        labels  = ["<5", "5-10", "10-15", "15-20", "20-25", "25-30", "30-40", "40-50", "50-75", "75-100", "100+"]
        for i, label in enumerate(labels):
            lo, hi = buckets[i], buckets[i + 1]
            count = sum(1 for p in xama_pts_all if lo <= p < hi)
            bar   = "█" * (count * 40 // n)
            print(f"  {label:>8}  {count:>4} ({count/n*100:4.1f}%)  {bar}")

        print(f"\n--- KILLS: PERFIL ---")
        for k in range(0, 8):
            count = sum(1 for x in kill_counts if x == k)
            if count == 0:
                continue
            print(f"  {k} kills   {count:>4} ({count/n*100:4.1f}%)")
        count_7plus = sum(1 for x in kill_counts if x >= 7)
        if count_7plus:
            print(f"  7+ kills  {count_7plus:>4} ({count_7plus/n*100:4.1f}%)")

        print(f"\n--- OUTROS ---")
        print(f"  Morte precoce (penalidade):  {early_death_count} ({early_death_count/n*100:.1f}%)")
        print(f"  Zero kills:                  {zero_kill_count} ({zero_kill_count/n*100:.1f}%)")
        print(f"  Com pelo menos 1 kill:       {non_zero_kill_count} ({non_zero_kill_count/n*100:.1f}%)")

        # Top 10 performers
        top_by_avg = []
        from collections import defaultdict
        person_accum = defaultdict(lambda: {"pts": 0.0, "games": 0, "kills": 0, "dmg": 0.0})
        for s in stats:
            pid = s.person_id
            person_accum[pid]["pts"]   += float(s.xama_points or 0)
            person_accum[pid]["games"] += 1
            person_accum[pid]["kills"] += int(s.kills or 0)
            person_accum[pid]["dmg"]   += float(s.damage or 0)

        from app.models.person import Person
        person_ids = list(person_accum.keys())
        persons = {p.id: p.display_name for p in db.query(Person).filter(Person.id.in_(person_ids)).all()}

        rows = []
        for pid, data in person_accum.items():
            g = data["games"]
            rows.append({
                "name":     persons.get(pid, f"id={pid}"),
                "games":    g,
                "total":    round(data["pts"], 1),
                "avg":      round(data["pts"] / g, 2) if g else 0,
                "avg_k":    round(data["kills"] / g, 2) if g else 0,
                "avg_dmg":  round(data["dmg"] / g, 0),
            })
        rows.sort(key=lambda r: r["avg"], reverse=True)

        print(f"\n--- TOP 10 — média XAMA por partida ---")
        print(f"  {'Jogador':<20} {'Partidas':>8} {'Total':>8} {'Avg/jogo':>9} {'Avg K':>6} {'Avg DMG':>8}")
        print(f"  {'─'*65}")
        for r in rows[:10]:
            print(f"  {r['name']:<20} {r['games']:>8} {r['total']:>8.1f} {r['avg']:>9.2f} {r['avg_k']:>6.2f} {r['avg_dmg']:>8.0f}")

        print(f"\n--- BOTTOM 10 — média XAMA por partida ---")
        print(f"  {'Jogador':<20} {'Partidas':>8} {'Total':>8} {'Avg/jogo':>9} {'Avg K':>6} {'Avg DMG':>8}")
        print(f"  {'─'*65}")
        for r in rows[-10:]:
            print(f"  {r['name']:<20} {r['games']:>8} {r['total']:>8.1f} {r['avg']:>9.2f} {r['avg_k']:>6.2f} {r['avg_dmg']:>8.0f}")

        print()

    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Análise de pontuação XAMA")
    parser.add_argument("--stage-id", type=int, default=None, help="Filtrar por stage ID")
    args = parser.parse_args()
    run(stage_id=args.stage_id)
