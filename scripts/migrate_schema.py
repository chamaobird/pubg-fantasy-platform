#!/usr/bin/env python3
"""
scripts/migrate_schema.py

Executa migrations do schema do banco de dados para adicionar os novos campos
necessários pela integração com PUBG API.

Uso:
    python scripts/migrate_schema.py
"""

import sys
import os

# Adiciona o diretório raiz ao path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text
from app.database import engine

MIGRATIONS = """
-- Adiciona campo is_admin na tabela users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Adiciona campos PUBG na tabela players
ALTER TABLE players ADD COLUMN IF NOT EXISTS pubg_id VARCHAR UNIQUE;
ALTER TABLE players ADD COLUMN IF NOT EXISTS region VARCHAR;
ALTER TABLE players ADD COLUMN IF NOT EXISTS avg_kills FLOAT DEFAULT 0.0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS avg_damage FLOAT DEFAULT 0.0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS avg_placement FLOAT DEFAULT 0.0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS matches_played INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS raw_stats JSON;
ALTER TABLE players ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;

-- Adiciona campos PUBG na tabela tournaments
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS pubg_id VARCHAR UNIQUE;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS region VARCHAR;
"""

def main():
    print("="*60)
    print(" Warzone Fantasy — Schema Migration")
    print("="*60)
    
    try:
        with engine.connect() as conn:
            print("\n[*] Conectando ao banco de dados...")
            
            # Executa todas as migrations
            for statement in MIGRATIONS.strip().split(";\n"):
                statement = statement.strip()
                if statement and not statement.startswith("--"):
                    print(f"\n[*] Executando: {statement[:60]}...")
                    conn.execute(text(statement))
            
            conn.commit()
            print("\n[✓] Migrations executadas com sucesso!")
            
            # Verifica os campos criados
            print("\n[*] Verificando schema da tabela users...")
            result = conn.execute(text(
                "SELECT column_name, data_type FROM information_schema.columns "
                "WHERE table_name = 'users';"
            ))
            for row in result:
                print(f"  - {row[0]}: {row[1]}")
            
            print("\n[*] Verificando schema da tabela players...")
            result = conn.execute(text(
                "SELECT column_name, data_type FROM information_schema.columns "
                "WHERE table_name = 'players';"
            ))
            for row in result:
                print(f"  - {row[0]}: {row[1]}")

            print("\n[*] Verificando schema da tabela tournaments...")
            result = conn.execute(text(
                "SELECT column_name, data_type FROM information_schema.columns "
                "WHERE table_name = 'tournaments';"
            ))
            for row in result:
                print(f"  - {row[0]}: {row[1]}")
            
            print("\n" + "="*60)
            print(" Migration concluída! O banco está pronto.")
            print("="*60)
    
    except Exception as e:
        print(f"\n[ERRO] Migration falhou: {e}")
        raise

if __name__ == "__main__":
    main()
