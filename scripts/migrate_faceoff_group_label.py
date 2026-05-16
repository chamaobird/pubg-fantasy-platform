#!/usr/bin/env python3
"""
scripts/migrate_faceoff_group_label.py

Adiciona campo group_label à tabela faceoff.
Permite agrupar faceoffs por fase/etapa (ex: "Winners Stage", "Survival Direta").

Uso:
    python scripts/migrate_faceoff_group_label.py
"""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text
from app.database import engine

MIGRATION = """
ALTER TABLE faceoff ADD COLUMN IF NOT EXISTS group_label VARCHAR(100) NULL;
"""

def main():
    with engine.connect() as conn:
        conn.execute(text(MIGRATION))
        conn.commit()
    print("OK: group_label adicionado à tabela faceoff.")

if __name__ == "__main__":
    main()
