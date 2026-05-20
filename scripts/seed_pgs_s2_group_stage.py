#!/usr/bin/env python3
"""
scripts/seed_pgs_s2_group_stage.py

Cria a Group Stage do PGS 2026 S2 (May 20) e reseta o Winners Stage.

Ações:
  1. Cria Stage "Group Stage" para championship_id=16
  2. Cria StageDay (day=1, May 20)
  3. Seed roster dos 24 times (16 de stage 42 + 8 survival diretos)
  4. Calcula pricing
  5. Abre lineup da Group Stage
  6. Fecha Winners Stage (42), deleta lineups de usuários e limpa roster

Uso:
    python scripts/seed_pgs_s2_group_stage.py              # dry-run
    python scripts/seed_pgs_s2_group_stage.py --confirm    # aplica

IDs produção:
    championship=16, Winners Stage=42
"""

import sys
import os
import argparse
from datetime import datetime, date, timezone
from decimal import Decimal

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import app.models.team_member  # noqa: F401
from app.models.team import Team  # noqa: F401
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.stage import Stage
from app.models.stage_day import StageDay
from app.models.roster import Roster
from app.models.person import Person
from app.models.lineup import Lineup

# ─── Config ───────────────────────────────────────────────────────────────────

CHAMPIONSHIP_ID  = 16
WINNERS_STAGE_ID = 42

# May 20, 01:00 EDT = 05:00 UTC
GROUP_START_UTC = datetime(2026, 5, 20, 5, 0, tzinfo=timezone.utc)

GROUP_STAGE_DATA = dict(
    championship_id    = CHAMPIONSHIP_ID,
    name               = "Group Stage",
    short_name         = "Group",
    shard              = "pc-tournament",
    lineup_size        = 4,
    captain_multiplier = Decimal("1.30"),
    price_min          = 10,
    price_max          = 35,
    pricing_newcomer_cost = 15,
    lineup_status      = "open",
    stage_phase        = "upcoming",
    start_date         = GROUP_START_UTC,
    end_date           = GROUP_START_UTC,
    lineup_close_at    = GROUP_START_UTC,
    lineup_open_at     = None,
)

# ─── Times ────────────────────────────────────────────────────────────────────

# Mapeamento: nome canônico → variantes no DB histórico
# None = time novo (tentará busca pelo nome canônico)
ALL_24_TEAMS: dict[str, list[str] | None] = {
    # --- Grupo A ---
    "Virtus.pro":       ["Virtus.pro", "VP"],
    "Natus Vincere":    ["NATUS VINCERE", "NAVI"],
    "JD Gaming":        ["JDG"],
    "Team Liquid":      ["Team Liquid", "TL"],
    "Team Vitality":    ["Team Vitality", "VIT"],
    "FURIA":            ["FURIA", "Furia"],
    "The Expendables":  ["The Expendables", "GTE", "TE"],
    "S2G Esports":      ["S2G", "S2G Esports"],

    # --- Grupo B ---
    "eArena":           ["EA"],
    "Crazy Raccoon":    ["CR"],
    "Petrichor Road":   ["PeRo"],
    "SOOPers":          None,  # time novo (roster manual no stage 42)
    "Theerathon Five":  ["T5"],
    "Gen.G Esports":    ["GEN", "Gen.G", "Gen.G Esports"],
    "CERBERUS Esports": ["FCE", "Finhay Cerberus", "CERBERUS"],
    "Team Falcons":     ["Team Falcons", "Falcons", "FLC", "TF"],

    # --- Grupo C ---
    "T1":               ["T1"],
    "17 Gaming":        ["17"],
    "Made in Thailand": ["MiTH"],
    "Anyone's Legend":  ["AL"],
    "Twisted Minds":    ["Twisted Minds", "TWIS"],
    "Four Angry Men":   ["4AM"],
    "Change The Game":  ["CTG", "Change the Game", "Change The Game"],
    "FULL SENSE":       ["FS", "Full Sense", "FULL SENSE"],
}

# ─── Helpers ──────────────────────────────────────────────────────────────────

def suggest_roster_for_stage(
    db: Session,
    new_stage_id: int,
    source_stage_id: int,
) -> dict[str, list[dict]]:
    """
    Para cada time, tenta:
      1. Copiar jogadores do source_stage_id (Winners Stage 42)
      2. Se não encontrar, busca no histórico via team_name variants
    """
    already: set[int] = {
        r.person_id
        for r in db.query(Roster.person_id)
        .filter(Roster.stage_id == new_stage_id)
        .all()
    }

    result: dict[str, list[dict]] = {}

    for canonical, variants in ALL_24_TEAMS.items():
        players: list[dict] = []

        # Estratégia 1: copiar de source_stage (Winners Stage 42)
        source_rows = (
            db.query(Roster, Person)
            .join(Person, Roster.person_id == Person.id)
            .filter(
                Roster.stage_id == source_stage_id,
                Roster.team_name == canonical,
            )
            .all()
        )
        if source_rows:
            for roster, person in source_rows:
                if roster.person_id not in already:
                    players.append({
                        "person_id":       roster.person_id,
                        "display_name":    person.display_name,
                        "team_name":       canonical,
                        "is_available":    roster.is_available,
                        "source":          f"stage_{source_stage_id}",
                        "fantasy_cost":    float(roster.fantasy_cost) if roster.fantasy_cost else None,
                    })
            result[canonical] = players
            continue

        # Estratégia 2: buscar histórico via variantes
        search_variants = (variants or []) + [canonical]

        rows = (
            db.query(
                Roster.person_id,
                Roster.team_name,
                Roster.stage_id,
                Roster.is_available,
                Roster.fantasy_cost,
                Person.display_name,
            )
            .join(Person, Roster.person_id == Person.id)
            .filter(
                Roster.team_name.in_(search_variants),
                Roster.stage_id != source_stage_id,
                Roster.stage_id != new_stage_id,
                Person.is_active == True,  # noqa: E712
            )
            .order_by(Roster.person_id, Roster.stage_id.desc())
            .all()
        )

        seen: set[int] = set()
        for row in rows:
            if row.person_id not in seen and row.person_id not in already:
                seen.add(row.person_id)
                players.append({
                    "person_id":    row.person_id,
                    "display_name": row.display_name,
                    "team_name":    canonical,
                    "is_available": row.is_available,
                    "source":       f"stage_{row.stage_id}_history",
                    "fantasy_cost": float(row.fantasy_cost) if row.fantasy_cost else None,
                })

        result[canonical] = players

    return result


def print_roster_preview(suggestions: dict[str, list[dict]]):
    print("\n=== ROSTER GROUP STAGE (preview) ===\n")
    total = 0
    warn = []

    for canonical, players in suggestions.items():
        n = len(players)
        flag = "OK " if n >= 5 else "!! "
        if n < 5:
            warn.append(f"{canonical} ({n} jogadores)")
        print(f"  {flag} {canonical}  ({n})")
        for p in players:
            av = "" if p["is_available"] else " [reserva]"
            src = p["source"]
            cost = f"  cost={p['fantasy_cost']:.0f}" if p["fantasy_cost"] else ""
            print(f"       id={p['person_id']:4d}  {p['display_name']:<20s}  {src}{cost}{av}")
        total += n

    print(f"\n  Total: {total} jogadores")
    if warn:
        print(f"\n  ATENÇÃO — times com <5 jogadores:")
        for w in warn:
            print(f"    {w}")
    print()


# ─── Main ─────────────────────────────────────────────────────────────────────

def run(db: Session, confirm: bool):

    # ── 1. Cria Group Stage ────────────────────────────────────────────────────
    existing = db.query(Stage).filter_by(
        championship_id=CHAMPIONSHIP_ID, name="Group Stage"
    ).first()

    if existing:
        print(f"[SKIP] Stage 'Group Stage' já existe: id={existing.id}")
        group_stage = existing
    else:
        group_stage = Stage(**GROUP_STAGE_DATA)
        print(f"[CREATE] Stage: {GROUP_STAGE_DATA['name']}")
        print(f"         start={GROUP_START_UTC}  lineup_status=open")
        if confirm:
            db.add(group_stage)
            db.flush()
            print(f"         -> id={group_stage.id}")
        else:
            group_stage.id = 0  # placeholder para dry-run

    # ── 2. Cria StageDay ──────────────────────────────────────────────────────
    if confirm and group_stage.id:
        existing_day = db.query(StageDay).filter_by(
            stage_id=group_stage.id, day_number=1
        ).first()
        if not existing_day:
            day = StageDay(
                stage_id=group_stage.id,
                day_number=1,
                date=date(2026, 5, 20),
                lineup_close_at=GROUP_START_UTC,
            )
            db.add(day)
            db.flush()
            print(f"[CREATE]   StageDay 1: May 20 2026  -> id={day.id}")
        else:
            print(f"[SKIP]   StageDay 1 já existe: id={existing_day.id}")
    else:
        print(f"[CREATE]   StageDay 1: May 20 2026")

    # ── 3. Roster (preview + apply) ───────────────────────────────────────────
    print("\n[ROSTER] Buscando jogadores dos 24 times...")
    real_stage_id = group_stage.id if confirm else WINNERS_STAGE_ID

    suggestions = suggest_roster_for_stage(
        db,
        new_stage_id  = real_stage_id if confirm else -1,
        source_stage_id = WINNERS_STAGE_ID,
    )
    print_roster_preview(suggestions)

    if confirm and group_stage.id:
        created = 0
        skipped = 0
        for canonical, players in suggestions.items():
            for p in players:
                existing_r = db.query(Roster).filter_by(
                    stage_id=group_stage.id,
                    person_id=p["person_id"],
                ).first()
                if existing_r:
                    skipped += 1
                    continue
                roster = Roster(
                    stage_id    = group_stage.id,
                    person_id   = p["person_id"],
                    team_name   = p["team_name"],
                    is_available= p["is_available"],
                )
                db.add(roster)
                created += 1
        db.flush()
        print(f"[ROSTER] {created} criados, {skipped} pulados")

    # ── 4. Calculate pricing ──────────────────────────────────────────────────
    if confirm and group_stage.id:
        print(f"\n[PRICING] Calculando preços para stage {group_stage.id}...")
        from app.services import pricing as pricing_service
        try:
            result = pricing_service.calculate_stage_pricing(
                stage_id=group_stage.id,
                db=db,
                source="manual",
            )
            print(f"[PRICING] updated={result['updated']}  skipped={result['skipped']}  newcomers={result['newcomers']}")
        except Exception as exc:
            print(f"[PRICING] ERRO: {exc}")
            print(f"[PRICING] Rode manualmente: POST /admin/pricing/stages/{group_stage.id}/recalculate-pricing")
    else:
        print(f"\n[PRICING] (dry-run) Rodará POST /admin/pricing/stages/<new_id>/recalculate-pricing")

    # ── 5. Fecha Winners Stage + limpa ────────────────────────────────────────
    winners = db.query(Stage).filter_by(id=WINNERS_STAGE_ID).first()
    if not winners:
        print(f"\n[WARN] Stage {WINNERS_STAGE_ID} não encontrada!")
    else:
        print(f"\n[WINNERS] Stage {WINNERS_STAGE_ID} atual: lineup_status={winners.lineup_status}")

        # 5a. Conta lineups existentes
        winner_day_ids = [d.id for d in db.query(StageDay).filter_by(stage_id=WINNERS_STAGE_ID).all()]
        lineup_count = db.query(Lineup).filter(Lineup.stage_day_id.in_(winner_day_ids)).count() if winner_day_ids else 0
        roster_count = db.query(Roster).filter_by(stage_id=WINNERS_STAGE_ID).count()

        print(f"[WINNERS] {lineup_count} lineups de usuários para deletar")
        print(f"[WINNERS] {roster_count} roster entries para deletar")

        if confirm:
            # Deleta lineups (cascade → lineup_player)
            if winner_day_ids and lineup_count > 0:
                lineups = db.query(Lineup).filter(Lineup.stage_day_id.in_(winner_day_ids)).all()
                for lp in lineups:
                    db.delete(lp)
                db.flush()
                print(f"[WINNERS] Deleted {lineup_count} lineups")

            # Deleta roster entries
            deleted = db.query(Roster).filter_by(stage_id=WINNERS_STAGE_ID).delete(synchronize_session=False)
            db.flush()
            print(f"[WINNERS] Deleted {deleted} roster entries")

            # Fecha lineup
            winners.lineup_status = "closed"
            db.flush()
            print(f"[WINNERS] lineup_status -> closed")
        else:
            print(f"[WINNERS] (dry-run) Fecharia lineup + deletaria lineups + limparia roster")

    # ── Commit ────────────────────────────────────────────────────────────────
    if confirm:
        db.commit()
        print(f"\n✓ Concluído com sucesso.")
        if group_stage.id:
            print(f"  Group Stage id={group_stage.id}  lineup=open")
            print(f"  Winners Stage {WINNERS_STAGE_ID}: lineup=closed, roster limpo")
            print(f"\n  Próximo passo: verificar preços no admin e ajustar se necessário")
    else:
        db.rollback()
        print(f"\n[DRY-RUN] Nenhuma alteração salva. Use --confirm para aplicar.")


def main():
    parser = argparse.ArgumentParser(description="Seed PGS S2 Group Stage")
    parser.add_argument("--confirm", action="store_true", help="Aplica alterações (default: dry-run)")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        run(db, confirm=args.confirm)
    except Exception as e:
        db.rollback()
        print(f"\n[ERRO] {e}")
        import traceback; traceback.print_exc()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
