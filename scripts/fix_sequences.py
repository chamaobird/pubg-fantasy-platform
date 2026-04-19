"""
fix_sequences.py
────────────────
Ressincroniza as sequences do PostgreSQL apos insercoes em lote fora do SQLAlchemy.

Sintoma sem esse script: IntegrityError (duplicate key) na proxima insercao via ORM,
porque a sequence esta atras do MAX(id) real da tabela.

Uso:
    python scripts/fix_sequences.py             # Corrige todas as tabelas
    python scripts/fix_sequences.py --dry-run   # Mostra o que faria sem executar
    python scripts/fix_sequences.py --table person roster player_account
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from sqlalchemy import text as sql_text

from app.database import SessionLocal

# Tabelas com coluna id serial/sequence gerenciada pelo SQLAlchemy
TABLES_WITH_SEQUENCES = [
    "championship",
    "stage",
    "stage_day",
    "person",
    "player_account",
    "roster",
    "roster_price_history",
    "match",
    "match_stat",
    "person_stage_stat",
    "lineup",
    "lineup_player",
    "user_day_stat",
    "user_stage_stat",
]


def fix_sequences(tables: list[str], dry_run: bool = False):
    db = SessionLocal()
    try:
        print(f"{'[DRY RUN] ' if dry_run else ''}Verificando sequences...\n")

        fixed = 0
        skipped = 0

        for table in tables:
            # Verifica se a tabela existe
            exists = db.execute(
                sql_text("""
                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.tables
                        WHERE table_schema = 'public' AND table_name = :table
                    )
                """),
                {"table": table},
            ).scalar()
            if not exists:
                print(f"  SKIP  {table:30} (tabela nao existe)")
                skipped += 1
                continue

            # Verifica se a tabela tem coluna 'id' inteira com sequence
            check = db.execute(
                sql_text("""
                    SELECT pg_get_serial_sequence(:table, 'id')
                """),
                {"table": table},
            ).scalar()

            if not check:
                print(f"  SKIP  {table:30} (sem sequence em 'id')")
                skipped += 1
                continue

            # Pega o MAX(id) atual
            max_id = db.execute(
                sql_text(f'SELECT COALESCE(MAX(id), 0) FROM "{table}"')
            ).scalar()

            # Pega o valor atual da sequence
            seq_val = db.execute(
                sql_text(f"SELECT last_value FROM {check}")
            ).scalar()

            if seq_val < max_id:
                if dry_run:
                    print(f"  WOULD FIX  {table:30} max_id={max_id}  seq_now={seq_val}")
                else:
                    db.execute(
                        sql_text(f"SELECT setval('{check}', {max_id})")
                    )
                    print(f"  FIXED  {table:30} seq {seq_val} -> {max_id}")
                fixed += 1
            else:
                print(f"  OK     {table:30} seq={seq_val}  max_id={max_id}")

        if not dry_run:
            db.commit()

        print(f"\nResultado: {fixed} corrigida(s), {skipped} sem sequence, {len(tables) - fixed - skipped} ja ok.")

    except Exception as exc:
        db.rollback()
        print(f"\nERRO: {exc}")
        raise
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="Ressincronizar sequences PostgreSQL")
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Mostra o que seria corrigido sem executar"
    )
    parser.add_argument(
        "--table", nargs="*",
        help="Tabelas especificas (padrao: todas as tabelas do sistema)"
    )
    args = parser.parse_args()

    tables = args.table if args.table else TABLES_WITH_SEQUENCES
    fix_sequences(tables, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
