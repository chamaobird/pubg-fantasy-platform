# app/services/email.py
"""
Envio de emails transacionais via Resend HTTP API.
Templates com identidade visual XAMA — fundo escuro, tipografia on-brand.
Todos os broadcasts são personalizados com o username do destinatário.
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


def _greeting(username: str | None) -> str:
    """Saudação personalizada com o username do destinatário."""
    name = username if username else "jogador"
    return f'Olá, <strong style="color: {_TEXT};">{name}</strong>.<br><br>'


def _format_close_label(close_iso: str) -> str:
    """Converte ISO 8601 para label legível no fuso de Brasília."""
    from datetime import datetime, timedelta
    try:
        dt = datetime.fromisoformat(close_iso.replace("Z", "+00:00"))
        brt = dt - timedelta(hours=3)
        return brt.strftime("%d/%m às %H:%M (Brasília)")
    except Exception:
        return close_iso


# ── Templates transacionais (auth) ────────────────────────────────────────────

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
        {_greeting(username)}
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


# ── Build functions (retornam subject + html) ─────────────────────────────────

def _build_lineup_open_html(
    username: str | None,
    stage_name: str,
    stage_id: int,
    close_iso: str | None,
) -> tuple[str, str]:
    stage_url = f"{settings.FRONTEND_URL}/tournament/{stage_id}"
    deadline_html = ""
    if close_iso:
        close_label = _format_close_label(close_iso)
        deadline_html = f"""
          <p class="text" style="margin-bottom: 8px;">
            Você tem até <strong style="color: {_TEXT};">{close_label}</strong> para salvar seu lineup.
          </p>
        """
    content = f"""
      <h2 class="title">Lineup aberta</h2>
      <p class="text">
        {_greeting(username)}
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
    return (f"XAMA Fantasy — Lineup aberta: {stage_name}", _html(content))


def _build_no_lineup_reminder_html(
    username: str | None,
    stage_name: str,
    stage_id: int,
) -> tuple[str, str]:
    stage_url = f"{settings.FRONTEND_URL}/tournament/{stage_id}"
    content = f"""
      <h2 class="title">Você ainda não montou seu lineup</h2>
      <p class="text">
        {_greeting(username)}
        O lineup para <strong style="color: {_TEXT};">{stage_name}</strong> está aberto.<br>
        Não fique de fora — monte seu time antes do fechamento.
      </p>
      <div class="btn-wrap">
        <a href="{stage_url}" class="btn">Montar agora &rarr;</a>
      </div>
      <p class="expiry">
        Você está recebendo este email por ser participante da XAMA Fantasy League.
      </p>
    """
    return (f"XAMA Fantasy — Monte seu lineup: {stage_name}", _html(content))


def _build_lineup_closing_soon_html(
    username: str | None,
    stage_name: str,
    stage_id: int,
    close_iso: str | None,
) -> tuple[str, str]:
    stage_url = f"{settings.FRONTEND_URL}/tournament/{stage_id}"
    deadline_html = ""
    if close_iso:
        close_label = _format_close_label(close_iso)
        deadline_html = f"""
          <p class="text" style="margin-bottom: 8px;">
            Prazo: <strong style="color: #f97316;">{close_label}</strong>
          </p>
        """
    content = f"""
      <h2 class="title">Lineup fecha em breve!</h2>
      <p class="text">
        {_greeting(username)}
        Você ainda não montou seu lineup para
        <strong style="color: {_TEXT};">{stage_name}</strong> e o prazo está chegando ao fim.<br>
        Monte agora para não perder os pontos desta etapa.
      </p>
      {deadline_html}
      <div class="btn-wrap">
        <a href="{stage_url}" class="btn">Montar agora &rarr;</a>
      </div>
      <p class="expiry">
        Você está recebendo este email por ser participante da XAMA Fantasy League.
      </p>
    """
    return (f"XAMA Fantasy — Fechamento próximo: {stage_name}", _html(content))


def _build_results_available_html(
    username: str | None,
    stage_name: str,
    stage_id: int,
    day_label: str | None,
) -> tuple[str, str]:
    stage_url = f"{settings.FRONTEND_URL}/tournament/{stage_id}"
    day_part = f" — {day_label}" if day_label else ""
    content = f"""
      <h2 class="title">Pontuação disponível</h2>
      <p class="text">
        {_greeting(username)}
        O scoring de <strong style="color: {_TEXT};">{stage_name}{day_part}</strong> está pronto.<br>
        Confira quantos pontos você marcou e veja como está no ranking.
      </p>
      <div class="btn-wrap">
        <a href="{stage_url}" class="btn">Ver minha pontuação &rarr;</a>
      </div>
      <p class="expiry">
        Você está recebendo este email por ser participante da XAMA Fantasy League.
      </p>
    """
    subject_day = f" — {day_label}" if day_label else ""
    return (f"XAMA Fantasy — Pontuação disponível: {stage_name}{subject_day}", _html(content))


def _build_stage_recap_html(
    username: str | None,
    stage_name: str,
    stage_id: int,
) -> tuple[str, str]:
    stage_url = f"{settings.FRONTEND_URL}/tournament/{stage_id}"
    content = f"""
      <h2 class="title">Stage encerrada</h2>
      <p class="text">
        {_greeting(username)}
        A <strong style="color: {_TEXT};">{stage_name}</strong> foi encerrada.<br>
        O ranking final está disponível — confira sua posição e a pontuação total da etapa.
      </p>
      <div class="btn-wrap">
        <a href="{stage_url}" class="btn">Ver ranking final &rarr;</a>
      </div>
      <p class="expiry">
        Você está recebendo este email por ser participante da XAMA Fantasy League.
      </p>
    """
    return (f"XAMA Fantasy — Resultado final: {stage_name}", _html(content))


def _build_price_rebalance_html(
    username: str | None,
    stage_name: str,
    stage_id: int,
) -> tuple[str, str]:
    stage_url = f"{settings.FRONTEND_URL}/tournament/{stage_id}"
    content = f"""
      <h2 class="title">Preços atualizados</h2>
      <p class="text">
        {_greeting(username)}
        Os preços dos jogadores foram reajustados para
        <strong style="color: {_TEXT};">{stage_name}</strong>.<br>
        Acesse sua lineup e verifique se ela ainda está dentro do orçamento de
        <strong style="color: {_TEXT};">100 créditos</strong> antes do início das partidas.
      </p>
      <div class="btn-wrap">
        <a href="{stage_url}" class="btn">Revisar meu lineup &rarr;</a>
      </div>
      <p class="expiry">
        Lineups que ultrapassarem o limite de budget serão <strong>invalidadas automaticamente</strong>.
      </p>
      <p class="expiry">
        Você está recebendo este email por ser participante da XAMA Fantasy League.
      </p>
    """
    return (f"XAMA Fantasy — Preços reajustados: {stage_name}", _html(content))


def _build_championship_start_html(
    username: str | None,
    champ_name: str,
    cta_url: str | None,
) -> tuple[str, str]:
    url = cta_url or settings.FRONTEND_URL
    content = f"""
      <h2 class="title">Novo campeonato disponível</h2>
      <p class="text">
        {_greeting(username)}
        O <strong style="color: {_TEXT};">{champ_name}</strong> já está disponível na plataforma.<br>
        Monte seu time, escolha seus jogadores e dispute o ranking com os demais participantes.
      </p>
      <div class="btn-wrap">
        <a href="{url}" class="btn">Participar agora &rarr;</a>
      </div>
      <p class="expiry">
        Você está recebendo este email por ser participante da XAMA Fantasy League.
      </p>
    """
    return (f"XAMA Fantasy — {champ_name}", _html(content))


def _build_announcement_html(
    username: str | None,
    title: str,
    body: str,
    cta_label: str | None = None,
    cta_url: str | None = None,
) -> tuple[str, str]:
    cta_html = ""
    if cta_label and cta_url:
        cta_html = f"""
          <div class="btn-wrap">
            <a href="{cta_url}" class="btn">{cta_label} &rarr;</a>
          </div>
        """
    content = f"""
      <h2 class="title">{title}</h2>
      <p class="text">
        {_greeting(username)}
        {body}
      </p>
      {cta_html}
      <p class="expiry">
        Você está recebendo este email por ser participante da XAMA Fantasy League.
      </p>
    """
    return (f"XAMA Fantasy — {title}", _html(content))


# ── Send functions (individuais) ──────────────────────────────────────────────

def send_lineup_open_notification(
    to_email: str, username: str | None,
    stage_name: str, stage_id: int, close_iso: str | None,
) -> bool:
    subject, html = _build_lineup_open_html(username, stage_name, stage_id, close_iso)
    return _send(to_email, subject, html)


def send_no_lineup_reminder(
    to_email: str, username: str | None,
    stage_name: str, stage_id: int,
) -> bool:
    subject, html = _build_no_lineup_reminder_html(username, stage_name, stage_id)
    return _send(to_email, subject, html)


def send_lineup_closing_soon(
    to_email: str, username: str | None,
    stage_name: str, stage_id: int, close_iso: str | None,
) -> bool:
    subject, html = _build_lineup_closing_soon_html(username, stage_name, stage_id, close_iso)
    return _send(to_email, subject, html)


def send_results_available(
    to_email: str, username: str | None,
    stage_name: str, stage_id: int, day_label: str | None,
) -> bool:
    subject, html = _build_results_available_html(username, stage_name, stage_id, day_label)
    return _send(to_email, subject, html)


def send_stage_recap(
    to_email: str, username: str | None,
    stage_name: str, stage_id: int,
) -> bool:
    subject, html = _build_stage_recap_html(username, stage_name, stage_id)
    return _send(to_email, subject, html)


def send_price_rebalance(
    to_email: str, username: str | None,
    stage_name: str, stage_id: int,
) -> bool:
    subject, html = _build_price_rebalance_html(username, stage_name, stage_id)
    return _send(to_email, subject, html)


def send_championship_start(
    to_email: str, username: str | None,
    champ_name: str, cta_url: str | None,
) -> bool:
    subject, html = _build_championship_start_html(username, champ_name, cta_url)
    return _send(to_email, subject, html)


def send_announcement(
    to_email: str, username: str | None,
    title: str, body: str,
    cta_label: str | None = None, cta_url: str | None = None,
) -> bool:
    subject, html = _build_announcement_html(username, title, body, cta_label, cta_url)
    return _send(to_email, subject, html)


# ── Query helpers ─────────────────────────────────────────────────────────────

def _fetch_all_users(db) -> list[tuple[str, str | None]]:
    """Retorna (email, username) de todos os usuários verificados e ativos."""
    from sqlalchemy import text
    rows = db.execute(
        text("""
            SELECT email, username FROM "user"
            WHERE email_verified = true
              AND is_active = true
              AND email IS NOT NULL
              AND email != ''
        """)
    ).fetchall()
    return [(r[0], r[1]) for r in rows]


def _fetch_users_without_lineup(db, stage_id: int) -> list[tuple[str, str | None]]:
    """Retorna (email, username) de usuários verificados/ativos sem lineup na stage."""
    from sqlalchemy import text
    rows = db.execute(
        text("""
            SELECT u.email, u.username FROM "user" u
            WHERE u.email_verified = true
              AND u.is_active = true
              AND u.email IS NOT NULL
              AND u.email != ''
              AND NOT EXISTS (
                SELECT 1 FROM lineup l
                JOIN stage_day sd ON sd.id = l.stage_day_id
                WHERE sd.stage_id = :stage_id
                  AND l.user_id = u.id
              )
        """),
        {"stage_id": stage_id},
    ).fetchall()
    return [(r[0], r[1]) for r in rows]


# ── Broadcast functions ───────────────────────────────────────────────────────

def _do_broadcast(recipients: list[tuple[str, str | None]], send_fn, log_label: str) -> dict:
    """Itera sobre destinatários chamando send_fn(email, username) e retorna contagem."""
    sent = failed = 0
    for email, username in recipients:
        ok = send_fn(email, username)
        if ok:
            sent += 1
        else:
            failed += 1
            logger.warning("[Email] Falha ao enviar %s para %s", log_label, email)
    logger.info("[Email] %s — %d enviados, %d falhas", log_label, sent, failed)
    return {"sent": sent, "failed": failed}


def broadcast_lineup_open(db, stage_name: str, stage_id: int, close_iso: str | None) -> dict:
    recipients = _fetch_all_users(db)
    return _do_broadcast(
        recipients,
        lambda email, username: send_lineup_open_notification(email, username, stage_name, stage_id, close_iso),
        f"lineup_open stage={stage_id}",
    )


def broadcast_no_lineup_reminder(db, stage_name: str, stage_id: int) -> dict:
    recipients = _fetch_users_without_lineup(db, stage_id)
    return _do_broadcast(
        recipients,
        lambda email, username: send_no_lineup_reminder(email, username, stage_name, stage_id),
        f"no_lineup_reminder stage={stage_id}",
    )


def broadcast_lineup_closing_soon(db, stage_name: str, stage_id: int, close_iso: str | None) -> dict:
    recipients = _fetch_users_without_lineup(db, stage_id)
    return _do_broadcast(
        recipients,
        lambda email, username: send_lineup_closing_soon(email, username, stage_name, stage_id, close_iso),
        f"lineup_closing_soon stage={stage_id}",
    )


def broadcast_results_available(db, stage_name: str, stage_id: int, day_label: str | None) -> dict:
    recipients = _fetch_all_users(db)
    return _do_broadcast(
        recipients,
        lambda email, username: send_results_available(email, username, stage_name, stage_id, day_label),
        f"results_available stage={stage_id}",
    )


def broadcast_stage_recap(db, stage_name: str, stage_id: int) -> dict:
    recipients = _fetch_all_users(db)
    return _do_broadcast(
        recipients,
        lambda email, username: send_stage_recap(email, username, stage_name, stage_id),
        f"stage_recap stage={stage_id}",
    )


def broadcast_price_rebalance(db, stage_name: str, stage_id: int) -> dict:
    recipients = _fetch_all_users(db)
    return _do_broadcast(
        recipients,
        lambda email, username: send_price_rebalance(email, username, stage_name, stage_id),
        f"price_rebalance stage={stage_id}",
    )


def broadcast_championship_start(db, champ_name: str, cta_url: str | None) -> dict:
    recipients = _fetch_all_users(db)
    return _do_broadcast(
        recipients,
        lambda email, username: send_championship_start(email, username, champ_name, cta_url),
        "championship_start",
    )


def broadcast_announcement(
    db,
    title: str,
    body: str,
    cta_label: str | None = None,
    cta_url: str | None = None,
) -> dict:
    recipients = _fetch_all_users(db)
    return _do_broadcast(
        recipients,
        lambda email, username: send_announcement(email, username, title, body, cta_label, cta_url),
        "announcement",
    )
