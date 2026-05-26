"""
fix_team_tags.py — Corrige inconsistências na tabela team:
  - LxB → LB (Last Breath, para bater com o arquivo de logo lb.png)
  - Normaliza nomes: "Also known as" → "Also Known As", "Chupinsky's" → "Chupinskys", etc.
"""
from app.database import engine
from sqlalchemy import text

fixes = [
    # (tabela, campo, novo_valor, condição)
    ("UPDATE team SET tag  = 'LB'           WHERE name = 'Last Breath'",),
    ("UPDATE team SET name = 'Also Known As' WHERE name = 'Also known as'",),
    ("UPDATE team SET name = 'Chupinskys'    WHERE name = 'Chupinsky''s'",),
    ("UPDATE team SET name = 'DOTS'          WHERE name = 'Dots'",),
    ("UPDATE team SET name = 'Nevermind'     WHERE name = 'NEVERMIND'",),
]

with engine.begin() as conn:
    for (sql,) in fixes:
        result = conn.execute(text(sql))
        print(f"{'OK':4} rows={result.rowcount:2}  {sql}")

print("\nConcluído.")
