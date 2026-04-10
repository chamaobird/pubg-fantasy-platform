# app/services/email.py
"""
Envio de emails transacionais via Resend HTTP API.
Sem SDK — usa httpx direto para manter dependências mínimas.
"""
from __future__ import annotations

import logging
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"


def send_verification_email(to_email: str, token: str) -> bool:
    """
    Envia email de confirmação de conta.
    Retorna True se enviado com sucesso, False caso contrário.
    """
    verify_url = f"{settings.BACKEND_URL}/auth/verify?token={token}"

    html = f"""
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
      <h2 style="color: #f97316; margin-bottom: 8px;">XAMA Fantasy</h2>
      <p style="color: #e2e8f0; font-size: 15px;">
        Confirme seu endereço de email para ativar sua conta.
      </p>
      <a href="{verify_url}"
         style="display: inline-block; margin-top: 24px; padding: 12px 28px;
                background: #f97316; color: #000; font-weight: 700;
                border-radius: 6px; text-decoration: none; font-size: 15px;">
        Verificar email
      </a>
      <p style="color: #64748b; font-size: 12px; margin-top: 32px;">
        Se você não criou uma conta na XAMA Fantasy, ignore este email.
      </p>
    </div>
    """

    try:
        response = httpx.post(
            RESEND_API_URL,
            headers={
                "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "from": settings.EMAIL_FROM,
                "to": [to_email],
                "subject": "XAMA Fantasy — Confirme seu email",
                "html": html,
            },
            timeout=10.0,
        )
        if response.status_code in (200, 201):
            return True
        logger.error("Resend error %s: %s", response.status_code, response.text)
        return False
    except Exception as exc:
        logger.error("Email send failed: %s", exc)
        return False