"""
validate_event.py
─────────────────
Checklist pre-evento: valida o estado do banco antes de abrir o lineup.

Uso:
    python scripts/pubg/validate_event.py --stage-id 23
    python scripts/pubg/validate_event.py --stage-id 23 --tournament-id eu-pecs26

Verificacoes:
    1. Jogadores com account_id PENDING_ no roster da stage
    2. Times sem logo (.png) em frontend/public/logos/
    3. Times sem entrada em TEAM_NAME_TO_TAG (teamUtils.js)
    4. pricing_distribution com aspas extras
    5. lineup_close_at configurado na stage
    6. [se --tournament-id] Shard do championship bate com o detectado na PUBG API
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from sqlalchemy import text as sql_text

from app.database import SessionLocal

LOGOS_BASE = ROOT / "frontend" / "public" / "logos"
TEAM_UTILS = ROOT / "frontend" / "src" / "utils" / "teamUtils.js"

OK   = "[OK]"
WARN = "[WARN]"
FAIL = "[FAIL]"
INFO = "[INFO]"


def _check_pending_accounts(db, stage_id: int) -> list[str]:
    rows = db.execute(
        sql_text("""
            SELECT p.display_name, pa.account_id, pa.shard
            FROM roster r
            JOIN person p ON p.id = r.person_id
            JOIN player_account pa ON pa.person_id = r.person_id
            WHERE r.stage_id = :stage_id
              AND pa.account_id LIKE 'PENDING%'
            ORDER BY p.display_name
        """),
        {"stage_id": stage_id},
    ).fetchall()
    return [(name, acc, shard) for name, acc, shard in rows]


def _get_stage_info(db, stage_id: int) -> dict | None:
    row = db.execute(
        sql_text("""
            SELECT s.name, s.short_name, s.shard, s.lineup_close_at,
                   s.lineup_status, s.pricing_distribution,
                   c.name as champ_name, c.id as champ_id
            FROM stage s
            JOIN championship c ON c.id = s.championship_id
            WHERE s.id = :stage_id
        """),
        {"stage_id": stage_id},
    ).fetchone()
    if not row:
        return None
    return dict(row._mapping)


def _get_teams(db, stage_id: int) -> list[str]:
    rows = db.execute(
        sql_text("""
            SELECT DISTINCT r.team_name
            FROM roster r
            WHERE r.stage_id = :stage_id
              AND r.team_name IS NOT NULL
            ORDER BY r.team_name
        """),
        {"stage_id": stage_id},
    ).fetchall()
    return [r[0] for r in rows]


def _load_team_name_to_tag() -> dict[str, str]:
    """
    Extrai o mapeamento completo {nome: tag} do TEAM_NAME_TO_TAG em teamUtils.js.
    Retorna dict vazio se o arquivo nao for encontrado.
    """
    if not TEAM_UTILS.exists():
        return {}
    content = TEAM_UTILS.read_text(encoding="utf-8")
    # Captura pares "Nome do Time": "TAG"
    pairs = re.findall(r'["\']([^"\']+)["\']:\s*["\']([A-Za-z0-9_\-]+)["\']', content)
    return {name.upper(): tag.upper() for name, tag in pairs}


def _all_logo_tags() -> set[str]:
    """Retorna todas as tags de logo disponíveis em todas as subpastas de logos/."""
    tags: set[str] = set()
    if not LOGOS_BASE.exists():
        return tags
    for folder in LOGOS_BASE.iterdir():
        if folder.is_dir():
            for f in folder.iterdir():
                if f.suffix.lower() in (".png", ".jpg", ".jpeg"):
                    tags.add(f.stem.upper())
    return tags


def _detect_shard_from_api(tournament_id: str) -> tuple[str, bool]:
    """Retorna (shard detectado, verificado). Nao lanca excecao."""
    import httpx
    api_key = os.getenv("PUBG_API_KEY", "")
    if not api_key:
        return "desconhecido", False
    headers = {"Authorization": f"Bearer {api_key}", "Accept": "application/vnd.api+json"}
    try:
        resp = httpx.get(f"https://api.pubg.com/tournaments/{tournament_id}", headers=headers, timeout=10)
        if not resp.is_success:
            return "desconhecido", False
        matches = resp.json().get("data", {}).get("relationships", {}).get("matches", {}).get("data", [])
        if not matches:
            return "pc-tournament", False  # torneio existe mas sem matches ainda
        sample_id = matches[0]["id"]
        probe = httpx.get(
            f"https://api.pubg.com/shards/pc-tournament/matches/{sample_id}",
            headers=headers, timeout=10,
        )
        shard = "pc-tournament" if probe.status_code == 200 else "steam"
        return shard, True
    except Exception:
        return "desconhecido", False


def run(stage_id: int, tournament_id: str | None = None):
    db = SessionLocal()
    issues = 0

    try:
        # ── Stage info ──────────────────────────────────────────────────────
        stage = _get_stage_info(db, stage_id)
        if not stage:
            print(f"{FAIL} Stage {stage_id} nao encontrada no banco.")
            return

        print(f"\nValidacao pre-evento — Stage {stage_id}: {stage['name']}")
        print(f"  Championship: {stage['champ_name']} | Shard: {stage['shard']}")
        print(f"  Status: {stage['lineup_status']}")
        print("-" * 60)

        # ── 1. PENDING_ accounts ────────────────────────────────────────────
        pending = _check_pending_accounts(db, stage_id)
        if pending:
            print(f"{FAIL} {len(pending)} jogador(es) com account PENDING_ no roster:")
            for name, acc, shard in pending:
                print(f"     - {name}: {acc} (shard={shard})")
            issues += len(pending)
        else:
            print(f"{OK}   Nenhum account PENDING_ no roster.")

        # ── 2. lineup_close_at ──────────────────────────────────────────────
        if stage["lineup_close_at"]:
            print(f"{OK}   lineup_close_at configurado: {stage['lineup_close_at']}")
        else:
            print(f"{WARN} lineup_close_at NAO configurado — o lineup nao fechara automaticamente.")
            issues += 1

        # ── 3. pricing_distribution ─────────────────────────────────────────
        pd = stage.get("pricing_distribution") or ""
        if pd.startswith("'") or pd.endswith("'"):
            print(f"{FAIL} pricing_distribution tem aspas extras: {pd!r}  (deve ser 'linear', sem aspas internas)")
            issues += 1
        elif pd:
            print(f"{OK}   pricing_distribution: {pd}")
        else:
            print(f"{WARN} pricing_distribution nao configurado (NULL).")

        # ── 4. Times / logos / teamUtils ────────────────────────────────────
        teams = _get_teams(db, stage_id)
        if not teams:
            print(f"{WARN} Nenhum time encontrado no roster da stage.")
        else:
            name_to_tag = _load_team_name_to_tag()
            all_logo_tags = _all_logo_tags()

            if not TEAM_UTILS.exists():
                print(f"{WARN} teamUtils.js nao encontrado em {TEAM_UTILS.relative_to(ROOT)}")
            if not LOGOS_BASE.exists():
                print(f"{WARN} Pasta de logos nao encontrada em frontend/public/logos/")

            print(f"\n  Times no roster ({len(teams)}):")
            for team in teams:
                team_upper = team.upper()
                tag = name_to_tag.get(team_upper, "").upper()

                has_utils = bool(tag)
                has_logo  = bool(tag) and tag in all_logo_tags

                logo_mark  = OK   if has_logo  else FAIL
                utils_mark = OK   if has_utils else WARN
                tag_label  = tag if tag else "?"

                if not has_logo:
                    issues += 1
                if not has_utils:
                    issues += 1

                print(f"    {team[:22]:22}  tag={tag_label:8}  logo={logo_mark}  teamUtils={utils_mark}")

        # ── 5. Shard via API ─────────────────────────────────────────────────
        if tournament_id:
            print(f"\n  Verificando shard via PUBG API (tournament={tournament_id})...")
            detected, verified = _detect_shard_from_api(tournament_id)
            db_shard = stage["shard"]
            if not verified:
                print(f"  {WARN} Nao foi possivel verificar shard via API.")
            elif detected == db_shard:
                print(f"  {OK}   Shard correto: {db_shard} (confirmado via API)")
            else:
                print(f"  {FAIL} Shard DIVERGENTE — banco={db_shard!r}, API detectou={detected!r}")
                print(f"         Corrigir: UPDATE stage SET shard='{detected}' WHERE championship_id={stage['champ_id']};")
                issues += 1

        # ── Resumo ──────────────────────────────────────────────────────────
        print("-" * 60)
        if issues == 0:
            print(f"\n{OK}  Tudo OK — stage {stage_id} pronta para abrir o lineup.\n")
        else:
            print(f"\n{FAIL} {issues} problema(s) encontrado(s) — resolver antes de abrir o lineup.\n")

    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="Validacao pre-evento de uma stage")
    parser.add_argument("--stage-id",      type=int, required=True, help="ID da stage a validar")
    parser.add_argument("--tournament-id", type=str, default=None,  help="Tournament ID para verificar shard via API")
    args = parser.parse_args()
    run(args.stage_id, args.tournament_id)


if __name__ == "__main__":
    main()
