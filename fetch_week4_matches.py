"""
fetch_week4_matches.py
Busca os UUIDs das partidas da PAS Week 4 (23/03/2026) no shard steam
a partir de nicks conhecidos de cada grupo.

Janela de tempo: 7PM–10PM EDT = 23:00–02:00 UTC (23/03 → 24/03)
"""

import requests
from datetime import datetime, timezone

# Lê o API key direto do .env para evitar typos
import os, pathlib
_env = {}
_env_path = pathlib.Path(__file__).parent / ".env"
if _env_path.exists():
    for line in _env_path.read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            k, _, v = line.partition("=")
            _env[k.strip()] = v.strip()

API_KEY = _env.get("PUBG_API_KEY", "")
SHARD   = "steam"  # live server — as scrims da Week 4 foram no Live Server
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Accept": "application/vnd.api+json",
}

# Janela de tempo das scrims (EDT = UTC-4)
# 7PM EDT = 23:00 UTC | 10PM EDT = 02:00 UTC (dia seguinte)
WIN_START = datetime(2026, 3, 23, 23, 0, 0, tzinfo=timezone.utc)
WIN_END   = datetime(2026, 3, 24,  2, 0, 0, tzinfo=timezone.utc)

# Um nick por grupo (basta um para puxar o histórico)
GROUP_PLAYERS = {
    "A": "Tny7_",
    "B": "conf2031",
    "C": "zRec4ldo",
    "D": "DuduGladiador",
}

def get_player_match_ids(nick: str) -> list[str]:
    """Retorna lista de match IDs recentes do jogador."""
    url = f"https://api.pubg.com/shards/{SHARD}/players?filter[playerNames]={nick}"
    r = requests.get(url, headers=HEADERS, timeout=15)
    if r.status_code == 404:
        print(f"  ⚠ Jogador '{nick}' não encontrado no shard {SHARD}")
        return []
    r.raise_for_status()
    data = r.json()
    players = data.get("data", [])
    if not players:
        return []
    matches = players[0].get("relationships", {}).get("matches", {}).get("data", [])
    return [m["id"] for m in matches]

def get_match_played_at(match_id: str) -> datetime | None:
    """Retorna o datetime UTC de quando a partida foi jogada."""
    url = f"https://api.pubg.com/shards/{SHARD}/matches/{match_id}"
    r = requests.get(url, headers=HEADERS, timeout=15)
    if r.status_code == 404:
        return None
    r.raise_for_status()
    data = r.json()
    attrs = data.get("data", {}).get("attributes", {})
    created = attrs.get("createdAt")
    if not created:
        return None
    return datetime.fromisoformat(created.replace("Z", "+00:00"))

def find_group_matches(group: str, nick: str) -> list[str]:
    print(f"\n── Grupo {group} ({nick}) ──")
    match_ids = get_player_match_ids(nick)
    print(f"  Partidas recentes encontradas: {len(match_ids)}")

    group_matches = []
    for mid in match_ids:
        played_at = get_match_played_at(mid)
        if played_at is None:
            continue
        if WIN_START <= played_at <= WIN_END:
            print(f"  ✓ {mid}  ({played_at.strftime('%Y-%m-%d %H:%M UTC')})")
            group_matches.append(mid)
        else:
            print(f"  ✗ {mid}  ({played_at.strftime('%Y-%m-%d %H:%M UTC')})")

    print(f"  → {len(group_matches)} partidas no horário das scrims")
    return group_matches

# ── Main ──────────────────────────────────────────────────────────────────────
all_results: dict[str, list[str]] = {}
for group, nick in GROUP_PLAYERS.items():
    all_results[group] = find_group_matches(group, nick)

# ── Output: payload pronto para o PowerShell ─────────────────────────────────
print("\n\n══════════════════════════════════════════")
print("RESULTADO — match_group_map para import:")
print("══════════════════════════════════════════")

entries = []
for group, ids in all_results.items():
    for mid in ids:
        entries.append(f'    "{mid}": "{group}"')

print("{")
print(",\n".join(entries))
print("}")

print("\nTotal de partidas encontradas:", sum(len(v) for v in all_results.values()))
for g, ids in all_results.items():
    print(f"  Grupo {g}: {len(ids)} partidas")
