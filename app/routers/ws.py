# app/routers/ws.py
"""
WebSocket Router — Live scoring updates

WS /ws/stage-day/{stage_day_id}
    O cliente se conecta e fica escutando.
    Quando o scoring de um dia é executado, recebe:
      {"type": "scoring_updated", "stage_day_id": N}
    e deve re-buscar os dados (lineup, leaderboard, player stats).

    Mantém a conexão viva com ping/pong a cada 30s.
    Desconexão limpa automaticamente do manager.
"""
from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.ws.manager import ws_manager

logger = logging.getLogger(__name__)
router = APIRouter(tags=["WebSocket"])

PING_INTERVAL = 30  # segundos


@router.websocket("/ws/stage-day/{stage_day_id}")
async def stage_day_ws(stage_day_id: int, ws: WebSocket) -> None:
    """
    Conexão WebSocket por stage_day.
    Envia {"type": "ping"} a cada 30s para manter a conexão viva.
    Fecha limpo ao desconectar.
    """
    await ws_manager.connect(stage_day_id, ws)
    try:
        while True:
            # Aguarda mensagem do cliente (keepalive / pong)
            # ou timeout para enviar nosso próprio ping
            try:
                await asyncio.wait_for(ws.receive_text(), timeout=PING_INTERVAL)
            except asyncio.TimeoutError:
                # Envia ping para manter conexão ativa
                try:
                    await ws.send_text('{"type":"ping"}')
                except Exception:
                    break
    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect(stage_day_id, ws)
