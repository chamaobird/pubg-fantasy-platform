"""
scripts/pubg/check_pgs_retry.py
────────────────────────────────
Verifica apenas os tournament IDs da PGS 2026 que falharam por rate limit
no diagnóstico inicial. Usa throttle maior (2s entre requests) para evitar 429.

Uso:
    python scripts/pubg/check_pgs_retry.py

Pré-requisito: pgs_match_ids.json já existente na raiz (gerado pelo check_pgs_data.py)
O resultado é mergeado no mesmo arquivo.
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
    raise SystemExit("❌  PUBG_API_KEY não encontrada no .env")

BASE_URL = "https://api.pubg.com"
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Accept": "application/vnd.api+json",
}
THROTTLE = 2.5  # segundos entre requests — conservador para evitar 429

# Apenas os IDs da PGS 2026 que falharam ou não foram confirmados
RETRY_IDS = {
    "as-pgs1fs": "PGS1 Final Stage",
    "as-pgs2ws": "PGS2 Winners Stage",
    "as-pgs3gf": "PGS3 Grand Finals",
    # Group Stage 2026 — não apareceu na lista, mas vale tentar variações
    "as-pgs1gs26": "PGS1 Group Stage 2026 (tentativa)",
    "as-pgs1group": "PGS1 Group Stage 2026 (tentativa alt)",
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def get(url: str) -> dict:
    time.sleep(THROTTLE)
    resp = requests.get(url, headers=HEADERS, timeout=15)
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


# ── Main ──────────────────────────────────────────────────────────────────────

print("\n" + "═" * 60)
print("  XAMA Fantasy — Retry de IDs com falha por rate limit")
print("═" * 60 + "\n")

# Carrega JSON existente para merge
output_path = Path("pgs_match_ids.json")
existing = json.loads(output_path.read_text()) if output_path.exists() else {}

new_results = {}

for tid, label in RETRY_IDS.items():
    print(f"  ▶ {tid}  ({label})")
    try:
        data = get(f"{BASE_URL}/tournaments/{tid}")
        matches = (
            data.get("data", {})
            .get("relationships", {})
            .get("matches", {})
            .get("data", [])
        )

        if not matches:
            print(f"     ❌ Nenhum match disponível")
            continue

        match_ids = [m["id"] for m in matches]
        print(f"     ✅ {len(match_ids)} match(es) disponível(is)")

        # Data do primeiro match
        try:
            m_data = get(f"{BASE_URL}/shards/pc-tournament/matches/{match_ids[0]}")
            created = m_data.get("data", {}).get("attributes", {}).get("createdAt")
            print(f"     📅 Primeiro match: {fmt_date(created)}")
        except Exception:
            pass

        new_results[tid] = match_ids

    except requests.HTTPError as e:
        code = e.response.status_code
        if code == 404:
            print(f"     ❌ 404 — ID não existe")
        elif code == 429:
            print(f"     ⏳ Ainda em rate limit — tente novamente em alguns minutos")
        else:
            print(f"     ❌ Erro HTTP {code}")
    except Exception as e:
        print(f"     ❌ Erro: {e}")

# Merge e salva
merged = {**existing, **new_results}
output_path.write_text(json.dumps(merged, indent=2))

print(f"\n  💾 {len(new_results)} novo(s) resultado(s) mergeado(s) em {output_path.resolve()}")
print("\n" + "═" * 60 + "\n")
