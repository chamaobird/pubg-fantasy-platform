#!/usr/bin/env python3
"""
scripts/seed_pgs_s2.py

Cria o championship PGS 2026 Series 2 com 3 stages + stage days.
Também cria (ou reutiliza) o Championship Group "PGS" e adiciona S2.

Uso:
    python scripts/seed_pgs_s2.py [--dry-run] [--pgs-s1-id <id>]

    --dry-run      Mostra o que seria criado sem modificar o banco
    --pgs-s1-id    ID do championship PGS S1 para adicionar ao grupo PGS
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
    name        = "PGS 2026 Series 2",
    short_name  = "PGS S2",
    shard       = "pc-tournament",
    tier_weight = 1.5,
    has_faceoff = False,
    is_active   = True,
)

# EDT 06:00 = UTC 10:00
W_OPEN   = edt(5, 28)   # Winners  — May 28 06:00 EDT
S_OPEN   = edt(5, 29)   # Survival — May 29 06:00 EDT
F_D1     = edt(5, 30)   # Final D1 — May 30 06:00 EDT
F_D2     = edt(5, 31)   # Final D2 — May 31 06:00 EDT

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
        lineup_close_at    = F_D1,   # fecha no primeiro dia
        lineup_open_at     = None,
        days = [
            dict(day_number=1, date=date(2026, 5, 30), lineup_close_at=F_D1),
            dict(day_number=2, date=date(2026, 5, 31), lineup_close_at=F_D2),
        ],
    ),
]

GROUP_DATA = dict(name="PGS", short_name="PGS", display_order=0)


# ─── Seed ─────────────────────────────────────────────────────────────────────

def seed(db: Session, dry_run: bool, pgs_s1_id: int | None):

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

        existing_stage = db.query(Stage).filter_by(
            championship_id=champ.id if not dry_run else 0,
            name=stage_name,
        ).first() if not dry_run else None

        if existing_stage:
            print(f"[SKIP]   Stage já existe: id={existing_stage.id} — {stage_name}")
            stage = existing_stage
        else:
            stage = Stage(championship_id=champ.id if not dry_run else 0, **sd)
            print(f"[CREATE] Stage: {stage_name}")
            print(f"         start={sd['start_date']}  lineup_size={sd['lineup_size']}  cap={sd['captain_multiplier']}")
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

    # ── Championship Group ──────────────────────────────────────────────────
    existing_group = db.query(ChampionshipGroup).filter_by(name=GROUP_DATA["name"]).first()
    if existing_group:
        print(f"[SKIP] Grupo já existe: id={existing_group.id} — {existing_group.name}")
        group = existing_group
    else:
        group = ChampionshipGroup(**GROUP_DATA)
        print(f"[CREATE] Grupo: {group.name}")
        if not dry_run:
            db.add(group)
            db.flush()
            print(f"         -> id={group.id}")

    # ── Membros do grupo ────────────────────────────────────────────────────
    def add_member(championship_id: int, display_order: int, label: str):
        if dry_run:
            print(f"[CREATE] GroupMember: championship_id={championship_id} ({label})")
            return
        exists = db.query(ChampionshipGroupMember).filter_by(
            group_id=group.id, championship_id=championship_id
        ).first()
        if exists:
            print(f"[SKIP]   GroupMember já existe: championship_id={championship_id} ({label})")
        else:
            m = ChampionshipGroupMember(
                group_id=group.id,
                championship_id=championship_id,
                display_order=display_order,
            )
            db.add(m)
            db.flush()
            print(f"[CREATE] GroupMember: championship_id={championship_id} ({label})")

    if pgs_s1_id:
        add_member(pgs_s1_id, display_order=0, label="PGS S1")

    if not dry_run and champ.id:
        add_member(champ.id, display_order=1, label="PGS S2")
    elif dry_run:
        print(f"[CREATE] GroupMember: championship_id=<novo PGS S2>")

    if not dry_run:
        db.commit()
        print("\nOK Seed concluído com sucesso.")
    else:
        db.rollback()
        print("\n[DRY-RUN] Nenhuma alteração salva.")


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Seed PGS 2026 Series 2")
    parser.add_argument("--dry-run", action="store_true", help="Simula sem salvar")
    parser.add_argument("--pgs-s1-id", type=int, default=None,
                        help="ID do championship PGS Series 1 para adicionar ao grupo")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        seed(db, dry_run=args.dry_run, pgs_s1_id=args.pgs_s1_id)
    except Exception as e:
        db.rollback()
        print(f"\n[ERRO] {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
