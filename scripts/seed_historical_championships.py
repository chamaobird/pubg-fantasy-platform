"""
Cria championships históricos (is_active=False) para regiões não cobertas
pela fantasy platform durante a temporada. Esses dados alimentam o pricing
engine sem aparecer no frontend público.

Regiões cobertas (playoffs e finals de 2026, após PGS S1):
  - PCL  (China)       — cn-pclf
  - PWS  (Korea)       — kr-pws1wf1, kr-pws1wf2, kr-pws1wf3
  - PTS  (Thailand)    — sea-ptsf1
  - PVS  (Vietnam)     — sea-pvsc26, sea-vn26p1
  - PMS  (SEA Masters) — sea-m26p11, sea-m26p12, sea-m26p13, sea-m26p14

Notas:
  - is_active=False   → oculto no frontend, mas pricing engine ainda lê
  - tier_weight=0.70  → mesmo peso de PAS/PEC (regional tier)
  - shard=pc-tournament → obrigatório para torneios oficiais
  - stage_phase=finished, lineup_status=closed → sem interação de usuário

Uso:
    python scripts/seed_historical_championships.py --dry-run
    python scripts/seed_historical_championships.py
"""
import argparse
import os
import sys
from datetime import date

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import text
from app.database import SessionLocal

# ---------------------------------------------------------------------------
# Configuração dos championships históricos
# ---------------------------------------------------------------------------
# Cada entrada: championship com lista de stages.
# Cada stage tem: name, short_name, pubg_tournament_id, approx_date (para StageDay)
# ---------------------------------------------------------------------------

HISTORICAL_CHAMPIONSHIPS = [
    {
        "name":        "PCL 2026 Spring",
        "short_name":  "PCL-26S",
        "tier_weight": 0.70,
        "stages": [
            {
                "name":               "PCL 2026 Spring Finals",
                "short_name":         "PCL-26S-F",
                "pubg_tournament_id": "cn-pclf",
                "approx_date":        date(2026, 5, 8),
                "matches_estimate":   15,
            },
        ],
    },
    {
        "name":        "PWS 2026 Season 1",
        "short_name":  "PWS-26S1",
        "tier_weight": 0.70,
        "stages": [
            {
                "name":               "PWS 2026 S1 Wildcard Finals 1",
                "short_name":         "PWS-26S1-WF1",
                "pubg_tournament_id": "kr-pws1wf1",
                "approx_date":        date(2026, 4, 18),
                "matches_estimate":   10,
            },
            {
                "name":               "PWS 2026 S1 Wildcard Finals 2",
                "short_name":         "PWS-26S1-WF2",
                "pubg_tournament_id": "kr-pws1wf2",
                "approx_date":        date(2026, 4, 25),
                "matches_estimate":   10,
            },
            {
                "name":               "PWS 2026 S1 Wildcard Finals 3",
                "short_name":         "PWS-26S1-WF3",
                "pubg_tournament_id": "kr-pws1wf3",
                "approx_date":        date(2026, 5, 2),
                "matches_estimate":   10,
            },
        ],
    },
    {
        "name":        "PTS 2026 Season 1",
        "short_name":  "PTS-26S1",
        "tier_weight": 0.70,
        "stages": [
            {
                "name":               "PTS 2026 S1 Finals",
                "short_name":         "PTS-26S1-F",
                "pubg_tournament_id": "sea-ptsf1",
                "approx_date":        date(2026, 5, 8),
                "matches_estimate":   31,
            },
        ],
    },
    {
        "name":        "PVS 2026 Season 1",
        "short_name":  "PVS-26S1",
        "tier_weight": 0.70,
        "stages": [
            {
                "name":               "PVS 2026 Championship",
                "short_name":         "PVS-26S1-CH",
                "pubg_tournament_id": "sea-pvsc26",
                "approx_date":        date(2026, 2, 28),
                "matches_estimate":   30,
            },
            {
                "name":               "PVS 2026 Playoffs 1",
                "short_name":         "PVS-26S1-P1",
                "pubg_tournament_id": "sea-vn26p1",
                "approx_date":        date(2026, 4, 10),
                "matches_estimate":   60,
            },
        ],
    },
    {
        "name":        "PMS 2026 Phase 1",
        "short_name":  "PMS-26P1",
        "tier_weight": 0.70,
        "stages": [
            {
                "name":               "PMS 2026 Phase 1.1",
                "short_name":         "PMS-26P1-1",
                "pubg_tournament_id": "sea-m26p11",
                "approx_date":        date(2026, 4, 15),
                "matches_estimate":   22,
            },
            {
                "name":               "PMS 2026 Phase 1.2",
                "short_name":         "PMS-26P1-2",
                "pubg_tournament_id": "sea-m26p12",
                "approx_date":        date(2026, 4, 23),
                "matches_estimate":   16,
            },
            {
                "name":               "PMS 2026 Phase 1.3",
                "short_name":         "PMS-26P1-3",
                "pubg_tournament_id": "sea-m26p13",
                "approx_date":        date(2026, 5, 1),
                "matches_estimate":   15,
            },
            {
                "name":               "PMS 2026 Phase 1.4",
                "short_name":         "PMS-26P1-4",
                "pubg_tournament_id": "sea-m26p14",
                "approx_date":        date(2026, 5, 8),
                "matches_estimate":   15,
            },
        ],
    },
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def log(msg: str) -> None:
    print(msg)


def get_or_create_championship(db, cfg: dict, dry_run: bool) -> int | None:
    row = db.execute(
        text("SELECT id FROM championship WHERE short_name = :sn"),
        {"sn": cfg["short_name"]},
    ).fetchone()

    if row:
        log(f"  [EXISTS] Championship {cfg['short_name']!r} id={row[0]}")
        return row[0]

    if dry_run:
        log(f"  [DRY]    Would create Championship {cfg['short_name']!r}")
        return None

    result = db.execute(
        text("""
            INSERT INTO championship (name, short_name, shard, is_active, tier_weight, has_faceoff)
            VALUES (:name, :sn, 'pc-tournament', false, :tw, false)
            RETURNING id
        """),
        {"name": cfg["name"], "sn": cfg["short_name"], "tw": cfg["tier_weight"]},
    )
    cid = result.fetchone()[0]
    log(f"  [CREATED] Championship {cfg['short_name']!r} id={cid}")
    return cid


def get_or_create_stage(db, champ_id: int, scfg: dict, dry_run: bool) -> int | None:
    row = db.execute(
        text("SELECT id FROM stage WHERE championship_id = :cid AND short_name = :sn"),
        {"cid": champ_id, "sn": scfg["short_name"]},
    ).fetchone()

    if row:
        log(f"    [EXISTS] Stage {scfg['short_name']!r} id={row[0]}")
        return row[0]

    if dry_run:
        log(f"    [DRY]    Would create Stage {scfg['short_name']!r} ({scfg['pubg_tournament_id']})")
        return None

    result = db.execute(
        text("""
            INSERT INTO stage (
                championship_id, name, short_name, shard,
                pubg_tournament_id,
                lineup_status, stage_phase, is_active,
                lineup_size, price_min, price_max
            ) VALUES (
                :cid, :name, :sn, 'pc-tournament',
                :tid,
                'closed', 'finished', true,
                4, 10, 35
            )
            RETURNING id
        """),
        {
            "cid":  champ_id,
            "name": scfg["name"],
            "sn":   scfg["short_name"],
            "tid":  scfg["pubg_tournament_id"],
        },
    )
    sid = result.fetchone()[0]
    log(f"    [CREATED] Stage {scfg['short_name']!r} id={sid} → {scfg['pubg_tournament_id']}")
    return sid


def get_or_create_stage_day(db, stage_id: int, scfg: dict, dry_run: bool) -> int | None:
    row = db.execute(
        text("SELECT id FROM stage_day WHERE stage_id = :sid AND day_number = 1"),
        {"sid": stage_id},
    ).fetchone()

    if row:
        log(f"      [EXISTS] StageDay id={row[0]}")
        return row[0]

    if dry_run:
        log(f"      [DRY]    Would create StageDay date={scfg['approx_date']}")
        return None

    result = db.execute(
        text("""
            INSERT INTO stage_day (stage_id, day_number, date)
            VALUES (:sid, 1, :dt)
            RETURNING id
        """),
        {"sid": stage_id, "dt": scfg["approx_date"]},
    )
    sdid = result.fetchone()[0]
    log(f"      [CREATED] StageDay id={sdid} date={scfg['approx_date']}")
    return sdid


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def run(dry_run: bool) -> None:
    db = SessionLocal()
    try:
        total_champ = 0
        total_stage = 0
        total_day   = 0

        for champ_cfg in HISTORICAL_CHAMPIONSHIPS:
            log(f"\n── {champ_cfg['name']} ({champ_cfg['short_name']}) ──")
            cid = get_or_create_championship(db, champ_cfg, dry_run)
            if cid is None and not dry_run:
                continue
            total_champ += 1

            for scfg in champ_cfg["stages"]:
                sid = get_or_create_stage(db, cid or -1, scfg, dry_run)
                if sid is None and not dry_run:
                    continue
                total_stage += 1

                sdid = get_or_create_stage_day(db, sid or -1, scfg, dry_run)
                if sdid is not None or dry_run:
                    total_day += 1

        if not dry_run:
            db.commit()
            log(f"\n✓ Committed: {total_champ} championships, {total_stage} stages, {total_day} stage_days")
            log("\nPróximo passo: python scripts/import_historical_matches.py --dry-run")
        else:
            log(f"\nDry run — would create: {total_champ} championships, {total_stage} stages, {total_day} stage_days")

    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Simula sem gravar no banco")
    args = parser.parse_args()
    run(dry_run=args.dry_run)
