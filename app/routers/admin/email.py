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
            {"key": "stage_name", "label": "Nome da stage",                              "required": True},
            {"key": "stage_id",   "label": "ID da stage",                                "required": True, "type": "number"},
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
    "lineup_closing_soon": {
        "key": "lineup_closing_soon",
        "label": "Fechamento Próximo",
        "description": "Alerta de urgência para usuários sem lineup — prazo chegando.",
        "variables": [
            {"key": "stage_name", "label": "Nome da stage",                              "required": True},
            {"key": "stage_id",   "label": "ID da stage",                                "required": True, "type": "number"},
            {"key": "close_iso",  "label": "Horário de fechamento (ISO 8601, opcional)", "required": False},
        ],
        "recipient_groups": ["no_lineup"],
    },
    "results_available": {
        "key": "results_available",
        "label": "Pontuação Disponível",
        "description": "Notifica que o scoring de um dia/stage está pronto para consulta.",
        "variables": [
            {"key": "stage_name", "label": "Nome da stage",                       "required": True},
            {"key": "stage_id",   "label": "ID da stage",                          "required": True, "type": "number"},
            {"key": "day_label",  "label": "Rótulo do dia (ex: Dia 1, opcional)", "required": False},
        ],
        "recipient_groups": ["all"],
    },
    "stage_recap": {
        "key": "stage_recap",
        "label": "Recap da Stage",
        "description": "Avisa que a stage foi encerrada e o ranking final está disponível.",
        "variables": [
            {"key": "stage_name", "label": "Nome da stage", "required": True},
            {"key": "stage_id",   "label": "ID da stage",   "required": True, "type": "number"},
        ],
        "recipient_groups": ["all"],
    },
    "price_rebalance": {
        "key": "price_rebalance",
        "label": "Repricing Executado",
        "description": "Avisa que os preços foram reajustados e o lineup pode ter mudado de custo.",
        "variables": [
            {"key": "stage_name", "label": "Nome da stage", "required": True},
            {"key": "stage_id",   "label": "ID da stage",   "required": True, "type": "number"},
        ],
        "recipient_groups": ["all"],
    },
    "championship_start": {
        "key": "championship_start",
        "label": "Novo Campeonato",
        "description": "Convida usuários a participar de um campeonato recém-disponível.",
        "variables": [
            {"key": "champ_name", "label": "Nome do campeonato",       "required": True},
            {"key": "cta_url",    "label": "URL do campeonato (opcional)", "required": False},
        ],
        "recipient_groups": ["all"],
    },
    "announcement": {
        "key": "announcement",
        "label": "Comunicado Geral",
        "description": "Mensagem livre enviada para todos os usuários ativos.",
        "variables": [
            {"key": "title",     "label": "Título",                    "required": True},
            {"key": "body",      "label": "Corpo do email",            "required": True, "multiline": True},
            {"key": "cta_label", "label": "Texto do botão (opcional)", "required": False},
            {"key": "cta_url",   "label": "URL do botão (opcional)",   "required": False},
        ],
        "recipient_groups": ["all"],
    },
}

# Regras do checklist: (template_key, condição em função do stage, urgência)
# Condição recebe dict com keys: lineup_status, stage_phase
_CHECKLIST_RULES: list[tuple[str, callable, str]] = [
    ("lineup_open",         lambda s: s["lineup_status"] == "open",                               "high"),
    ("price_rebalance",     lambda s: s["lineup_status"] == "open",                               "medium"),
    ("no_lineup_reminder",  lambda s: s["lineup_status"] == "open",                               "medium"),
    ("lineup_closing_soon", lambda s: s["lineup_status"] == "open",                               "medium"),
    ("results_available",   lambda s: s["stage_phase"] in ("live", "finished"),                   "high"),
    ("stage_recap",         lambda s: s["stage_phase"] == "finished",                             "high"),
]


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

    for var in tpl["variables"]:
        if var["required"] and not req.variables.get(var["key"]):
            raise HTTPException(status_code=400, detail=f"Variável obrigatória ausente: '{var['key']}'")

    from app.services import email as svc

    v = req.variables
    result: dict = {"sent": 0, "failed": 0}
    subject = ""

    if req.template_key == "lineup_open":
        stage_name = v["stage_name"]
        stage_id   = int(v["stage_id"])
        close_iso  = v.get("close_iso") or None
        subject    = f"XAMA Fantasy — Lineup aberta: {stage_name}"
        if req.recipient_group == "no_lineup":
            result = svc.broadcast_no_lineup_reminder(db, stage_name, stage_id)
        else:
            result = svc.broadcast_lineup_open(db, stage_name, stage_id, close_iso)

    elif req.template_key == "no_lineup_reminder":
        stage_name = v["stage_name"]
        stage_id   = int(v["stage_id"])
        subject    = f"XAMA Fantasy — Monte seu lineup: {stage_name}"
        result     = svc.broadcast_no_lineup_reminder(db, stage_name, stage_id)

    elif req.template_key == "lineup_closing_soon":
        stage_name = v["stage_name"]
        stage_id   = int(v["stage_id"])
        close_iso  = v.get("close_iso") or None
        subject    = f"XAMA Fantasy — Fechamento próximo: {stage_name}"
        result     = svc.broadcast_lineup_closing_soon(db, stage_name, stage_id, close_iso)

    elif req.template_key == "results_available":
        stage_name = v["stage_name"]
        stage_id   = int(v["stage_id"])
        day_label  = v.get("day_label") or None
        day_part   = f" — {day_label}" if day_label else ""
        subject    = f"XAMA Fantasy — Pontuação disponível: {stage_name}{day_part}"
        result     = svc.broadcast_results_available(db, stage_name, stage_id, day_label)

    elif req.template_key == "stage_recap":
        stage_name = v["stage_name"]
        stage_id   = int(v["stage_id"])
        subject    = f"XAMA Fantasy — Resultado final: {stage_name}"
        result     = svc.broadcast_stage_recap(db, stage_name, stage_id)

    elif req.template_key == "price_rebalance":
        stage_name = v["stage_name"]
        stage_id   = int(v["stage_id"])
        subject    = f"XAMA Fantasy — Preços reajustados: {stage_name}"
        result     = svc.broadcast_price_rebalance(db, stage_name, stage_id)

    elif req.template_key == "championship_start":
        champ_name = v["champ_name"]
        cta_url    = v.get("cta_url") or None
        subject    = f"XAMA Fantasy — {champ_name}"
        result     = svc.broadcast_championship_start(db, champ_name, cta_url)

    elif req.template_key == "announcement":
        title     = v["title"]
        body      = v["body"]
        cta_label = v.get("cta_label") or None
        cta_url   = v.get("cta_url") or None
        subject   = f"XAMA Fantasy — {title}"
        result    = svc.broadcast_announcement(db, title, body, cta_label, cta_url)

    log = EmailLog(
        template_key    = req.template_key,
        subject         = subject,
        recipient_group = req.recipient_group,
        stage_id        = int(v["stage_id"]) if "stage_id" in v else None,
        sent_count      = result["sent"],
        failed_count    = result["failed"],
        variables       = v,
        triggered_by    = current_user.username,
        sent_at         = datetime.now(timezone.utc),
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    return {"log_id": log.id, "sent": result["sent"], "failed": result["failed"]}


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
        _build_lineup_closing_soon_html,
        _build_results_available_html,
        _build_stage_recap_html,
        _build_price_rebalance_html,
        _build_championship_start_html,
        _build_announcement_html,
    )

    # Preview usa username de exemplo
    PREVIEW_USERNAME = "NomeExemplo"
    v = req.variables

    if req.template_key == "lineup_open":
        stage_name = v.get("stage_name", "")
        stage_id   = int(v.get("stage_id", 0))
        close_iso  = v.get("close_iso") or None
        if req.recipient_group == "no_lineup":
            subject, html = _build_no_lineup_reminder_html(PREVIEW_USERNAME, stage_name, stage_id)
        else:
            subject, html = _build_lineup_open_html(PREVIEW_USERNAME, stage_name, stage_id, close_iso)

    elif req.template_key == "no_lineup_reminder":
        subject, html = _build_no_lineup_reminder_html(
            PREVIEW_USERNAME, v.get("stage_name", ""), int(v.get("stage_id", 0))
        )

    elif req.template_key == "lineup_closing_soon":
        subject, html = _build_lineup_closing_soon_html(
            PREVIEW_USERNAME,
            v.get("stage_name", ""),
            int(v.get("stage_id", 0)),
            v.get("close_iso") or None,
        )

    elif req.template_key == "results_available":
        subject, html = _build_results_available_html(
            PREVIEW_USERNAME,
            v.get("stage_name", ""),
            int(v.get("stage_id", 0)),
            v.get("day_label") or None,
        )

    elif req.template_key == "stage_recap":
        subject, html = _build_stage_recap_html(
            PREVIEW_USERNAME, v.get("stage_name", ""), int(v.get("stage_id", 0))
        )

    elif req.template_key == "price_rebalance":
        subject, html = _build_price_rebalance_html(
            PREVIEW_USERNAME, v.get("stage_name", ""), int(v.get("stage_id", 0))
        )

    elif req.template_key == "championship_start":
        subject, html = _build_championship_start_html(
            PREVIEW_USERNAME, v.get("champ_name", ""), v.get("cta_url") or None
        )

    elif req.template_key == "announcement":
        subject, html = _build_announcement_html(
            PREVIEW_USERNAME,
            v.get("title", ""),
            v.get("body", ""),
            v.get("cta_label") or None,
            v.get("cta_url") or None,
        )

    else:
        raise HTTPException(status_code=400, detail="Template sem preview implementado.")

    return {"subject": subject, "html": html}


@router.get("/checklist")
def get_email_checklist(
    db: Session = Depends(get_db),
    _: UserModel = Depends(require_admin),
):
    """
    Retorna pendências de email por stage ativa.
    Para cada stage em fase 'live'/'finished' ou com lineup aberto,
    lista quais emails esperados ainda não foram disparados.
    """
    from sqlalchemy import text

    # Stages relevantes (não upcoming nem totalmente fechadas-e-novas)
    stages_rows = db.execute(
        text("""
            SELECT s.id, s.name, s.short_name, s.lineup_status, s.stage_phase,
                   c.short_name AS champ_short_name, s.championship_id, c.name AS champ_name
            FROM stage s
            JOIN championship c ON c.id = s.championship_id
            WHERE s.stage_phase != 'upcoming'
               OR s.lineup_status = 'open'
            ORDER BY s.id DESC
            LIMIT 30
        """)
    ).fetchall()

    if not stages_rows:
        return []

    stage_ids = [r[0] for r in stages_rows]
    # IDs são inteiros vindos do nosso próprio banco — seguro formatar direto
    ids_csv = ", ".join(str(i) for i in stage_ids)

    # Último disparo por (stage_id, template_key)
    logs_rows = db.execute(
        text(f"""
            SELECT stage_id, template_key, MAX(sent_at) AS last_sent_at, SUM(sent_count) AS total_sent
            FROM email_log
            WHERE stage_id IN ({ids_csv})
            GROUP BY stage_id, template_key
        """)
    ).fetchall()

    sent_index: dict[tuple, dict] = {}
    for row in logs_rows:
        sent_index[(row[0], row[1])] = {
            "last_sent_at": row[2].isoformat() if row[2] else None,
            "total_sent": row[3],
        }

    items = []
    for s in stages_rows:
        stage_dict = {
            "lineup_status": s[3],
            "stage_phase": s[4],
        }
        stage_label = f"{s[5]} — {s[1]}"

        for tpl_key, condition, urgency in _CHECKLIST_RULES:
            if not condition(stage_dict):
                continue

            log_info = sent_index.get((s[0], tpl_key))
            tpl_meta = TEMPLATES.get(tpl_key, {})

            items.append({
                "stage_id":         s[0],
                "stage_name":       stage_label,
                "stage_short":      s[2],
                "lineup_status":    s[3],
                "stage_phase":      s[4],
                "championship_id":  s[6],
                "champ_name":       s[7],
                "champ_short_name": s[5],
                "template_key":     tpl_key,
                "template_label":   tpl_meta.get("label", tpl_key),
                "status":           "sent" if log_info else "pending",
                "last_sent_at":     log_info["last_sent_at"] if log_info else None,
                "total_sent":       log_info["total_sent"] if log_info else 0,
                "urgency":          urgency,
            })

    return items


class MarkSentRequest(BaseModel):
    stage_id: int
    template_key: str


@router.post("/checklist/mark-sent", status_code=status.HTTP_200_OK)
def mark_sent_manually(
    req: MarkSentRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_admin),
):
    """
    Registra um email como 'já enviado' sem disparar nada.
    Útil quando o email foi enviado por outro canal e só precisa fechar a pendência.
    """
    tpl_meta = TEMPLATES.get(req.template_key, {})
    subject = f"XAMA Fantasy — {tpl_meta.get('label', req.template_key)} [marcado manualmente]"

    log = EmailLog(
        template_key    = req.template_key,
        subject         = subject,
        recipient_group = "manual",
        stage_id        = req.stage_id,
        sent_count      = 0,
        failed_count    = 0,
        variables       = {"note": "Marcado como enviado manualmente pelo admin"},
        triggered_by    = f"{current_user.username} (manual)",
        sent_at         = datetime.now(timezone.utc),
    )
    db.add(log)
    db.commit()
    return {"ok": True, "log_id": log.id}


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
