"""
Lembrete de ultimo dia das Playoffs 1 — PAS e PEC.
Uso: python -m scripts.broadcast_last_day_reminder
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.services.email import _send, _html, _TEXT, _ORANGE, _MUTED, _BORDER
from app.core.config import settings


def _build_content(stage_pas_id: int, stage_pec_id: int) -> str:
    url_pas = f"{settings.FRONTEND_URL}/tournament/{stage_pas_id}"
    url_pec = f"{settings.FRONTEND_URL}/tournament/{stage_pec_id}"

    return f"""
      <h2 class="title">Ultimo dia das Playoffs 1 🔥</h2>
      <p class="text">
        Hoje é o <strong style="color: {_TEXT};">último dia</strong> das Playoffs 1 tanto da
        <strong style="color: {_TEXT};">PAS</strong> quanto da
        <strong style="color: {_TEXT};">PEC</strong>.
        <br><br>
        Se você ainda não montou ou quer ajustar seu lineup, essa é a sua última chance!
      </p>

      <table width="100%" style="border-collapse: collapse; margin-bottom: 28px;">
        <tr>
          <td style="padding: 10px 8px; border-top: 1px solid {_BORDER};">
            <span style="font-size: 13px; color: {_MUTED}; text-transform: uppercase; letter-spacing: 0.08em;">PAS — Playoffs 1 · Dia 3</span>
          </td>
          <td style="padding: 10px 8px; border-top: 1px solid {_BORDER}; text-align: right;">
            <a href="{url_pas}" style="color: {_ORANGE}; font-size: 13px; font-weight: 700; text-decoration: none; letter-spacing: 0.06em; text-transform: uppercase;">Ver lineup &rarr;</a>
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 8px; border-top: 1px solid {_BORDER}; border-bottom: 1px solid {_BORDER};">
            <span style="font-size: 13px; color: {_MUTED}; text-transform: uppercase; letter-spacing: 0.08em;">PEC — Spring Playoffs 1 · Dia 3</span>
          </td>
          <td style="padding: 10px 8px; border-top: 1px solid {_BORDER}; border-bottom: 1px solid {_BORDER}; text-align: right;">
            <a href="{url_pec}" style="color: {_ORANGE}; font-size: 13px; font-weight: 700; text-decoration: none; letter-spacing: 0.06em; text-transform: uppercase;">Ver lineup &rarr;</a>
          </td>
        </tr>
      </table>

      <p class="expiry">
        Você está recebendo este email por ser participante da XAMA Fantasy League.
      </p>
    """


def broadcast():
    from sqlalchemy import text

    db = SessionLocal()
    try:
        rows = db.execute(
            text("""
                SELECT email FROM "user"
                WHERE email_verified = true
                  AND is_active = true
                  AND email IS NOT NULL
                  AND email != ''
            """)
        ).fetchall()
    finally:
        db.close()

    html = _html(_build_content(stage_pas_id=17, stage_pec_id=23))
    subject = "XAMA Fantasy — Ultimo dia das Playoffs 1 (PAS & PEC) 🔥"

    sent = failed = 0
    for (email,) in rows:
        ok = _send(email, subject, html)
        if ok:
            sent += 1
            print(f"  OK {email}")
        else:
            failed += 1
            print(f"  FALHA: {email}")

    print(f"\nResultado: {sent} enviados, {failed} falhas")
    return sent, failed


if __name__ == "__main__":
    print("Disparando lembrete de ultimo dia das Playoffs 1 (PAS + PEC)...")
    broadcast()
