"""
extract_finals_teams.py
───────────────────────
Busca todos os matches dos torneios PEC (eu-pecs26) e PAS (am-pas126) via
PUBG API, extrai os participantes e agrupa-os pela tag do time (prefixo do
nome antes do primeiro '_').

Saída:
  - Exibe resumo no terminal
  - Grava docs/finals_teams_from_api.txt para revisão manual

Uso:
    python scripts/pubg/extract_finals_teams.py

Variáveis de ambiente:
    PUBG_API_KEY=...
    (DATABASE_URL não é necessária — script apenas lê a API)
"""

from __future__ import annotations

import os
import re
import sys
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

try:
    import requests
    from dotenv import load_dotenv
except ImportError:
    sys.exit("pip install requests python-dotenv")

load_dotenv(ROOT / ".env")

API_KEY = os.getenv("PUBG_API_KEY") or os.getenv("PUBG_API_TOKEN") or os.getenv("PUBG_TOKEN")
if not API_KEY:
    sys.exit("❌  PUBG_API_KEY não encontrada. Defina no .env")

BASE    = "https://api.pubg.com"
HEADERS = {"Authorization": f"Bearer {API_KEY}", "Accept": "application/vnd.api+json"}

TOURNAMENTS = [
    ("PEC", "eu-pecs26"),
    ("PAS", "am-pas126"),
]

OUTPUT_FILE = ROOT / "docs" / "finals_teams_from_api.txt"

# ── Rate limit ─────────────────────────────────────────────────────────────────

_last_req = 0.0

def _throttle():
    global _last_req
    elapsed = time.time() - _last_req
    if elapsed < 6.5:
        time.sleep(6.5 - elapsed)
    _last_req = time.time()


def api_get(url: str) -> dict:
    _throttle()
    resp = requests.get(url, headers=HEADERS, timeout=20)
    if resp.status_code == 429:
        print("  [rate limit] aguardando 65s...")
        time.sleep(65)
        resp = requests.get(url, headers=HEADERS, timeout=20)
    resp.raise_for_status()
    return resp.json()


# ── PUBG API ───────────────────────────────────────────────────────────────────

def get_tournament_match_ids(tournament_id: str) -> list[str]:
    print(f"  Buscando matches do torneio {tournament_id}...")
    data = api_get(f"{BASE}/tournaments/{tournament_id}")
    matches = (
        data.get("data", {})
            .get("relationships", {})
            .get("matches", {})
            .get("data", [])
    )
    ids = [m["id"] for m in matches]
    print(f"  → {len(ids)} matches encontrados")
    return ids


def get_match_participants(match_id: str) -> list[dict]:
    """Retorna lista de {name, account_id, kills, damage, placement}."""
    data = api_get(f"{BASE}/shards/pc-tournament/matches/{match_id}")
    participants = []
    for item in data.get("included", []):
        if item.get("type") != "participant":
            continue
        stats = item.get("attributes", {}).get("stats", {})
        participants.append({
            "name":       stats.get("name", ""),
            "account_id": stats.get("playerId", ""),
            "kills":      stats.get("kills", 0),
            "damage":     round(stats.get("damageDealt", 0), 1),
            "placement":  stats.get("winPlace", 0),
        })
    return participants


# ── Tag parsing ────────────────────────────────────────────────────────────────

TAG_RE = re.compile(r"^([A-Z0-9]{2,6})_(.+)$")

def parse_tag(name: str) -> tuple[str, str]:
    """
    Tenta extrair a tag do time do nome do jogador.
    Ex: 'TWIS_xmpl' → ('TWIS', 'xmpl')
        'gabriehw'  → ('', 'gabriehw')   # sem tag
    """
    m = TAG_RE.match(name)
    if m:
        return m.group(1), m.group(2)
    return "", name


# ── Core ───────────────────────────────────────────────────────────────────────

def process_tournament(label: str, tournament_id: str) -> dict[str, set[str]]:
    """
    Busca todos os matches do torneio e retorna:
        tag → set de nomes de jogadores
    """
    print(f"\n{'═'*60}")
    print(f"  {label} — {tournament_id}")
    print(f"{'═'*60}")

    match_ids = get_tournament_match_ids(tournament_id)

    # tag → {player_name, ...}
    tag_players: dict[str, set[str]] = defaultdict(set)
    # Para jogadores sem tag, tentar inferir pelo contexto
    notag_players: set[str] = set()

    for i, mid in enumerate(match_ids, 1):
        print(f"  [{i:02d}/{len(match_ids)}] match {mid[:8]}...", end=" ")
        try:
            participants = get_match_participants(mid)
            for p in participants:
                tag, player = parse_tag(p["name"])
                if tag:
                    tag_players[tag].add(p["name"])  # guarda nome completo
                else:
                    notag_players.add(p["name"])
            print(f"→ {len(participants)} participantes")
        except requests.HTTPError as e:
            print(f"→ ERRO {e.response.status_code}")

    if notag_players:
        print(f"\n  ⚠️  {len(notag_players)} jogadores SEM tag detectada:")
        for n in sorted(notag_players):
            print(f"     {n}")
        tag_players["SEM_TAG"].update(notag_players)

    return dict(tag_players)


def write_output(results: dict[str, dict[str, set[str]]]):
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        "# ============================================================",
        "# TEAMS EXTRAÍDOS DA PUBG API — Para revisão",
        f"# Gerado em: {now}",
        "# ============================================================",
        "#",
        "# Instruções:",
        "#   - Verifique nomes de jogadores (use o nome exato da API)",
        "#   - Adicione o nome completo do time após a tag",
        "#   - Remova jogadores que são SUBS (não fazem parte do roster oficial)",
        "#   - Remova times que NÃO participam das Finals",
        "#   - Salve e devolva para criar o seed script",
        "#",
        "# Formato:",
        "#   [TAG] Nome do Time | jogador1, jogador2, jogador3, jogador4",
        "#",
        "# Nota: jogadores aparecem com nome completo (TAG_nome).",
        "#       Para o banco, usamos apenas a parte após o '_' como display_name.",
        "#",
    ]

    for label, tag_players in results.items():
        lines.append("")
        lines.append("")
        lines.append(f"# {'='*56}")
        lines.append(f"# {label}")
        lines.append(f"# {'='*56}")
        lines.append("")

        # Ordenar por tag
        for tag in sorted(tag_players.keys()):
            players = sorted(tag_players[tag])
            # Exibir nomes completos para facilitar identificação
            players_str = ", ".join(players)
            lines.append(f"[{tag:<6}] ??? | {players_str}")

    lines.append("")
    OUTPUT_FILE.write_text("\n".join(lines), encoding="utf-8")
    print(f"\n  💾 Arquivo gravado: {OUTPUT_FILE}")


def print_summary(results: dict[str, dict[str, set[str]]]):
    total_tags = sum(len(t) for t in results.values())
    total_players = sum(
        len(players)
        for tag_players in results.values()
        for players in tag_players.values()
    )
    print(f"\n{'═'*60}")
    print(f"  RESUMO FINAL")
    print(f"{'═'*60}")
    for label, tag_players in results.items():
        real_tags = {t: p for t, p in tag_players.items() if t != "SEM_TAG"}
        sem_tag   = tag_players.get("SEM_TAG", set())
        print(f"  {label}: {len(real_tags)} times detectados"
              + (f"  |  {len(sem_tag)} sem tag" if sem_tag else ""))
        for tag in sorted(real_tags.keys()):
            names = sorted(real_tags[tag])
            print(f"    [{tag:<6}] {len(names):2d} nomes → {', '.join(names)}")
    print(f"\n  Total: {total_tags} tags  |  {total_players} ocorrências de jogadores")
    print(f"{'═'*60}")


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    results = {}
    for label, tournament_id in TOURNAMENTS:
        results[label] = process_tournament(label, tournament_id)

    print_summary(results)
    write_output(results)


if __name__ == "__main__":
    main()
