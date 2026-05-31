# app/routers/admin/stages.py
from __future__ import annotations
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin
from app.models.championship import Championship
from app.models.faceoff import Faceoff
from app.models.stage import Stage
from app.models.stage_day import StageDay
from app.models.user import User
from app.schemas.stage import StageCreate, StageResponse, StageUpdate

router = APIRouter(
    prefix="/admin/stages",
    tags=["Admin — Stages"],
    dependencies=[Depends(require_admin)],
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_or_404(db: Session, stage_id: int) -> Stage:
    obj = db.query(Stage).filter(Stage.id == stage_id).first()
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Stage {stage_id} not found",
        )
    return obj


def _validate_championship(db: Session, championship_id: int) -> Championship:
    champ = db.query(Championship).filter(Championship.id == championship_id).first()
    if not champ:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Championship {championship_id} not found",
        )
    if not champ.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Championship {championship_id} is inactive",
        )
    return champ


def _validate_carries_stats_from(db: Session, stage_ids: list[int]) -> None:
    """Ensure all referenced stage_ids actually exist."""
    for sid in stage_ids:
        if not db.query(Stage).filter(Stage.id == sid).first():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Stage {sid} referenced in carries_stats_from not found",
            )


def _validate_roster_source(db: Session, stage_id: int) -> None:
    if not db.query(Stage).filter(Stage.id == stage_id).first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Stage {stage_id} referenced in roster_source_stage_id not found",
        )


def _maybe_upsert_sync_schedule(db: Session, stage: Stage) -> None:
    """
    Auto-cria ou atualiza StageSyncSchedule para stages pc-tournament.
    Chamado quando pubg_tournament_id / start_date / end_date são definidos.
    Não sobrescreve schedules completed ou cancelled.
    """
    from datetime import timedelta
    from app.models.stage_sync_schedule import StageSyncSchedule

    existing = (
        db.query(StageSyncSchedule)
        .filter(StageSyncSchedule.stage_id == stage.id)
        .order_by(StageSyncSchedule.id.desc())
        .first()
    )

    run_until = stage.end_date + timedelta(hours=3)

    if existing and existing.status not in ("completed", "cancelled"):
        existing.tournament_id = stage.pubg_tournament_id
        existing.run_from  = stage.start_date
        existing.run_until = run_until
        db.add(existing)
    elif not existing or existing.status in ("completed", "cancelled"):
        db.add(StageSyncSchedule(
            stage_id      = stage.id,
            tournament_id = stage.pubg_tournament_id,
            interval_min  = 5,
            run_from      = stage.start_date,
            run_until     = run_until,
            status        = "pending",
            notes         = None,
        ))


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("", response_model=StageResponse, status_code=status.HTTP_201_CREATED)
def create_stage(
    body: StageCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> Stage:
    _validate_championship(db, body.championship_id)

    if body.carries_stats_from:
        _validate_carries_stats_from(db, body.carries_stats_from)

    if body.roster_source_stage_id:
        _validate_roster_source(db, body.roster_source_stage_id)

    stage_data = body.model_dump(exclude={"days_schedule"})
    stage = Stage(**stage_data)
    db.add(stage)
    db.flush()  # popula stage.id antes de criar os StageDays

    if body.days_schedule:
        # Multi-day: cria um StageDay por entrada, ordenados por day_number
        for ds in sorted(body.days_schedule, key=lambda d: d.day_number):
            day_date = ds.date or (ds.first_match_at.date() if ds.first_match_at else None)
            if not day_date and stage.start_date:
                day_date = stage.start_date.date()
            db.add(StageDay(
                stage_id=stage.id,
                day_number=ds.day_number,
                date=day_date,
                lineup_open_at=ds.lineup_open_at,
                lineup_close_at=ds.lineup_close_at,
                first_match_at=ds.first_match_at,
                last_match_at=ds.last_match_at,
            ))
    elif stage.start_date:
        # Single-day fallback: auto-cria Day 1
        db.add(StageDay(
            stage_id=stage.id,
            day_number=1,
            date=stage.start_date.date(),
            lineup_close_at=stage.lineup_close_at,
        ))

    db.commit()
    db.refresh(stage)

    # Auto-create StageSyncSchedule when all required fields are present
    if stage.pubg_tournament_id and stage.start_date and stage.end_date and stage.shard == "pc-tournament":
        _maybe_upsert_sync_schedule(db, stage)

    return stage


@router.get("", response_model=list[StageResponse])
def list_stages(
    championship_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> list[Stage]:
    q = db.query(Stage)
    if championship_id is not None:
        q = q.filter(Stage.championship_id == championship_id)
    return q.order_by(Stage.id.desc()).all()


# ── Tournament match discovery ────────────────────────────────────────────────
# IMPORTANTE: deve ficar ANTES de /{stage_id} — FastAPI respeita ordem de registro.

@router.get("/twire-matches")
def list_twire_matches(
    twire_tournament_id: int,
    page: int = 1,
    db: Session = Depends(get_db),
):
    """
    Busca matches via Twire GraphQL (backup quando PUBG API falha).
    Cruza shardInfo (PUBG UUID) com o banco para indicar quais já foram importados.
    """
    import requests as _req
    from app.models.match import Match

    EP = "https://tjjkdyimqrb7jjnc6m5rpefjtu.appsync-api.eu-west-1.amazonaws.com/graphql"
    KEY = "da2-vqpq6wms5ndbvhl2r7kvzbpmfi"
    HDR = {"Content-Type": "application/json", "x-api-key": KEY, "Origin": "https://twire.gg"}

    payload = {
        "query": (
            '{ getLastestMatches(game: "pubg", tournamentId: %d, page: %d)'
            " { id shardInfo startDate map } }"
        ) % (twire_tournament_id, page)
    }

    try:
        r = _req.post(EP, headers=HDR, json=payload, timeout=15)
        data = r.json()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Twire API error: {exc}")

    if "errors" in data:
        raise HTTPException(
            status_code=502,
            detail=f"Twire GraphQL error: {data['errors'][0].get('message', 'unknown')}",
        )

    raw_matches = data.get("data", {}).get("getLastestMatches", []) or []
    all_uuids = [m["shardInfo"] for m in raw_matches if m.get("shardInfo")]

    imported_matches = db.query(Match).filter(Match.pubg_match_id.in_(all_uuids)).all()
    imported_map = {m.pubg_match_id: m for m in imported_matches}

    result = []
    for m in raw_matches:
        uuid = m.get("shardInfo")
        if not uuid:
            continue
        imp = imported_map.get(uuid)
        result.append({
            "match_id": uuid,
            "twire_id": m.get("id"),
            "imported": imp is not None,
            "stage_day_id": imp.stage_day_id if imp else None,
            "played_at": m.get("startDate"),
            "map": m.get("map"),
        })

    result.sort(key=lambda x: x["imported"])  # novos primeiro
    return result


@router.get("/tournament-matches")
def list_tournament_matches(
    tournament_id: str,
    db: Session = Depends(get_db),
):
    """
    Busca todos os match IDs de um torneio na PUBG API e cruza com o banco
    para indicar quais já foram importados.
    Retorna lista ordenada: novos primeiro, depois importados.
    """
    from app.services.match_discovery import discover_matches_tournament_with_dates
    from app.models.match import Match

    matches_with_dates = discover_matches_tournament_with_dates(tournament_id)
    if not matches_with_dates:
        return []

    all_ids = list(matches_with_dates.keys())
    imported_matches = (
        db.query(Match)
        .filter(Match.pubg_match_id.in_(all_ids))
        .all()
    )
    imported_map = {m.pubg_match_id: m for m in imported_matches}

    result = []
    for mid in all_ids:
        m = imported_map.get(mid)
        # played_at: prefer DB value (definitive), fallback to API createdAt for unimported matches
        if m and m.played_at:
            played_at_str = m.played_at.isoformat()
        elif matches_with_dates.get(mid):
            played_at_str = matches_with_dates[mid]
        else:
            played_at_str = None
        result.append({
            "match_id": mid,
            "imported": m is not None,
            "stage_day_id": m.stage_day_id if m else None,
            "played_at": played_at_str,
        })

    result.sort(key=lambda x: (x["imported"], x["played_at"] or ""))  # novos primeiro, ordenados por data
    return result


@router.get("/{stage_id}", response_model=StageResponse)
def get_stage(
    stage_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> Stage:
    return _get_or_404(db, stage_id)


@router.patch("/{stage_id}", response_model=StageResponse)
def update_stage(
    stage_id: int,
    body: StageUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> Stage:
    stage = _get_or_404(db, stage_id)

    updates = body.model_dump(exclude_unset=True)

    if "championship_id" in updates:
        _validate_championship(db, updates["championship_id"])

    if "carries_stats_from" in updates and updates["carries_stats_from"]:
        _validate_carries_stats_from(db, updates["carries_stats_from"])

    if "roster_source_stage_id" in updates and updates["roster_source_stage_id"]:
        _validate_roster_source(db, updates["roster_source_stage_id"])

    # Guard: lineup_status só aceita transições válidas (closed ↔ open ↔ locked)
    # stage_phase é livre — admin pode mudar upcoming/live/finished a qualquer momento
    if "lineup_status" in updates:
        new_status = updates["lineup_status"]
        current = stage.lineup_status
        valid_transitions = {
            "closed": {"open", "locked"},
            "open":   {"locked", "closed"},
            "locked": {"open", "closed"},
        }
        if new_status != current and new_status not in valid_transitions.get(current, set()):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot transition lineup_status from '{current}' to '{new_status}'",
            )

    prev_lineup_status = stage.lineup_status
    prev_stage_phase   = stage.stage_phase

    for field, value in updates.items():
        setattr(stage, field, value)

    # ── Lifecycle automático de faceoffs ──────────────────────────────────────

    # 1. Auto-ABRE faceoffs draft quando primeira stage abre lineup
    if (
        "lineup_status" in updates
        and updates["lineup_status"] == "open"
        and prev_lineup_status != "open"
        and stage.championship_id
    ):
        championship = db.query(Championship).filter(
            Championship.id == stage.championship_id
        ).first()
        if championship and championship.has_faceoff:
            # Só abre se nenhuma outra stage do campeonato já está open/locked
            other_active = db.query(Stage).filter(
                Stage.championship_id == stage.championship_id,
                Stage.id != stage.id,
                Stage.lineup_status.in_(["open", "locked"]),
            ).first()
            if not other_active:
                db.query(Faceoff).filter(
                    Faceoff.championship_id == stage.championship_id,
                    Faceoff.status == "draft",
                ).update({"status": "open"}, synchronize_session=False)

    # 2. Auto-FECHA faceoffs abertos quando lineup_status → locked
    if (
        "lineup_status" in updates
        and updates["lineup_status"] == "locked"
        and prev_lineup_status != "locked"
        and stage.championship_id
    ):
        db.query(Faceoff).filter(
            Faceoff.championship_id == stage.championship_id,
            Faceoff.status == "open",
        ).update({"status": "closed"}, synchronize_session=False)

    # 3. Auto-RESOLVE + set finished_at quando todos os stages vão pra finished
    if (
        "stage_phase" in updates
        and updates["stage_phase"] == "finished"
        and prev_stage_phase != "finished"
        and stage.championship_id
    ):
        # Verifica se todas as OUTRAS stages ativas do campeonato já estão finished
        # (a atual já foi atualizada via setattr, mas antes do flush)
        other_unfinished = db.query(Stage).filter(
            Stage.championship_id == stage.championship_id,
            Stage.id != stage.id,
            Stage.stage_phase != "finished",
            Stage.is_active == True,  # noqa: E712
        ).first()

        if not other_unfinished:
            from datetime import datetime, timezone
            from app.services.team_standings import calculate_team_tournament_standings

            championship = db.query(Championship).filter(
                Championship.id == stage.championship_id
            ).first()
            if championship and championship.has_faceoff and not championship.finished_at:
                championship.finished_at = datetime.now(timezone.utc)

                # Tenta auto-resolver faceoffs fechados
                closed_faceoffs = db.query(Faceoff).filter(
                    Faceoff.championship_id == stage.championship_id,
                    Faceoff.status == "closed",
                ).all()

                if closed_faceoffs:
                    try:
                        standings = calculate_team_tournament_standings(stage.championship_id, db)
                        if standings:
                            rank_map = {s["team_name"]: s["rank"] for s in standings}
                            for f in closed_faceoffs:
                                rank_a = rank_map.get(f.team_a_name)
                                rank_b = rank_map.get(f.team_b_name)
                                if rank_a is None and rank_b is None:
                                    continue
                                if rank_a is None:
                                    winner = f.team_b_name
                                elif rank_b is None:
                                    winner = f.team_a_name
                                elif rank_a < rank_b:
                                    winner = f.team_a_name
                                elif rank_b < rank_a:
                                    winner = f.team_b_name
                                else:
                                    winner = None  # empate
                                f.winner_team_name = winner
                                f.status = "resolved"
                    except Exception:
                        pass  # auto-resolve falhou — admin usa bulk-resolve manualmente

    # Upsert per-day schedule when provided
    if "days_schedule" in updates and updates["days_schedule"]:
        from app.schemas.stage import DayScheduleInput as _DSI
        for ds in sorted(updates["days_schedule"], key=lambda d: d.day_number if isinstance(d, _DSI) else d["day_number"]):
            ds_num = ds.day_number if isinstance(ds, _DSI) else ds["day_number"]
            existing_day = (
                db.query(StageDay)
                .filter(StageDay.stage_id == stage_id, StageDay.day_number == ds_num)
                .first()
            )
            day_date = (ds.date if isinstance(ds, _DSI) else ds.get("date")) or (
                ds.first_match_at.date() if isinstance(ds, _DSI) and ds.first_match_at else None
            )
            if existing_day:
                if day_date:
                    existing_day.date = day_date
                if isinstance(ds, _DSI):
                    if ds.lineup_open_at is not None:
                        existing_day.lineup_open_at = ds.lineup_open_at
                    if ds.lineup_close_at is not None:
                        existing_day.lineup_close_at = ds.lineup_close_at
                    if ds.first_match_at is not None:
                        existing_day.first_match_at = ds.first_match_at
                    if ds.last_match_at is not None:
                        existing_day.last_match_at = ds.last_match_at
                db.add(existing_day)
            else:
                if not day_date and stage.start_date:
                    day_date = stage.start_date.date()
                db.add(StageDay(
                    stage_id=stage_id,
                    day_number=ds_num,
                    date=day_date,
                    lineup_open_at=ds.lineup_open_at if isinstance(ds, _DSI) else ds.get("lineup_open_at"),
                    lineup_close_at=ds.lineup_close_at if isinstance(ds, _DSI) else ds.get("lineup_close_at"),
                    first_match_at=ds.first_match_at if isinstance(ds, _DSI) else ds.get("first_match_at"),
                    last_match_at=ds.last_match_at if isinstance(ds, _DSI) else ds.get("last_match_at"),
                ))

    # Sincroniza StageDay quando start_date ou lineup_close_at mudam.
    # Para stages normais: sincroniza day_number=1.
    # Para independent_lineups: lineup_close_at vai para o ÚLTIMO day (final lock);
    # start_date ainda vai para day_number=1.
    if "start_date" in updates or "lineup_close_at" in updates:
        day1 = (
            db.query(StageDay)
            .filter(StageDay.stage_id == stage_id, StageDay.day_number == 1)
            .first()
        )
        if day1:
            if "start_date" in updates and stage.start_date:
                day1.date = stage.start_date.date()
            if "lineup_close_at" in updates:
                if stage.independent_lineups:
                    last_day = (
                        db.query(StageDay)
                        .filter(StageDay.stage_id == stage_id)
                        .order_by(StageDay.day_number.desc())
                        .first()
                    )
                    target_day = last_day or day1
                else:
                    target_day = day1
                target_day.lineup_close_at = stage.lineup_close_at

    # Auto-create/update StageSyncSchedule when tournament fields are present/changed
    tournament_fields = {"pubg_tournament_id", "start_date", "end_date", "shard"}
    if tournament_fields & set(updates.keys()):
        if stage.pubg_tournament_id and stage.start_date and stage.end_date and stage.shard == "pc-tournament":
            _maybe_upsert_sync_schedule(db, stage)

    db.commit()
    db.refresh(stage)
    return stage


@router.get("/{stage_id}/next-stage")
def get_next_stage(
    stage_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """
    Retorna a próxima stage do mesmo championship: menor id > stage_id
    com lineup_status != 'open'. Admin usa para preview antes de abrir.
    """
    current = _get_or_404(db, stage_id)

    next_stage = (
        db.query(Stage)
        .filter(
            Stage.championship_id == current.championship_id,
            Stage.id > stage_id,
            Stage.lineup_status != "open",
            Stage.is_active == True,
        )
        .order_by(Stage.id.asc())
        .first()
    )

    if not next_stage:
        return None

    return {
        "id":                    next_stage.id,
        "name":                  next_stage.name,
        "short_name":            next_stage.short_name,
        "lineup_status":         next_stage.lineup_status,
        "price_min":             next_stage.price_min,
        "price_max":             next_stage.price_max,
        "pricing_newcomer_cost": next_stage.pricing_newcomer_cost,
        "captain_multiplier":    float(next_stage.captain_multiplier),
        "shard":                 next_stage.shard,
        "pubg_tournament_id":    next_stage.pubg_tournament_id,
        "independent_lineups":   next_stage.independent_lineups,
    }


@router.delete("/{stage_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_stage(
    stage_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> None:
    """
    Hard delete — only allowed if stage has no days or matches attached.
    Stages with activity should be managed via championship deactivation.
    """
    from app.models.stage_day import StageDay

    stage = _get_or_404(db, stage_id)

    has_days = db.query(StageDay).filter(StageDay.stage_id == stage_id).first()
    if has_days:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete a stage that already has days. Deactivate the championship instead.",
        )

    db.delete(stage)
    db.commit()


# ── Scan unresolved ───────────────────────────────────────────────────────────

@router.post(
    "/{stage_id}/scan-unresolved",
    summary="Detectar jogadores não resolvidos no import (leitura pura)",
    description=(
        "Re-busca até `match_limit` matches da PUBG API para esta stage e identifica "
        "aliases/account_ids que NÃO foram mapeados para nenhuma Person. "
        "LEITURA PURA — nenhuma alteração no banco. "
        "Use para descobrir contas de substitutos ou aliases novos que precisam ser "
        "cadastrados via POST /admin/persons/{id}/accounts antes de reprocessar."
    ),
)
def scan_unresolved(
    stage_id: int,
    match_limit: int = 3,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> dict:
    from app.models import Match, StageDay
    from app.pubg.client import PubgClient, PubgApiError
    from app.services.identity import build_lookup, resolve_from_lookup

    stage = _get_or_404(db, stage_id)

    # Carrega matches da stage
    matches = (
        db.query(Match)
        .join(StageDay, Match.stage_day_id == StageDay.id)
        .filter(StageDay.stage_id == stage_id)
        .order_by(Match.id)
        .limit(match_limit)
        .all()
    )

    if not matches:
        return {"stage_id": stage_id, "matches_scanned": 0, "unresolved": [], "message": "Nenhum match encontrado para esta stage."}

    lookup = build_lookup(db, stage_id)
    client = PubgClient(shard=stage.shard)

    all_unresolved: list[dict] = []
    scanned = 0
    errors = []

    for match in matches:
        try:
            raw = client.get_match(match.pubg_match_id)
        except PubgApiError as exc:
            errors.append({"pubg_match_id": match.pubg_match_id, "error": str(exc)})
            continue

        scanned += 1
        match_unresolved = []
        for rps in raw.player_stats:
            identity = resolve_from_lookup(lookup, rps.account_id, rps.alias)
            if identity is None:
                match_unresolved.append({
                    "alias": rps.alias,
                    "account_id": rps.account_id,
                    "kills": rps.kills,
                    "placement": rps.placement,
                })

        if match_unresolved:
            all_unresolved.append({
                "pubg_match_id": match.pubg_match_id,
                "match_db_id": match.id,
                "players_total": len(raw.player_stats),
                "unresolved_count": len(match_unresolved),
                "unresolved": match_unresolved,
            })

    # Dedup: same alias appearing in multiple matches
    seen_accounts: set[str] = set()
    deduped_unresolved: list[dict] = []
    for match_data in all_unresolved:
        for p in match_data["unresolved"]:
            if p["account_id"] not in seen_accounts:
                seen_accounts.add(p["account_id"])
                deduped_unresolved.append({
                    "alias": p["alias"],
                    "account_id": p["account_id"],
                    "first_seen_match": match_data["pubg_match_id"],
                })

    return {
        "stage_id": stage_id,
        "shard": stage.shard,
        "matches_scanned": scanned,
        "matches_with_unresolved": len(all_unresolved),
        "unique_unresolved_players": len(deduped_unresolved),
        "unresolved": deduped_unresolved,
        "per_match": all_unresolved,
        "errors": errors,
        "next_steps": (
            "Para cada alias/account_id acima: "
            "1) Identifique a Person correspondente no roster; "
            "2) POST /admin/persons/{person_id}/accounts com o account_id; "
            "3) POST /admin/stages/{stage_id}/reprocess-all para re-importar."
        ) if deduped_unresolved else "Nenhum jogador não resolvido — dados completos.",
    }


# ── Team Standings by Stage ────────────────────────────────────────────────────

@router.get(
    "/{stage_id}/team-standings",
    summary="Standings por time de uma stage específica",
    description=(
        "Calcula standings usando a fórmula oficial do torneio PUBG "
        "(survival pts + kills) apenas para os matches desta stage. "
        "Use top_n para filtrar os N primeiros colocados."
    ),
)
def get_stage_team_standings(
    stage_id: int,
    top_n: int = 16,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> dict:
    from app.services.team_standings import calculate_team_tournament_standings

    stage = _get_or_404(db, stage_id)
    standings = calculate_team_tournament_standings(
        stage.championship_id, db, stage_ids=[stage_id]
    )
    return {
        "stage_id": stage_id,
        "stage_name": stage.name,
        "top_n": top_n,
        "total_teams": len(standings),
        "standings": standings[:top_n],
    }
