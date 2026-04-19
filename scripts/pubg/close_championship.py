"""
close_championship.py
─────────────────────
Encerra uma championship: importa os matches restantes do último dia
e fecha todos os stages com o status correto.

SEMÂNTICA IMPORTANTE (armadilhas comuns):
  - lineup_status='closed'  → "ainda não começou" (EM BREVE no frontend)  ← ERRADO para encerrar
  - lineup_status='locked'  → "encerrado com resultados visíveis"           ← CORRETO
  - is_active=False         → soft-delete total (some das APIs públicas)    ← NUNCA usar para encerrar
  - is_active=True          → visível no frontend                            ← manter sempre

Como o frontend determina "encerrada" (Championships.jsx:271):
  championships.every(s => s.lineup_status === 'locked')
  Ou seja: a championship aparece como encerrada quando TODOS os stages
  estão 'locked' — sem precisar alterar is_active.

Uso:
    # Ver estado atual sem alterar nada
    python scripts/pubg/close_championship.py --championship-id 9 --dry-run

    # Encerrar a championship PEC (eu-pecs26) — stage 23, stage_day 24
    python scripts/pubg/close_championship.py --championship-id 9 --last-stage-id 23 --last-stage-day-id 24 --tournament-id eu-pecs26
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from sqlalchemy import text as sql_text
from app.database import SessionLocal
from app.models.championship import Championship
from app.models.match import Match
from app.models.stage import Stage
from app.models.stage_day import StageDay
from app.services.import_ import import_stage_matches

API_KEY = os.getenv("PUBG_API_KEY", "")
HEADERS = {"Authorization": f"Bearer {API_KEY}", "Accept": "application/vnd.api+json"}
BASE = "https://api.pubg.com"


def get_tournament_match_ids(tournament_id: str) -> list[str]:
    resp = requests.get(f"{BASE}/tournaments/{tournament_id}", headers=HEADERS, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    matches = data.get("data", {}).get("relationships", {}).get("matches", {}).get("data", [])
    return [m["id"] for m in matches]


def load_known_ids_from_db() -> set[str]:
    db = SessionLocal()
    try:
        rows = db.execute(
            sql_text("SELECT pubg_match_id FROM match WHERE shard = 'pc-tournament'"),
        ).fetchall()
        return {r[0] for r in rows}
    finally:
        db.close()


def import_remaining(stage_id: int, stage_day_id: int, tournament_id: str) -> int:
    known = load_known_ids_from_db()
    all_ids = get_tournament_match_ids(tournament_id)
    new_ids = [mid for mid in all_ids if mid not in known]

    print(f"  Matches na API: {len(all_ids)} | Já importados: {len(known)} | Novos: {len(new_ids)}")

    if not new_ids:
        print("  Nenhum match novo para importar.")
        return 0

    db = SessionLocal()
    try:
        result = import_stage_matches(
            db=db,
            stage_id=stage_id,
            pubg_match_ids=new_ids,
            stage_day_id=stage_day_id,
            force_reprocess=False,
        )
        db.commit()
        for m in result.get("matches", []):
            print(f"    {m['pubg_match_id'][:8]}...  {m.get('status')}  ok={m.get('players_ok', 0)}  skip={m.get('players_skipped', 0)}")
        return len(new_ids)
    except Exception as e:
        db.rollback()
        print(f"  [ERRO] {e}")
        raise
    finally:
        db.close()


def show_state(championship_id: int):
    db = SessionLocal()
    try:
        champ = db.get(Championship, championship_id)
        if not champ:
            print(f"Championship {championship_id} não encontrada.")
            return

        stages = db.query(Stage).filter(Stage.championship_id == championship_id).order_by(Stage.id).all()
        print(f"\nChampionship: {champ.name} (id={champ.id}, is_active={champ.is_active})")
        print(f"{'Stage':<35} {'status':<10} {'is_active':<10} {'matches'}")
        print("-" * 70)
        for s in stages:
            days = db.query(StageDay).filter(StageDay.stage_id == s.id).all()
            match_count = 0
            for d in days:
                match_count += db.query(Match).filter(Match.stage_day_id == d.id).count()
            print(f"  {s.name:<33} {s.lineup_status:<10} {str(s.is_active):<10} {match_count}")
        print()
    finally:
        db.close()


def close_championship(championship_id: int, last_stage_id: int, dry_run: bool):
    db = SessionLocal()
    try:
        champ = db.get(Championship, championship_id)
        if not champ:
            print(f"[ERRO] Championship {championship_id} não encontrada.")
            return

        stages = db.query(Stage).filter(Stage.championship_id == championship_id).order_by(Stage.id).all()

        print(f"\nFechando championship: {champ.name}")
        print(f"dry_run={dry_run}\n")

        for s in stages:
            old_status = s.lineup_status
            target_status = "locked"

            if old_status == target_status:
                print(f"  [OK]   Stage {s.id} ({s.short_name}) já está '{target_status}'")
                continue

            if dry_run:
                print(f"  [DRY]  Stage {s.id} ({s.short_name}): '{old_status}' -> '{target_status}'")
            else:
                s.lineup_status = target_status
                print(f"  [SET]  Stage {s.id} ({s.short_name}): '{old_status}' -> '{target_status}'")

        # Garantir que is_active permanece True em tudo
        for s in stages:
            if not s.is_active:
                if dry_run:
                    print(f"  [DRY]  Stage {s.id} ({s.short_name}): is_active False -> True")
                else:
                    s.is_active = True
                    print(f"  [SET]  Stage {s.id} ({s.short_name}): is_active False -> True")

        if not champ.is_active:
            if dry_run:
                print(f"  [DRY]  Championship: is_active False -> True")
            else:
                champ.is_active = True
                print(f"  [SET]  Championship: is_active False -> True")

        if not dry_run:
            db.commit()
            print("\n[OK] Commit realizado.")
        else:
            print("\n[DRY RUN] Nenhuma alteração foi feita.")
    except Exception as e:
        db.rollback()
        print(f"\n[ERRO] {e}")
        raise
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="Encerra uma championship corretamente")
    parser.add_argument("--championship-id",    type=int, required=True)
    parser.add_argument("--last-stage-id",      type=int, default=None, help="Stage ID do último dia (para importar matches pendentes)")
    parser.add_argument("--last-stage-day-id",  type=int, default=None, help="StageDay ID do último dia")
    parser.add_argument("--tournament-id",      type=str, default=None, help="Tournament ID da PUBG API (ex: eu-pecs26)")
    parser.add_argument("--dry-run",            action="store_true",    help="Mostra o que seria feito sem alterar o banco")
    args = parser.parse_args()

    # 1. Mostrar estado atual
    print("=== Estado antes ===")
    show_state(args.championship_id)

    # 2. Importar matches pendentes (se fornecido tournament-id)
    if args.tournament_id and args.last_stage_id and args.last_stage_day_id:
        print("=== Importando matches pendentes ===")
        if not args.dry_run:
            import_remaining(args.last_stage_id, args.last_stage_day_id, args.tournament_id)
        else:
            print("  [DRY RUN] Import pulado")

    # 3. Fechar championship
    print("=== Fechando championship ===")
    close_championship(args.championship_id, args.last_stage_id, args.dry_run)

    # 4. Mostrar estado final
    print("=== Estado depois ===")
    show_state(args.championship_id)


if __name__ == "__main__":
    main()
