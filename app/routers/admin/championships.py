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
from app.schemas.stage import StageResponse

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


class StageWizardIn(BaseModel):
    """Stage definition inside the championship wizard — championship_id is injected server-side."""
    name: str
    short_name: str
    start_date: Optional[str] = None        # ISO datetime string or None
    lineup_close_at: Optional[str] = None   # ISO datetime string or None
    price_min: int = 10
    price_max: int = 35
    captain_multiplier: float = 1.30
    shard: Optional[str] = None             # inherits from championship if None


class ChampionshipWizardIn(BaseModel):
    """Creates a championship + N stages in a single atomic transaction."""
    championship: ChampionshipCreate
    stages: list[StageWizardIn]


class ChampionshipWizardOut(BaseModel):
    championship: ChampionshipResponse
    stages: list[StageResponse]


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


@router.post("/create-with-stages", response_model=ChampionshipWizardOut, status_code=status.HTTP_201_CREATED)
def create_championship_with_stages(
    body: ChampionshipWizardIn,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> ChampionshipWizardOut:
    """
    Cria championship + N stages em uma única transação atômica.
    Se qualquer stage falhar, o championship também é revertido.
    """
    from datetime import datetime, timezone
    from app.models.stage import Stage
    from app.models.stage_day import StageDay

    if not body.stages:
        raise HTTPException(status_code=422, detail="Pelo menos uma stage é necessária.")

    championship = Championship(**body.championship.model_dump())
    db.add(championship)
    db.flush()  # get championship.id before creating stages

    created_stages: list[Stage] = []
    for s in body.stages:
        shard = s.shard or body.championship.shard

        def _parse_dt(val: Optional[str]) -> Optional[datetime]:
            if not val:
                return None
            try:
                dt = datetime.fromisoformat(val.replace("Z", "+00:00"))
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt
            except ValueError:
                raise HTTPException(status_code=422, detail=f"Data inválida: {val!r}")

        start_dt = _parse_dt(s.start_date)
        close_dt = _parse_dt(s.lineup_close_at)

        stage = Stage(
            championship_id=championship.id,
            name=s.name,
            short_name=s.short_name,
            shard=shard,
            start_date=start_dt,
            lineup_close_at=close_dt,
            price_min=s.price_min,
            price_max=s.price_max,
            captain_multiplier=s.captain_multiplier,
        )
        db.add(stage)
        db.flush()

        if start_dt:
            db.add(StageDay(
                stage_id=stage.id,
                day_number=1,
                date=start_dt.date(),
                lineup_close_at=close_dt,
            ))

        created_stages.append(stage)

    db.commit()
    db.refresh(championship)
    for stage in created_stages:
        db.refresh(stage)

    return ChampionshipWizardOut(
        championship=ChampionshipResponse.model_validate(championship),
        stages=[StageResponse.model_validate(s) for s in created_stages],
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


# ── Full coverage scan ─────────────────────────────────────────────────────────

def _suggest_person(alias: str, roster_candidates: list[dict]) -> Optional[dict]:
    """
    Tenta identificar a qual person do roster um alias não-resolvido pertence.
    Estratégia (por ordem de confiança):
      1. alias termina com display_name (ex: FATE_fl8nkr → fl8nkr)          → 95
      2. alias contém display_name (substring)                                → 75
      3. prefixo do alias bate com trecho do team_name (ex: FATE_ → Team FATE) → 60
      4. sem match                                                             → None
    """
    alias_lower = alias.lower()

    best: Optional[dict] = None
    best_score = 0

    for cand in roster_candidates:
        name_lower = cand["display_name"].lower()
        score = 0

        if alias_lower.endswith(name_lower):
            score = 95
        elif name_lower and name_lower in alias_lower:
            score = 75
        else:
            # Team prefix heuristic: "FATE_" prefix → look for "team fate" in team_name
            parts = alias.split("_")
            prefix = parts[0].lower() if parts else ""
            team_lower = (cand["team_name"] or "").lower()
            if prefix and prefix in team_lower:
                score = 60

        if score > best_score:
            best_score = score
            best = {**cand, "confidence": best_score}

    return best if best_score >= 60 else None


@router.post(
    "/{championship_id}/full-coverage-scan",
    summary="Scan completo de aliases não resolvidos em todas as stages do campeonato",
    description=(
        "Re-busca `matches_per_stage` partidas da PUBG API por stage e identifica aliases "
        "que não foram mapeados para nenhuma Person. "
        "Para cada alias não resolvido, tenta sugerir automaticamente a Person do roster "
        "usando matching de nome e prefixo de time. "
        "READ-ONLY: nenhuma alteração no banco."
    ),
)
def full_coverage_scan(
    championship_id: int,
    matches_per_stage: int = Query(2, ge=1, le=5, description="Matches por stage a escanear (default 2)"),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> dict:
    from app.models import Stage, StageDay, Match, Roster
    from app.pubg.client import PubgClient, PubgApiError
    from app.services.identity import build_lookup, resolve_from_lookup
    from app.models.person import Person

    championship = _get_or_404(db, championship_id)

    stages = (
        db.query(Stage)
        .filter(Stage.championship_id == championship_id, Stage.is_active == True)  # noqa
        .order_by(Stage.id)
        .all()
    )

    if not stages:
        return {"championship_id": championship_id, "stages_scanned": 0, "all_unresolved": []}

    # Pre-load per-stage roster candidates (for suggestion engine)
    stage_roster: dict[int, list[dict]] = {}
    for stage in stages:
        roster_rows = (
            db.query(Roster, Person)
            .join(Person, Person.id == Roster.person_id)
            .filter(Roster.stage_id == stage.id, Roster.is_available == True)  # noqa
            .all()
        )
        stage_roster[stage.id] = [
            {"person_id": r.person_id, "display_name": p.display_name, "team_name": r.team_name}
            for r, p in roster_rows
        ]

    results_by_stage = []
    global_seen: dict[str, dict] = {}  # account_id → first occurrence

    for stage in stages:
        client = PubgClient(shard=stage.shard)
        lookup = build_lookup(db, stage.id)

        matches = (
            db.query(Match)
            .join(StageDay, Match.stage_day_id == StageDay.id)
            .filter(StageDay.stage_id == stage.id)
            .order_by(Match.id)
            .limit(matches_per_stage)
            .all()
        )

        stage_unresolved: list[dict] = []
        stage_errors = []
        scanned = 0

        for match in matches:
            try:
                raw = client.get_match(match.pubg_match_id)
            except PubgApiError as exc:
                stage_errors.append({"pubg_match_id": match.pubg_match_id, "error": str(exc)})
                continue

            scanned += 1
            for rps in raw.player_stats:
                if resolve_from_lookup(lookup, rps.account_id, rps.alias) is None:
                    if rps.account_id not in global_seen:
                        suggestion = _suggest_person(rps.alias, stage_roster.get(stage.id, []))
                        entry = {
                            "account_id": rps.account_id,
                            "alias": rps.alias,
                            "stage_id": stage.id,
                            "pubg_match_id": match.pubg_match_id,
                            "suggested_person_id": suggestion["person_id"] if suggestion else None,
                            "suggested_display_name": suggestion["display_name"] if suggestion else None,
                            "suggested_team": suggestion["team_name"] if suggestion else None,
                            "confidence": suggestion["confidence"] if suggestion else 0,
                        }
                        global_seen[rps.account_id] = entry
                        stage_unresolved.append(entry)

        results_by_stage.append({
            "stage_id": stage.id,
            "shard": stage.shard,
            "matches_scanned": scanned,
            "unresolved_count": len(stage_unresolved),
            "errors": stage_errors,
            "unresolved": stage_unresolved,
        })

    all_unresolved = list(global_seen.values())
    high_confidence = [u for u in all_unresolved if u["confidence"] >= 75]
    needs_review = [u for u in all_unresolved if 0 < u["confidence"] < 75]
    no_match = [u for u in all_unresolved if u["confidence"] == 0]

    return {
        "championship_id": championship_id,
        "championship_name": championship.name,
        "stages_scanned": len(stages),
        "total_unresolved": len(all_unresolved),
        "high_confidence_matches": len(high_confidence),
        "needs_review": len(needs_review),
        "no_match_found": len(no_match),
        "by_stage": results_by_stage,
        "all_unresolved": all_unresolved,
        "instruction": (
            "Para cada entry: se suggested_person_id estiver preenchido, "
            "confirme e use POST /admin/persons/{person_id}/accounts para vincular o account_id. "
            "Se confidence=0, identifique manualmente ou crie nova Person. "
            "Após vincular todas as contas: POST /admin/championships/{id}/reprocess-all."
        ),
    }


# ── Reprocess all ─────────────────────────────────────────────────────────────

@router.post(
    "/{championship_id}/reprocess-all",
    summary="Reprocessa todas as partidas do campeonato (idempotente)",
    description=(
        "Re-busca e recalcula todos os MATCH_STAT e USER_STAGE_STAT para todas "
        "as stages do campeonato. Seguro: não apaga dados — usa upsert. "
        "Ideal após adicionar novos player_accounts para capturar os dados retroativos. "
        "AVISO: faz uma requisição para a PUBG API por partida — pode ser lento."
    ),
)
def reprocess_all(
    championship_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> dict:
    from app.models import Stage, StageDay, Match
    from app.services.import_ import reprocess_match

    championship = _get_or_404(db, championship_id)

    stages = (
        db.query(Stage)
        .filter(Stage.championship_id == championship_id, Stage.is_active == True)  # noqa
        .order_by(Stage.id)
        .all()
    )

    if not stages:
        return {"championship_id": championship_id, "matches_total": 0, "results": []}

    results = []
    total_ok = 0
    total_err = 0

    for stage in stages:
        matches = (
            db.query(Match)
            .join(StageDay, Match.stage_day_id == StageDay.id)
            .filter(StageDay.stage_id == stage.id)
            .order_by(Match.id)
            .all()
        )
        for match in matches:
            try:
                r = reprocess_match(db=db, pubg_match_id=match.pubg_match_id, stage_id=stage.id)
                results.append({
                    "stage_id": stage.id,
                    "pubg_match_id": match.pubg_match_id,
                    "status": r["status"],
                    "players_ok": r.get("players_ok", 0),
                    "players_skipped": r.get("players_skipped", 0),
                    "error": r.get("error"),
                })
                if not r.get("error"):
                    total_ok += 1
                else:
                    total_err += 1
            except Exception as exc:
                results.append({
                    "stage_id": stage.id,
                    "pubg_match_id": match.pubg_match_id,
                    "status": "error",
                    "error": str(exc),
                })
                total_err += 1

    return {
        "championship_id": championship_id,
        "championship_name": championship.name,
        "matches_total": len(results),
        "matches_ok": total_ok,
        "matches_error": total_err,
        "results": results,
    }
