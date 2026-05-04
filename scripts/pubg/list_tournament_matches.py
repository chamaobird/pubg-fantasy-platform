"""
list_tournament_matches.py
──────────────────────────
Lista todos os matches de um ou mais torneios com data/hora,
filtrando opcionalmente por data.

Uso:
    python scripts/pubg/list_tournament_matches.py
    python scripts/pubg/list_tournament_matches.py --date 2026-05-01
    python scripts/pubg/list_tournament_matches.py --date 2026-05-02
"""

from __future__ import annotations

import os
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

try:
    import requests
    from dotenv import load_dotenv
except ImportError:
    sys.exit("pip install requests python-dotenv")

load_dotenv(ROOT / ".env")

API_KEY = (
    os.getenv("PUBG_API_KEY")
    or os.getenv("PUBG_API_TOKEN")
    or os.getenv("PUBG_TOKEN")
    or ""
)
if not API_KEY:
    sys.exit("PUBG_API_KEY não encontrada no .env")

HEADERS = {"Authorization": f"Bearer {API_KEY}", "Accept": "application/vnd.api+json"}
BASE = "https://api.pubg.com"

# PAS Playoffs 2 (stages 30-32)  e  PEC Playoffs 2 (stages 33-35)
TOURNAMENTS = [
    ("am-pas126", "PAS Americas 2026"),
    ("eu-pecs26",  "PEC EMEA 2026 Spring"),
]


def get_tournament_match_ids(tournament_id: str) -> list[str]:
    r = requests.get(f"{BASE}/tournaments/{tournament_id}", headers=HEADERS, timeout=15)
    r.raise_for_status()
    data = r.json()

    # Formato PEC
    ids = [
        m["id"]
        for m in data.get("data", {})
                     .get("relationships", {})
                     .get("matches", {})
                     .get("data", [])
    ]
    if ids:
        return ids

    # Formato PAS
    return [m["id"] for m in data.get("included", [])]


def get_match_date(match_id: str) -> str | None:
    time.sleep(0.7)  # rate limit suave
    try:
        r = requests.get(
            f"{BASE}/shards/pc-tournament/matches/{match_id}",
            headers=HEADERS,
            timeout=15,
        )
        if r.status_code == 429:
            print("  [rate limit] aguardando 65s...")
            time.sleep(65)
            r = requests.get(
                f"{BASE}/shards/pc-tournament/matches/{match_id}",
                headers=HEADERS,
                timeout=15,
            )
        if r.status_code == 404:
            return None
        r.raise_for_status()
        return r.json().get("data", {}).get("attributes", {}).get("createdAt")
    except Exception as e:
        print(f"  [erro] {match_id}: {e}")
        return None


def fmt(iso: str) -> str:
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d %H:%M UTC")
    except Exception:
        return iso


def in_window(iso: str, date_str: str) -> bool:
    try:
        target = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return target <= dt < target + timedelta(days=1)
    except Exception:
        return True


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", type=str, default=None,
                        help="Filtrar por data UTC (YYYY-MM-DD). Ex: 2026-05-01")
    parser.add_argument("--no-details", action="store_true",
                        help="Listar só os IDs sem buscar data (mais rápido)")
    args = parser.parse_args()

    for tid, name in TOURNAMENTS:
        print(f"\n{'='*60}")
        print(f"Torneio: {tid}  ({name})")
        print(f"{'='*60}")

        ids = get_tournament_match_ids(tid)
        print(f"Total de matches no torneio: {len(ids)}")

        if args.no_details:
            for mid in ids:
                print(f"  {mid}")
            continue

        print(f"Buscando detalhes de cada match (pode demorar ~{len(ids)*0.7:.0f}s)...\n")

        results = []
        for i, mid in enumerate(ids, 1):
            created = get_match_date(mid)
            if created:
                results.append((created, mid))
                print(f"  [{i:03d}/{len(ids)}] {fmt(created)}  {mid}")
            else:
                print(f"  [{i:03d}/{len(ids)}] (sem data)  {mid}")

        results.sort()

        if args.date:
            filtered = [(d, m) for d, m in results if in_window(d, args.date)]
            print(f"\n{'─'*60}")
            print(f"Matches em {args.date}: {len(filtered)}")
            for d, m in filtered:
                print(f"  {fmt(d)}  {m}")

    print("\nConcluído.")


if __name__ == "__main__":
    main()
