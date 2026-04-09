"""
check_pgs_data.py
─────────────────
Diagnóstico de disponibilidade de dados da PGS na PUBG API.

Roda na raiz do projeto (onde está o .env):
    python check_pgs_data.py

O que faz:
  1. Lê PUBG_API_KEY do .env
  2. Lista todos os tournaments disponíveis no shard pc-tournament
  3. Para cada tournament ID da PGS conhecido, tenta buscar os matches
  4. Exibe um resumo: quais stages têm dados, quantas partidas, datas
"""

import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv

# ── Config ────────────────────────────────────────────────────────────────────

load_dotenv()
API_KEY = os.getenv("PUBG_API_KEY") or os.getenv("PUBG_API_TOKEN") or os.getenv("PUBG_TOKEN")

if not API_KEY:
    raise SystemExit(
        "❌  PUBG_API_KEY não encontrada no .env\n"
        "    Verifique o nome da variável no seu arquivo .env"
    )

BASE_URL = "https://api.pubg.com"
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Accept": "application/vnd.api+json",
}

# Tournament IDs conhecidos da PGS Asia 2026
# (group stage ainda sem ID confirmado — será detectado via /tournaments)
KNOWN_PGS_IDS = {
    "as-pgs1ws": "PGS1 Winners Stage",
    "as-pgs1ss": "PGS1 Survival Stage",
    "as-pgs1fs": "PGS1 Final Stage",
    "as-pgs2ws": "PGS2 Winners Stage",
    "as-pgs2ss": "PGS2 Survival Stage",
    "as-pgs2fs": "PGS2 Final Stage",
    "as-pgs3ss": "PGS3 Survival Stage (Series Final)",
    "as-pgs3gf": "PGS3 Grand Finals",
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def get(url: str, params: dict = None) -> dict:
    """GET com rate limit respeitado (10 req/min no plano free)."""
    resp = requests.get(url, headers=HEADERS, params=params, timeout=15)
    if resp.status_code == 429:
        print("  ⏳ Rate limit atingido, aguardando 6s...")
        time.sleep(6)
        resp = requests.get(url, headers=HEADERS, params=params, timeout=15)
    resp.raise_for_status()
    return resp.json()


def fmt_date(iso: str | None) -> str:
    if not iso:
        return "—"
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return dt.strftime("%d/%m/%Y %H:%M UTC")
    except Exception:
        return iso


# ── 1. Lista todos os tournaments ─────────────────────────────────────────────

print("\n" + "═" * 60)
print("  XAMA Fantasy — Diagnóstico de dados PGS na PUBG API")
print("═" * 60)

print("\n[1/3] Buscando lista de tournaments...")
try:
    data = get(f"{BASE_URL}/tournaments")
    all_tournaments = data.get("data", [])
except Exception as e:
    raise SystemExit(f"❌  Falha ao listar tournaments: {e}")

# Filtra os relacionados à PGS
pgs_tournaments = [
    t for t in all_tournaments
    if "pgs" in (t.get("id") or "").lower()
    or "pgs" in (t.get("attributes", {}).get("name") or "").lower()
]

print(f"   Total de tournaments na API: {len(all_tournaments)}")
print(f"   Tournaments com 'pgs' no ID ou nome: {len(pgs_tournaments)}")

all_found_ids = {t["id"] for t in pgs_tournaments}

# Detecta IDs novos (ex: group stage) que não estavam na lista conhecida
new_ids = all_found_ids - set(KNOWN_PGS_IDS.keys())
if new_ids:
    print(f"\n   🆕 IDs encontrados que não estavam na lista conhecida:")
    for tid in sorted(new_ids):
        attrs = next(t for t in pgs_tournaments if t["id"] == tid).get("attributes", {})
        print(f"      {tid}  |  {attrs}")
    # Adiciona ao dicionário para diagnóstico
    for tid in new_ids:
        KNOWN_PGS_IDS[tid] = f"(novo — não mapeado)"

# IDs conhecidos que não apareceram na lista
missing = set(KNOWN_PGS_IDS.keys()) - all_found_ids
if missing:
    print(f"\n   ⚠️  IDs conhecidos NÃO encontrados no endpoint /tournaments:")
    for tid in sorted(missing):
        print(f"      {tid}  →  {KNOWN_PGS_IDS[tid]}")


# ── 2. Para cada tournament, busca matches disponíveis ────────────────────────

print("\n[2/3] Verificando matches disponíveis por tournament...\n")

results = {}

for tid, label in sorted(KNOWN_PGS_IDS.items()):
    print(f"  ▶ {tid}  ({label})")
    try:
        time.sleep(0.7)  # respeita rate limit ~10 req/min
        data = get(f"{BASE_URL}/tournaments/{tid}")
        matches = data.get("data", {}).get("relationships", {}).get("matches", {}).get("data", [])

        if not matches:
            print(f"     ❌ Nenhum match disponível (dados expirados ou stage vazia)")
            results[tid] = {"label": label, "matches": [], "available": False}
            continue

        # Busca detalhes do primeiro e último match para inferir datas
        # (evita buscar todos para não estourar rate limit)
        match_ids = [m["id"] for m in matches]

        print(f"     ✅ {len(match_ids)} match(es) disponível(is)")
        results[tid] = {
            "label": label,
            "match_ids": match_ids,
            "count": len(match_ids),
            "available": True,
        }

        # Busca detalhes do primeiro match para pegar a data
        time.sleep(0.7)
        try:
            m_data = get(f"{BASE_URL}/shards/pc-tournament/matches/{match_ids[0]}")
            created = m_data.get("data", {}).get("attributes", {}).get("createdAt")
            print(f"     📅 Primeiro match: {fmt_date(created)}")
            results[tid]["first_match_date"] = created
        except Exception:
            pass

    except requests.HTTPError as e:
        if e.response.status_code == 404:
            print(f"     ❌ 404 — Tournament não encontrado na API")
        else:
            print(f"     ❌ Erro HTTP {e.response.status_code}")
        results[tid] = {"label": label, "matches": [], "available": False}
    except Exception as e:
        print(f"     ❌ Erro: {e}")
        results[tid] = {"label": label, "matches": [], "available": False}


# ── 3. Resumo final ───────────────────────────────────────────────────────────

print("\n[3/3] Resumo\n")
print(f"{'Tournament ID':<20} {'Stage':<35} {'Matches':<10} {'Disponível'}")
print("─" * 80)

for tid, info in sorted(results.items()):
    available = "✅" if info.get("available") else "❌"
    count = str(info.get("count", 0)) if info.get("available") else "—"
    print(f"{tid:<20} {info['label']:<35} {count:<10} {available}")

available_count = sum(1 for v in results.values() if v.get("available"))
print(f"\n  {available_count}/{len(results)} stages com dados disponíveis na API")

# ── 4. Salva match IDs em JSON para uso posterior ─────────────────────────────

output = {
    tid: info["match_ids"]
    for tid, info in results.items()
    if info.get("available") and info.get("match_ids")
}

output_path = Path("pgs_match_ids.json")
output_path.write_text(json.dumps(output, indent=2))
print(f"\n  💾 Match IDs salvos em: {output_path.resolve()}")
print("\n" + "═" * 60 + "\n")
