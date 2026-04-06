# app/pubg/client.py
"""
PUBG API Client — stub para Fase 3

Responsável por chamar a PUBG API e retornar dados já normalizados
no formato esperado pelo import service (RawMatch + RawPlayerStat).

Shards suportados:
  - "steam"         → scrims, PAS, Live Server
  - "pc-tournament" → torneios oficiais PGS e similares

A API key é lida do .env (PUBG_API_KEY).
Rate limit: 10 req/min para tournament endpoint, 1 req/10s para /matches.
"""
from __future__ import annotations

import logging
import os
import time
from datetime import datetime, timezone
from typing import Optional

import httpx

from app.services.import_ import RawMatch, RawPlayerStat

logger = logging.getLogger(__name__)

PUBG_API_BASE = "https://api.pubg.com"
PUBG_API_KEY  = os.getenv("PUBG_API_KEY", "")

# Rate limiting simples (sem Redis — suficiente para uso admin)
_last_request_at: float = 0.0
_MIN_INTERVAL_SECS = 1.1  # ~54 req/min, abaixo do limite de 10 req/10s


class PubgApiError(Exception):
    """Erro retornado pela PUBG API (4xx/5xx ou parsing)."""
    pass


class PubgClient:
    def __init__(self, shard: str = "steam"):
        if shard not in ("steam", "pc-tournament"):
            raise ValueError(f"Shard inválido: {shard!r}. Use 'steam' ou 'pc-tournament'.")
        self.shard = shard
        self._headers = {
            "Authorization": f"Bearer {PUBG_API_KEY}",
            "Accept": "application/vnd.api+json",
        }

    def get_match(self, pubg_match_id: str) -> RawMatch:
        """
        Busca um match na PUBG API e retorna RawMatch normalizado.

        Raises:
            PubgApiError: se a API retornar erro ou o parsing falhar.
        """
        self._rate_limit()
        url = f"{PUBG_API_BASE}/shards/{self.shard}/matches/{pubg_match_id}"

        try:
            resp = httpx.get(url, headers=self._headers, timeout=15)
        except httpx.RequestError as exc:
            raise PubgApiError(f"Erro de rede ao buscar match {pubg_match_id}: {exc}") from exc

        if resp.status_code == 404:
            raise PubgApiError(f"Match {pubg_match_id} não encontrado no shard {self.shard}")
        if resp.status_code == 429:
            raise PubgApiError("Rate limit da PUBG API atingido. Aguarde e tente novamente.")
        if not resp.is_success:
            raise PubgApiError(
                f"PUBG API retornou {resp.status_code} para match {pubg_match_id}: {resp.text[:200]}"
            )

        try:
            return self._parse_match(resp.json(), pubg_match_id)
        except (KeyError, TypeError, ValueError) as exc:
            raise PubgApiError(f"Erro ao parsear match {pubg_match_id}: {exc}") from exc

    def get_tournament_matches(self, pubg_tournament_id: str) -> list[str]:
        """
        Retorna lista de pubg_match_ids de um torneio.
        Usa o endpoint /tournaments/{id} (disponível apenas no shard pc-tournament).
        """
        self._rate_limit()
        url = f"{PUBG_API_BASE}/tournaments/{pubg_tournament_id}"

        resp = httpx.get(url, headers=self._headers, timeout=15)
        if not resp.is_success:
            raise PubgApiError(
                f"PUBG API retornou {resp.status_code} para tournament {pubg_tournament_id}"
            )

        data = resp.json()
        relationships = data.get("data", {}).get("relationships", {})
        matches = relationships.get("matches", {}).get("data", [])
        return [m["id"] for m in matches if m.get("type") == "match"]

    # -----------------------------------------------------------------------
    # Parsing interno
    # -----------------------------------------------------------------------

    def _parse_match(self, data: dict, pubg_match_id: str) -> RawMatch:
        """
        Transforma o JSON bruto da PUBG API em RawMatch.

        A API retorna um JSON:API envelope com:
          data.attributes  → metadados do match
          included[]        → roster, participant, asset objects
        """
        attrs = data["data"]["attributes"]

        map_name       = attrs.get("mapName")
        duration_secs  = int(attrs.get("duration", 0))
        created_at_str = attrs.get("createdAt")
        played_at: Optional[datetime] = None
        if created_at_str:
            try:
                played_at = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
            except ValueError:
                pass

        # Coleta participantes indexados por ID
        included = data.get("included", [])
        participants = {
            obj["id"]: obj
            for obj in included
            if obj.get("type") == "participant"
        }

        # Extrai placement por participante via rosters
        placement_by_participant: dict[str, int] = {}
        for obj in included:
            if obj.get("type") != "roster":
                continue
            placement = obj.get("attributes", {}).get("stats", {}).get("rank", 28)
            for part_ref in obj.get("relationships", {}).get("participants", {}).get("data", []):
                placement_by_participant[part_ref["id"]] = int(placement)

        player_stats: list[RawPlayerStat] = []
        for part_id, part in participants.items():
            pattrs = part.get("attributes", {}).get("stats", {})
            account_id = pattrs.get("playerId", "")

            if not account_id or account_id == "ai":
                continue

            player_stats.append(RawPlayerStat(
                account_id    = account_id,
                alias         = pattrs.get("name", ""),
                kills         = int(pattrs.get("kills", 0)),
                assists       = int(pattrs.get("assists", 0)),
                damage_dealt  = float(pattrs.get("damageDealt", 0.0)),
                placement     = placement_by_participant.get(part_id, 28),
                survival_secs = int(pattrs.get("timeSurvived", 0)),
                knocks        = int(pattrs.get("DBNOs", 0)),
                headshots     = int(pattrs.get("headshotKills", 0)),
            ))

        logger.debug(
            "[PubgClient] match=%s shard=%s — %d participantes parseados",
            pubg_match_id, self.shard, len(player_stats),
        )

        return RawMatch(
            pubg_match_id = pubg_match_id,
            map_name      = map_name,
            played_at     = played_at,
            duration_secs = duration_secs,
            player_stats  = player_stats,
        )

    def _rate_limit(self) -> None:
        global _last_request_at
        elapsed = time.monotonic() - _last_request_at
        if elapsed < _MIN_INTERVAL_SECS:
            time.sleep(_MIN_INTERVAL_SECS - elapsed)
        _last_request_at = time.monotonic()
