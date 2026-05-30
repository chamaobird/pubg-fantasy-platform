# app/routers/admin/roster.py
from __future__ import annotations

from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import require_admin
from app.models.person import Person
from app.models.person_stage_stat import PersonStageStat
from app.models.roster import Roster
from app.models.stage import Stage
from app.models.user import User
from pydantic import BaseModel
from app.schemas.roster import RosterCreate, RosterResponse, RosterUpdate
from app.models.roster_change_log import RosterChangeLog
from app.schemas.team import (
    ImportTeamRequest,
    ImportTeamResponse,
    ImportedPlayer,
    SkippedPlayer,
)


class TeamInRoster(BaseModel):
    team_name: str
    player_count: int


class CopyFromStageRequest(BaseModel):
    source_stage_id: int
    team_names: list[str]


class CopyFromStageResponse(BaseModel):
    added_teams: int
    added_players: int
    skipped_players: int


class RosterHistorySuggestRequest(BaseModel):
    teams: list[str]


class SuggestedPlayer(BaseModel):
    person_id: int
    display_name: str
    last_seen_stage_id: int
    last_fantasy_cost: Optional[float]
    matches_played: int          # no último stage visto
    probable_reserve: bool       # menor nº de partidas no time (só flagado se unívoco)


class TeamSuggestion(BaseModel):
    team_name: str
    found: int
    players: list[SuggestedPlayer]


class RosterApplyPlayerInput(BaseModel):
    person_id: int
    team_name: str
    is_reserve: bool = False


class RosterApplySuggestionsRequest(BaseModel):
    players: list[RosterApplyPlayerInput]


class RosterApplySuggestionsResponse(BaseModel):
    stage_id: int
    added: int
    skipped: int
    skipped_detail: list[dict]
    pricing_updated: int

router = APIRouter(
    prefix="/admin/stages/{stage_id}/roster",
    tags=["Admin — Roster"],
    dependencies=[Depends(require_admin)],
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_stage_or_404(db: Session, stage_id: int) -> Stage:
    obj = db.query(Stage).filter(Stage.id == stage_id).first()
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Stage {stage_id} not found",
        )
    return obj


def _get_roster_or_404(db: Session, roster_id: int, stage_id: int) -> Roster:
    obj = (
        db.query(Roster)
        .filter(Roster.id == roster_id, Roster.stage_id == stage_id)
        .first()
    )
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Roster entry {roster_id} not found for stage {stage_id}",
        )
    return obj


def _log_change(db: Session, roster: Roster, change_type: str, admin: User, field_name: str | None = None, old_value=None, new_value=None, note: str | None = None):
    db.add(RosterChangeLog(
        roster_id=roster.id,
        stage_id=roster.stage_id,
        person_id=roster.person_id,
        change_type=change_type,
        field_name=field_name,
        old_value=str(old_value) if old_value is not None else None,
        new_value=str(new_value) if new_value is not None else None,
        changed_by_id=str(admin.id),
        note=note,
    ))


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("", response_model=RosterResponse, status_code=status.HTTP_201_CREATED)
def add_to_roster(
    stage_id: int,
    body: RosterCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> Roster:
    _get_stage_or_404(db, stage_id)

    # Validate person exists and is active
    person = db.query(Person).filter(Person.id == body.person_id).first()
    if not person:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Person {body.person_id} not found",
        )
    if not person.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Person {body.person_id} is inactive",
        )

    # Prevent duplicates
    existing = (
        db.query(Roster)
        .filter(Roster.stage_id == stage_id, Roster.person_id == body.person_id)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Person {body.person_id} is already in the roster for stage {stage_id}",
        )

    roster = Roster(stage_id=stage_id, **body.model_dump())
    db.add(roster)
    db.flush()  # ensure roster.id is populated
    _log_change(db, roster, "created", _admin)
    db.commit()
    db.refresh(roster)
    return roster


@router.get("", response_model=list[RosterResponse])
def list_roster(
    stage_id: int,
    include_unavailable: bool = False,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> list[RosterResponse]:
    _get_stage_or_404(db, stage_id)

    q = (
        db.query(Roster)
        .options(joinedload(Roster.person))
        .filter(Roster.stage_id == stage_id)
    )
    if not include_unavailable:
        q = q.filter(Roster.is_available == True)  # noqa: E712
    rosters = q.order_by(Roster.id).all()

    return [
        RosterResponse(
            id=r.id,
            stage_id=r.stage_id,
            person_id=r.person_id,
            person_name=r.person.display_name if r.person else None,
            team_name=r.team_name,
            fantasy_cost=float(r.fantasy_cost) if r.fantasy_cost is not None else None,
            cost_override=float(r.cost_override) if r.cost_override is not None else None,
            effective_cost=float(r.effective_cost) if r.effective_cost is not None else None,
            newcomer_to_tier=r.newcomer_to_tier,
            is_available=r.is_available,
            created_at=r.created_at,
        )
        for r in rosters
    ]


@router.get("/changes", summary="Histórico de alterações do roster da stage")
def get_roster_changes(
    stage_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    from app.models.person import Person
    logs = (
        db.query(RosterChangeLog)
        .filter(RosterChangeLog.stage_id == stage_id)
        .order_by(RosterChangeLog.changed_at.desc())
        .limit(200)
        .all()
    )
    result = []
    for log in logs:
        person = db.query(Person).filter(Person.id == log.person_id).first()
        result.append({
            "id": log.id,
            "roster_id": log.roster_id,
            "person_id": log.person_id,
            "person_name": person.display_name if person else str(log.person_id),
            "change_type": log.change_type,
            "field_name": log.field_name,
            "old_value": log.old_value,
            "new_value": log.new_value,
            "changed_by_id": log.changed_by_id,
            "changed_at": log.changed_at.isoformat() if log.changed_at else None,
            "note": log.note,
        })
    return result


@router.patch("/{roster_id}", response_model=RosterResponse)
def update_roster_entry(
    stage_id: int,
    roster_id: int,
    body: RosterUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> Roster:
    roster = _get_roster_or_404(db, roster_id, stage_id)

    updates = body.model_dump(exclude_unset=True)
    for field, new_val in updates.items():
        old_val = getattr(roster, field, None)
        _log_change(db, roster, "updated", _admin, field_name=field, old_value=old_val, new_value=new_val)
        setattr(roster, field, new_val)

    db.commit()
    db.refresh(roster)
    return roster


@router.get("/preflight")
def preflight_roster(
    stage_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """
    Valida o roster da stage antes de importar partidas.

    Para cada jogador ativo (is_available=True), verifica se existe um
    PlayerAccount com account_id real (não PENDING_*) no shard da stage.

    Retorna lista de jogadores problemáticos:
      - sem_conta: não tem nenhum PlayerAccount no shard correto
      - pendente:  tem apenas accounts PENDING_* (nunca resolvido pela API)

    Também inclui config_warnings sobre configuração da stage.
    """
    from app.models.player_account import PlayerAccount
    from app.models.stage_day import StageDay

    stage = _get_stage_or_404(db, stage_id)
    shard = stage.shard

    roster_rows = (
        db.query(Roster)
        .join(Person, Roster.person_id == Person.id)
        .filter(Roster.stage_id == stage_id, Roster.is_available == True)
        .all()
    )

    issues = []
    for r in roster_rows:
        accounts = (
            db.query(PlayerAccount)
            .filter(
                PlayerAccount.person_id == r.person_id,
                PlayerAccount.shard == shard,
            )
            .all()
        )

        real_accounts   = [a for a in accounts if not a.account_id.startswith("PENDING_")]
        pending_accounts = [a for a in accounts if a.account_id.startswith("PENDING_")]

        if real_accounts:
            continue  # OK — tem pelo menos uma conta real

        person = db.query(Person).filter(Person.id == r.person_id).first()
        issues.append({
            "roster_id":   r.id,
            "person_id":   r.person_id,
            "person_name": person.display_name if person else str(r.person_id),
            "team_name":   r.team_name,
            "status":      "pendente" if pending_accounts else "sem_conta",
            "pending_ids": [a.account_id for a in pending_accounts],
        })

    # Config checks
    stage_days_ok = db.query(StageDay).filter(StageDay.stage_id == stage_id).count() > 0
    lineup_close_ok = stage.lineup_close_at is not None
    tournament_id_ok = stage.pubg_tournament_id is not None

    config_warnings = []
    if not stage_days_ok:
        config_warnings.append({
            "check": "stage_days",
            "ok": False,
            "message": "Nenhum StageDay configurado para esta stage.",
        })
    if not lineup_close_ok:
        config_warnings.append({
            "check": "lineup_close_at",
            "ok": False,
            "message": "lineup_close_at não configurado — lineup nunca fechará automaticamente.",
        })
    if shard == "pc-tournament" and not tournament_id_ok:
        config_warnings.append({
            "check": "pubg_tournament_id",
            "ok": False,
            "message": "pubg_tournament_id não configurado — match discovery automático não funcionará.",
        })

    critical_fail = not stage_days_ok

    return {
        "stage_id":        stage_id,
        "shard":           shard,
        "total_active":    len(roster_rows),
        "issues_count":    len(issues),
        "ok":              not critical_fail and len(issues) == 0,
        "issues":          issues,
        "config_warnings": config_warnings,
    }


@router.get("/days/{stage_day_id}/missing-players")
def missing_players_check(
    stage_id: int,
    stage_day_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """
    Retorna jogadores do roster (is_available=True) que não aparecem em nenhuma
    partida do dia informado. Sinal de possível substituição não registrada.

    Inclui flag has_substitution=True se já há StageSubstitution registrada
    para o jogador nesta stage.
    """
    from app.models.match import Match
    from app.models.match_stat import MatchStat
    from app.models.substitution import StageSubstitution

    _get_stage_or_404(db, stage_id)

    roster_rows = (
        db.query(Roster)
        .join(Person, Roster.person_id == Person.id)
        .filter(Roster.stage_id == stage_id, Roster.is_available == True)
        .all()
    )
    if not roster_rows:
        return {"stage_day_id": stage_day_id, "missing": [], "total_roster": 0, "total_with_stats": 0}

    # Persons com stats no dia
    persons_with_stats = {
        row[0]
        for row in (
            db.query(MatchStat.person_id)
            .join(Match, MatchStat.match_id == Match.id)
            .filter(Match.stage_day_id == stage_day_id)
            .distinct()
            .all()
        )
    }

    # Subs já registradas nesta stage
    subs_out = {
        row[0]
        for row in (
            db.query(StageSubstitution.out_person_id)
            .filter(StageSubstitution.stage_id == stage_id)
            .all()
        )
    }

    # Subs já registradas como "in" nesta stage (para flag is_sub_in)
    subs_in_ids = {
        row[0]
        for row in (
            db.query(StageSubstitution.in_person_id)
            .filter(StageSubstitution.stage_id == stage_id)
            .all()
        )
    }

    missing = []
    for r in roster_rows:
        if r.person_id not in persons_with_stats:
            person = db.query(Person).filter(Person.id == r.person_id).first()
            missing.append({
                "person_id": r.person_id,
                "person_name": person.display_name if person else str(r.person_id),
                "team_name": r.team_name,
                "has_substitution": r.person_id in subs_out,
                "is_sub_in": r.person_id in subs_in_ids,
            })

    # Persons com stats no dia que NÃO estão no roster ativo (is_available=True)
    # → possíveis substitutos que entraram
    active_roster_ids = {r.person_id for r in roster_rows}

    # team_name de reservas (is_available=False) no mesmo stage
    reserve_roster = {
        r.person_id: r.team_name
        for r in db.query(Roster).filter(
            Roster.stage_id == stage_id, Roster.is_available == False
        ).all()
    }

    unexpected = []
    for person_id in persons_with_stats:
        if person_id not in active_roster_ids:
            person = db.query(Person).filter(Person.id == person_id).first()
            team_name = reserve_roster.get(person_id)
            unexpected.append({
                "person_id": person_id,
                "person_name": person.display_name if person else str(person_id),
                "team_name": team_name,
                "has_substitution": person_id in subs_in_ids,
            })

    return {
        "stage_day_id": stage_day_id,
        "missing": missing,
        "unexpected": unexpected,
        "total_roster": len(roster_rows),
        "total_with_stats": len(persons_with_stats),
    }


@router.get("/teams", response_model=list[TeamInRoster])
def list_teams_in_roster(
    stage_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> list[TeamInRoster]:
    """Retorna os times distintos presentes no roster de uma stage, com contagem de jogadores."""
    _get_stage_or_404(db, stage_id)

    from sqlalchemy import func
    rows = (
        db.query(Roster.team_name, func.count(Roster.id).label("player_count"))
        .filter(Roster.stage_id == stage_id, Roster.team_name.isnot(None))
        .group_by(Roster.team_name)
        .order_by(Roster.team_name)
        .all()
    )
    return [TeamInRoster(team_name=r.team_name, player_count=r.player_count) for r in rows]


@router.post("/copy-from-stage", response_model=CopyFromStageResponse, status_code=status.HTTP_200_OK)
def copy_teams_from_stage(
    stage_id: int,
    body: CopyFromStageRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> CopyFromStageResponse:
    """
    Copia jogadores dos times selecionados de uma stage de origem para esta stage.
    Idempotente: jogadores já presentes no roster destino são contados em skipped.
    """
    _get_stage_or_404(db, stage_id)
    _get_stage_or_404(db, body.source_stage_id)

    source_entries = (
        db.query(Roster)
        .options(joinedload(Roster.person))
        .filter(
            Roster.stage_id == body.source_stage_id,
            Roster.team_name.in_(body.team_names),
            Roster.is_available == True,  # noqa: E712
        )
        .all()
    )

    added_players = 0
    skipped_players = 0
    teams_seen: set[str] = set()

    for entry in source_entries:
        teams_seen.add(entry.team_name)
        existing = (
            db.query(Roster)
            .filter(Roster.stage_id == stage_id, Roster.person_id == entry.person_id)
            .first()
        )
        if existing:
            skipped_players += 1
            continue

        new_entry = Roster(
            stage_id=stage_id,
            person_id=entry.person_id,
            team_name=entry.team_name,
            fantasy_cost=15.00,
            is_available=True,
        )
        db.add(new_entry)
        added_players += 1

    db.commit()
    return CopyFromStageResponse(
        added_teams=len(teams_seen),
        added_players=added_players,
        skipped_players=skipped_players,
    )


@router.post("/import-team", status_code=status.HTTP_200_OK)
def import_team_to_roster(
    stage_id: int,
    body: ImportTeamRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> ImportTeamResponse:
    """
    Importa todos os membros ativos de um time para o roster da stage.
    Jogadores já presentes no roster são reportados em 'skipped' — nunca duplicados.
    """
    from app.models.team import Team
    from app.models.team_member import TeamMember

    _get_stage_or_404(db, stage_id)

    team = db.query(Team).filter(Team.id == body.team_id).first()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Time {body.team_id} não encontrado",
        )

    active_members = (
        db.query(TeamMember)
        .options(joinedload(TeamMember.person))
        .filter(TeamMember.team_id == body.team_id, TeamMember.left_at.is_(None))
        .all()
    )

    if not active_members:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"O time '{team.name}' não possui membros ativos.",
        )

    added: list[ImportedPlayer] = []
    skipped: list[SkippedPlayer] = []

    for member in active_members:
        person = member.person
        if not person or not person.is_active:
            skipped.append(SkippedPlayer(
                person_id=member.person_id,
                person_name=person.display_name if person else f"id={member.person_id}",
                reason="Jogador inativo",
            ))
            continue

        existing = (
            db.query(Roster)
            .filter(Roster.stage_id == stage_id, Roster.person_id == person.id)
            .first()
        )
        if existing:
            skipped.append(SkippedPlayer(
                person_id=person.id,
                person_name=person.display_name,
                reason="Já está no roster desta stage",
            ))
            continue

        roster_entry = Roster(
            stage_id=stage_id,
            person_id=person.id,
            team_name=team.name,
        )
        db.add(roster_entry)
        added.append(ImportedPlayer(person_id=person.id, person_name=person.display_name))

    db.commit()

    return ImportTeamResponse(
        team_id=team.id,
        team_name=team.name,
        stage_id=stage_id,
        added=added,
        skipped=skipped,
    )


@router.post("/suggest-from-history", response_model=list[TeamSuggestion])
def suggest_roster_from_history(
    stage_id: int,
    body: RosterHistorySuggestRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> list[TeamSuggestion]:
    """
    Para cada time em `teams`, busca jogadores com histórico no banco
    e sugere um roster baseado nas aparições mais recentes.

    - Exclui jogadores já presentes no roster desta stage.
    - Detecta provável reserva: jogador com MENOR matches_played no último stage
      onde o time apareceu (só flagado se unívoco — sem empate).
    - Probable reserve é sinalizado mas não criado automaticamente como is_available=False;
      o admin confirma via apply-suggestions.
    """
    _get_stage_or_404(db, stage_id)

    if not body.teams:
        return []

    # Persons já no roster desta stage (excluir das sugestões)
    already_in_stage: set[int] = {
        r.person_id
        for r in db.query(Roster.person_id).filter(Roster.stage_id == stage_id).all()
    }

    # Busca histórico: roster + person + person_stage_stat mais recentes por time
    rows = (
        db.query(
            Roster.person_id,
            Roster.team_name,
            Roster.stage_id,
            Roster.fantasy_cost,
            Person.display_name,
            PersonStageStat.matches_played,
        )
        .join(Person, Roster.person_id == Person.id)
        .outerjoin(
            PersonStageStat,
            and_(
                PersonStageStat.person_id == Roster.person_id,
                PersonStageStat.stage_id == Roster.stage_id,
            ),
        )
        .filter(
            Roster.team_name.in_(body.teams),
            Roster.is_available == True,   # noqa: E712
            Person.is_active == True,       # noqa: E712
            Roster.stage_id != stage_id,   # exclui o próprio stage alvo
        )
        .order_by(Roster.team_name, Roster.person_id, Roster.stage_id.desc())
        .all()
    )

    # Deduplica: para cada (team, person) mantém apenas o registro do stage mais recente
    seen: set[tuple[str, int]] = set()
    deduped: list[tuple] = []
    for row in rows:
        key = (row.team_name, row.person_id)
        if key not in seen and row.person_id not in already_in_stage:
            seen.add(key)
            deduped.append(row)

    # Agrupa por time
    by_team: dict[str, list[dict]] = {t: [] for t in body.teams}
    for row in deduped:
        team = row.team_name
        if team in by_team:
            by_team[team].append({
                "person_id":       row.person_id,
                "display_name":    row.display_name,
                "last_seen_stage_id": row.stage_id,
                "last_fantasy_cost":  float(row.fantasy_cost) if row.fantasy_cost else None,
                "matches_played":  row.matches_played or 0,
                "probable_reserve": False,
            })

    # Detecta provável reserva por time (só se ≥5 jogadores e resultado unívoco)
    for team_name, players in by_team.items():
        if len(players) >= 5:
            min_matches = min(p["matches_played"] for p in players)
            candidates = [p for p in players if p["matches_played"] == min_matches]
            if len(candidates) == 1:
                candidates[0]["probable_reserve"] = True

    return [
        TeamSuggestion(
            team_name=t,
            found=len(by_team[t]),
            players=sorted(
                [SuggestedPlayer(**p) for p in by_team[t]],
                key=lambda x: x.matches_played,
                reverse=True,
            ),
        )
        for t in body.teams
    ]


@router.post("/apply-suggestions", response_model=RosterApplySuggestionsResponse)
def apply_roster_suggestions(
    stage_id: int,
    body: RosterApplySuggestionsRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> RosterApplySuggestionsResponse:
    """
    Cria entradas de roster em bulk a partir das sugestões confirmadas pelo admin.

    Reservas (is_reserve=True):
      - is_available = False
      - fantasy_cost = cost_override = 10 (fixo, nunca recalculado pelo pricing)

    Titulares (is_reserve=False):
      - is_available = True
      - fantasy_cost calculado pelo pricing após o bulk insert

    Idempotente: jogadores já no roster são reportados em skipped.
    """
    from app.services.pricing import calculate_stage_pricing

    _get_stage_or_404(db, stage_id)

    added_ids: list[int] = []
    skipped: list[dict] = []

    for player in body.players:
        person = db.query(Person).filter(Person.id == player.person_id).first()
        if not person:
            skipped.append({"person_id": player.person_id, "reason": "person not found"})
            continue
        if not person.is_active:
            skipped.append({"person_id": player.person_id, "reason": "person inactive"})
            continue

        existing = (
            db.query(Roster)
            .filter(Roster.stage_id == stage_id, Roster.person_id == player.person_id)
            .first()
        )
        if existing:
            skipped.append({
                "person_id":   player.person_id,
                "person_name": person.display_name,
                "reason":      "already in roster",
            })
            continue

        entry = Roster(
            stage_id=stage_id,
            person_id=player.person_id,
            team_name=player.team_name or None,
            is_available=not player.is_reserve,
        )
        if player.is_reserve:
            entry.fantasy_cost  = Decimal("10")
            entry.cost_override = Decimal("10")

        db.add(entry)
        added_ids.append(player.person_id)

    db.flush()

    # Recalcula pricing para titulares recém-adicionados
    pricing_result = {"updated": 0}
    if any(not p.is_reserve for p in body.players if p.person_id in added_ids):
        pricing_result = calculate_stage_pricing(stage_id, db)

    db.commit()

    return RosterApplySuggestionsResponse(
        stage_id=stage_id,
        added=len(added_ids),
        skipped=len(skipped),
        skipped_detail=skipped,
        pricing_updated=pricing_result.get("updated", 0),
    )


@router.delete("/{roster_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_from_roster(
    stage_id: int,
    roster_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> None:
    """Hard delete — only allowed if this roster entry has no lineup usage."""
    from app.models.lineup import LineupPlayer

    roster = _get_roster_or_404(db, roster_id, stage_id)

    in_lineup = (
        db.query(LineupPlayer)
        .filter(LineupPlayer.roster_id == roster_id)
        .first()
    )
    if in_lineup:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Cannot remove a player from roster while they appear in user lineups. "
                "Set is_available=false instead."
            ),
        )

    db.delete(roster)
    db.commit()
