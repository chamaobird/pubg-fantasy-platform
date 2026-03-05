"""
Seed script — run once after migrations:
    python scripts/seed.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv()

from app.database import SessionLocal
from app.models import Player, Team, Tournament, ScoringRule, User
from app.core.security import hash_password

db = SessionLocal()

# ── Teams ────────────────────────────────────────────────────────────────────
teams_data = [
    {"name": "Twisted Minds", "region": "MENA", "logo_url": "https://example.com/logos/twisted_minds.png"},
    {"name": "Natus Vincere", "region": "EMEA", "logo_url": "https://example.com/logos/navi.png"},
    {"name": "TSM",           "region": "Americas", "logo_url": "https://example.com/logos/tsm.png"},
]

teams = {}
for t in teams_data:
    obj = db.query(Team).filter(Team.name == t["name"]).first() or Team(**t)
    db.add(obj)
    db.flush()
    teams[t["name"]] = obj

# ── Players (4 per team) ─────────────────────────────────────────────────────
players_data = [
    # Twisted Minds
    {"name": "NikoS",   "team": "Twisted Minds", "role": "fragger",  "price": 28.5},
    {"name": "Mido",    "team": "Twisted Minds", "role": "IGL",      "price": 22.0},
    {"name": "Shadow",  "team": "Twisted Minds", "role": "support",  "price": 18.0},
    {"name": "Kratos",  "team": "Twisted Minds", "role": "fragger",  "price": 24.0},
    # Natus Vincere
    {"name": "Ubah",    "team": "Natus Vincere", "role": "fragger",  "price": 30.0},
    {"name": "Ryzen",   "team": "Natus Vincere", "role": "IGL",      "price": 25.0},
    {"name": "Keitos",  "team": "Natus Vincere", "role": "support",  "price": 16.0},
    {"name": "Flash",   "team": "Natus Vincere", "role": "fragger",  "price": 20.0},
    # TSM
    {"name": "Pio",     "team": "TSM",           "role": "IGL",      "price": 23.0},
    {"name": "Ztyle",   "team": "TSM",           "role": "fragger",  "price": 27.0},
    {"name": "Chappie", "team": "TSM",           "role": "support",  "price": 15.0},
    {"name": "Ibiza",   "team": "TSM",           "role": "fragger",  "price": 21.0},
]

for p in players_data:
    team_obj = teams[p["team"]]
    existing = db.query(Player).filter(Player.name == p["name"], Player.team_id == team_obj.id).first()
    if not existing:
        db.add(Player(name=p["name"], team_id=team_obj.id, role=p["role"], price=p["price"]))

# ── Tournament ───────────────────────────────────────────────────────────────
tourney = db.query(Tournament).filter(Tournament.name == "PUBG Americas Series S1").first()
if not tourney:
    tourney = Tournament(
        name="PUBG Americas Series S1",
        region="Americas",
        type="official",
        status="active",
        budget_limit=100.0,
    )
    db.add(tourney)
    db.flush()

    rule = ScoringRule(
        tournament_id=tourney.id,
        kill_points=15.0,
        damage_per_100=5.0,
        survival_points=1.0,
        early_death_penalty=-5.0,
        placement_multiplier_json='{"1": 1.5, "2": 1.3, "3": 1.1, "4-10": 1.0, "11+": 0.8}',
    )
    db.add(rule)

# ── Admin user ───────────────────────────────────────────────────────────────
admin = db.query(User).filter(User.email == "admin@pubgfantasy.gg").first()
if not admin:
    db.add(User(
        username="admin",
        email="admin@pubgfantasy.gg",
        hashed_password=hash_password("changeme123"),
        is_admin=True,
    ))

db.commit()
print("✅ Seed complete — 3 teams, 12 players, 1 tournament, 1 admin user")
db.close()
