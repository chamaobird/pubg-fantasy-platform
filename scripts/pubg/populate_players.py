"""
scripts/pubg/populate_players.py
──────────────────────────────────
Varre todos os 8 tournament IDs da PGS 2026, extrai participantes únicos
via PUBG API e cria Person + PlayerAccount no banco.

Agrupamento por alias normalizado (lowercase):
    Mesmo jogador pode ter múltiplos account_ids em stages diferentes
    (lobbies oficiais criam contas novas por stage).
    Ex: NAVI_Feyerist com 3 account_ids → 1 Person + 3 PlayerAccount

Separação de alias:
    "GNS_SuccessStory" → display_name="SuccessStory"  team_tag="GNS"
    "17_xwudd"         → display_name="xwudd"         team_tag="17"
    "NAVI_boost1k-"    → display_name="boost1k-"      team_tag="NAVI"

Idempotente — pode ser re-executado sem duplicar registros.

Uso (da raiz do projeto):
    python scripts/pubg/populate_players.py
    python scripts/pubg/populate_players.py --dry-run
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

# ── Bootstrap ─────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

from app.database import SessionLocal          # noqa: E402
from app.models.person import Person           # noqa: E402
from app.models.player_account import PlayerAccount  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

# ── PUBG API ──────────────────────────────────────────────────────────────────
API_KEY = (
    os.getenv("PUBG_API_KEY")
    or os.getenv("PUBG_API_TOKEN")
    or os.getenv("PUBG_TOKEN")
)
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Accept": "application/vnd.api+json",
}
BASE_URL = "https://api.pubg.com"
SHARD    = "pc-tournament"
THROTTLE = 1.2

# Apenas os 8 tournaments da PGS 2026
PGS2026_IDS = {
    "as-pgs1ws", "as-pgs1ss", "as-pgs1fs",
    "as-pgs2ws", "as-pgs2ss", "as-pgs2fs",
    "as-pgs3ss", "as-pgs3gf",
}


def pubg_get(url: str, retries: int = 3) -> dict:
    for attempt in range(retries):
        time.sleep(THROTTLE)
        resp = requests.get(url, headers=HEADERS, timeout=15)
        if resp.status_code == 429:
            wait = 12 * (attempt + 1)
            log.warning("Rate limit — aguardando %ds...", wait)
            time.sleep(wait)
            continue
        resp.raise_for_status()
        return resp.json()
    raise RuntimeError(f"Falha após {retries} tentativas: {url}")


def parse_alias(alias: str) -> tuple[str | None, str]:
    """'TAG_Name' -> (tag, name). Sem '_' -> (None, alias)."""
    if "_" in alias:
        tag, name = alias.split("_", 1)
        return tag, name
    return None, alias


def extract_players_from_match(data: dict) -> list[tuple[str, str]]:
    """Retorna lista de (account_id, alias) do match."""
    result = []
    for obj in data.get("included", []):
        if obj.get("type") != "participant":
            continue
        stats = obj.get("attributes", {}).get("stats", {})
        aid   = stats.get("playerId", "")
        alias = stats.get("name", "")
        if aid and aid != "ai" and alias:
            result.append((aid, alias))
    return result


def main(dry_run: bool) -> None:
    match_ids_path = ROOT / "pgs_match_ids.json"
    if not match_ids_path.exists():
        raise SystemExit("pgs_match_ids.json nao encontrado na raiz.")

    all_match_ids: dict[str, list[str]] = json.loads(match_ids_path.read_text())
    pgs2026 = {
        tid: ids for tid, ids in all_match_ids.items()
        if tid in PGS2026_IDS and ids
    }

    print("\n" + "=" * 65)
    print("  XAMA Fantasy - Populate Players PGS 2026")
    print("=" * 65)
    if dry_run:
        print("  DRY RUN - nenhuma alteracao sera feita no banco\n")

    log.info(
        "Tournaments: %d  |  Matches disponiveis: %d",
        len(pgs2026), sum(len(v) for v in pgs2026.values()),
    )

    # ── 1. Coleta participantes agrupados por alias normalizado ───────────────
    print("\n[1/2] Coletando participantes da PUBG API...\n")

    # alias_key (lowercase) -> {"alias", "tag", "name", "accounts": set}
    by_alias: dict[str, dict] = {}
    total_fetched = 0

    for tid, match_ids in pgs2026.items():
        log.info("  %s (%d matches)", tid, len(match_ids))

        for match_id in match_ids:
            try:
                data    = pubg_get(f"{BASE_URL}/shards/{SHARD}/matches/{match_id}")
                players = extract_players_from_match(data)
                total_fetched += 1

                for account_id, alias in players:
                    key = alias.lower()
                    if key not in by_alias:
                        tag, name = parse_alias(alias)
                        by_alias[key] = {
                            "alias":    alias,
                            "tag":      tag,
                            "name":     name,
                            "accounts": set(),
                        }
                    by_alias[key]["accounts"].add(account_id)

                log.info(
                    "    match %s...%s - %d participantes (%d jogadores unicos)",
                    match_id[:8], match_id[-4:], len(players), len(by_alias),
                )

            except Exception as exc:
                log.error("    match %s: %s", match_id[:8], exc)

    total_players  = len(by_alias)
    total_accounts = sum(len(v["accounts"]) for v in by_alias.values())
    multi_accounts = sum(1 for v in by_alias.values() if len(v["accounts"]) > 1)

    print(f"\n  Matches processados           : {total_fetched}")
    print(f"  Jogadores unicos (por alias)  : {total_players}")
    print(f"  Total account_ids             : {total_accounts}")
    print(f"  Jogadores com multiplas contas: {multi_accounts}")

    # ── 2. Cria Person + PlayerAccount no banco ───────────────────────────────
    print("\n[2/2] Criando Person + PlayerAccount no banco...\n")

    db = SessionLocal()
    created_persons  = 0
    created_accounts = 0
    skipped_persons  = 0
    skipped_accounts = 0

    try:
        existing_account_ids: set[str] = {
            pa.account_id
            for pa in db.query(PlayerAccount.account_id)
            .filter(PlayerAccount.shard == SHARD)
            .all()
        }
        existing_persons_by_name: dict[str, int] = {
            p.display_name.lower(): p.id
            for p in db.query(Person).all()
        }
        log.info(
            "Ja no banco - Persons: %d  |  PlayerAccounts (shard=%s): %d",
            len(existing_persons_by_name), SHARD, len(existing_account_ids),
        )

        for alias_key, entry in sorted(by_alias.items()):
            display_name = entry["name"]
            tag          = entry["tag"]
            alias        = entry["alias"]
            account_ids  = entry["accounts"]

            # ── Person ────────────────────────────────────────────────────────
            if display_name.lower() in existing_persons_by_name:
                person_id = existing_persons_by_name[display_name.lower()]
                skipped_persons += 1
            elif dry_run:
                log.info(
                    "  [dry-run] Person '%-20s' tag=%-6s  %d account(s)",
                    display_name, tag or "-", len(account_ids),
                )
                created_persons  += 1
                created_accounts += len(account_ids)
                continue
            else:
                person = Person(display_name=display_name)
                db.add(person)
                db.flush()
                person_id = person.id
                existing_persons_by_name[display_name.lower()] = person_id
                created_persons += 1
                log.info(
                    "  Person id=%-4d  %-20s  tag=%-6s  (%d account(s))",
                    person_id, display_name, tag or "-", len(account_ids),
                )

            # ── PlayerAccounts ────────────────────────────────────────────────
            for account_id in sorted(account_ids):
                if account_id in existing_account_ids:
                    skipped_accounts += 1
                    continue

                if not dry_run:
                    acct = PlayerAccount(
                        person_id  = person_id,
                        account_id = account_id,
                        shard      = SHARD,
                        alias      = alias,
                    )
                    db.add(acct)
                    db.flush()
                    existing_account_ids.add(account_id)

                created_accounts += 1

        if not dry_run:
            db.commit()
            log.info("  Banco commitado")

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    # ── Resumo ────────────────────────────────────────────────────────────────
    print("\n" + "=" * 65)
    print("  Resumo")
    print("=" * 65)
    print(f"  Jogadores unicos (por alias)  : {total_players}")
    print(f"  Total account_ids na API      : {total_accounts}")
    print(f"  Persons criadas               : {created_persons}")
    print(f"  Persons ja existiam           : {skipped_persons}")
    print(f"  PlayerAccounts criados        : {created_accounts}")
    print(f"  PlayerAccounts ja existiam    : {skipped_accounts}")
    if dry_run:
        print("\n  DRY RUN - nenhuma alteracao foi feita")
    else:
        print("\n  Concluido")
    print("=" * 65 + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Populate players PGS 2026")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not API_KEY:
        raise SystemExit("PUBG_API_KEY nao encontrada no .env")

    main(dry_run=args.dry_run)
