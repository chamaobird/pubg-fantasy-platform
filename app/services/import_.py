# app/services/import_.py
"""
Import Service — Fase 3 / #030 #033

Responsável por:
  - #030: Importar matches de uma Stage usando o shard herdado automaticamente
  - #033: Reprocessar um match específico (idempotente, qualquer shard)

Fluxo de import:
  1. Recebe stage_id + lista de pubg_match_ids
  2. Carrega Stage (valida existência, obtém shard)
  3. Para cada match_id:
     a. Verifica se já existe em MATCH (por pubg_match_id + stage_day_id)
     b. Busca dados brutos na PUBG API via PubgClient (usando shard da Stage)
     c. Cria Match se não existir
     d. Resolve identidades via identity.resolve_from_lookup()
     e. Calcula e persiste MATCH_STAT + PERSON_STAGE_STAT via scoring.process_match_stats()
  4. Retorna resumo com contadores e erros por match

Reprocess (idempotente):
  - Mesmo fluxo, mas: match já existe → apenas rebusca stats e recalcula
  - MATCH_STAT é upsertion — scoring.py cuida de descontar pontos antigos
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.services.identity import build_lookup, resolve_from_lookup
from app.services.scoring import PlayerStatInput, process_match_stats

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# DTOs de entrada da PUBG API (já parseados pelo PubgClient)
# ---------------------------------------------------------------------------

@dataclass
class RawPlayerStat:
    """Stat bruta de um participante vinda da PUBG API."""
    account_id:    str
    alias:         str
    kills:         int   = 0
    assists:       int   = 0
    damage_dealt:  float = 0.0
    placement:     int   = 28
    survival_secs: int   = 0
    knocks:        int   = 0
    headshots:     int   = 0


@dataclass
class RawMatch:
    """Match bruto retornado pelo PubgClient."""
    pubg_match_id:  str
    map_name:       Optional[str]
    played_at:      Optional[datetime]
    duration_secs:  int
    player_stats:   list[RawPlayerStat] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Resultado por match
# ---------------------------------------------------------------------------

@dataclass
class MatchImportResult:
    pubg_match_id: str
    status:        str    # "imported" | "reprocessed" | "skipped" | "error"
    match_id:      Optional[int] = None
    players_ok:    int = 0
    players_skipped: int = 0
    unresolved_aliases: list = None   # aliases que não foram resolvidos para nenhum Person
    total_pts:     float = 0.0
    error:         Optional[str] = None

    def __post_init__(self):
        if self.unresolved_aliases is None:
            self.unresolved_aliases = []


# ---------------------------------------------------------------------------
# Ponto de entrada principal — import em lote
# ---------------------------------------------------------------------------

def import_stage_matches(
    db: Session,
    stage_id: int,
    pubg_match_ids: list[str],
    stage_day_id: Optional[int] = None,
    force_reprocess: bool = False,
) -> dict:
    """
    Importa uma lista de matches para uma Stage.

    Args:
        db:              sessão SQLAlchemy
        stage_id:        ID da Stage (determina o shard automaticamente)
        pubg_match_ids:  lista de UUIDs de match da PUBG API
        stage_day_id:    se informado, vincula os matches ao StageDay específico.
                         Se None, tenta auto-detectar pelo played_at (ou usa o
                         StageDay mais recente da Stage).
        force_reprocess: se True, rebusca e recalcula mesmo matches já existentes

    Returns:
        dict com resumo geral e lista de resultados por match
    """
    from app.models import Stage, StageDay, Match  # imports locais
    from app.pubg.client import PubgClient, PubgApiError  # a implementar

    # Carrega Stage
    stage = db.query(Stage).filter(Stage.id == stage_id).first()
    if not stage:
        raise ValueError(f"Stage {stage_id} não encontrada")

    shard = stage.shard  # herdado automaticamente — nunca vem do request
    logger.info(
        "[Import] stage=%s shard=%s — importando %d matches",
        stage_id, shard, len(pubg_match_ids),
    )

    # Lookup de identidade pré-carregado para a Stage
    lookup = build_lookup(db, stage_id)

    client = PubgClient(shard=shard)
    results: list[MatchImportResult] = []

    for pubg_match_id in pubg_match_ids:
        result = _import_single_match(
            db=db,
            client=client,
            pubg_match_id=pubg_match_id,
            stage=stage,
            stage_day_id=stage_day_id,
            lookup=lookup,
            force_reprocess=force_reprocess,
        )
        results.append(result)

    # Commit único ao final — atômico por lote
    db.commit()

    imported    = sum(1 for r in results if r.status == "imported")
    reprocessed = sum(1 for r in results if r.status == "reprocessed")
    skipped     = sum(1 for r in results if r.status == "skipped")
    errors      = [r for r in results if r.status == "error"]

    logger.info(
        "[Import] stage=%s — importados=%d reprocessados=%d skipped=%d erros=%d",
        stage_id, imported, reprocessed, skipped, len(errors),
    )

    all_unresolved = sorted({a for r in results for a in r.unresolved_aliases})

    return {
        "stage_id":          stage_id,
        "shard":             shard,
        "total":             len(pubg_match_ids),
        "imported":          imported,
        "reprocessed":       reprocessed,
        "skipped":           skipped,
        "unresolved_players": all_unresolved,
        "errors":            [{"match_id": e.pubg_match_id, "error": e.error} for e in errors],
        "matches":           [
            {
                "pubg_match_id":     r.pubg_match_id,
                "status":           r.status,
                "match_id":         r.match_id,
                "players_ok":       r.players_ok,
                "players_skipped":  r.players_skipped,
                "unresolved":       r.unresolved_aliases,
                "total_pts":        r.total_pts,
            }
            for r in results
        ],
    }


def reprocess_match(
    db: Session,
    pubg_match_id: str,
    stage_id: int,
) -> dict:
    """
    Reprocessa um match específico.
    Rebusca da API usando o shard da Stage e recalcula MATCH_STAT + PERSON_STAGE_STAT.

    #033 — funciona para qualquer shard (steam ou pc-tournament).
    """
    from app.models import Stage, StageDay, Match  # imports locais
    from app.pubg.client import PubgClient, PubgApiError

    stage = db.query(Stage).filter(Stage.id == stage_id).first()
    if not stage:
        raise ValueError(f"Stage {stage_id} não encontrada")

    match = (
        db.query(Match)
        .join(StageDay, Match.stage_day_id == StageDay.id)
        .filter(
            Match.pubg_match_id == pubg_match_id,
            StageDay.stage_id   == stage_id,
        )
        .first()
    )
    if not match:
        raise ValueError(
            f"Match {pubg_match_id} não encontrado para stage_id={stage_id}. "
            "Use import_stage_matches() para importar primeiro."
        )

    lookup = build_lookup(db, stage_id, played_at=match.played_at)
    client = PubgClient(shard=stage.shard)

    result = _import_single_match(
        db=db,
        client=client,
        pubg_match_id=pubg_match_id,
        stage=stage,
        stage_day_id=match.stage_day_id,
        lookup=lookup,
        force_reprocess=True,
    )

    db.commit()

    return {
        "pubg_match_id": pubg_match_id,
        "stage_id":      stage_id,
        "shard":         stage.shard,
        "status":        result.status,
        "match_id":      result.match_id,
        "players_ok":    result.players_ok,
        "players_skipped": result.players_skipped,
        "total_pts":     result.total_pts,
        "error":         result.error,
    }


# ---------------------------------------------------------------------------
# Lógica de import de um único match
# ---------------------------------------------------------------------------

def _import_single_match(
    db: Session,
    client,  # PubgClient
    pubg_match_id: str,
    stage,   # Stage ORM obj
    stage_day_id: Optional[int],
    lookup: dict,
    force_reprocess: bool,
) -> MatchImportResult:
    from app.models import Match, StageDay  # import local
    from app.pubg.client import PubgApiError

    # Detecta StageDay se não informado
    effective_stage_day_id = stage_day_id or _detect_stage_day(db, stage.id)
    if not effective_stage_day_id:
        return MatchImportResult(
            pubg_match_id=pubg_match_id,
            status="error",
            error="Nenhum StageDay encontrado para a Stage. Crie um StageDay primeiro.",
        )

    # Verifica se match já existe (scoped por stage_day da stage)
    existing_match = (
        db.query(Match)
        .join(StageDay, Match.stage_day_id == StageDay.id)
        .filter(
            Match.pubg_match_id == pubg_match_id,
            StageDay.stage_id   == stage.id,
        )
        .first()
    )

    if existing_match and not force_reprocess:
        logger.info("[Import] match %s já existe — skipping", pubg_match_id)
        return MatchImportResult(
            pubg_match_id=pubg_match_id,
            status="skipped",
            match_id=existing_match.id,
        )

    # Busca dados da PUBG API
    try:
        raw: RawMatch = client.get_match(pubg_match_id)
    except PubgApiError as exc:
        logger.error("[Import] Erro ao buscar match %s: %s", pubg_match_id, exc)
        return MatchImportResult(
            pubg_match_id=pubg_match_id,
            status="error",
            error=str(exc),
        )
    except Exception as exc:
        logger.error("[Import] Erro inesperado no match %s: %s", pubg_match_id, exc)
        return MatchImportResult(
            pubg_match_id=pubg_match_id,
            status="error",
            error=f"Erro inesperado: {exc}",
        )

    # Cria ou reutiliza Match
    if existing_match:
        match = existing_match
        match.played_at = raw.played_at
        match.map_name  = raw.map_name
        status = "reprocessed"
    else:
        match = Match(
            pubg_match_id = pubg_match_id,
            stage_day_id  = effective_stage_day_id,
            shard         = stage.shard,
            played_at     = raw.played_at,
            map_name      = raw.map_name,
        )
        db.add(match)
        db.flush()  # garante match.id antes do scoring
        status = "imported"

    # Resolve identidades e monta PlayerStatInput
    player_stats: list[PlayerStatInput] = []
    unresolved: list[str] = []

    for rps in raw.player_stats:
        identity = resolve_from_lookup(lookup, rps.account_id, rps.alias)
        if identity is None:
            unresolved.append(rps.alias)
            continue

        person_id, _player_account_id = identity
        player_stats.append(PlayerStatInput(
            person_id        = person_id,
            account_id_used  = rps.account_id,
            kills            = rps.kills,
            assists          = rps.assists,
            damage_dealt     = rps.damage_dealt,
            placement        = rps.placement,
            survival_secs    = rps.survival_secs,
            knocks           = rps.knocks,
            headshots        = rps.headshots,
        ))

    if unresolved:
        logger.warning(
            "[Import] match %s — %d participantes não resolvidos: %s",
            pubg_match_id, len(unresolved), unresolved[:10],
        )

    # Calcula e persiste stats
    summary = process_match_stats(
        db            = db,
        match         = match,
        all_stats     = player_stats,
        duration_secs = raw.duration_secs,
    )

    return MatchImportResult(
        pubg_match_id      = pubg_match_id,
        status             = status,
        match_id           = match.id,
        players_ok         = summary["players_processed"],
        players_skipped    = len(unresolved),
        unresolved_aliases = unresolved,
        total_pts          = summary["total_points_awarded"],
    )


# ---------------------------------------------------------------------------
# Helper: detecta o StageDay mais recente de uma Stage
# ---------------------------------------------------------------------------

def _detect_stage_day(db: Session, stage_id: int) -> Optional[int]:
    """
    Retorna o ID do StageDay mais recente (por day_number desc) para a Stage.
    Usado quando stage_day_id não é informado explicitamente.
    """
    from app.models import StageDay

    sd = (
        db.query(StageDay)
        .filter(StageDay.stage_id == stage_id)
        .order_by(StageDay.day_number.desc())
        .first()
    )
    return sd.id if sd else None
