"""
manage_player_accounts.py
Utilitário para gerenciar nomes/aliases de jogadores no banco.

Casos de uso:
  1. Ver todos os aliases de um jogador
  2. Adicionar novo alias a um jogador existente
  3. Renomear alias principal de um jogador
  4. Desativar um alias antigo (marcar active_until)
  5. Transferir alias para outra Person (quando identidade muda)

Uso:
  $env:DATABASE_URL="postgresql://..."
  
  # Ver jogador
  python manage_player_accounts.py info slabyy-_

  # Adicionar alias
  python manage_player_accounts.py add-alias slabyy-_ slabyy-

  # Renomear alias principal
  python manage_player_accounts.py rename slabyy-_ novoNome

  # Desativar alias antigo
  python manage_player_accounts.py deactivate slabyy-

  # Listar todos os jogadores de um time (pelo roster da stage)
  python manage_player_accounts.py team "No Way" --stage-id 1
"""

import os, sys
from datetime import datetime, timezone

try:
    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import Session
except ImportError:
    sys.exit("pip install sqlalchemy psycopg2-binary")

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    sys.exit("Defina DATABASE_URL antes de rodar")

engine = create_engine(DATABASE_URL)

# ── HELPERS ──────────────────────────────────────────────────────────────────

def find_person_by_alias(session, alias):
    """Encontra person_id pelo alias (qualquer player_account ativo)."""
    row = session.execute(
        text("""
            SELECT p.id, p.display_name, pa.id as pa_id, pa.alias, pa.account_id,
                   pa.active_from, pa.active_until
            FROM player_account pa
            JOIN person p ON p.id = pa.person_id
            WHERE pa.alias ILIKE :a
            ORDER BY pa.active_until NULLS LAST
        """),
        {"a": alias}
    ).fetchone()
    return row

def get_all_accounts(session, person_id):
    """Retorna todos os player_accounts de uma Person."""
    rows = session.execute(
        text("""
            SELECT id, alias, account_id, shard, active_from, active_until
            FROM player_account
            WHERE person_id = :p
            ORDER BY active_until NULLS LAST, id
        """),
        {"p": person_id}
    ).fetchall()
    return rows

# ── COMANDOS ─────────────────────────────────────────────────────────────────

def cmd_info(session, alias):
    """Mostra todos os dados de um jogador."""
    row = find_person_by_alias(session, alias)
    if not row:
        print(f"Nenhum jogador encontrado com alias '{alias}'")
        return

    person_id = row.id
    print(f"\nPerson id={person_id} | display_name={row.display_name}")
    print("Player accounts:")
    for pa in get_all_accounts(session, person_id):
        status = "ATIVO" if pa.active_until is None else f"INATIVO até {pa.active_until}"
        acc = pa.account_id or "sem account_id"
        print(f"  [{pa.id}] alias={pa.alias} | {acc} | shard={pa.shard} | {status}")


def cmd_add_alias(session, existing_alias, new_alias, account_id=None):
    """Adiciona um novo alias para o mesmo jogador."""
    row = find_person_by_alias(session, existing_alias)
    if not row:
        print(f"Jogador '{existing_alias}' não encontrado")
        return

    # Verifica se alias já existe
    exists = session.execute(
        text("SELECT id FROM player_account WHERE alias ILIKE :a"),
        {"a": new_alias}
    ).fetchone()
    if exists:
        print(f"Alias '{new_alias}' já existe (player_account id={exists[0]})")
        return

    # Busca shard do account existente
    pa = session.execute(
        text("SELECT shard FROM player_account WHERE id = :id"),
        {"id": row.pa_id}
    ).fetchone()

    session.execute(
        text("""
            INSERT INTO player_account (person_id, shard, alias, account_id)
            VALUES (:p, :s, :a, :aid)
        """),
        {"p": row.id, "s": pa.shard, "a": new_alias, "aid": account_id}
    )
    session.commit()
    print(f"✅ Alias '{new_alias}' adicionado para {row.display_name} (person_id={row.id})")


def cmd_rename(session, old_alias, new_alias):
    """Renomeia o alias principal de um jogador (atualiza display_name e alias)."""
    row = find_person_by_alias(session, old_alias)
    if not row:
        print(f"Jogador '{old_alias}' não encontrado")
        return

    # Atualiza o alias no player_account
    session.execute(
        text("UPDATE player_account SET alias = :new WHERE id = :id"),
        {"new": new_alias, "id": row.pa_id}
    )
    # Atualiza display_name na Person se era o mesmo
    if row.display_name == old_alias:
        session.execute(
            text("UPDATE person SET display_name = :new WHERE id = :p"),
            {"new": new_alias, "p": row.id}
        )
        print(f"  display_name atualizado: {old_alias} → {new_alias}")

    session.commit()
    print(f"✅ Alias renomeado: '{old_alias}' → '{new_alias}' (person_id={row.id})")


def cmd_deactivate(session, alias):
    """Marca um alias como inativo (active_until = agora)."""
    row = find_person_by_alias(session, alias)
    if not row:
        print(f"Alias '{alias}' não encontrado")
        return

    now = datetime.now(timezone.utc)
    session.execute(
        text("UPDATE player_account SET active_until = :now WHERE id = :id"),
        {"now": now, "id": row.pa_id}
    )
    session.commit()
    print(f"✅ Alias '{alias}' desativado (active_until={now.isoformat()})")


def cmd_set_account_id(session, alias, account_id):
    """Atualiza o account_id (Steam ID) de um player_account."""
    row = find_person_by_alias(session, alias)
    if not row:
        print(f"Alias '{alias}' não encontrado")
        return

    session.execute(
        text("UPDATE player_account SET account_id = :aid WHERE id = :id"),
        {"aid": account_id, "id": row.pa_id}
    )
    session.commit()
    print(f"✅ account_id atualizado para '{alias}': {account_id}")


def cmd_team(session, team_name, stage_id):
    """Lista todos os jogadores de um time no roster de uma stage."""
    rows = session.execute(
        text("""
            SELECT p.id, p.display_name, r.fantasy_cost,
                   pa.alias, pa.account_id, pa.active_until
            FROM roster r
            JOIN person p ON p.id = r.person_id
            LEFT JOIN player_account pa ON pa.person_id = p.id
                AND pa.active_until IS NULL
            WHERE r.team_name = :t AND r.stage_id = :s
            ORDER BY p.display_name
        """),
        {"t": team_name, "s": stage_id}
    ).fetchall()

    if not rows:
        print(f"Nenhum jogador encontrado para '{team_name}' na stage {stage_id}")
        return

    print(f"\n[ {team_name} | stage_id={stage_id} ]")
    for r in rows:
        acc = r.account_id or "sem account_id"
        print(f"  {r.display_name:<20} alias={r.alias or '?':<20} {acc}  custo={r.fantasy_cost}")


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(0)

    cmd = sys.argv[1]

    with Session(engine) as session:
        if cmd == "info" and len(sys.argv) >= 3:
            cmd_info(session, sys.argv[2])

        elif cmd == "add-alias" and len(sys.argv) >= 4:
            account_id = sys.argv[4] if len(sys.argv) >= 5 else None
            cmd_add_alias(session, sys.argv[2], sys.argv[3], account_id)

        elif cmd == "rename" and len(sys.argv) >= 4:
            cmd_rename(session, sys.argv[2], sys.argv[3])

        elif cmd == "deactivate" and len(sys.argv) >= 3:
            cmd_deactivate(session, sys.argv[2])

        elif cmd == "set-account-id" and len(sys.argv) >= 4:
            cmd_set_account_id(session, sys.argv[2], sys.argv[3])

        elif cmd == "team" and len(sys.argv) >= 4:
            cmd_team(session, sys.argv[2], int(sys.argv[3]))

        else:
            print(__doc__)

if __name__ == "__main__":
    main()
