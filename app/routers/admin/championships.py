# app/routers/admin/championships.py
from __future__ import annotations

import os
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin
from app.models.championship import Championship
from app.models.user import User
from app.schemas.championship import (
    ChampionshipCreate,
    ChampionshipResponse,
    ChampionshipUpdate,
)

_PUBG_BASE = "https://api.pubg.com"

router = APIRouter(
    prefix="/admin/championships",
    tags=["Admin — Championships"],
    dependencies=[Depends(require_admin)],
)


# ── Schemas ───────────────────────────────────────────────────────────────────

class ShardDetectResponse(BaseModel):
    tournament_id: str
    shard: str
    sample_match_id: str
    verified: bool


class CoveragePlayerEntry(BaseModel):
    stage_id: int
    stage_shard: str
    person_id: int
    display_name: str
    team_name: str
    matches_appeared: int
    total_matches: int
    coverage_pct: float
    registered_accounts: list[str]  # aliases cadastrados no player_account


class CoverageAuditResponse(BaseModel):
    championship_id: int
    championship_name: str
    total_gaps: int
    zero_coverage: int
    players: list[CoveragePlayerEntry]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _pubg_headers() -> dict:
    key = os.getenv("PUBG_API_KEY", "")
    if not key:
        raise HTTPException(status_code=500, detail="PUBG_API_KEY não configurada no servidor.")
    return {"Authorization": f"Bearer {key}", "Accept": "application/vnd.api+json"}


def _get_or_404(db: Session, championship_id: int) -> Championship:
    obj = db.query(Championship).filter(Championship.id == championship_id).first()
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Championship {championship_id} not found",
        )
    return obj


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get(
    "/detect-shard",
    response_model=ShardDetectResponse,
    summary="Detectar shard de um tournament_id da PUBG API",
    description=(
        "Consulta a PUBG API para determinar o shard correto de um torneio. "
        "Regra: se GET /tournaments/{id} retorna matches e o primeiro match "
        "responde 200 em /shards/pc-tournament/matches/{id}, o shard é pc-tournament. "
        "Caso contrário, steam."
    ),
)
def detect_shard(
    tournament_id: str = Query(..., description="Ex: eu-pecs26, am-pas126"),
    _admin: User = Depends(require_admin),
) -> ShardDetectResponse:
    headers = _pubg_headers()

    # Passo 1 — buscar match IDs do torneio
    try:
        resp = httpx.get(f"{_PUBG_BASE}/tournaments/{tournament_id}", headers=headers, timeout=10)
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Erro de rede ao contatar PUBG API: {exc}")

    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail=f"Tournament '{tournament_id}' não encontrado na PUBG API.")
    if not resp.is_success:
        raise HTTPException(status_code=502, detail=f"PUBG API retornou {resp.status_code}: {resp.text[:200]}")

    matches = resp.json().get("data", {}).get("relationships", {}).get("matches", {}).get("data", [])
    if not matches:
        raise HTTPException(status_code=422, detail=f"Tournament '{tournament_id}' não possui matches ainda.")

    sample_match_id = matches[0]["id"]

    # Passo 2 — confirmar shard via probe em pc-tournament
    try:
        probe = httpx.get(
            f"{_PUBG_BASE}/shards/pc-tournament/matches/{sample_match_id}",
            headers=headers,
            timeout=10,
        )
        shard = "pc-tournament" if probe.status_code == 200 else "steam"
        verified = probe.status_code in (200, 404)  # qualquer resposta da API = verificado
    except httpx.RequestError:
        shard = "pc-tournament"  # best-guess se torneio existe mas probe falhou
        verified = False

    return ShardDetectResponse(
        tournament_id=tournament_id,
        shard=shard,
        sample_match_id=sample_match_id,
        verified=verified,
    )


@router.post("", response_model=ChampionshipResponse, status_code=status.HTTP_201_CREATED)
def create_championship(
    body: ChampionshipCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> Championship:
    championship = Championship(**body.model_dump())
    db.add(championship)
    db.commit()
    db.refresh(championship)
    return championship


@router.get("", response_model=list[ChampionshipResponse])
def list_championships(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> list[Championship]:
    q = db.query(Championship)
    if not include_inactive:
        q = q.filter(Championship.is_active == True)  # noqa: E712
    return q.order_by(Championship.id.desc()).all()


@router.get("/{championship_id}", response_model=ChampionshipResponse)
def get_championship(
    championship_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> Championship:
    return _get_or_404(db, championship_id)


@router.patch("/{championship_id}", response_model=ChampionshipResponse)
def update_championship(
    championship_id: int,
    body: ChampionshipUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> Championship:
    championship = _get_or_404(db, championship_id)

    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(championship, field, value)

    db.commit()
    db.refresh(championship)
    return championship


@router.delete("/{championship_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_championship(
    championship_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> None:
    """Soft delete — sets is_active=False. Data is preserved."""
    championship = _get_or_404(db, championship_id)
    if not championship.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Championship is already inactive",
        )
    championship.is_active = False
    db.commit()


@router.get(
    "/{championship_id}/coverage-audit",
    response_model=CoverageAuditResponse,
    summary="Auditoria de cobertura de dados do campeonato",
    description=(
        "Retorna todos os jogadores do roster que aparecem em menos partidas do que o esperado. "
        "Útil para detectar contas não cadastradas (player_account faltando) ou subs não mapeados. "
        "Leitura pura — nenhuma alteração no banco."
    ),
)
def get_coverage_audit(
    championship_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> CoverageAuditResponse:
    championship = _get_or_404(db, championship_id)

    rows = db.execute(text("""
        WITH stage_match_counts AS (
            SELECT sd.stage_id, COUNT(DISTINCT m.id) AS total_matches
            FROM match m
            JOIN stage_day sd ON sd.id = m.stage_day_id
            GROUP BY sd.stage_id
        ),
        player_appearances AS (
            SELECT sd.stage_id, ms.person_id, COUNT(DISTINCT ms.match_id) AS matches_appeared
            FROM match_stat ms
            JOIN match m ON m.id = ms.match_id
            JOIN stage_day sd ON sd.id = m.stage_day_id
            GROUP BY sd.stage_id, ms.person_id
        )
        SELECT
            r.stage_id,
            s.shard          AS stage_shard,
            r.person_id,
            p.display_name,
            r.team_name,
            COALESCE(pa.matches_appeared, 0)  AS matches_appeared,
            smc.total_matches
        FROM roster r
        JOIN person p ON p.id = r.person_id
        JOIN stage s ON s.id = r.stage_id
        LEFT JOIN player_appearances pa ON pa.stage_id = r.stage_id AND pa.person_id = r.person_id
        LEFT JOIN stage_match_counts smc ON smc.stage_id = r.stage_id
        WHERE s.championship_id = :cid
          AND r.is_available = true
          AND smc.total_matches > 0
          AND COALESCE(pa.matches_appeared, 0) < smc.total_matches
        ORDER BY COALESCE(pa.matches_appeared, 0) ASC, r.stage_id, r.team_name, p.display_name
    """), {"cid": championship_id}).fetchall()

    if not rows:
        return CoverageAuditResponse(
            championship_id=championship_id,
            championship_name=championship.name,
            total_gaps=0,
            zero_coverage=0,
            players=[],
        )

    # Load registered accounts per person (for the persons found in gaps)
    person_ids = list({r.person_id for r in rows})
    acc_rows = db.execute(text("""
        SELECT person_id, alias, account_id FROM player_account
        WHERE person_id = ANY(:pids)
        ORDER BY person_id, active_from
    """), {"pids": person_ids}).fetchall()

    accounts_by_person: dict[int, list[str]] = {}
    for ar in acc_rows:
        accounts_by_person.setdefault(ar.person_id, []).append(
            f"{ar.alias} ({ar.account_id[:12]}...)" if ar.alias else ar.account_id[:16]
        )

    players = [
        CoveragePlayerEntry(
            stage_id=r.stage_id,
            stage_shard=r.stage_shard,
            person_id=r.person_id,
            display_name=r.display_name,
            team_name=r.team_name,
            matches_appeared=int(r.matches_appeared),
            total_matches=int(r.total_matches),
            coverage_pct=round(100.0 * r.matches_appeared / r.total_matches, 1),
            registered_accounts=accounts_by_person.get(r.person_id, []),
        )
        for r in rows
    ]

    return CoverageAuditResponse(
        championship_id=championship_id,
        championship_name=championship.name,
        total_gaps=len(players),
        zero_coverage=sum(1 for p in players if p.matches_appeared == 0),
        players=players,
    )
