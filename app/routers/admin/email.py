# app/routers/admin/email.py
"""
Admin endpoints para disparo de emails e histórico de envios.
Templates são fixos no código; o admin preenche as variáveis e confirma.
"""
from __future__ import annotations

from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin
from app.models.email_log import EmailLog
from app.models.user import User as UserModel

router = APIRouter(prefix="/admin/email", tags=["admin-email"])

# ── Definição dos templates disponíveis ───────────────────────────────────────

TEMPLATES: dict[str, dict] = {
    "lineup_open": {
        "key": "lineup_open",
        "label": "Lineup Aberta",
        "description": "Avisa que o lineup de uma stage está aberto para montagem.",
        "variables": [
            {"key": "stage_name", "label": "Nome da stage", "required": True},
            {"key": "stage_id",   "label": "ID da stage",   "required": True, "type": "number"},
            {"key": "close_iso",  "label": "Horário de fechamento (ISO 8601, opcional)", "required": False},
        ],
        "recipient_groups": ["all", "no_lineup"],
    },
    "no_lineup_reminder": {
        "key": "no_lineup_reminder",
        "label": "Lembrete — Sem Lineup",
        "description": "Lembrete para usuários que ainda não montaram o lineup de uma stage.",
        "variables": [
            {"key": "stage_name", "label": "Nome da stage", "required": True},
            {"key": "stage_id",   "label": "ID da stage",   "required": True, "type": "number"},
        ],
        "recipient_groups": ["no_lineup"],
    },
    "announcement": {
        "key": "announcement",
        "label": "Comunicado Geral",
        "description": "Mensagem livre enviada para todos os usuários ativos.",
        "variables": [
            {"key": "title",     "label": "Título",          "required": True},
            {"key": "body",      "label": "Corpo do email",  "required": True, "multiline": True},
            {"key": "cta_label", "label": "Texto do botão (opcional)",  "required": False},
            {"key": "cta_url",   "label": "URL do botão (opcional)",    "required": False},
        ],
        "recipient_groups": ["all"],
    },
}


# ── Schemas ───────────────────────────────────────────────────────────────────

class DispatchRequest(BaseModel):
    template_key: str
    variables: dict
    recipient_group: str = "all"


class EmailLogOut(BaseModel):
    id: int
    template_key: str
    subject: str
    recipient_group: str
    stage_id: Optional[int]
    sent_count: int
    failed_count: int
    variables: Optional[dict]
    triggered_by: Optional[str]
    sent_at: datetime

    model_config = {"from_attributes": True}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/templates")
def list_templates(_: UserModel = Depends(require_admin)):
    return list(TEMPLATES.values())


@router.post("/dispatch", status_code=status.HTTP_200_OK)
def dispatch_email(
    req: DispatchRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_admin),
):
    tpl = TEMPLATES.get(req.template_key)
    if not tpl:
        raise HTTPException(status_code=400, detail=f"Template '{req.template_key}' não encontrado.")

    if req.recipient_group not in tpl["recipient_groups"]:
        raise HTTPException(
            status_code=400,
            detail=f"Grupo '{req.recipient_group}' não suportado por este template.",
        )

    # Valida variáveis obrigatórias
    for var in tpl["variables"]:
        if var["required"] and not req.variables.get(var["key"]):
            raise HTTPException(status_code=400, detail=f"Variável obrigatória ausente: '{var['key']}'")

    from app.services import email as email_service

    v = req.variables
    result = {"sent": 0, "failed": 0}
    subject = ""

    if req.template_key == "lineup_open":
        stage_name = v["stage_name"]
        stage_id   = int(v["stage_id"])
        close_iso  = v.get("close_iso") or None
        subject    = f"XAMA Fantasy — Lineup aberta: {stage_name}"

        if req.recipient_group == "no_lineup":
            result = email_service.broadcast_no_lineup_reminder(db, stage_name, stage_id)
        else:
            result = email_service.broadcast_lineup_open(db, stage_name, stage_id, close_iso)

    elif req.template_key == "no_lineup_reminder":
        stage_name = v["stage_name"]
        stage_id   = int(v["stage_id"])
        subject    = f"XAMA Fantasy — Monte seu lineup: {stage_name}"
        result     = email_service.broadcast_no_lineup_reminder(db, stage_name, stage_id)

    elif req.template_key == "announcement":
        title     = v["title"]
        body      = v["body"]
        cta_label = v.get("cta_label") or None
        cta_url   = v.get("cta_url") or None
        subject   = f"XAMA Fantasy — {title}"
        result    = email_service.broadcast_announcement(db, title, body, cta_label, cta_url)

    # Grava log
    log = EmailLog(
        template_key     = req.template_key,
        subject          = subject,
        recipient_group  = req.recipient_group,
        stage_id         = int(v["stage_id"]) if "stage_id" in v else None,
        sent_count       = result["sent"],
        failed_count     = result["failed"],
        variables        = v,
        triggered_by     = current_user.username,
        sent_at          = datetime.now(timezone.utc),
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    return {
        "log_id":   log.id,
        "sent":     result["sent"],
        "failed":   result["failed"],
    }


@router.post("/preview")
def preview_email(
    req: DispatchRequest,
    _: UserModel = Depends(require_admin),
):
    """Gera o HTML do email sem enviar. Retorna {subject, html}."""
    tpl = TEMPLATES.get(req.template_key)
    if not tpl:
        raise HTTPException(status_code=400, detail=f"Template '{req.template_key}' não encontrado.")

    from app.services.email import (
        _build_lineup_open_html,
        _build_no_lineup_reminder_html,
        _build_announcement_html,
    )

    v = req.variables

    if req.template_key == "lineup_open":
        stage_name = v.get("stage_name", "")
        stage_id   = int(v.get("stage_id", 0))
        close_iso  = v.get("close_iso") or None
        if req.recipient_group == "no_lineup":
            subject, html = _build_no_lineup_reminder_html(stage_name, stage_id)
        else:
            subject, html = _build_lineup_open_html(stage_name, stage_id, close_iso)

    elif req.template_key == "no_lineup_reminder":
        subject, html = _build_no_lineup_reminder_html(
            v.get("stage_name", ""), int(v.get("stage_id", 0))
        )

    elif req.template_key == "announcement":
        subject, html = _build_announcement_html(
            v.get("title", ""),
            v.get("body", ""),
            v.get("cta_label") or None,
            v.get("cta_url") or None,
        )
    else:
        raise HTTPException(status_code=400, detail="Template sem preview implementado.")

    return {"subject": subject, "html": html}


@router.get("/stages")
def list_stages_for_email(
    championship_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: UserModel = Depends(require_admin),
):
    """Lista stages para uso nos dropdowns do painel de email."""
    from app.models.stage import Stage
    from app.models.championship import Championship as ChampModel

    q = (
        db.query(Stage, ChampModel.short_name)
        .join(ChampModel, Stage.championship_id == ChampModel.id)
        .order_by(Stage.id.desc())
    )
    if championship_id:
        q = q.filter(Stage.championship_id == championship_id)

    return [
        {
            "id":               s.id,
            "name":             s.name,
            "short_name":       s.short_name,
            "championship_id":  s.championship_id,
            "champ_short_name": champ_short,
            "lineup_status":    s.lineup_status,
            "stage_phase":      s.stage_phase,
        }
        for s, champ_short in q.all()
    ]


@router.get("/championships")
def list_championships_for_email(
    db: Session = Depends(get_db),
    _: UserModel = Depends(require_admin),
):
    """Lista championships para o filtro do painel de email."""
    from app.models.championship import Championship as ChampModel

    return [
        {"id": c.id, "name": c.name, "short_name": c.short_name}
        for c in db.query(ChampModel).order_by(ChampModel.id.desc()).all()
    ]


@router.get("/logs", response_model=list[EmailLogOut])
def list_logs(
    limit: int = 50,
    db: Session = Depends(get_db),
    _: UserModel = Depends(require_admin),
):
    return (
        db.query(EmailLog)
        .order_by(EmailLog.sent_at.desc())
        .limit(limit)
        .all()
    )
