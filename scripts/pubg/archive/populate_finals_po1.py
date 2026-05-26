"""
populate_finals_po1.py
──────────────────────
Cria os dois championships das Finals Playoff 1 (PAS e PEC):
  - PUBG Americas Series 1 2026 - Finals 1  (am-pas126)
  - PUBG EMEA Championship: 2026 Spring - Finals 1  (eu-pecs26)

Estratégia:
  - Roster copiado do último dia dos playoffs (PAS D3=stage 17, PEC D3=stage 23)
  - D2 e D3 de cada final usam o mesmo roster do D1 (copiado novamente)
  - carries_stats_from aponta para todos os stages do playoff correspondente
  - Horários em UTC (EDT = UTC-4)

Uso:
  python scripts/pubg/populate_finals_po1.py --dry-run
  python scripts/pubg/populate_finals_po1.py
"""

import argparse
import os
import sys
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

try:
    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import Session
except ImportError:
    sys.exit("pip install sqlalchemy psycopg2-binary")

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    sys.exit("Defina DATABASE_URL antes de rodar")

parser = argparse.ArgumentParser()
parser.add_argument("--dry-run", action="store_true", help="Mostra o que seria feito sem alterar o banco")
args = parser.parse_args()
DRY = args.dry_run

# ── CONFIGURAÇÃO ──────────────────────────────────────────────────────────────

def utc(year, month, day, hour, minute=0):
    return datetime(year, month, day, hour, minute, tzinfo=timezone.utc)

CHAMPIONSHIPS = [
    {
        "name":       "PUBG Americas Series 1 2026 - Finals 1",
        "short_name": "PAS1-F1-26",
        "shard":      "pc-tournament",
        "tier_weight": Decimal("1.00"),
        "roster_source_stage_id": 17,           # PAS Playoffs D3
        "carries_stats_from": [15, 16, 17],     # PAS Playoffs D1, D2, D3
        "stages": [
            {
                "name":       "Finals 1 - Dia 1",
                "short_name": "F1-D1",
                "date":       date(2026, 4, 24),
                "day_number": 1,
                "start_at":   utc(2026, 4, 24, 23,  0),   # 19h EDT
                "close_at":   utc(2026, 4, 24, 23, 15),   # 19h15 EDT
            },
            {
                "name":       "Finals 1 - Dia 2",
                "short_name": "F1-D2",
                "date":       date(2026, 4, 25),
                "day_number": 2,
                "start_at":   utc(2026, 4, 25, 23,  0),
                "close_at":   utc(2026, 4, 25, 23, 15),
            },
            {
                "name":       "Finals 1 - Dia 3",
                "short_name": "F1-D3",
                "date":       date(2026, 4, 26),
                "day_number": 3,
                "start_at":   utc(2026, 4, 26, 23,  0),
                "close_at":   utc(2026, 4, 26, 23, 15),
            },
        ],
    },
    {
        "name":       "PUBG EMEA Championship: 2026 Spring - Finals 1",
        "short_name": "PEC1-F1-26",
        "shard":      "pc-tournament",
        "tier_weight": Decimal("1.00"),
        "roster_source_stage_id": 23,           # PEC Playoffs D3
        "carries_stats_from": [21, 22, 23],     # PEC Playoffs D1, D2, D3
        "stages": [
            {
                "name":       "Finals 1 - Dia 1",
                "short_name": "F1-D1",
                "date":       date(2026, 4, 24),
                "day_number": 1,
                "start_at":   utc(2026, 4, 24, 16,  0),   # 12h EDT
                "close_at":   utc(2026, 4, 24, 16, 15),   # 12h15 EDT
            },
            {
                "name":       "Finals 1 - Dia 2",
                "short_name": "F1-D2",
                "date":       date(2026, 4, 25),
                "day_number": 2,
                "start_at":   utc(2026, 4, 25, 16,  0),
                "close_at":   utc(2026, 4, 25, 16, 15),
            },
            {
                "name":       "Finals 1 - Dia 3",
                "short_name": "F1-D3",
                "date":       date(2026, 4, 26),
                "day_number": 3,
                "start_at":   utc(2026, 4, 26, 16,  0),
                "close_at":   utc(2026, 4, 26, 16, 15),
            },
        ],
    },
]

LINEUP_SIZE        = 4        # 4 titulares + 1 reserva (implícito no sistema)
CAPTAIN_MULTIPLIER = Decimal("1.30")
PRICE_MIN          = 12
PRICE_MAX          = 35
PRICING_NEWCOMER   = 15

# ── HELPERS ───────────────────────────────────────────────────────────────────

def log(msg):
    print(msg)

def get_roster_from_stage(session, source_stage_id):
    """Retorna lista de (person_id, team_name, fantasy_cost) do stage de origem."""
    rows = session.execute(
        text("""
            SELECT person_id, team_name, fantasy_cost, cost_override, newcomer_to_tier
            FROM roster
            WHERE stage_id = :s
            ORDER BY team_name, person_id
        """),
        {"s": source_stage_id}
    ).fetchall()
    log(f"  Roster source (stage {source_stage_id}): {len(rows)} jogadores")
    return rows

def copy_roster_to_stage(session, roster_rows, target_stage_id):
    """Copia entradas de roster para o stage de destino (ignora duplicatas)."""
    inserted = 0
    skipped = 0
    for row in roster_rows:
        person_id, team_name, fantasy_cost, cost_override, newcomer = row
        exists = session.execute(
            text("SELECT id FROM roster WHERE person_id = :p AND stage_id = :s"),
            {"p": person_id, "s": target_stage_id}
        ).fetchone()
        if exists:
            skipped += 1
            continue
        if DRY:
            inserted += 1
            continue
        session.execute(
            text("""
                INSERT INTO roster (person_id, stage_id, team_name, fantasy_cost,
                                    cost_override, newcomer_to_tier, is_available)
                VALUES (:p, :s, :t, :fc, :co, :nt, true)
            """),
            {
                "p": person_id,
                "s": target_stage_id,
                "t": team_name,
                "fc": fantasy_cost,
                "co": cost_override,
                "nt": newcomer,
            }
        )
        inserted += 1
    action = "[DRY] would insert" if DRY else "Inseridos"
    log(f"  {action}: {inserted} | Já existiam: {skipped}")

def create_or_get_championship(session, cfg):
    row = session.execute(
        text("SELECT id FROM championship WHERE name = :n"),
        {"n": cfg["name"]}
    ).fetchone()
    if row:
        log(f"  [EXISTE] Championship id={row[0]}")
        return row[0]
    if DRY:
        log(f"  [DRY] Criaria championship: {cfg['name']}")
        return None
    r = session.execute(
        text("""
            INSERT INTO championship (name, short_name, shard, tier_weight, is_active)
            VALUES (:n, :sn, :sh, :tw, true)
            RETURNING id
        """),
        {"n": cfg["name"], "sn": cfg["short_name"], "sh": cfg["shard"], "tw": cfg["tier_weight"]}
    )
    cid = r.fetchone()[0]
    log(f"  [CRIADO] Championship id={cid}")
    return cid

def create_or_get_stage(session, champ_id, stage_cfg, champ_cfg, roster_source_override=None):
    row = session.execute(
        text("SELECT id FROM stage WHERE championship_id = :c AND short_name = :sn"),
        {"c": champ_id, "sn": stage_cfg["short_name"]}
    ).fetchone() if champ_id else None
    if row:
        log(f"  [EXISTE] Stage '{stage_cfg['short_name']}' id={row[0]}")
        return row[0]
    if DRY:
        log(f"  [DRY] Criaria stage: {stage_cfg['name']}")
        return None

    carries = "{" + ",".join(str(x) for x in champ_cfg["carries_stats_from"]) + "}"
    roster_src = roster_source_override or champ_cfg["roster_source_stage_id"]

    r = session.execute(
        text("""
            INSERT INTO stage (
                championship_id, name, short_name, shard,
                lineup_size, captain_multiplier,
                price_min, price_max, pricing_newcomer_cost,
                carries_stats_from, roster_source_stage_id,
                lineup_status, is_active,
                start_date, end_date
            )
            VALUES (
                :c, :n, :sn, :sh,
                :ls, :cm,
                :pmin, :pmax, :pnew,
                :csf, :rss,
                'closed', true,
                :sd, :ed
            )
            RETURNING id
        """),
        {
            "c":    champ_id,
            "n":    stage_cfg["name"],
            "sn":   stage_cfg["short_name"],
            "sh":   champ_cfg["shard"],
            "ls":   LINEUP_SIZE,
            "cm":   CAPTAIN_MULTIPLIER,
            "pmin": PRICE_MIN,
            "pmax": PRICE_MAX,
            "pnew": PRICING_NEWCOMER,
            "csf":  carries,
            "rss":  roster_src,
            "sd":   stage_cfg["start_at"],
            "ed":   stage_cfg["close_at"],
        }
    )
    sid = r.fetchone()[0]
    log(f"  [CRIADO] Stage '{stage_cfg['short_name']}' id={sid}")
    return sid

def create_stage_day(session, stage_id, stage_cfg):
    if not stage_id:
        log(f"  [DRY] Criaria stage_day: {stage_cfg['date']}")
        return None
    row = session.execute(
        text("SELECT id FROM stage_day WHERE stage_id = :s AND date = :d"),
        {"s": stage_id, "d": stage_cfg["date"]}
    ).fetchone()
    if row:
        log(f"  [EXISTE] StageDay id={row[0]} ({stage_cfg['date']})")
        return row[0]
    if DRY:
        log(f"  [DRY] Criaria stage_day: {stage_cfg['date']}")
        return None
    r = session.execute(
        text("""
            INSERT INTO stage_day (stage_id, date, day_number, lineup_close_at)
            VALUES (:s, :d, :dn, :lca)
            RETURNING id
        """),
        {
            "s":   stage_id,
            "d":   stage_cfg["date"],
            "dn":  stage_cfg["day_number"],
            "lca": stage_cfg["close_at"],
        }
    )
    sdid = r.fetchone()[0]
    log(f"  [CRIADO] StageDay id={sdid} ({stage_cfg['date']}, fecha {stage_cfg['close_at']} UTC)")
    return sdid

# ── MAIN ──────────────────────────────────────────────────────────────────────

engine = create_engine(DATABASE_URL)

with Session(engine) as session:
    for champ_cfg in CHAMPIONSHIPS:
        log(f"\n{'='*60}")
        log(f"CHAMPIONSHIP: {champ_cfg['name']}")
        log(f"{'='*60}")

        # 1. Championship
        log("\n--- Championship ---")
        champ_id = create_or_get_championship(session, champ_cfg)

        # 2. Roster source do playoff
        log(f"\n--- Buscando roster base (stage {champ_cfg['roster_source_stage_id']}) ---")
        source_roster = get_roster_from_stage(session, champ_cfg["roster_source_stage_id"])

        # 3. Stages + StageDays + Roster
        first_stage_id = None
        for i, stage_cfg in enumerate(champ_cfg["stages"]):
            log(f"\n--- Stage: {stage_cfg['name']} ---")

            # D2 e D3 apontam para D1 das finals como roster_source (após D1 ser criado)
            roster_source_override = first_stage_id if i > 0 else None

            stage_id = create_or_get_stage(
                session, champ_id, stage_cfg, champ_cfg,
                roster_source_override=roster_source_override
            )

            if i == 0 and stage_id:
                first_stage_id = stage_id

            log(f"  StageDay:")
            create_stage_day(session, stage_id, stage_cfg)

            log(f"  Roster:")
            if stage_id or DRY:
                copy_roster_to_stage(session, source_roster, stage_id)

    # 4. Commit
    if not DRY:
        session.commit()
        log("\n[OK] Commit realizado com sucesso!")
    else:
        log("\n[DRY RUN] Nenhuma alteração feita.")

    # 5. Resumo final
    if not DRY:
        log("\n=== RESUMO FINAL ===")
        for champ_cfg in CHAMPIONSHIPS:
            row = session.execute(
                text("SELECT id FROM championship WHERE name = :n"),
                {"n": champ_cfg["name"]}
            ).fetchone()
            if not row:
                continue
            cid = row[0]
            stages = session.execute(
                text("""
                    SELECT s.id, s.short_name, s.lineup_status, sd.id as sdid, sd.date
                    FROM stage s
                    LEFT JOIN stage_day sd ON sd.stage_id = s.id
                    WHERE s.championship_id = :c
                    ORDER BY s.id
                """),
                {"c": cid}
            ).fetchall()
            log(f"\n{champ_cfg['name']} (id={cid})")
            for s in stages:
                roster_count = session.execute(
                    text("SELECT COUNT(*) FROM roster WHERE stage_id = :s"),
                    {"s": s[0]}
                ).scalar()
                log(f"  Stage {s[0]} ({s[1]}): status={s[2]}, stage_day={s[3]} ({s[4]}), roster={roster_count} jogadores")
