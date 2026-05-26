"""
scripts/pubg/populate_pgs2026.py
─────────────────────────────────
Cria toda a estrutura da PGS 2026 no banco:
  - 1 Championship
  - 8 Stages (PGS1 WS/SS/FS, PGS2 WS/SS/FS, PGS3 SS/GF)
  - StageDays para cada stage
  - Importa os matches de cada tournament via API do PUBG

Uso (da raiz do projeto):
    python scripts/pubg/populate_pgs2026.py

Flags opcionais:
    --dry-run     Mostra o que seria criado sem tocar no banco
    --skip-import Cria estrutura no banco mas não importa matches da API

Pré-requisitos:
    - DATABASE_URL e PUBG_API_KEY no .env
    - pgs_match_ids.json na raiz (gerado por check_pgs_data.py + check_pgs_retry.py)
    - Backend não precisa estar rodando (acessa banco diretamente)

ATENÇÃO: Este script assume banco LIMPO. Não roda TRUNCATE —
         faça isso manualmente antes se necessário:
         DELETE FROM match_stat; DELETE FROM match; DELETE FROM stage_day;
         DELETE FROM roster; DELETE FROM stage; DELETE FROM championship;
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from datetime import date, datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv

# ── Bootstrap — adiciona raiz ao path para importar app ───────────────────────
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

load_dotenv(ROOT / ".env")

from app.database import SessionLocal  # noqa: E402
from app.models.championship import Championship  # noqa: E402
from app.models.stage import Stage  # noqa: E402
from app.models.stage_day import StageDay  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

# ── PUBG API ──────────────────────────────────────────────────────────────────

API_KEY = (
    os.getenv("PUBG_API_KEY")
    or os.getenv("PUBG_API_TOKEN")
    or os.getenv("PUBG_TOKEN")
)
PUBG_HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Accept": "application/vnd.api+json",
}
PUBG_BASE = "https://api.pubg.com"


def pubg_get(url: str, retries: int = 3) -> dict:
    for attempt in range(retries):
        time.sleep(1.2)  # respeita rate limit
        resp = requests.get(url, headers=PUBG_HEADERS, timeout=15)
        if resp.status_code == 429:
            wait = 10 * (attempt + 1)
            log.warning("Rate limit — aguardando %ds...", wait)
            time.sleep(wait)
            continue
        resp.raise_for_status()
        return resp.json()
    raise RuntimeError(f"Falha após {retries} tentativas: {url}")


# ── Definição da estrutura PGS 2026 ──────────────────────────────────────────
#
# Mapeamento completo baseado no diagnóstico da API:
#
#   SERIES 1
#     PGS1 Winners Stage   as-pgs1ws   1 dia   19/03/2026   5 matches
#     PGS1 Survival Stage  as-pgs1ss   1 dia   20/03/2026   5 matches
#     PGS1 Final Stage     as-pgs1fs   2 dias  22-23/03     10 matches (5+5)
#
#   SERIES 2
#     PGS2 Winners Stage   as-pgs2ws   1 dia   26/03/2026   5 matches
#     PGS2 Survival Stage  as-pgs2ss   1 dia   27/03/2026   5 matches
#     PGS2 Final Stage     as-pgs2fs   2 dias  29-30/03     10 matches (5+5)
#
#   SERIES FINAL
#     PGS3 Survival Stage  as-pgs3ss   1 dia   02/04/2026   5 matches
#     PGS3 Grand Finals    as-pgs3gf   3 dias  05-07/04     15 matches (5+5+5)
#
# lineup_close_at = 12:35 UTC (5 min antes do início das partidas às 12:40)

STAGES_CONFIG = [
    # ── Series 1 ──────────────────────────────────────────────────────────────
    {
        "key":        "pgs1_ws",
        "name":       "PGS1 Winners Stage",
        "short_name": "PGS1WS",
        "tournament_id": "as-pgs1ws",
        "carries_stats_from": [],  # primeira stage, sem histórico interno
        "days": [
            {"day_number": 1, "date": date(2026, 3, 19), "lineup_close_at": datetime(2026, 3, 19, 12, 35, tzinfo=timezone.utc)},
        ],
    },
    {
        "key":        "pgs1_ss",
        "name":       "PGS1 Survival Stage",
        "short_name": "PGS1SS",
        "tournament_id": "as-pgs1ss",
        "carries_stats_from": [],
        "days": [
            {"day_number": 1, "date": date(2026, 3, 20), "lineup_close_at": datetime(2026, 3, 20, 12, 35, tzinfo=timezone.utc)},
        ],
    },
    {
        "key":        "pgs1_fs",
        "name":       "PGS1 Final Stage",
        "short_name": "PGS1FS",
        "tournament_id": "as-pgs1fs",
        "carries_stats_from": [],  # preenchido após IDs serem criados
        "days": [
            {"day_number": 1, "date": date(2026, 3, 22), "lineup_close_at": datetime(2026, 3, 22, 12, 35, tzinfo=timezone.utc)},
            {"day_number": 2, "date": date(2026, 3, 23), "lineup_close_at": datetime(2026, 3, 23, 12, 35, tzinfo=timezone.utc)},
        ],
    },
    # ── Series 2 ──────────────────────────────────────────────────────────────
    {
        "key":        "pgs2_ws",
        "name":       "PGS2 Winners Stage",
        "short_name": "PGS2WS",
        "tournament_id": "as-pgs2ws",
        "carries_stats_from": [],
        "days": [
            {"day_number": 1, "date": date(2026, 3, 26), "lineup_close_at": datetime(2026, 3, 26, 12, 35, tzinfo=timezone.utc)},
        ],
    },
    {
        "key":        "pgs2_ss",
        "name":       "PGS2 Survival Stage",
        "short_name": "PGS2SS",
        "tournament_id": "as-pgs2ss",
        "carries_stats_from": [],
        "days": [
            {"day_number": 1, "date": date(2026, 3, 27), "lineup_close_at": datetime(2026, 3, 27, 12, 35, tzinfo=timezone.utc)},
        ],
    },
    {
        "key":        "pgs2_fs",
        "name":       "PGS2 Final Stage",
        "short_name": "PGS2FS",
        "tournament_id": "as-pgs2fs",
        "carries_stats_from": [],
        "days": [
            {"day_number": 1, "date": date(2026, 3, 29), "lineup_close_at": datetime(2026, 3, 29, 12, 35, tzinfo=timezone.utc)},
            {"day_number": 2, "date": date(2026, 3, 30), "lineup_close_at": datetime(2026, 3, 30, 12, 35, tzinfo=timezone.utc)},
        ],
    },
    # ── Series Final ──────────────────────────────────────────────────────────
    {
        "key":        "pgs3_ss",
        "name":       "PGS3 Survival Stage",
        "short_name": "PGS3SS",
        "tournament_id": "as-pgs3ss",
        "carries_stats_from": [],
        "days": [
            {"day_number": 1, "date": date(2026, 4, 2), "lineup_close_at": datetime(2026, 4, 2, 12, 35, tzinfo=timezone.utc)},
        ],
    },
    {
        "key":        "pgs3_gf",
        "name":       "PGS3 Grand Finals",
        "short_name": "PGS3GF",
        "tournament_id": "as-pgs3gf",
        "carries_stats_from": [],
        "days": [
            {"day_number": 1, "date": date(2026, 4, 5), "lineup_close_at": datetime(2026, 4, 5, 12, 35, tzinfo=timezone.utc)},
            {"day_number": 2, "date": date(2026, 4, 6), "lineup_close_at": datetime(2026, 4, 6, 12, 35, tzinfo=timezone.utc)},
            {"day_number": 3, "date": date(2026, 4, 7), "lineup_close_at": datetime(2026, 4, 7, 12, 35, tzinfo=timezone.utc)},
        ],
    },
]


# ── Import de matches via endpoint do backend ─────────────────────────────────

def import_matches_for_stage(
    stage_id: int,
    stage_day_id: int,
    match_ids: list[str],
    backend_url: str,
    token: str,
    dry_run: bool,
) -> dict:
    """
    Chama POST /admin/stages/{stage_id}/import-matches com a lista completa.
    Payload: {"pubg_match_ids": [...], "stage_day_id": N}
    """
    if dry_run:
        log.info("    [dry-run] importaria %d matches para stage_day=%d", len(match_ids), stage_day_id)
        return {"ok": len(match_ids), "fail": 0}

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    try:
        resp = requests.post(
            f"{backend_url}/admin/stages/{stage_id}/import-matches",
            json={
                "pubg_match_ids": match_ids,
                "stage_day_id": stage_day_id,
            },
            headers=headers,
            timeout=120,  # import de 5 matches pode demorar
        )
        if resp.status_code in (200, 201):
            result = resp.json()
            log.info("    Resposta: %s", result)
            # O endpoint retorna um dict com contadores — tentamos extrair
            imported = result.get("imported", result.get("ok", len(match_ids)))
            skipped  = result.get("skipped", 0)
            errors   = result.get("errors", result.get("fail", 0))
            return {"ok": imported + skipped, "fail": errors}
        else:
            log.error("    HTTP %d: %s", resp.status_code, resp.text[:300])
            return {"ok": 0, "fail": len(match_ids)}
    except Exception as exc:
        log.error("    Erro na requisição: %s", exc)
        return {"ok": 0, "fail": len(match_ids)}


# ── Distribuição de matches por dia ──────────────────────────────────────────

def distribute_matches_by_day(
    match_ids: list[str],
    n_days: int,
) -> list[list[str]]:
    """
    Divide a lista de match_ids em grupos o mais iguais possível por dia.
    A API retorna em ordem decrescente — invertemos para ordem cronológica.

    Exemplos:
      15 matches / 3 dias → [5, 5, 5]
      10 matches / 3 dias → [3, 4, 3]  (dias do meio absorvem o resto)
      14 matches / 3 dias → [5, 5, 4]
       0 matches / N dias → [[], [], ...]
    """
    if n_days <= 0:
        return []

    ordered = list(reversed(match_ids))
    total = len(ordered)

    if total == 0:
        return [[] for _ in range(n_days)]

    base, remainder = divmod(total, n_days)
    result: list[list[str]] = []
    idx = 0
    for i in range(n_days):
        # Distribui o resto nos primeiros dias para balancear melhor
        count = base + (1 if i < remainder else 0)
        result.append(ordered[idx: idx + count])
        idx += count
    return result


# ── Main ──────────────────────────────────────────────────────────────────────

def main(dry_run: bool, skip_import: bool, backend_url: str, admin_token: str) -> None:
    # Carrega match IDs salvos
    match_ids_path = ROOT / "scripts" / "pubg" / "data" / "pgs_match_ids.json"
    if not match_ids_path.exists():
        # Fallback: raiz do projeto (localização legada)
        match_ids_path = ROOT / "pgs_match_ids.json"
        if not match_ids_path.exists():
            raise SystemExit(
                "❌  pgs_match_ids.json não encontrado.\n"
                "    Esperado em: scripts/pubg/data/pgs_match_ids.json\n"
                "    Rode check_pgs_data.py primeiro."
            )
        log.warning("  ⚠️  pgs_match_ids.json encontrado na raiz (localização legada). "
                    "Mova para scripts/pubg/data/")

    all_match_ids: dict[str, list[str]] = json.loads(match_ids_path.read_text())

    db = SessionLocal()

    try:
        print("\n" + "═" * 65)
        print("  XAMA Fantasy — Populate PGS 2026")
        print("═" * 65)

        if dry_run:
            print("  ⚠️  DRY RUN — nenhuma alteração será feita no banco\n")

        # ── 1. Championship ───────────────────────────────────────────────────

        print("\n[1/3] Criando Championship...")

        existing_champ = db.query(Championship).filter(
            Championship.short_name == "PGS26"
        ).first()

        if existing_champ:
            log.info("  Championship PGS26 já existe (id=%d) — reusando", existing_champ.id)
            championship = existing_champ
        elif not dry_run:
            championship = Championship(
                name="PUBG Global Series 2026",
                short_name="PGS26",
                shard="pc-tournament",
                is_active=True,
            )
            db.add(championship)
            db.flush()  # garante o ID antes de criar stages
            log.info("  ✅ Championship criado: id=%d", championship.id)
        else:
            log.info("  [dry-run] criaria Championship 'PUBG Global Series 2026'")
            championship = type("C", (), {"id": 0})()  # mock para dry-run

        # ── 2. Stages + StageDays ─────────────────────────────────────────────

        print("\n[2/3] Criando Stages e StageDays...")

        stage_id_map: dict[str, int] = {}  # key → stage.id

        for cfg in STAGES_CONFIG:
            # Verifica se já existe
            existing_stage = None
            if not dry_run:
                existing_stage = db.query(Stage).filter(
                    Stage.short_name == cfg["short_name"],
                    Stage.championship_id == championship.id,
                ).first()

            if existing_stage:
                log.info("  Stage %s já existe (id=%d) — pulando", cfg["short_name"], existing_stage.id)
                stage_id_map[cfg["key"]] = existing_stage.id
                continue

            if not dry_run:
                stage = Stage(
                    championship_id=championship.id,
                    name=cfg["name"],
                    short_name=cfg["short_name"],
                    shard="pc-tournament",
                    carries_stats_from=cfg["carries_stats_from"] or None,
                    lineup_status="locked",  # já passaram, não queremos abrir
                    is_active=True,
                    price_min=12,
                    price_max=35,
                    pricing_newcomer_cost=15,
                    captain_multiplier=1.30,
                )
                db.add(stage)
                db.flush()
                stage_id_map[cfg["key"]] = stage.id
                log.info("  ✅ Stage %-12s → id=%d", cfg["short_name"], stage.id)

                # StageDays
                for day_cfg in cfg["days"]:
                    sd = StageDay(
                        stage_id=stage.id,
                        day_number=day_cfg["day_number"],
                        date=day_cfg["date"],
                        lineup_close_at=day_cfg["lineup_close_at"],
                    )
                    db.add(sd)
                    db.flush()
                    log.info(
                        "    └─ StageDay D%d → id=%d  (%s)",
                        day_cfg["day_number"], sd.id, day_cfg["date"],
                    )
            else:
                log.info(
                    "  [dry-run] criaria Stage %s com %d day(s)",
                    cfg["short_name"], len(cfg["days"]),
                )
                stage_id_map[cfg["key"]] = 0

        if not dry_run:
            db.commit()
            log.info("\n  ✅ Banco commitado — Championship + Stages + StageDays criados")

        # ── 3. Import de matches ──────────────────────────────────────────────

        if skip_import:
            print("\n[3/3] Import de matches pulado (--skip-import)\n")
        else:
            print("\n[3/3] Importando matches...")

            if not admin_token:
                log.warning(
                    "  ⚠️  --token não fornecido. "
                    "Passe seu JWT admin com --token=<jwt> para importar matches.\n"
                    "  Estrutura criada no banco. Importe os matches manualmente via Swagger."
                )
            else:
                for cfg in STAGES_CONFIG:
                    t_id = cfg["tournament_id"]
                    stage_id = stage_id_map.get(cfg["key"], 0)
                    match_ids = all_match_ids.get(t_id, [])

                    if not match_ids:
                        log.warning("  %-10s → sem match IDs disponíveis, pulando", cfg["short_name"])
                        continue

                    n_days = len(cfg["days"])
                    days_in_db = []

                    if not dry_run and stage_id:
                        days_in_db = (
                            db.query(StageDay)
                            .filter(StageDay.stage_id == stage_id)
                            .order_by(StageDay.day_number)
                            .all()
                        )

                    distributed = distribute_matches_by_day(match_ids, n_days)

                    log.info("\n  ▶ %s (stage_id=%d)", cfg["name"], stage_id)

                    # Fecha a sessão do banco ANTES do import HTTP
                    # para evitar timeout de conexão idle no Render
                    day_ids = [d.id for d in days_in_db] if days_in_db else [0] * n_days
                    db.close()

                    for i, (day_matches, day_id) in enumerate(zip(distributed, day_ids)):
                        day_num = i + 1
                        log.info(
                            "    D%d → %d matches (stage_day_id=%d)",
                            day_num, len(day_matches), day_id,
                        )

                        result = import_matches_for_stage(
                            stage_id=stage_id,
                            stage_day_id=day_id,
                            match_ids=day_matches,
                            backend_url=backend_url,
                            token=admin_token,
                            dry_run=dry_run,
                        )
                        n_ok   = result["ok"]
                        n_fail = len(result["fail"]) if isinstance(result["fail"], list) else result["fail"]
                        log.info("      ok=%d  falha=%d", n_ok, n_fail)

                    # Reabre sessão para próxima iteração
                    db = SessionLocal()

        # ── Resumo ────────────────────────────────────────────────────────────

        print("\n" + "═" * 65)
        print("  Resumo")
        print("═" * 65)
        print(f"  Championship : PUBG Global Series 2026 (PGS26)")
        print(f"  Stages       : {len(STAGES_CONFIG)}")
        total_days = sum(len(c["days"]) for c in STAGES_CONFIG)
        total_matches = sum(len(all_match_ids.get(c["tournament_id"], [])) for c in STAGES_CONFIG)
        print(f"  Stage Days   : {total_days}")
        print(f"  Matches disp.: {total_matches}")
        if dry_run:
            print("\n  ⚠️  DRY RUN — nenhuma alteração foi feita")
        else:
            print("\n  ✅ Populate concluído")
            if not admin_token and not skip_import:
                print("\n  ⚠️  Próximo passo: importe os matches via Swagger ou")
                print("     rode novamente com --token=<seu_jwt_admin>")
        print("═" * 65 + "\n")

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Populate PGS 2026 no banco XAMA Fantasy")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Mostra o que seria criado sem tocar no banco",
    )
    parser.add_argument(
        "--skip-import",
        action="store_true",
        help="Cria estrutura no banco mas não importa matches",
    )
    parser.add_argument(
        "--backend",
        default="http://localhost:8000",
        help="URL base do backend (default: http://localhost:8000)",
    )
    parser.add_argument(
        "--token",
        default="",
        help="JWT do usuário admin para autenticar o import de matches",
    )
    args = parser.parse_args()

    if not API_KEY:
        raise SystemExit("❌  PUBG_API_KEY não encontrada no .env")

    main(
        dry_run=args.dry_run,
        skip_import=args.skip_import,
        backend_url=args.backend,
        admin_token=args.token,
    )
