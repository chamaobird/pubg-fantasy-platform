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


def send_lineup_open_notification(
    to_email: str,
    stage_name: str,
    stage_id: int,
    close_iso: str | None,
) -> bool:
    """
    Avisa um usuário que a montagem de lineup abriu para uma stage.

    Args:
        to_email:   endereço de destino
        stage_name: nome legível da stage (ex: "PAS Playoffs — Dia 2")
        stage_id:   ID da stage (para gerar o link)
        close_iso:  ISO 8601 do horário de fechamento (ex: "2026-04-18T23:00:00Z"), ou None
    """
    stage_url = f"{settings.FRONTEND_URL}/tournament/{stage_id}"

    if close_iso:
        try:
            from datetime import datetime, timezone
            dt = datetime.fromisoformat(close_iso.replace("Z", "+00:00"))
            # Formata em horário de Brasília (UTC-3) para o usuário
            from datetime import timedelta
            brt = dt - timedelta(hours=3)
            close_label = brt.strftime("%d/%m às %H:%M (Brasília)")
        except Exception:
            close_label = close_iso
        deadline_html = f"""
          <p class="text" style="margin-bottom: 8px;">
            Você tem até <strong style="color: {_TEXT};">{close_label}</strong> para salvar seu lineup.
          </p>
        """
    else:
        deadline_html = ""

    content = f"""
      <h2 class="title">Lineup aberta</h2>
      <p class="text">
        A montagem de lineup para <strong style="color: {_TEXT};">{stage_name}</strong> está aberta.<br>
        Monte seu time e escolha seu capitão antes do início das partidas.
      </p>
      {deadline_html}
      <div class="btn-wrap">
        <a href="{stage_url}" class="btn">Montar lineup &rarr;</a>
      </div>
      <p class="expiry">
        Você está recebendo este email por ser participante da XAMA Fantasy League.
      </p>
    """
    return _send(to_email, f"XAMA Fantasy — Lineup aberta: {stage_name}", _html(content))


def send_over_budget_notification(
    to_email: str,
    username: str,
    stage_name: str,
    stage_id: int,
    total_cost: float,
    budget_cap: int = 100,
) -> bool:
    """
    Avisa o usuário que seu lineup replicado extrapolou o budget após repricing.
    O lineup foi invalidado e ele precisa montar um novo antes do fechamento.
    """
    stage_url = f"{settings.FRONTEND_URL}/tournament/{stage_id}"
    content = f"""
      <h2 class="title">Lineup Inválido — Budget Excedido</h2>
      <p class="text">
        Olá, <strong style="color: {_TEXT};">{username}</strong>.<br><br>
        O lineup que foi carregado automaticamente para
        <strong style="color: {_TEXT};">{stage_name}</strong>
        excedeu o limite de budget após o reajuste de preços dos jogadores.<br><br>
        <strong style="color: #f97316;">Custo do lineup:</strong>
        <strong style="color: {_TEXT};">{total_cost:.0f} créditos</strong>
        &nbsp;/&nbsp; Limite: <strong style="color: {_TEXT};">{budget_cap} créditos</strong>
      </p>
      <p class="text" style="margin-top: -16px;">
        Seu lineup atual foi <strong style="color: #f87171;">invalidado</strong> e
        <strong>não pontuará</strong> até que você monte um novo dentro do orçamento.
        Monte seu time agora antes do fechamento das lineups.
      </p>
      <div class="btn-wrap">
        <a href="{stage_url}" class="btn">Montar novo lineup &rarr;</a>
      </div>
      <p class="expiry">
        Você está recebendo este email por ser participante da XAMA Fantasy League.
      </p>
    """
    return _send(
        to_email,
        f"XAMA Fantasy — Lineup inválido: budget excedido em {stage_name}",
        _html(content),
    )


def broadcast_lineup_open(db, stage_name: str, stage_id: int, close_iso: str | None) -> dict:
    """
    Envia notificação de lineup aberta para todos os usuários verificados e ativos.

    Args:
        db:         sessão SQLAlchemy
        stage_name: nome legível da stage
        stage_id:   ID da stage
        close_iso:  ISO do fechamento ou None

    Returns:
        {"sent": N, "failed": N}
    """
    from sqlalchemy import text

    rows = db.execute(
        text("""
            SELECT email FROM "user"
            WHERE email_verified = true
              AND is_active = true
              AND email IS NOT NULL
              AND email != ''
        """)
    ).fetchall()

    sent = failed = 0
    for (email,) in rows:
        ok = send_lineup_open_notification(email, stage_name, stage_id, close_iso)
        if ok:
            sent += 1
        else:
            failed += 1
            logger.warning("[Email] Falha ao enviar lineup_open para %s", email)

    logger.info(
        "[Email] broadcast_lineup_open stage=%s — %d enviados, %d falhas",
        stage_id, sent, failed,
    )
    return {"sent": sent, "failed": failed}
