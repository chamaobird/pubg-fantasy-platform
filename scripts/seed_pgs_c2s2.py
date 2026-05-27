#!/usr/bin/env python3
"""
scripts/seed_pgs_c2s2.py

Cria o championship PGS 2026 Circuit 2 - Series 2 com 3 stages + stage days.
Adiciona ao Championship Group PGS (id=3 em produção).

Estrutura:
  - Winners Stage  : 5 partidas — May 28, 2026 (1 dia)
  - Survival Stage : 5 partidas — May 29, 2026 (1 dia)
  - Final Stage    : 10 partidas — May 30–31, 2026 (2 dias, independent_lineups=True)

Uso:
    python scripts/seed_pgs_c2s2.py [--dry-run] [--pgs-group-id <id>]

    --dry-run         Mostra o que seria criado sem modificar o banco
    --pgs-group-id    ID do ChampionshipGroup PGS (default: 3)
"""

import sys
import os
import argparse
from datetime import datetime, date, timezone
from decimal import Decimal

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.championship import Championship
from app.models.stage import Stage
from app.models.stage_day import StageDay
from app.models.championship_group import ChampionshipGroup, ChampionshipGroupMember


# ─── Helpers ──────────────────────────────────────────────────────────────────

def edt(month: int, day: int, hour: int = 6, minute: int = 0) -> datetime:
    """Converte horário EDT (UTC-4) para datetime UTC."""
    return datetime(2026, month, day, hour + 4, minute, tzinfo=timezone.utc)


# ─── Dados ────────────────────────────────────────────────────────────────────

CHAMP_DATA = dict(
    name        = "PGS 2026 Circuit 2 - Series 2",
    short_name  = "PGS C2S2",
    shard       = "pc-tournament",
    tier_weight = 1.5,
    has_faceoff = False,
    is_active   = True,
)

# EDT 06:00 = UTC 10:00
W_OPEN = edt(5, 28)   # Winners  — May 28 06:00 EDT
S_OPEN = edt(5, 29)   # Survival — May 29 06:00 EDT
F_D1   = edt(5, 30)   # Final D1 — May 30 06:00 EDT
F_D2   = edt(5, 31)   # Final D2 — May 31 06:00 EDT

STAGES_DATA = [
    dict(
        name               = "Winners Stage",
        short_name         = "Winners",
        shard              = "pc-tournament",
        lineup_size        = 4,
        captain_multiplier = Decimal("1.30"),
        price_min          = 10,
        price_max          = 35,
        lineup_status      = "closed",
        stage_phase        = "upcoming",
        start_date         = W_OPEN,
        end_date           = W_OPEN,
        lineup_close_at    = W_OPEN,
        lineup_open_at     = None,
        independent_lineups = False,
        days = [
            dict(day_number=1, date=date(2026, 5, 28), lineup_close_at=W_OPEN),
        ],
    ),
    dict(
        name               = "Survival Stage",
        short_name         = "Survival",
        shard              = "pc-tournament",
        lineup_size        = 4,
        captain_multiplier = Decimal("1.30"),
        price_min          = 10,
        price_max          = 35,
        lineup_status      = "closed",
        stage_phase        = "upcoming",
        start_date         = S_OPEN,
        end_date           = S_OPEN,
        lineup_close_at    = S_OPEN,
        lineup_open_at     = None,
        independent_lineups = False,
        days = [
            dict(day_number=1, date=date(2026, 5, 29), lineup_close_at=S_OPEN),
        ],
    ),
    dict(
        name               = "Final Stage",
        short_name         = "Final",
        shard              = "pc-tournament",
        lineup_size        = 4,
        captain_multiplier = Decimal("1.30"),
        price_min          = 10,
        price_max          = 35,
        lineup_status      = "closed",
        stage_phase        = "upcoming",
        start_date         = F_D1,
        end_date           = F_D2,
        lineup_close_at    = F_D1,   # fecha antes do D1; D2 abre independente
        lineup_open_at     = None,
        independent_lineups = True,  # lineup diferente por dia
        days = [
            dict(day_number=1, date=date(2026, 5, 30), lineup_close_at=F_D1),
            dict(day_number=2, date=date(2026, 5, 31), lineup_close_at=F_D2),
        ],
    ),
]

PGS_GROUP_DEFAULT_ID = 3


# ─── Seed ─────────────────────────────────────────────────────────────────────

def seed(db: Session, dry_run: bool, pgs_group_id: int):

    # ── Championship ────────────────────────────────────────────────────────
    existing = db.query(Championship).filter_by(name=CHAMP_DATA["name"]).first()
    if existing:
        print(f"[SKIP] Championship já existe: id={existing.id} — {existing.name}")
        champ = existing
    else:
        champ = Championship(**CHAMP_DATA)
        print(f"[CREATE] Championship: {champ.name}  (tier_weight={champ.tier_weight})")
        if not dry_run:
            db.add(champ)
            db.flush()
            print(f"         -> id={champ.id}")

    # ── Stages + Stage Days ─────────────────────────────────────────────────
    for sd in STAGES_DATA:
        days_data = sd.pop("days")
        stage_name = sd["name"]

        existing_stage = None
        if not dry_run and hasattr(champ, 'id') and champ.id:
            existing_stage = db.query(Stage).filter_by(
                championship_id=champ.id,
                name=stage_name,
            ).first()

        if existing_stage:
            print(f"[SKIP]   Stage já existe: id={existing_stage.id} — {stage_name}")
            stage = existing_stage
        else:
            stage = Stage(championship_id=champ.id if not dry_run else 0, **sd)
            print(f"[CREATE] Stage: {stage_name}")
            print(f"         start={sd['start_date']}  lineup_size={sd['lineup_size']}  "
                  f"cap={sd['captain_multiplier']}  independent_lineups={sd.get('independent_lineups')}")
            if not dry_run:
                db.add(stage)
                db.flush()
                print(f"         -> id={stage.id}")

        for day in days_data:
            if not dry_run and stage.id:
                existing_day = db.query(StageDay).filter_by(
                    stage_id=stage.id, day_number=day["day_number"]
                ).first()
                if existing_day:
                    print(f"[SKIP]     StageDay {day['day_number']} já existe: id={existing_day.id}")
                    continue
                sd_obj = StageDay(stage_id=stage.id, **day)
                db.add(sd_obj)
                db.flush()
                print(f"[CREATE]   StageDay {day['day_number']}: date={day['date']}  -> id={sd_obj.id}")
            else:
                print(f"[CREATE]   StageDay {day['day_number']}: date={day['date']}")

        sd["days"] = days_data  # restaura para não afetar reiteration

    # ── Championship Group (PGS) ────────────────────────────────────────────
    group = db.query(ChampionshipGroup).filter_by(id=pgs_group_id).first()
    if not group:
        print(f"[WARN] Grupo id={pgs_group_id} não encontrado — pulando adição ao grupo.")
    else:
        print(f"[OK]   Grupo encontrado: id={group.id} — {group.name}")
        if not dry_run and champ.id:
            exists = db.query(ChampionshipGroupMember).filter_by(
                group_id=group.id, championship_id=champ.id
            ).first()
            if exists:
                print(f"[SKIP]   GroupMember já existe.")
            else:
                # display_order = próximo disponível
                max_order = db.query(ChampionshipGroupMember).filter_by(
                    group_id=group.id
                ).count()
                m = ChampionshipGroupMember(
                    group_id=group.id,
                    championship_id=champ.id,
                    display_order=max_order,
                )
                db.add(m)
                db.flush()
                print(f"[CREATE] GroupMember: championship_id={champ.id} (PGS C2S2)  order={max_order}")
        elif dry_run:
            print(f"[CREATE] GroupMember: championship_id=<novo PGS C2S2>  order=<próximo>")

    if not dry_run:
        db.commit()
        print("\nOK Seed concluído com sucesso.")
        print("\nPróximos passos:")
        print("  1. python scripts/seed_pgs_c2s2_roster.py --stage-id <WINNERS_STAGE_ID> --suggest")
        print("  2. Revisar sugestões e popular GAM x TE manualmente")
        print("  3. python scripts/seed_pgs_c2s2_roster.py --stage-id <WINNERS_STAGE_ID> --apply --confirm")
        print("  4. POST /admin/stages/<WINNERS_STAGE_ID>/calculate-pricing")
    else:
        db.rollback()
        print("\n[DRY-RUN] Nenhuma alteração salva.")


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Seed PGS 2026 Circuit 2 - Series 2")
    parser.add_argument("--dry-run", action="store_true", help="Simula sem salvar")
    parser.add_argument("--pgs-group-id", type=int, default=PGS_GROUP_DEFAULT_ID,
                        help=f"ID do ChampionshipGroup PGS (default: {PGS_GROUP_DEFAULT_ID})")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        seed(db, dry_run=args.dry_run, pgs_group_id=args.pgs_group_id)
    except Exception as e:
        db.rollback()
        print(f"\n[ERRO] {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
