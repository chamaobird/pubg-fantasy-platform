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
