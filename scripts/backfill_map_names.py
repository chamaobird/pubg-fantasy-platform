"""
scripts/backfill_map_names.py

Atualiza o campo map_name de todos os matches existentes no banco
buscando o dado diretamente na PUBG API.

Uso:
    python scripts/backfill_map_names.py

Requer DATABASE_URL e PUBG_API_KEY no ambiente (ou .env na raiz).
"""
import os
import sys
import time
import logging

import requests
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

DATABASE_URL = os.environ["DATABASE_URL"]
PUBG_API_KEY = os.environ["PUBG_API_KEY"]

PUBG_HEADERS = {
    "Authorization": f"Bearer {PUBG_API_KEY}",
    "Accept": "application/vnd.api+json",
}

# Mapeamento de código interno → nome legível (para referência, não usado aqui)
MAP_NAMES = {
    "Baltic_Main":   "Erangel",
    "Desert_Main":   "Miramar",
    "Tiger_Main":    "Taego",
    "Neon_Main":     "Rondo",
    "Vikendi_Main":  "Vikendi",
    "Savage_Main":   "Sanhok",
    "Kiki_Main":     "Deston",
    "Heaven_Main":   "Haven",
}


def fetch_map_name(pubg_match_id: str, shard: str) -> str | None:
    url = f"https://api.pubg.com/shards/{shard}/matches/{pubg_match_id}"
    try:
        r = requests.get(url, headers=PUBG_HEADERS, timeout=10)
        if r.status_code == 200:
            return r.json().get("data", {}).get("attributes", {}).get("mapName")
        elif r.status_code == 429:
            logger.warning("Rate limited — aguardando 10s...")
            time.sleep(10)
            return fetch_map_name(pubg_match_id, shard)
        else:
            logger.error("HTTP %s para match %s", r.status_code, pubg_match_id)
            return None
    except Exception as e:
        logger.error("Erro ao buscar match %s: %s", pubg_match_id, e)
        return None


def main():
    engine = create_engine(DATABASE_URL)

    with Session(engine) as db:
        rows = db.execute(
            text("SELECT id, pubg_match_id, shard FROM match WHERE map_name IS NULL ORDER BY id")
        ).fetchall()

        logger.info("Encontrados %d matches sem map_name", len(rows))

        updated = 0
        for match_id, pubg_match_id, shard in rows:
            map_name = fetch_map_name(pubg_match_id, shard)
            if map_name:
                db.execute(
                    text("UPDATE match SET map_name = :map_name WHERE id = :id"),
                    {"map_name": map_name, "id": match_id},
                )
                logger.info("✓ match %d (%s) → %s", match_id, pubg_match_id[:8], map_name)
                updated += 1
            else:
                logger.warning("✗ match %d (%s) — map_name não obtido", match_id, pubg_match_id[:8])

            # Respeitar rate limit da PUBG API (~10 req/min no free tier)
            time.sleep(0.7)

        db.commit()
        logger.info("Backfill concluído: %d/%d atualizados", updated, len(rows))


if __name__ == "__main__":
    main()
