# app/services/pubg_api.py
"""
Serviço de integração com a PUBG Official API.

Documentação oficial: https://documentation.pubg.com/en/introduction.html

Autenticação:
    - Header: Authorization: Bearer {PUBG_API_KEY}
    - Header: Accept: application/vnd.api+json

Rate Limit:
    - 10 requests/minuto por API Key
    - Adicionamos sleep(6) entre chamadas para respeitar o limite

Fórmula de fantasy_cost (transparente):
    fantasy_cost = (avg_kills * 2) + (avg_damage / 100) + placement_score
    onde:
        placement_score = max(0, (28 - avg_placement) * 0.5)
        - avg_placement 1  → placement_score = 13.5
        - avg_placement 10 → placement_score = 9.0
        - avg_placement 28 → placement_score = 0.0
    Custo mínimo: 5.0  |  Custo máximo: sem limite (normalizado externamente se necessário)
"""

import asyncio
import logging
from datetime import datetime
from typing import Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

PUBG_BASE_URL = "https://api.pubg.com"
PUBG_SHARD = "pc-tournament"


def _get_headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.PUBG_API_KEY}",
        "Accept": "application/vnd.api+json",
    }


def calculate_fantasy_cost(
    avg_kills: float,
    avg_damage: float,
    avg_placement: float,
) -> float:
    """
    Calcula o fantasy_cost de um jogador de forma transparente.

    Fórmula:
        placement_score = max(0, (28 - avg_placement) * 0.5)
        fantasy_cost    = (avg_kills * 2) + (avg_damage / 100) + placement_score

    Exemplos:
        Jogador top    (5k, 300dmg, place 3):  10 + 3.0 + 12.5 = 25.5
        Jogador médio  (3k, 200dmg, place 10): 6  + 2.0 + 9.0  = 17.0
        Jogador fraco  (1k, 100dmg, place 20): 2  + 1.0 + 4.0  = 7.0

    Custo mínimo garantido: 5.0
    """
    placement_score = max(0.0, (28.0 - avg_placement) * 0.5)
    cost = (avg_kills * 2.0) + (avg_damage / 100.0) + placement_score
    return max(5.0, round(cost, 2))


class PUBGApiClient:
    """Cliente assíncrono para a PUBG Official API."""

    def __init__(self):
        self.base_url = PUBG_BASE_URL
        self.shard = PUBG_SHARD
        self._client: Optional[httpx.AsyncClient] = None

    async def __aenter__(self):
        self._client = httpx.AsyncClient(
            headers=_get_headers(),
            timeout=30.0,
        )
        return self

    async def __aexit__(self, *args):
        if self._client:
            await self._client.aclose()

    async def _get(self, url: str) -> dict:
        if not self._client:
            raise RuntimeError("PUBGApiClient must be used as async context manager")
        response = await self._client.get(url)
        response.raise_for_status()
        return response.json()

    async def list_tournaments(self) -> list[dict]:
        """
        Lista todos os torneios disponíveis no shard pc-tournament.
        Endpoint: GET /shards/pc-tournament/tournaments
        """
        url = f"{self.base_url}/shards/{self.shard}/tournaments"
        logger.info(f"[PUBG API] Fetching tournaments from {url}")

        data = await self._get(url)
        tournaments = []

        for item in data.get("data", []):
            attrs = item.get("attributes", {})
            tournament = {
                "pubg_id": item.get("id", ""),
                "name": attrs.get("title", attrs.get("id", "Unknown Tournament")),
                "region": _extract_region(item.get("id", "")),
                "start_date": _parse_date(attrs.get("createdAt")),
                "status": _normalize_status(attrs.get("createdAt")),
            }
            tournaments.append(tournament)

        logger.info(f"[PUBG API] Found {len(tournaments)} tournaments")
        return tournaments

    async def get_tournament(self, tournament_id: str) -> dict:
        """
        Busca detalhes de um torneio específico incluindo seus matches.
        Endpoint: GET /shards/pc-tournament/tournaments/{id}
        """
        url = f"{self.base_url}/shards/{self.shard}/tournaments/{tournament_id}"
        logger.info(f"[PUBG API] Fetching tournament detail: {tournament_id}")
        return await self._get(url)

    async def get_player_season_stats(
        self, account_id: str, season_id: str = "division.bro.official.pc-2018-01"
    ) -> dict:
        """
        Busca estatísticas de temporada de um jogador.
        Endpoint: GET /shards/{shard}/players/{accountId}/seasons/{seasonId}
        """
        url = (
            f"{self.base_url}/shards/{self.shard}"
            f"/players/{account_id}/seasons/{season_id}"
        )
        logger.info(f"[PUBG API] Fetching stats for player {account_id}")
        return await self._get(url)

    async def search_players_by_names(self, names: list[str]) -> list[dict]:
        """
        Busca até 10 jogadores pelo nome.
        Endpoint: GET /shards/{shard}/players?filter[playerNames]=name1,name2
        """
        if not names:
            return []

        chunk = names[:10]
        names_param = ",".join(chunk)
        url = (
            f"{self.base_url}/shards/{self.shard}"
            f"/players?filter[playerNames]={names_param}"
        )
        logger.info(f"[PUBG API] Searching players: {names_param}")

        data = await self._get(url)
        players = []

        for item in data.get("data", []):
            attrs = item.get("attributes", {})
            player = {
                "pubg_id": item.get("id", ""),
                "name": attrs.get("name", ""),
                "raw_stats": attrs,
            }
            players.append(player)

        return players

    async def get_match(self, match_id: str) -> dict:
        """
        Busca detalhes de uma partida específica.
        Endpoint: GET /shards/{shard}/matches/{matchId}
        """
        url = f"{self.base_url}/shards/{self.shard}/matches/{match_id}"
        logger.info(f"[PUBG API] Fetching match {match_id}")
        return await self._get(url)

    async def extract_players_from_tournament(
        self, tournament_id: str, max_matches: int = 5
    ) -> list[dict]:
        """
        Extrai jogadores e calcula stats médias a partir dos matches de um torneio.

        Fluxo:
            1. Busca detalhes do torneio (lista de match IDs)
            2. Para cada match (até max_matches), busca detalhes
            3. Agrega stats por jogador (kills, damage, placement)
            4. Calcula médias e fantasy_cost

        Rate limit: sleep(6) entre cada chamada de match (10 req/min)
        """
        tournament_data = await self.get_tournament(tournament_id)
        match_refs = (
            tournament_data.get("data", {})
            .get("relationships", {})
            .get("matches", {})
            .get("data", [])
        )

        match_ids = [m["id"] for m in match_refs[:max_matches]]
        logger.info(
            f"[PUBG API] Tournament {tournament_id}: "
            f"processing {len(match_ids)} matches"
        )

        if not match_ids:
            logger.warning(f"[PUBG API] No matches found for tournament {tournament_id}")
            return []

        player_stats: dict[str, dict] = {}

        for i, match_id in enumerate(match_ids):
            if i > 0:
                logger.debug(f"[PUBG API] Rate limit sleep 6s before match {match_id}")
                await asyncio.sleep(6)  # Respeita rate limit: 10 req/min

            try:
                match_data = await self.get_match(match_id)
                _aggregate_match_stats(match_data, player_stats)
            except httpx.HTTPStatusError as e:
                logger.warning(f"[PUBG API] Failed to fetch match {match_id}: {e}")
                continue

        players = []
        for pubg_id, stats in player_stats.items():
            matches = stats["matches"]
            avg_kills = stats["total_kills"] / matches
            avg_damage = stats["total_damage"] / matches
            avg_placement = stats["total_placement"] / matches

            players.append({
                "pubg_id": pubg_id,
                "name": stats["name"],
                "region": _extract_region(tournament_id),
                "avg_kills": round(avg_kills, 2),
                "avg_damage": round(avg_damage, 2),
                "avg_placement": round(avg_placement, 2),
                "matches_played": matches,
                "fantasy_cost": calculate_fantasy_cost(avg_kills, avg_damage, avg_placement),
                "raw_stats": stats,
            })

        logger.info(
            f"[PUBG API] Extracted {len(players)} players from tournament {tournament_id}"
        )
        return players


# ------------------------------------------------------------------
# HELPERS INTERNOS
# ------------------------------------------------------------------

def _aggregate_match_stats(match_data: dict, player_stats: dict) -> None:
    """Agrega estatísticas de uma partida no dicionário player_stats."""
    included = match_data.get("included", [])

    participants = {
        item["id"]: item
        for item in included
        if item.get("type") == "participant"
    }

    for participant in participants.values():
        attrs = participant.get("attributes", {})
        stats = attrs.get("stats", {})
        pubg_id = stats.get("playerId", "")
        name = stats.get("name", "unknown")

        if not pubg_id or pubg_id == "ai":
            continue  # Ignora bots

        if pubg_id not in player_stats:
            player_stats[pubg_id] = {
                "name": name,
                "total_kills": 0.0,
                "total_damage": 0.0,
                "total_placement": 0.0,
                "matches": 0,
            }

        player_stats[pubg_id]["total_kills"] += float(stats.get("kills", 0))
        player_stats[pubg_id]["total_damage"] += float(stats.get("damageDealt", 0))
        player_stats[pubg_id]["total_placement"] += float(stats.get("winPlace", 28))
        player_stats[pubg_id]["matches"] += 1


def _extract_region(tournament_or_match_id: str) -> str:
    """Infere região a partir do ID do torneio/match da PUBG."""
    tid = tournament_or_match_id.lower()
    if "na" in tid or "americas" in tid:
        return "NA"
    if "eu" in tid or "europe" in tid:
        return "EU"
    if "as" in tid or "asia" in tid:
        return "AS"
    if "sea" in tid:
        return "SEA"
    if "oc" in tid or "oceania" in tid:
        return "OC"
    if "sa" in tid or "south" in tid:
        return "SA"
    return "GLOBAL"


def _parse_date(date_str: Optional[str]) -> Optional[datetime]:
    """Converte string ISO 8601 da PUBG API para datetime."""
    if not date_str:
        return None
    try:
        return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


def _normalize_status(created_at_str: Optional[str]) -> str:
    """Determina status do torneio baseado na data de criação."""
    if not created_at_str:
        return "upcoming"
    dt = _parse_date(created_at_str)
    if dt and dt < datetime.now(dt.tzinfo):
        return "active"
    return "upcoming"
