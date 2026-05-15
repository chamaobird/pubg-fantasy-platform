# app/services/seatlon_monitor.py
"""
Seatlon Monitor — detecta novos tournament IDs na PUBG API via pubg.seatlon.eu.

Fluxo:
  1. GET https://pubg.seatlon.eu/api/v2/pubg/tournaments
  2. Filtra active=True com prefixos conhecidos (am-pas, eu-pec, as-pgs, ...)
  3. Compara contra Stage.pubg_tournament_id já atribuídos no banco
  4. Novo = ativo + prefixo conhecido + não atribuído a nenhum Stage
  5. Se houver novos → envia email para ADMIN_EMAIL

Chamado por:
  - APScheduler job (seatlon_job.py) a cada 6 horas
  - Endpoint admin POST /admin/seatlon/scan (trigger manual)
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings

logger = logging.getLogger(__name__)

SEATLON_API_URL = "https://pubg.seatlon.eu/api/v2/pubg/tournaments"

# Prefixos que indicam torneios relevantes para a plataforma
KNOWN_PREFIXES: list[str] = [
    "am-pas",   # Americas PAS
    "eu-pec",   # Europe PEC
    "as-pgs",   # Asia PGS
    "eu-pgs",   # Europe PGS
    "am-pgs",   # Americas PGS
]


@dataclass
class SeatloNTournament:
    tournament_id: str
    pubg_created_at: str
    matches_count: int
    active: bool


def _fetch_seatlon_tournaments() -> list[SeatloNTournament]:
    """Busca lista completa de torneios do seatlon.eu."""
    try:
        resp = httpx.get(
            SEATLON_API_URL,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "Accept": "application/json",
                "X-Requested-With": "XMLHttpRequest",
                "Referer": "https://pubg.seatlon.eu/tournaments",
            },
            timeout=15.0,
        )
        resp.raise_for_status()
        data = resp.json()
        return [
            SeatloNTournament(
                tournament_id=item["tournament_id"],
                pubg_created_at=item.get("pubg_created_at", ""),
                matches_count=item.get("matches_count", 0),
                active=item.get("active", False),
            )
            for item in data.get("data", [])
        ]
    except Exception as exc:
        logger.error("[SeatloNMonitor] Erro ao buscar API: %s", exc)
        return []


def _get_assigned_tournament_ids(db: Session) -> set[str]:
    """Retorna todos os pubg_tournament_id já atribuídos a algum Stage no banco."""
    from app.models.stage import Stage

    rows = (
        db.query(Stage.pubg_tournament_id)
        .filter(Stage.pubg_tournament_id.isnot(None))
        .all()
    )
    return {r.pubg_tournament_id for r in rows}


def _is_relevant(tournament_id: str) -> bool:
    """Retorna True se o tournament_id tem prefixo conhecido."""
    return any(tournament_id.startswith(prefix) for prefix in KNOWN_PREFIXES)


def _send_admin_notification(new_tournaments: list[SeatloNTournament]) -> bool:
    """Envia email ao admin com os novos tournament_ids detectados."""
    from app.services.email import _send  # noqa: PLC0415

    if not settings.ADMIN_EMAIL:
        logger.warning("[SeatloNMonitor] ADMIN_EMAIL não configurado — notificação não enviada.")
        return False

    rows_html = "".join(
        f"""
        <tr>
          <td style="padding:8px 12px;font-family:monospace;font-size:14px;
                     background:#f4f4f4;border-radius:4px;">{t.tournament_id}</td>
          <td style="padding:8px 12px;color:#555;">{t.matches_count} matches</td>
          <td style="padding:8px 12px;color:#555;">{t.pubg_created_at[:10] if t.pubg_created_at else '—'}</td>
        </tr>
        """
        for t in new_tournaments
    )

    html = f"""
    <html><body style="font-family:sans-serif;color:#222;max-width:600px;margin:auto;">
      <h2 style="color:#e8a830;">🎮 Novos tournament IDs detectados</h2>
      <p>O monitor do <strong>seatlon.eu</strong> identificou {len(new_tournaments)}
         novo(s) torneio(s) ativo(s) não atribuídos a nenhum Stage:</p>
      <table style="border-collapse:collapse;width:100%;margin:16px 0;">
        <thead>
          <tr style="background:#222;color:#fff;">
            <th style="padding:8px 12px;text-align:left;">tournament_id</th>
            <th style="padding:8px 12px;text-align:left;">Matches</th>
            <th style="padding:8px 12px;text-align:left;">Criado em</th>
          </tr>
        </thead>
        <tbody>{rows_html}</tbody>
      </table>
      <p style="color:#555;font-size:13px;">
        Atribua via admin: <code>PATCH /admin/stages/{{stage_id}}</code>
        com <code>"pubg_tournament_id": "..."</code>
      </p>
      <p style="color:#999;font-size:12px;">
        Enviado em {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}
      </p>
    </body></html>
    """

    subject = f"[XAMA Admin] {len(new_tournaments)} novo(s) tournament ID(s) detectado(s)"
    return _send(settings.ADMIN_EMAIL, subject, html)


def scan_new_tournaments(db: Session) -> dict:
    """
    Entry point principal. Detecta novos tournament IDs e notifica admin.

    Returns:
        {
            "fetched": int,           # total retornado pelo seatlon
            "relevant_active": int,   # com prefixo conhecido + active=True
            "already_assigned": int,  # já em Stage.pubg_tournament_id
            "new": int,               # nunca atribuídos
            "new_ids": list[str],     # os IDs novos
            "email_sent": bool,
        }
    """
    tournaments = _fetch_seatlon_tournaments()
    if not tournaments:
        return {
            "fetched": 0, "relevant_active": 0,
            "already_assigned": 0, "new": 0,
            "new_ids": [], "email_sent": False,
        }

    assigned = _get_assigned_tournament_ids(db)

    relevant_active = [
        t for t in tournaments
        if t.active and _is_relevant(t.tournament_id)
    ]

    new_tournaments = [
        t for t in relevant_active
        if t.tournament_id not in assigned
    ]

    email_sent = False
    if new_tournaments:
        logger.info(
            "[SeatloNMonitor] %d novo(s) tournament(s): %s",
            len(new_tournaments),
            [t.tournament_id for t in new_tournaments],
        )
        email_sent = _send_admin_notification(new_tournaments)
    else:
        logger.debug("[SeatloNMonitor] Nenhum torneio novo detectado.")

    return {
        "fetched":          len(tournaments),
        "relevant_active":  len(relevant_active),
        "already_assigned": len(relevant_active) - len(new_tournaments),
        "new":              len(new_tournaments),
        "new_ids":          [t.tournament_id for t in new_tournaments],
        "email_sent":       email_sent,
    }
