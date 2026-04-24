"""
watch_matches.py
────────────────
Monitor genérico de torneio PUBG. Detecta novos matches e importa automaticamente.
Projetado para rodar em background (nohup), com logs persistentes em arquivo.

Uso:
    # Foreground (desenvolvimento / debug)
    python scripts/pubg/watch_matches.py --tournament-id am-pas126 --stage-id 24 --stage-day-id 25

    # Background persistente (produção) — sobrevive ao fim da sessão
    nohup python -u scripts/pubg/watch_matches.py \\
        --tournament-id eu-pecs26 --stage-id 27 --stage-day-id 28 \\
        --interval 3 > /dev/null 2>&1 &

    # Ver log em tempo real
    tail -f logs/watch_eu-pecs26.log

    # Parar o processo
    kill $(cat logs/watch_eu-pecs26.pid)

Arquivos criados em logs/:
    watch_{tournament_id}.log   — log persistente (append)
    watch_{tournament_id}.pid   — PID do processo (apagado ao encerrar)

Observações:
    - Suporta os dois formatos de resposta da PUBG API (PAS e PEC).
    - Carrega IDs já importados do banco no startup — nunca tenta reimportar.
    - Use python -u para evitar buffering (necessário com nohup).
"""
from __future__ import annotations

import argparse
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from app.database import SessionLocal
from app.services.import_ import import_stage_matches

API_KEY = (
    os.getenv("PUBG_API_KEY")
    or os.getenv("PUBG_API_TOKEN")
    or os.getenv("PUBG_TOKEN")
    or ""
)
HEADERS = {"Authorization": f"Bearer {API_KEY}", "Accept": "application/vnd.api+json"}
BASE = "https://api.pubg.com"


# ── Helpers ───────────────────────────────────────────────────────────────────

def now_str() -> str:
    return datetime.now(timezone.utc).strftime("%H:%M:%S UTC")


def get_tournament_match_ids(tournament_id: str) -> list[str]:
    """
    Suporta os dois formatos de resposta da PUBG API:
      - PEC: data.relationships.matches.data[].id
      - PAS: included[].id
    """
    r = requests.get(f"{BASE}/tournaments/{tournament_id}", headers=HEADERS, timeout=15)
    r.raise_for_status()
    data = r.json()

    # Formato PEC
    ids = [
        m["id"]
        for m in (
            data.get("data", {})
                .get("relationships", {})
                .get("matches", {})
                .get("data", [])
        )
    ]
    if ids:
        return ids

    # Formato PAS
    return [m["id"] for m in data.get("included", [])]


def load_known_ids() -> set[str]:
    """Carrega todos os pubg_match_ids já no banco (qualquer stage, shard pc-tournament)."""
    from sqlalchemy import text
    db = SessionLocal()
    try:
        rows = db.execute(
            text("SELECT pubg_match_id FROM match WHERE shard = 'pc-tournament'")
        ).fetchall()
        return {r[0] for r in rows}
    finally:
        db.close()


def emit(msg: str, log) -> None:
    """Escreve linha com timestamp no stdout e no log file, com flush imediato."""
    line = f"[{now_str()}] {msg}"
    print(line, flush=True)
    log.write(line + "\n")
    log.flush()


def do_import(stage_id: int, stage_day_id: int, match_ids: list[str], log) -> int:
    db = SessionLocal()
    try:
        result = import_stage_matches(
            db=db,
            stage_id=stage_id,
            pubg_match_ids=match_ids,
            stage_day_id=stage_day_id,
            force_reprocess=False,
        )
        db.commit()

        for m in result.get("matches", []):
            line = (
                f"    {m['pubg_match_id'][:8]}...  {m.get('status', '?'):<12}"
                f"  ok={m.get('players_ok', 0):2}"
                f"  skip={m.get('players_skipped', 0):2}"
                f"  pts={m.get('total_pts', 0.0):.1f}"
            )
            print(line, flush=True)
            log.write(line + "\n")
            log.flush()

        for e in result.get("errors", []):
            line = f"    [ERRO] {e.get('match_id', '?')}: {e.get('error', '?')}"
            print(line, flush=True)
            log.write(line + "\n")
            log.flush()

        return result.get("imported", len(match_ids))

    except Exception as ex:
        db.rollback()
        line = f"    [ERRO import] {ex}"
        print(line, flush=True)
        log.write(line + "\n")
        log.flush()
        return 0
    finally:
        db.close()


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Monitor genérico de torneio PUBG")
    parser.add_argument("--tournament-id",  required=True,  help="ID do torneio na API (ex: am-pas126, eu-pecs26)")
    parser.add_argument("--stage-id",       type=int, required=True,  help="Stage ID no banco")
    parser.add_argument("--stage-day-id",   type=int, required=True,  help="StageDay ID no banco")
    parser.add_argument("--interval",       type=int, default=3,      help="Intervalo de polling em minutos (default: 3)")
    args = parser.parse_args()

    # Dirs e paths
    logs_dir = ROOT / "logs"
    logs_dir.mkdir(exist_ok=True)
    log_path = logs_dir / f"watch_{args.tournament_id}.log"
    pid_path = logs_dir / f"watch_{args.tournament_id}.pid"

    # Registra PID para facilitar kill
    pid_path.write_text(str(os.getpid()))

    header = (
        f"\n{'='*60}\n"
        f"watch_matches  tournament={args.tournament_id}\n"
        f"               stage={args.stage_id}  stage_day={args.stage_day_id}\n"
        f"               interval={args.interval}min  pid={os.getpid()}\n"
        f"               log={log_path}\n"
        f"{'='*60}"
    )

    with open(log_path, "a", encoding="utf-8") as log:
        print(header, flush=True)
        log.write(header + "\n")
        log.flush()

        # Carrega IDs já importados
        known: set[str] = load_known_ids()
        emit(f"Init: {len(known)} match(es) já no banco", log)

        # Loop principal
        while True:
            try:
                ids = get_tournament_match_ids(args.tournament_id)
                new_ids = [i for i in ids if i not in known]

                if new_ids:
                    emit(f"{len(new_ids)} novo(s): {[i[:8] for i in new_ids]}", log)
                    do_import(args.stage_id, args.stage_day_id, new_ids, log)
                    known.update(new_ids)
                else:
                    emit(f"Sem novos ({len(known)} no banco, {len(ids)} no torneio)", log)

            except KeyboardInterrupt:
                emit("Parado (KeyboardInterrupt).", log)
                break
            except Exception as ex:
                emit(f"Erro no poll: {ex}", log)

            time.sleep(args.interval * 60)

    pid_path.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
