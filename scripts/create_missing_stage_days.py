"""
Cria StageDay(day_number=1) para cada stage ativa que ainda não tem nenhum dia cadastrado.

Uso:
    python scripts/create_missing_stage_days.py           # dry-run (só lista)
    python scripts/create_missing_stage_days.py --apply   # cria de verdade

Opcional — restringir a stage_ids específicos:
    python scripts/create_missing_stage_days.py --apply --stages 30 33
"""
import os
import sys
import argparse

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv()

from app.database import SessionLocal
from app.models.stage import Stage
from app.models.stage_day import StageDay

parser = argparse.ArgumentParser()
parser.add_argument("--apply",  action="store_true", help="Aplica as mudanças (default: dry-run)")
parser.add_argument("--stages", nargs="*", type=int, default=None, help="IDs de stages a processar (default: todas ativas)")
args = parser.parse_args()

db = SessionLocal()

q = db.query(Stage).filter(Stage.is_active == True)  # noqa: E712
if args.stages:
    q = q.filter(Stage.id.in_(args.stages))
stages = q.order_by(Stage.id).all()

to_create = []
for stage in stages:
    has_days = db.query(StageDay).filter(StageDay.stage_id == stage.id).first()
    if has_days:
        print(f"  SKIP  stage {stage.id:3d} ({stage.short_name!r}) — já tem dias cadastrados")
        continue

    if not stage.start_date:
        print(f"  WARN  stage {stage.id:3d} ({stage.short_name!r}) — sem start_date, pulando")
        continue

    day = StageDay(
        stage_id=stage.id,
        day_number=1,
        date=stage.start_date.date(),
        lineup_close_at=stage.lineup_close_at,
    )
    to_create.append((stage, day))
    print(f"  {'CREATE' if args.apply else 'DRY'  }  stage {stage.id:3d} ({stage.short_name!r})"
          f"  date={day.date}  lineup_close_at={day.lineup_close_at}")

if not to_create:
    print("\nNada a fazer.")
    sys.exit(0)

if not args.apply:
    print(f"\n{len(to_create)} stage(s) sem dias. Rode com --apply para criar.")
    sys.exit(0)

for stage, day in to_create:
    db.add(day)

db.commit()
print(f"\n{len(to_create)} StageDay(s) criados com sucesso.")
