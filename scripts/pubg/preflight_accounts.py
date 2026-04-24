"""
preflight_accounts.py
─────────────────────
Valida accounts antes do primeiro match do dia.

Busca os participantes dos matches disponíveis na API e cruza com o banco.
Detecta quatro situações:
  [OK]      account_id real (pc-tournament) encontrado no banco — import vai funcionar
  [PENDING] account_id PENDING_ no banco — pode corrigir com --fix (UPDATE)
  [STEAM]   jogador no roster só com account steam — pode corrigir com --fix (INSERT)
  [UNKNOWN] sem registro no banco — sub ou jogador fora do roster da stage

Uso:
    # Relatório sem alterar nada (padrão: usa apenas o 1º match novo)
    python scripts/pubg/preflight_accounts.py --tournament-id am-pas126 --stage-id 24

    # Verificar todos os matches disponíveis
    python scripts/pubg/preflight_accounts.py --tournament-id am-pas126 --stage-id 24 --all-matches

    # Corrigir PENDING_ e STEAM automaticamente
    python scripts/pubg/preflight_accounts.py --tournament-id am-pas126 --stage-id 24 --fix
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

from sqlalchemy import text
from app.database import SessionLocal

API_KEY = (
    os.getenv("PUBG_API_KEY")
    or os.getenv("PUBG_API_TOKEN")
    or os.getenv("PUBG_TOKEN")
    or ""
)
HEADERS = {"Authorization": f"Bearer {API_KEY}", "Accept": "application/vnd.api+json"}
BASE = "https://api.pubg.com"
SHARD = "pc-tournament"


# ── API ───────────────────────────────────────────────────────────────────────

def get_tournament_match_ids(tournament_id: str) -> list[str]:
    r = requests.get(f"{BASE}/tournaments/{tournament_id}", headers=HEADERS, timeout=15)
    r.raise_for_status()
    data = r.json()
    ids = [
        m["id"]
        for m in (
            data.get("data", {})
                .get("relationships", {})
                .get("matches", {})
                .get("data", [])
        )
    ]
    if not ids:
        ids = [m["id"] for m in data.get("included", [])]
    return ids


def get_match_participants(match_id: str) -> list[dict]:
    """Retorna lista de {account_id, name} dos participantes de um match."""
    r = requests.get(
        f"{BASE}/shards/{SHARD}/matches/{match_id}",
        headers=HEADERS,
        timeout=15,
    )
    r.raise_for_status()
    participants = []
    for item in r.json().get("included", []):
        if item.get("type") != "participant":
            continue
        stats = item.get("attributes", {}).get("stats", {})
        account_id = stats.get("playerId", "")
        name = stats.get("name", "")
        if account_id:
            participants.append({"account_id": account_id, "name": name})
    return participants


# ── Banco ─────────────────────────────────────────────────────────────────────

def load_known_db_ids() -> set[str]:
    """Todos os pubg_match_id já importados (pc-tournament)."""
    db = SessionLocal()
    try:
        rows = db.execute(
            text("SELECT pubg_match_id FROM match WHERE shard = 'pc-tournament'")
        ).fetchall()
        return {r[0] for r in rows}
    finally:
        db.close()


def load_roster_accounts(stage_id: int) -> tuple[dict, dict, dict]:
    """
    Carrega roster da stage e seus player_accounts.

    Retorna:
        by_account:    pc-tournament account_id → entry
        by_alias:      pc-tournament alias.lower() → entry
        by_steam_alias: steam alias.lower() → entry  (apenas players SEM account pc-tournament)

    entry = {person_id, display_name, alias, account_id, pending}
    """
    db = SessionLocal()
    try:
        # Accounts pc-tournament (incluindo PENDING_)
        rows = db.execute(
            text("""
                SELECT
                    pa.account_id,
                    pa.alias,
                    p.id      AS person_id,
                    p.display_name
                FROM roster r
                JOIN person p ON p.id = r.person_id
                LEFT JOIN player_account pa
                    ON pa.person_id = p.id
                    AND pa.shard = 'pc-tournament'
                    AND pa.active_until IS NULL
                WHERE r.stage_id = :stage_id
            """),
            {"stage_id": stage_id},
        ).fetchall()

        by_account: dict[str, dict] = {}
        by_alias: dict[str, dict] = {}
        persons_with_pct: set[int] = set()

        for row in rows:
            entry = {
                "person_id":    row.person_id,
                "display_name": row.display_name,
                "alias":        row.alias,
                "account_id":   row.account_id,
                "pending":      bool(row.account_id and row.account_id.startswith("PENDING_")),
            }
            if row.account_id:
                by_account[row.account_id] = entry
                persons_with_pct.add(row.person_id)
            if row.alias:
                by_alias[row.alias.lower()] = entry

        # Accounts steam para quem NÃO tem pc-tournament — usados como fallback de nome
        steam_rows = db.execute(
            text("""
                SELECT
                    pa.alias,
                    p.id      AS person_id,
                    p.display_name
                FROM roster r
                JOIN person p ON p.id = r.person_id
                JOIN player_account pa
                    ON pa.person_id = p.id
                    AND pa.shard = 'steam'
                    AND pa.active_until IS NULL
                WHERE r.stage_id = :stage_id
                  AND p.id != ALL(:with_pct)
            """),
            {"stage_id": stage_id, "with_pct": list(persons_with_pct) or [0]},
        ).fetchall()

        by_steam_alias: dict[str, dict] = {}
        for row in steam_rows:
            if row.alias:
                by_steam_alias[row.alias.lower()] = {
                    "person_id":    row.person_id,
                    "display_name": row.display_name,
                    "alias":        row.alias,
                    "account_id":   None,
                    "pending":      False,
                }

        return by_account, by_alias, by_steam_alias
    finally:
        db.close()


def fix_pending(alias: str, real_account_id: str) -> bool:
    """UPDATE PENDING_ → account_id real para o alias informado."""
    db = SessionLocal()
    try:
        result = db.execute(
            text("""
                UPDATE player_account
                SET account_id = :real_id
                WHERE alias ILIKE :alias
                  AND shard = 'pc-tournament'
                  AND account_id LIKE 'PENDING_%'
            """),
            {"real_id": real_account_id, "alias": alias},
        )
        db.commit()
        return result.rowcount > 0
    except Exception as ex:
        db.rollback()
        print(f"    [ERRO fix] {ex}")
        return False
    finally:
        db.close()


def add_pct_account(person_id: int, account_id: str, alias: str) -> bool:
    """INSERT novo player_account pc-tournament para jogador que só tinha steam."""
    db = SessionLocal()
    try:
        db.execute(
            text("""
                INSERT INTO player_account (person_id, account_id, shard, alias)
                VALUES (:person_id, :account_id, 'pc-tournament', :alias)
                ON CONFLICT DO NOTHING
            """),
            {"person_id": person_id, "account_id": account_id, "alias": alias},
        )
        db.commit()
        return True
    except Exception as ex:
        db.rollback()
        print(f"    [ERRO insert] {ex}")
        return False
    finally:
        db.close()


# ── Verificação por match ─────────────────────────────────────────────────────

def check_match(
    match_id: str,
    by_account: dict,
    by_alias: dict,
    by_steam_alias: dict,
    do_fix: bool,
) -> dict:
    print(f"\n  Match {match_id[:8]}...")
    try:
        participants = get_match_participants(match_id)
    except Exception as ex:
        print(f"    [ERRO ao buscar match] {ex}")
        return {"ok": 0, "pending": 0, "steam": 0, "unknown": 0, "fixed": 0}

    counts = {"ok": 0, "pending": 0, "steam": 0, "unknown": 0, "fixed": 0}

    for p in participants:
        api_id   = p["account_id"]
        api_name = p["name"]

        # 1. account_id real já no banco → OK
        if api_id in by_account and not by_account[api_id]["pending"]:
            counts["ok"] += 1
            continue

        # 2. Resolve por alias pc-tournament (pode ser PENDING ou ID diferente)
        entry = by_account.get(api_id) or by_alias.get(api_name.lower())

        if entry and entry["pending"]:
            counts["pending"] += 1
            print(f"    [PENDING] {api_name:<25}  real_id={api_id[:20]}...")
            if do_fix:
                if fix_pending(api_name, api_id):
                    counts["fixed"] += 1
                    entry["account_id"] = api_id
                    entry["pending"] = False
                    by_account[api_id] = entry
                    print(f"             CORRIGIDO (UPDATE PENDING→real)")
            continue

        if entry:
            # Encontrou pelo alias mas account_id difere e não é PENDING → ok (troca de ID)
            counts["ok"] += 1
            continue

        # 3. Resolve por alias steam (jogador sem pc-tournament account)
        steam_entry = by_steam_alias.get(api_name.lower())
        if steam_entry:
            counts["steam"] += 1
            print(f"    [STEAM]   {api_name:<25}  real_id={api_id[:20]}...")
            if do_fix:
                if add_pct_account(steam_entry["person_id"], api_id, api_name):
                    counts["fixed"] += 1
                    # Promove para by_account para matches seguintes
                    steam_entry["account_id"] = api_id
                    by_account[api_id] = steam_entry
                    by_steam_alias.pop(api_name.lower(), None)
                    print(f"             CORRIGIDO (INSERT pc-tournament)")
            continue

        counts["unknown"] += 1
        print(f"    [UNKNOWN] {api_name:<25}  id={api_id[:20]}...")

    summary = (
        f"    → ok={counts['ok']}  pending={counts['pending']}"
        f"  steam={counts['steam']}  unknown={counts['unknown']}"
    )
    if do_fix:
        summary += f"  fixed={counts['fixed']}"
    print(summary)
    return counts


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Pre-flight de accounts antes do match day")
    parser.add_argument("--tournament-id",  required=True,       help="ID do torneio (ex: am-pas126)")
    parser.add_argument("--stage-id",       type=int, required=True, help="Stage ID no banco")
    parser.add_argument("--fix",            action="store_true", help="Corrigir PENDING_ automaticamente")
    parser.add_argument("--all-matches",    action="store_true", help="Verificar todos os matches (default: apenas os novos)")
    args = parser.parse_args()

    print(f"\nPre-flight | tournament={args.tournament_id} | stage={args.stage_id}")
    print(f"Modo: {'CORRIGIR (--fix)' if args.fix else 'relatório (use --fix para corrigir)'}")

    # 1. Buscar IDs do torneio
    print("\n[1] Buscando matches no torneio...")
    all_ids = get_tournament_match_ids(args.tournament_id)
    if not all_ids:
        print("  Nenhum match disponível no torneio ainda.")
        return
    print(f"    {len(all_ids)} match(es) no torneio")

    # 2. Filtrar novos (não importados)
    known_db = load_known_db_ids()
    new_ids = [i for i in all_ids if i not in known_db]

    if args.all_matches:
        check_ids = all_ids
        print(f"    Verificando todos os {len(check_ids)} match(es)")
    elif new_ids:
        check_ids = new_ids
        print(f"    {len(new_ids)} novo(s) — verificando apenas os novos")
    else:
        # Todos já importados — pega o mais recente para checar
        check_ids = all_ids[-1:]
        print(f"    Todos já importados — verificando o mais recente para referência")

    # 3. Carregar roster do banco
    print(f"\n[2] Carregando roster da stage {args.stage_id}...")
    by_account, by_alias, by_steam_alias = load_roster_accounts(args.stage_id)
    n_players = len({e["person_id"] for e in list(by_account.values()) + list(by_alias.values()) + list(by_steam_alias.values())})
    print(f"    {n_players} jogadores no roster")
    if by_steam_alias:
        print(f"    {len(by_steam_alias)} com apenas account steam (sem pc-tournament): "
              f"{', '.join(e['display_name'] for e in by_steam_alias.values())}")

    if n_players == 0:
        print("  [AVISO] Roster vazio — verifique o --stage-id informado.")
        return

    # 4. Verificar cada match
    print("\n[3] Verificando participantes...")
    total = {"ok": 0, "pending": 0, "steam": 0, "unknown": 0, "fixed": 0}
    for mid in check_ids:
        counts = check_match(mid, by_account, by_alias, by_steam_alias, args.fix)
        for k in total:
            total[k] += counts[k]

    # 5. Sumário
    print(f"\n{'='*50}")
    summary = (
        f"SUMÁRIO  ok={total['ok']}  pending={total['pending']}"
        f"  steam={total['steam']}  unknown={total['unknown']}"
    )
    if args.fix:
        summary += f"  fixed={total['fixed']}"
    print(summary)

    needs_fix = total["pending"] + total["steam"]
    if needs_fix > 0 and not args.fix:
        print(f"\n  ⚠  {needs_fix} problema(s) — rode com --fix para corrigir antes do import")
        if total["pending"]:
            print(f"     {total['pending']} PENDING_ (UPDATE)")
        if total["steam"]:
            print(f"     {total['steam']} STEAM-only (INSERT pc-tournament)")
    if total["unknown"] > 0:
        print(f"  ℹ  {total['unknown']} UNKNOWN — subs ou jogadores fora do roster da stage {args.stage_id}")
    if needs_fix == 0 and total["unknown"] == 0:
        print("\n  ✓ Tudo OK — todos os participantes estão resolvidos no banco")
    elif needs_fix == 0:
        print("\n  ✓ Nenhum PENDING/STEAM — accounts resolvidos (UNKNOWN = subs, esperado)")


if __name__ == "__main__":
    main()
