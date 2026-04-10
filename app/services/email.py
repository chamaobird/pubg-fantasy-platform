# app/services/email.py
"""
Envio de emails transacionais via Resend HTTP API.
Templates com identidade visual XAMA — fundo escuro, tipografia on-brand.
"""
from __future__ import annotations

import logging
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"

# Paleta XAMA
_BLACK   = "#0d0f14"
_SURFACE = "#13151f"
_BORDER  = "#1e2133"
_ORANGE  = "#f97316"
_TEXT    = "#e2e8f0"
_MUTED   = "#64748b"

_BASE_STYLE = f"""
  body, table, td {{ margin: 0; padding: 0; border: 0; }}
  body {{ background: {_BLACK}; font-family: Arial, sans-serif; }}
  .wrapper {{ background: {_BLACK}; padding: 40px 16px; }}
  .card {{
    background: {_SURFACE};
    border: 1px solid {_BORDER};
    border-radius: 16px;
    max-width: 480px;
    margin: 0 auto;
    overflow: hidden;
  }}
  .top-bar {{
    height: 3px;
    background: linear-gradient(90deg, {_ORANGE} 0%, transparent 70%);
  }}
  .body {{ padding: 36px 32px; }}
  .logo-name {{
    font-size: 22px; font-weight: 700; color: {_TEXT};
    letter-spacing: 0.08em; text-transform: uppercase;
  }}
  .logo-sub {{
    font-size: 10px; color: {_ORANGE};
    letter-spacing: 0.2em; text-transform: uppercase; margin-top: 2px;
  }}
  .divider {{
    height: 1px; background: {_BORDER}; margin: 24px 0;
  }}
  .title {{
    font-size: 20px; font-weight: 700; color: {_TEXT};
    letter-spacing: 0.04em; text-transform: uppercase; margin: 0 0 12px 0;
  }}
  .text {{
    font-size: 15px; color: {_MUTED}; line-height: 1.6; margin: 0 0 28px 0;
  }}
  .btn {{
    display: inline-block;
    padding: 14px 32px;
    background: {_ORANGE};
    color: {_BLACK} !important;
    font-weight: 700;
    font-size: 15px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    text-decoration: none;
    border-radius: 8px;
  }}
  .btn-wrap {{ text-align: center; margin-bottom: 28px; }}
  .expiry {{
    font-size: 12px; color: {_MUTED}; text-align: center; margin-bottom: 8px;
  }}
  .footer {{
    text-align: center; padding: 20px 32px;
    border-top: 1px solid {_BORDER};
  }}
  .footer-text {{
    font-size: 11px; color: {_BORDER};
    letter-spacing: 0.06em; text-transform: uppercase;
  }}
"""


def _html(content: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>{_BASE_STYLE}</style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="top-bar"></div>
      <div class="body">
        <div style="margin-bottom: 24px;">
          <div class="logo-name">&#128293; XAMA</div>
          <div class="logo-sub">Fantasy League</div>
        </div>
        <div class="divider"></div>
        {content}
      </div>
      <div class="footer">
        <div class="footer-text">XAMA Fantasy League &mdash; dados reais do PUBG Esports</div>
      </div>
    </div>
  </div>
</body>
</html>"""


def _send(to_email: str, subject: str, html: str) -> bool:
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
                "subject": subject,
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


def send_verification_email(to_email: str, token: str) -> bool:
    verify_url = f"{settings.BACKEND_URL}/auth/verify?token={token}"
    content = f"""
      <h2 class="title">Confirme seu email</h2>
      <p class="text">
        Sua conta foi criada com sucesso.<br>
        Clique no botao abaixo para ativar seu acesso e comecar a montar seu time.
      </p>
      <div class="btn-wrap">
        <a href="{verify_url}" class="btn">Verificar email &rarr;</a>
      </div>
      <p class="expiry">
        Se voce nao criou uma conta na XAMA Fantasy, ignore este email.
      </p>
    """
    return _send(to_email, "XAMA Fantasy — Confirme seu email", _html(content))


def send_password_reset_email(to_email: str, token: str) -> bool:
    reset_url = f"{settings.FRONTEND_URL}/auth/reset-password?token={token}"
    content = f"""
      <h2 class="title">Redefinir senha</h2>
      <p class="text">
        Recebemos uma solicitacao para redefinir a senha da sua conta.<br>
        Clique no botao abaixo para criar uma nova senha.
      </p>
      <div class="btn-wrap">
        <a href="{reset_url}" class="btn">Redefinir senha &rarr;</a>
      </div>
      <p class="expiry">Este link expira em 30 minutos.</p>
      <p class="expiry">
        Se voce nao solicitou a troca de senha, ignore este email.
      </p>
    """
    return _send(to_email, "XAMA Fantasy — Redefinir senha", _html(content))
