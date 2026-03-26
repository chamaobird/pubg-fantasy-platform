"""
build_live_id_mapping.py
========================
Fetches participants from one match per group (A/B/C/D) via the debug endpoint,
cross-references with DB players, and generates the bulk-set-live-ids payload.

Usage:
  python build_live_id_mapping.py
"""

import json
import re
import sys

try:
    import requests
except ImportError:
    print("pip install requests --break-system-packages")
    sys.exit(1)

# ── Config ────────────────────────────────────────────────────────────────────
API_BASE      = "https://pubg-fantasy-platform.onrender.com"
TOURNAMENT_ID = 7

# One representative match per group (doesn't matter which — same teams each week)
GROUP_MATCHES = {
    "A": "89282bab-c579-4025-8a36-f7c63fa59207",
    "B": "0fc2a916-f48f-4377-9eb0-41a0137a13aa",
    "C": "fe6aefe2-6920-422e-be09-1a19ff8a9ddb",
    "D": "facc92c6-633f-4f0a-b937-78ff782d33d0",
}
# ─────────────────────────────────────────────────────────────────────────────


def normalise(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", name.lower())


def strip_prefix(name: str) -> str:
    """Remove team prefix (everything up to and including first underscore)."""
    if "_" in name:
        return name.split("_", 1)[1]
    return name


def fetch_db_players() -> list[dict]:
    url = f"{API_BASE}/tournaments/{TOURNAMENT_ID}/debug-players"
    print(f"Fetching DB players from {url} …")
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    players = r.json().get("all_players", [])
    print(f"  → {len(players)} players loaded from DB")
    return players


def fetch_group_participants(group: str, match_id: str) -> list[dict]:
    url = f"{API_BASE}/tournaments/{TOURNAMENT_ID}/debug-match-resolve/{match_id}?shard=steam"
    print(f"  Fetching Group {group} participants ({match_id[:8]}…) …")
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    data = r.json()
    participants = data.get("unresolved", []) + data.get("resolved", [])
    print(f"    → {len(participants)} participants ({data['resolved_count']} resolved, {data['unresolved_count']} unresolved)")
    return participants


def build_mapping(db_players: list[dict], live_players: list[dict]):
    # Build lookup: normalised_name → db_player
    lookup: dict[str, dict] = {}
    for p in db_players:
        name = p["name"]
        lookup[normalise(name)] = p
        lookup[normalise(strip_prefix(name))] = p

    matched   = []
    unmatched = []
    seen_live_ids: set[str] = set()

    for lp in live_players:
        live_name = lp["pubg_name"]
        live_id   = lp["pubg_account_id"]

        if live_id in seen_live_ids:
            continue
        seen_live_ids.add(live_id)

        # Try direct + prefix-stripped normalised match
        db_p = lookup.get(normalise(live_name)) or lookup.get(re.sub(r"[^a-z]", "", normalise(live_name)))

        if db_p:
            # Avoid duplicate DB entries (same player matched twice)
            if not any(m["player_name"] == db_p["name"] for m in matched):
                matched.append({
                    "live_name":    live_name,
                    "db_name":      db_p["name"],
                    "live_pubg_id": live_id,
                    "player_name":  db_p["name"],
                })
        else:
            unmatched.append({"live_name": live_name, "live_pubg_id": live_id})

    return matched, unmatched


def main():
    db_players = fetch_db_players()

    # Collect participants from all 4 groups
    print("\nFetching participants from one match per group …")
    all_participants: list[dict] = []
    for group, match_id in GROUP_MATCHES.items():
        participants = fetch_group_participants(group, match_id)
        all_participants.extend(participants)

    print(f"\nTotal participants collected (with duplicates): {len(all_participants)}")

    matched, unmatched = build_mapping(db_players, all_participants)

    print(f"\n✓ Matched: {len(matched)}")
    print(f"✗ Unmatched (not in DB — expected): {len(unmatched)}")

    print("\n── Matched players ──")
    for m in sorted(matched, key=lambda x: x["db_name"]):
        print(f"  {m['live_name']:<25} → {m['db_name']}")

    # Build payload for POST /admin/players/bulk-set-live-ids
    payload = {
        "entries": [
            {"player_name": m["player_name"], "live_pubg_id": m["live_pubg_id"]}
            for m in matched
        ]
    }

    out_file = "live_id_payload.json"
    with open(out_file, "w") as f:
        json.dump(payload, f, indent=2)

    print(f"\n✅ Payload saved to {out_file}  ({len(matched)} entries)")
    print("\nApply with:")
    print(f"""$body = Get-Content '{out_file}' -Raw
Invoke-RestMethod -Uri "{API_BASE}/admin/players/bulk-set-live-ids" `
    -Method POST -Headers $headers -Body $body""")


if __name__ == "__main__":
    main()
