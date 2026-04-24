"""
close_and_open_next_day.py
──────────────────────────
Automatiza a transição entre dias de competição.

Sequência:
  1. Exibe estado atual das duas stages
  2. Verifica contagem de matches do dia (se --expected-matches for informado)
  3. Copia roster do from-stage para o to-stage (DISTINCT person_id, skipa duplicatas)
  4. Remove do to-stage jogadores com account PENDING_ que nunca tiveram match_stat
  5. Roda calculate_stage_pricing no to-stage
  6. Seta lineup_status = 'open' no to-stage

Dry-run por padrão. Use --commit para gravar.

Uso:
    # Ver o que seria feito (dry-run)
    python scripts/pubg/close_and_open_next_day.py --from-stage 24 --to-stage 25

    # Também verificar contagem de matches
    python scripts/pubg/close_and_open_next_day.py --from-stage 24 --to-stage 25 --expected-matches 5

    # Gravar
    python scripts/pubg/close_and_open_next_day.py --from-stage 24 --to-stage 25 --commit

    # Gravar com validação de matches (abortará se insuficientes)
    python scripts/pubg/close_and_open_next_day.py \\
        --from-stage 24 --to-stage 25 --expected-matches 5 --commit
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from sqlalchemy import text
from app.database import SessionLocal
from app.models.stage import Stage
from app.services.pricing import calculate_stage_pricing


# ── Display ───────────────────────────────────────────────────────────────────

def show_stage(db, stage_id: int, label: str) -> None:
    stage = db.get(Stage, stage_id)
    if not stage:
        print(f"  {label}: [ERRO] stage {stage_id} não encontrada")
        return
    roster_count = db.execute(
        text("SELECT COUNT(*) FROM roster WHERE stage_id = :s"),
        {"s": stage_id},
    ).scalar()
    match_count = db.execute(
        text("""
            SELECT COUNT(*) FROM match m
            JOIN stage_day sd ON sd.id = m.stage_day_id
            WHERE sd.stage_id = :s
        """),
        {"s": stage_id},
    ).scalar()
    print(
        f"  {label}: [{stage.short_name}]"
        f"  status={stage.lineup_status}"
        f"  roster={roster_count}"
        f"  matches={match_count}"
    )


# ── Passos ────────────────────────────────────────────────────────────────────

def check_match_count(db, from_stage_id: int, expected: int) -> bool:
    actual = db.execute(
        text("""
            SELECT COUNT(*) FROM match m
            JOIN stage_day sd ON sd.id = m.stage_day_id
            WHERE sd.stage_id = :s
        """),
        {"s": from_stage_id},
    ).scalar()
    ok = actual >= expected
    status = "OK" if ok else "INSUFICIENTE"
    print(f"  [{status}] Stage {from_stage_id}: {actual} matches importados (esperado >= {expected})")
    return ok


def copy_roster(db, from_stage_id: int, to_stage_id: int, dry_run: bool) -> int:
    """Copia DISTINCT person_id do from_stage para o to_stage. Skipa duplicatas."""
    source = db.execute(
        text("""
            SELECT DISTINCT r.person_id, r.team_name
            FROM roster r
            WHERE r.stage_id = :from_s
            ORDER BY r.person_id
        """),
        {"from_s": from_stage_id},
    ).fetchall()

    existing = {
        row[0]
        for row in db.execute(
            text("SELECT person_id FROM roster WHERE stage_id = :s"),
            {"s": to_stage_id},
        ).fetchall()
    }

    to_insert = [row for row in source if row.person_id not in existing]

    for row in to_insert:
        if not dry_run:
            db.execute(
                text("""
                    INSERT INTO roster (stage_id, person_id, team_name, fantasy_cost, is_available)
                    VALUES (:stage_id, :person_id, :team_name, 15.00, true)
                """),
                {
                    "stage_id":  to_stage_id,
                    "person_id": row.person_id,
                    "team_name": row.team_name,
                },
            )

    return len(to_insert)


def remove_pending_never_played(db, stage_id: int, dry_run: bool) -> int:
    """
    Remove do stage os jogadores que:
      - têm account_id PENDING_ (nunca tiveram account real)
      - nunca apareceram em nenhuma match_stat
    """
    rows = db.execute(
        text("""
            SELECT r.id, r.person_id, p.display_name, pa.account_id
            FROM roster r
            JOIN person p ON p.id = r.person_id
            LEFT JOIN player_account pa
                ON pa.person_id = p.id
                AND pa.shard = 'pc-tournament'
                AND pa.active_until IS NULL
            WHERE r.stage_id = :stage_id
              AND pa.account_id LIKE 'PENDING_%'
              AND NOT EXISTS (
                  SELECT 1 FROM match_stat ms WHERE ms.person_id = r.person_id
              )
        """),
        {"stage_id": stage_id},
    ).fetchall()

    for row in rows:
        print(f"    [REMOVE] {row.display_name}  (person_id={row.person_id}  acc={row.account_id})")
        if not dry_run:
            db.execute(
                text("DELETE FROM roster WHERE id = :id"),
                {"id": row.id},
            )

    return len(rows)


def run_pricing(db, stage_id: int, dry_run: bool) -> None:
    if dry_run:
        roster_count = db.execute(
            text("SELECT COUNT(*) FROM roster WHERE stage_id = :s AND is_available = true"),
            {"s": stage_id},
        ).scalar()
        print(f"  [DRY] Pricing rodaria para {roster_count} jogadores ativos")
        return

    result = calculate_stage_pricing(stage_id, db)
    print(
        f"  updated={result['updated']}"
        f"  skipped={result['skipped']}"
        f"  newcomers={result['newcomers']}"
    )


def open_stage(db, stage_id: int, dry_run: bool) -> None:
    stage = db.get(Stage, stage_id)
    if not stage:
        print(f"  [ERRO] Stage {stage_id} não encontrada")
        return
    old = stage.lineup_status
    if not dry_run:
        stage.lineup_status = "open"
    print(f"  Stage {stage_id} ({stage.short_name}): {old!r} → 'open'")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Transição entre dias de competição")
    parser.add_argument("--from-stage",       type=int, required=True, help="Stage do dia atual (fonte do roster)")
    parser.add_argument("--to-stage",         type=int, required=True, help="Stage do próximo dia (destino)")
    parser.add_argument("--expected-matches", type=int, default=0,     help="Qtd esperada de matches no dia atual (0 = não verifica)")
    parser.add_argument("--commit",           action="store_true",     help="Gravar no banco (padrão: dry-run)")
    args = parser.parse_args()

    dry_run = not args.commit
    mode = "[DRY-RUN]" if dry_run else "[COMMIT]"
    print(f"\n{mode} from-stage={args.from_stage} → to-stage={args.to_stage}")
    if dry_run:
        print("  Nenhuma alteração será gravada. Use --commit para gravar.\n")

    db = SessionLocal()
    try:
        # 1. Estado inicial
        print("=== Estado inicial ===")
        show_stage(db, args.from_stage, "from-stage")
        show_stage(db, args.to_stage,   "to-stage  ")

        # 2. Verificar contagem de matches (opcional)
        if args.expected_matches > 0:
            print("\n=== Verificando matches do dia ===")
            ok = check_match_count(db, args.from_stage, args.expected_matches)
            if not ok and not dry_run:
                print("  Abortando — matches insuficientes. Passe --expected-matches 0 para forçar.")
                return

        # 3. Copiar roster
        print(f"\n=== Copiando roster (stage {args.from_stage} → {args.to_stage}) ===")
        copied = copy_roster(db, args.from_stage, args.to_stage, dry_run)
        verb = "seriam" if dry_run else "foram"
        print(f"  {copied} entrada(s) {verb} inseridas")

        # 4. Remover pendentes sem histórico
        print(f"\n=== Removendo PENDING_ sem partidas (stage {args.to_stage}) ===")
        removed = remove_pending_never_played(db, args.to_stage, dry_run)
        if removed == 0:
            print("  Nenhum para remover")
        else:
            print(f"  {removed} entrada(s) {verb} removidas")

        # 5. Pricing
        print(f"\n=== Calculando pricing (stage {args.to_stage}) ===")
        run_pricing(db, args.to_stage, dry_run)

        # 6. Abrir stage
        print(f"\n=== Abrindo stage {args.to_stage} ===")
        open_stage(db, args.to_stage, dry_run)

        # 7. Commit ou rollback
        if not dry_run:
            db.commit()
            print("\n[OK] Commit realizado.")
        else:
            db.rollback()

        # 8. Estado final
        print("\n=== Estado final ===")
        show_stage(db, args.from_stage, "from-stage")
        show_stage(db, args.to_stage,   "to-stage  ")

        if dry_run:
            print("\n[DRY-RUN] Nenhuma alteração foi gravada.")

    except Exception as ex:
        db.rollback()
        print(f"\n[ERRO] {ex}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
