# app/services/match_discovery.py
"""
Match Discovery Service — descobre automaticamente match IDs de um StageDay
consultando a PUBG API por sobreposição de jogadores do roster.

Estratégia (steam shard):
  1. Amostra até MAX_SAMPLE jogadores do roster com account_id válido
  2. Para cada jogador, busca seus matches recentes (/players/{id})
  3. Conta sobreposição: match_id presente em ≥ MIN_OVERLAP jogadores → candidato
  4. Retorna IDs candidatos ordenados por overlap desc

Estratégia (pc-tournament shard):
  Usa o endpoint /tournaments/{pubg_tournament_id} diretamente.

Nota de rate limit:
  O PubgClient já faz throttle de 1.1s entre requests.
  Com MAX_SAMPLE=6 → ~7-8s de latência total, aceitável para um job a cada 2min.
"""
from __future__ import annotations

import logging
import os
import time
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

from sqlalchemy.orm import Session
from sqlalchemy import text

logger = logging.getLogger(__name__)

PUBG_API_BASE    = "https://api.pubg.com"
MAX_SAMPLE       = 6     # jogadores amostados por rodada
MIN_OVERLAP      = 3     # mínimo de jogadores em comum para ser candidato
WINDOW_HOURS     = 4     # janela de horas em torno de stage.start_date

_last_req: float = 0.0
_MIN_INTERVAL    = 1.2   # segundos entre requests


def _throttle() -> None:
    global _last_req
    elapsed = time.monotonic() - _last_req
    if elapsed < _MIN_INTERVAL:
        time.sleep(_MIN_INTERVAL - elapsed)
    _last_req = time.monotonic()


def _headers() -> dict:
    key = os.getenv("PUBG_API_KEY", "")
    return {"Authorization": f"Bearer {key}", "Accept": "application/vnd.api+json"}


def _player_match_ids(account_id: str, shard: str) -> list[str]:
    """Retorna até 14 match IDs recentes de um jogador."""
    _throttle()
    url = f"{PUBG_API_BASE}/shards/{shard}/players/{account_id}"
    try:
        resp = httpx.get(url, headers=_headers(), timeout=15)
        if resp.status_code == 404:
            return []
        if resp.status_code == 429:
            logger.warning("[MatchDiscovery] Rate limit atingido, aguardando 65s")
            time.sleep(65)
            _throttle()
            resp = httpx.get(url, headers=_headers(), timeout=15)
        resp.raise_for_status()
        data = resp.json()
        rels = data.get("data", {}).get("relationships", {}).get("matches", {}).get("data", [])
        return [m["id"] for m in rels]
    except Exception as exc:
        logger.warning("[MatchDiscovery] Erro ao buscar matches do player %s: %s", account_id, exc)
        return []


def _match_created_at(match_id: str, shard: str) -> Optional[datetime]:
    """Retorna o createdAt do match para filtragem por janela de tempo."""
    _throttle()
    url = f"{PUBG_API_BASE}/shards/{shard}/matches/{match_id}"
    try:
        resp = httpx.get(url, headers=_headers(), timeout=15)
        if not resp.is_success:
            return None
        attrs = resp.json().get("data", {}).get("attributes", {})
        raw = attrs.get("createdAt", "")
        if raw:
            return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except Exception as exc:
        logger.warning("[MatchDiscovery] Erro ao buscar createdAt do match %s: %s", match_id, exc)
    return None


def _sample_roster_accounts(db: Session, stage_id: int, limit: int = MAX_SAMPLE) -> list[str]:
    """
    Amostra account_ids do roster da stage.
    Distribui pelos times (1 por time preferencial) para melhor cobertura.
    """
    rows = db.execute(text("""
        SELECT pa.account_id, r.team_name
        FROM roster r
        JOIN person p ON p.id = r.person_id
        JOIN player_account pa ON pa.person_id = p.id
        WHERE r.stage_id = :s
          AND pa.active_until IS NULL
          AND pa.account_id IS NOT NULL
          AND pa.account_id NOT ILIKE 'PENDING%%'
        ORDER BY r.team_name, p.display_name
    """), {"s": stage_id}).fetchall()

    # Pega 1-2 por time até atingir o limite
    by_team: dict[str, list[str]] = {}
    for row in rows:
        by_team.setdefault(row.team_name, []).append(row.account_id)

    sampled: list[str] = []
    for accounts in by_team.values():
        sampled.extend(accounts[:2])
        if len(sampled) >= limit:
            break
    return sampled[:limit]


def discover_matches_steam(
    db: Session,
    stage_id: int,
    reference_dt: Optional[datetime] = None,
    already_imported: Optional[set[str]] = None,
) -> list[str]:
    """
    Descobre match IDs do dia no shard 'steam' usando overlap de jogadores.

    Args:
        db:               sessão SQLAlchemy
        stage_id:         ID da stage
        reference_dt:     datetime de referência para filtrar por janela de tempo.
                          Se None, usa agora() - WINDOW_HOURS.
        already_imported: set de pubg_match_ids já importados (para ignorar)

    Returns:
        Lista de match IDs candidatos (não importados ainda), ordenados por overlap.
    """
    already_imported = already_imported or set()
    shard = "steam"

    accounts = _sample_roster_accounts(db, stage_id)
    if not accounts:
        logger.warning("[MatchDiscovery] Nenhum account_id disponível para stage %s", stage_id)
        return []

    logger.info(
        "[MatchDiscovery] Amostando %d jogadores para stage %s",
        len(accounts), stage_id,
    )

    counter: Counter = Counter()
    for acc in accounts:
        ids = _player_match_ids(acc, shard)
        for mid in ids:
            if mid not in already_imported:
                counter[mid] += 1

    candidates = [(mid, cnt) for mid, cnt in counter.items() if cnt >= MIN_OVERLAP]
    candidates.sort(key=lambda x: -x[1])

    if not candidates:
        logger.info("[MatchDiscovery] Nenhum candidato com overlap >= %d", MIN_OVERLAP)
        return []

    # Filtro opcional por janela de tempo
    if reference_dt is None:
        reference_dt = datetime.now(timezone.utc) - timedelta(hours=WINDOW_HOURS)

    window_start = reference_dt - timedelta(hours=1)
    window_end   = reference_dt + timedelta(hours=WINDOW_HOURS)

    result: list[str] = []
    for mid, overlap in candidates:
        created = _match_created_at(mid, shard)
        if created is None or (window_start <= created <= window_end):
            logger.info(
                "[MatchDiscovery] Candidato: %s (overlap=%d, created=%s)",
                mid, overlap, created,
            )
            result.append(mid)

    return result


def discover_matches_tournament(pubg_tournament_id: str) -> list[str]:
    """
    Descobre match IDs via endpoint /tournaments/{id} (pc-tournament shard).
    Retorna todos os match IDs do torneio (inclusive já importados — o caller filtra).
    """
    _throttle()
    url = f"{PUBG_API_BASE}/tournaments/{pubg_tournament_id}"
    try:
        resp = httpx.get(url, headers=_headers(), timeout=15)
        resp.raise_for_status()
        data = resp.json()
        matches = data.get("data", {}).get("relationships", {}).get("matches", {}).get("data", [])
        return [m["id"] for m in matches if m.get("type") == "match"]
    except Exception as exc:
        logger.error("[MatchDiscovery] Erro no endpoint tournament %s: %s", pubg_tournament_id, exc)
        return []
