# app/services/identity.py
"""
Identity Resolution — Fase 3 / #031

Resolve um par (account_id, alias) vindo da PUBG API para uma PERSON do banco.

Estratégia (em ordem de prioridade):
  1. PLAYER_ACCOUNT.account_id == account_id  (exato, confiável)
  2. PLAYER_ACCOUNT.alias      == alias       (case-insensitive, fallback)

Nunca lança exceção: retorna None se não resolver.
O caller loga warning e skipa — o import nunca quebra por jogador não encontrado.

Regras importantes:
  - PLAYER_ACCOUNT tem active_until: verifica se a conta está ativa na data da partida.
    Se active_until IS NULL → ainda ativa.
    Se active_until < played_at → conta expirada, não usa.
  - Uma PERSON pode ter múltiplas contas em shards diferentes — a busca por
    account_id já é suficientemente específica.
  - Retorna (person_id, player_account_id) para rastreabilidade (account_id_used
    gravado em MATCH_STAT).
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.models import Person, PlayerAccount

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Ponto de entrada principal
# ---------------------------------------------------------------------------

def resolve_person(
    db: Session,
    account_id: str,
    alias: str,
    played_at: Optional[datetime] = None,
) -> Optional[tuple[int, int]]:
    """
    Resolve um participante da PUBG API para uma PERSON do banco.

    Args:
        db:         sessão SQLAlchemy
        account_id: pubg account id (ex: "account.abc123" para steam,
                    ou o id numérico para pc-tournament)
        alias:      nome Steam/PUBG do jogador no momento da partida
        played_at:  data/hora da partida — usado para validar active_until.
                    Se None, ignora a validação de expiração.

    Returns:
        (person_id, player_account_id) se resolvido
        None se não encontrado (caller loga e skipa)
    """
    if account_id:
        result = _resolve_by_account_id(db, account_id, played_at)
        if result:
            return result

    if alias:
        result = _resolve_by_alias(db, alias, played_at)
        if result:
            return result

    return None


def build_lookup(
    db: Session,
    stage_id: int,
    played_at: Optional[datetime] = None,
) -> dict[str, tuple[int, int]]:
    """
    Constrói um lookup pré-carregado para resolução em lote.
    Útil quando um import processa muitos matches do mesmo stage.

    Chaves: account_id e alias.lower() de todas as PLAYER_ACCOUNTs ativas
    no contexto do stage (via Roster → Person → PlayerAccount).

    Valor: (person_id, player_account_id)

    Se não houver Roster para o stage, faz fallback para todas as
    PLAYER_ACCOUNTs do banco (com warning).
    """
    from app.models import Roster  # import local para evitar circular

    roster_rows = (
        db.query(Roster)
        .filter(Roster.stage_id == stage_id)
        .all()
    )
    person_ids = [r.person_id for r in roster_rows]

    if not person_ids:
        logger.warning(
            "build_lookup: nenhum Roster encontrado para stage_id=%s. "
            "Fallback para todas as PLAYER_ACCOUNTs do banco. "
            "Adicione Roster ao stage para melhorar a precisão.",
            stage_id,
        )
        accounts = db.query(PlayerAccount).all()
    else:
        accounts = (
            db.query(PlayerAccount)
            .filter(PlayerAccount.person_id.in_(person_ids))
            .all()
        )

    lookup: dict[str, tuple[int, int]] = {}
    for acc in accounts:
        # Valida active_until se played_at fornecido
        if played_at and acc.active_until and acc.active_until < played_at:
            continue  # conta expirada na data da partida

        key_id = acc.account_id
        key_alias = (acc.alias or "").lower()
        val = (acc.person_id, acc.id)

        if key_id:
            lookup[key_id] = val
        if key_alias:
            # alias pode colidir entre jogadores — mantém o primeiro encontrado
            # (resolução por account_id tem prioridade de qualquer forma)
            if key_alias not in lookup:
                lookup[key_alias] = val

    logger.info(
        "build_lookup: stage=%s — %s contas carregadas, %s entradas no lookup",
        stage_id, len(accounts), len(lookup),
    )
    return lookup


def resolve_from_lookup(
    lookup: dict[str, tuple[int, int]],
    account_id: str,
    alias: str,
) -> Optional[tuple[int, int]]:
    """
    Versão rápida (sem DB) para uso dentro de um loop de import em lote.
    Usa o lookup pré-carregado por build_lookup().
    """
    if account_id and account_id in lookup:
        return lookup[account_id]
    if alias and alias.lower() in lookup:
        return lookup[alias.lower()]
    return None


# ---------------------------------------------------------------------------
# Helpers internos
# ---------------------------------------------------------------------------

def _resolve_by_account_id(
    db: Session,
    account_id: str,
    played_at: Optional[datetime],
) -> Optional[tuple[int, int]]:
    q = db.query(PlayerAccount).filter(PlayerAccount.account_id == account_id)
    accounts = q.all()
    for acc in accounts:
        if played_at and acc.active_until and acc.active_until < played_at:
            continue
        return (acc.person_id, acc.id)
    return None


def _resolve_by_alias(
    db: Session,
    alias: str,
    played_at: Optional[datetime],
) -> Optional[tuple[int, int]]:
    accounts = (
        db.query(PlayerAccount)
        .filter(PlayerAccount.alias.ilike(alias))
        .all()
    )
    for acc in accounts:
        if played_at and acc.active_until and acc.active_until < played_at:
            continue
        return (acc.person_id, acc.id)
    return None
