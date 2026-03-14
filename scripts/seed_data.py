#!/usr/bin/env python3
"""
scripts/seed_data.py

Popula o banco de dados com dados de exemplo para testes locais.
Útil quando a PUBG API não retorna torneios (ex: sem API key válida).

Uso:
    # A partir da raiz do projeto:
    python scripts/seed_data.py

    # Ou com variáveis de ambiente customizadas:
    DATABASE_URL=postgresql://... python scripts/seed_data.py

Dados criados:
    - 3 torneios regionais (NA, EU, AS)
    - 20 jogadores com stats realistas de PUBG
    - 1 usuário admin (admin@warzone.gg / admin123)
"""

import sys
import os
from datetime import datetime, timedelta

# Garante que o módulo app seja encontrado ao rodar da raiz
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.orm import Session
from app.database import engine, Base, SessionLocal
from app.models import Tournament, Player, User
from app.services.pubg_api import calculate_fantasy_cost

# Cria tabelas se não existirem
Base.metadata.create_all(bind=engine)


# ------------------------------------------------------------------
# DADOS DE SEED
# ------------------------------------------------------------------

TOURNAMENTS_SEED = [
    {
        "name": "PUBG Global Championship 2024 - Europe",
        "pubg_id": "pgc2024-eu-qualifier",
        "region": "EU",
        "start_date": datetime.utcnow() - timedelta(days=3),
        "end_date": datetime.utcnow() + timedelta(days=18),
        "status": "active",
        "max_teams": 16,
    },
    {
        "name": "PUBG Global Championship 2024 - North America",
        "pubg_id": "pgc2024-na-qualifier",
        "region": "NA",
        "start_date": datetime.utcnow() - timedelta(days=7),
        "end_date": datetime.utcnow() + timedelta(days=14),
        "status": "active",
        "max_teams": 16,
    },
    {
        "name": "PUBG Global Championship 2024 - Asia",
        "pubg_id": "pgc2024-as-qualifier",
        "region": "AS",
        "start_date": datetime.utcnow() + timedelta(days=5),
        "end_date": datetime.utcnow() + timedelta(days=26),
        "status": "upcoming",
        "max_teams": 20,
    },
]

# 20 jogadores com stats realistas de PUBG competitivo
PLAYERS_SEED = [
    # ── NA Players ──────────────────────────────────────────────────
    {
        "name": "iBUYPOWER_Miccoy",
        "pubg_id": "account.na001",
        "region": "NA",
        "avg_kills": 5.2, "avg_damage": 380.0, "avg_placement": 4.1,
        "matches_played": 24, "position": "IGL",
    },
    {
        "name": "Shoot2Kill_Paraboy",
        "pubg_id": "account.na002",
        "region": "NA",
        "avg_kills": 6.8, "avg_damage": 450.0, "avg_placement": 5.5,
        "matches_played": 22, "position": "Fragger",
    },
    {
        "name": "Oath_Hayz",
        "pubg_id": "account.na003",
        "region": "NA",
        "avg_kills": 3.9, "avg_damage": 310.0, "avg_placement": 3.2,
        "matches_played": 20, "position": "Support",
    },
    {
        "name": "TSM_Viss",
        "pubg_id": "account.na004",
        "region": "NA",
        "avg_kills": 4.5, "avg_damage": 295.0, "avg_placement": 6.8,
        "matches_played": 18, "position": "Sniper",
    },
    {
        "name": "NRG_Raven",
        "pubg_id": "account.na005",
        "region": "NA",
        "avg_kills": 2.8, "avg_damage": 220.0, "avg_placement": 8.3,
        "matches_played": 21, "position": "Support",
    },
    # ── EU Players ──────────────────────────────────────────────────
    {
        "name": "Natus_Vincere_Ubah",
        "pubg_id": "account.eu001",
        "region": "EU",
        "avg_kills": 7.1, "avg_damage": 510.0, "avg_placement": 3.8,
        "matches_played": 26, "position": "Fragger",
    },
    {
        "name": "FaZe_Destro",
        "pubg_id": "account.eu002",
        "region": "EU",
        "avg_kills": 5.6, "avg_damage": 420.0, "avg_placement": 4.5,
        "matches_played": 24, "position": "IGL",
    },
    {
        "name": "G2_Jeemzz",
        "pubg_id": "account.eu003",
        "region": "EU",
        "avg_kills": 4.2, "avg_damage": 350.0, "avg_placement": 5.0,
        "matches_played": 23, "position": "Fragger",
    },
    {
        "name": "Liquid_Pio",
        "pubg_id": "account.eu004",
        "region": "EU",
        "avg_kills": 3.5, "avg_damage": 280.0, "avg_placement": 7.2,
        "matches_played": 19, "position": "Sniper",
    },
    {
        "name": "PENTA_Sezk0",
        "pubg_id": "account.eu005",
        "region": "EU",
        "avg_kills": 2.9, "avg_damage": 240.0, "avg_placement": 9.1,
        "matches_played": 20, "position": "Support",
    },

    # ── EU Cheap Players (para testar lineup + reserva dentro do budget) ──────
    {
        "name": "EU_Budget_Anchor_5",
        "pubg_id": "account.eu101",
        "region": "EU",
        "avg_kills": 0.5,
        "avg_damage": 50.0,
        "avg_placement": 12.0,
        "matches_played": 10,
        "position": "Support",
        "fantasy_cost": 5.0,
    },
    {
        "name": "EU_Budget_Anchor_8",
        "pubg_id": "account.eu102",
        "region": "EU",
        "avg_kills": 0.8,
        "avg_damage": 80.0,
        "avg_placement": 10.0,
        "matches_played": 10,
        "position": "Support",
        "fantasy_cost": 8.0,
    },
    {
        "name": "EU_Budget_Anchor_10",
        "pubg_id": "account.eu103",
        "region": "EU",
        "avg_kills": 1.0,
        "avg_damage": 100.0,
        "avg_placement": 9.5,
        "matches_played": 10,
        "position": "IGL",
        "fantasy_cost": 10.0,
    },
    {
        "name": "EU_Budget_Anchor_12",
        "pubg_id": "account.eu104",
        "region": "EU",
        "avg_kills": 1.2,
        "avg_damage": 120.0,
        "avg_placement": 9.0,
        "matches_played": 10,
        "position": "Sniper",
        "fantasy_cost": 12.0,
    },
    {
        "name": "EU_Budget_Anchor_15",
        "pubg_id": "account.eu105",
        "region": "EU",
        "avg_kills": 1.6,
        "avg_damage": 150.0,
        "avg_placement": 8.0,
        "matches_played": 10,
        "position": "Fragger",
        "fantasy_cost": 15.0,
    },
    # ── AS Players ──────────────────────────────────────────────────
    {
        "name": "DX_Paraboy",
        "pubg_id": "account.as001",
        "region": "AS",
        "avg_kills": 8.3, "avg_damage": 580.0, "avg_placement": 2.9,
        "matches_played": 28, "position": "Fragger",
    },
    {
        "name": "17Gaming_Suk",
        "pubg_id": "account.as002",
        "region": "AS",
        "avg_kills": 6.4, "avg_damage": 490.0, "avg_placement": 3.5,
        "matches_played": 27, "position": "Fragger",
    },
    {
        "name": "Tianba_Yoyo",
        "pubg_id": "account.as003",
        "region": "AS",
        "avg_kills": 5.0, "avg_damage": 400.0, "avg_placement": 4.0,
        "matches_played": 25, "position": "IGL",
    },
    {
        "name": "Nova_XQF_Lc",
        "pubg_id": "account.as004",
        "region": "AS",
        "avg_kills": 4.8, "avg_damage": 370.0, "avg_placement": 4.7,
        "matches_played": 24, "position": "Sniper",
    },
    {
        "name": "Four_Angry_Men_Shen",
        "pubg_id": "account.as005",
        "region": "AS",
        "avg_kills": 3.3, "avg_damage": 260.0, "avg_placement": 6.5,
        "matches_played": 22, "position": "Support",
    },
    # ── SEA Players ─────────────────────────────────────────────────
    {
        "name": "Box_Gaming_BBF",
        "pubg_id": "account.sea001",
        "region": "SEA",
        "avg_kills": 5.5, "avg_damage": 415.0, "avg_placement": 4.3,
        "matches_played": 21, "position": "Fragger",
    },
    {
        "name": "GPX_Danawa_Jinmu",
        "pubg_id": "account.sea002",
        "region": "SEA",
        "avg_kills": 4.7, "avg_damage": 360.0, "avg_placement": 5.8,
        "matches_played": 20, "position": "IGL",
    },
    {
        "name": "MAD_Owlette",
        "pubg_id": "account.sea003",
        "region": "SEA",
        "avg_kills": 3.1, "avg_damage": 250.0, "avg_placement": 7.5,
        "matches_played": 18, "position": "Support",
    },
    {
        "name": "Oasis_Gaming_Dobrojan",
        "pubg_id": "account.sa001",
        "region": "SA",
        "avg_kills": 4.0, "avg_damage": 300.0, "avg_placement": 6.0,
        "matches_played": 17, "position": "Fragger",
    },
    {
        "name": "INTZ_Rass",
        "pubg_id": "account.sa002",
        "region": "SA",
        "avg_kills": 3.7, "avg_damage": 275.0, "avg_placement": 7.0,
        "matches_played": 16, "position": "Sniper",
    },
]


# ------------------------------------------------------------------
# FUNÇÕES DE SEED
# ------------------------------------------------------------------

def seed_tournaments(db: Session) -> None:
    """Cria ou ignora os torneios de seed (idempotente)."""
    for t_data in TOURNAMENTS_SEED:
        existing = db.query(Tournament).filter(
            Tournament.pubg_id == t_data["pubg_id"]
        ).first()

        if existing:
            print(f"  [SKIP] Tournament já existe: {t_data['name']}")
        else:
            tournament = Tournament(**t_data)
            db.add(tournament)
            print(f"  [OK]   Tournament criado: {t_data['name']}")

    db.commit()


def seed_players(db: Session) -> None:
    """Cria ou ignora os jogadores de seed com fantasy_cost calculado."""
    tournaments = db.query(Tournament).all()
    tournaments_by_region = {t.region: t for t in tournaments if t.region}
    fallback_tournament = None
    for t in tournaments:
        if t.status == "active":
            fallback_tournament = t
            break
    if not fallback_tournament and tournaments:
        fallback_tournament = tournaments[0]

    for p_data in PLAYERS_SEED:
        existing = db.query(Player).filter(
            Player.pubg_id == p_data["pubg_id"]
        ).first()

        tournament = tournaments_by_region.get(p_data["region"], fallback_tournament)

        fantasy_cost = p_data.get("fantasy_cost")
        if fantasy_cost is None:
            fantasy_cost = calculate_fantasy_cost(
                avg_kills=p_data["avg_kills"],
                avg_damage=p_data["avg_damage"],
                avg_placement=p_data["avg_placement"],
            )

        if existing:
            changed = False
            expected_tournament_id = (tournament.id if tournament else None)
            if existing.tournament_id != expected_tournament_id:
                existing.tournament_id = expected_tournament_id
                changed = True

            if existing.region != p_data["region"]:
                existing.region = p_data["region"]
                changed = True

            if float(existing.fantasy_cost or 0.0) != float(fantasy_cost):
                existing.fantasy_cost = fantasy_cost
                changed = True

            if changed:
                print(
                    f"  [UPDATE] Player atualizado: {p_data['name']} "
                    f"(tournament_id={existing.tournament_id}, cost={fantasy_cost})"
                )
            else:
                print(f"  [SKIP] Player já existe: {p_data['name']} (cost={fantasy_cost})")
        else:
            player = Player(
                name=p_data["name"],
                pubg_id=p_data["pubg_id"],
                region=p_data["region"],
                tournament_id=(tournament.id if tournament else None),
                avg_kills=p_data["avg_kills"],
                avg_damage=p_data["avg_damage"],
                avg_placement=p_data["avg_placement"],
                matches_played=p_data["matches_played"],
                position=p_data["position"],
                fantasy_cost=fantasy_cost,
                last_synced_at=datetime.utcnow(),
            )
            db.add(player)
            print(f"  [OK]   Player criado: {p_data['name']} | cost={fantasy_cost}")

    db.commit()


def seed_admin_user(db: Session) -> None:
    """Cria usuário admin padrão para testes."""
    from app.core.security import hash_password

    existing = db.query(User).filter(User.email == "admin@warzone.gg").first()
    if existing:
        print("  [SKIP] Admin user já existe: admin@warzone.gg")
        return

    admin = User(
        email="admin@warzone.gg",
        username="admin",
        hashed_password=hash_password("admin123"),
        is_admin=True,
    )
    db.add(admin)
    db.commit()
    print("  [OK]   Admin user criado: admin@warzone.gg / admin123")


# ------------------------------------------------------------------
# MAIN
# ------------------------------------------------------------------

def main():
    print("=" * 60)
    print("  Warzone Fantasy — Seed Data Script")
    print("=" * 60)

    db: Session = SessionLocal()
    try:
        print("\n[1/3] Criando torneios...")
        seed_tournaments(db)

        print("\n[2/3] Criando jogadores...")
        seed_players(db)

        print("\n[3/3] Criando usuário admin...")
        seed_admin_user(db)

        print("\n" + "=" * 60)
        print("  Seed concluído com sucesso!")
        print("  Torneios: 3 | Jogadores: 20 | Admin: 1")
        print("=" * 60)

    except Exception as e:
        db.rollback()
        print(f"\n[ERRO] Seed falhou: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
