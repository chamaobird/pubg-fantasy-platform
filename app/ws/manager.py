# app/ws/manager.py
"""
WebSocket Connection Manager

Singleton que rastreia conexões ativas por stage_day_id.
Quando o scoring de um dia termina, broadcasteia um evento
para todos os clientes conectados àquele dia.

Formato da mensagem:
  {"type": "scoring_updated", "stage_day_id": 25}

O frontend recebe e re-busca os dados (pontos, leaderboard)
sem precisar recarregar a página.
"""
from __future__ import annotations

import json
import logging
from collections import defaultdict
from typing import DefaultDict, Set

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        # stage_day_id → set of active WebSocket connections
        self._connections: DefaultDict[int, Set[WebSocket]] = defaultdict(set)

    async def connect(self, stage_day_id: int, ws: WebSocket) -> None:
        await ws.accept()
        self._connections[stage_day_id].add(ws)
        count = len(self._connections[stage_day_id])
        logger.info("[WS] connect: stage_day=%s — %d conexão(ões) ativa(s)", stage_day_id, count)

    def disconnect(self, stage_day_id: int, ws: WebSocket) -> None:
        self._connections[stage_day_id].discard(ws)
        count = len(self._connections[stage_day_id])
        logger.info("[WS] disconnect: stage_day=%s — %d conexão(ões) restante(s)", stage_day_id, count)

    async def broadcast(self, stage_day_id: int, payload: dict) -> None:
        """Envia payload JSON para todos os clientes conectados ao stage_day_id."""
        connections = list(self._connections.get(stage_day_id, []))
        if not connections:
            return

        message = json.dumps(payload)
        dead: list[WebSocket] = []
        for ws in connections:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)

        # Remove conexões mortas
        for ws in dead:
            self._connections[stage_day_id].discard(ws)

        sent = len(connections) - len(dead)
        logger.info(
            "[WS] broadcast stage_day=%s — %d enviado(s), %d desconectado(s)",
            stage_day_id, sent, len(dead),
        )

    def active_count(self, stage_day_id: int) -> int:
        return len(self._connections.get(stage_day_id, set()))


# Instância global — importada pelo router e pelo scoring service
ws_manager = ConnectionManager()
