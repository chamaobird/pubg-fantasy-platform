"""
populate_pas1_playoffs.py
Popula Championship, Stages, StageDays, Persons, PlayerAccounts e Rosters
do PAS1 Playoffs 1.

Uso:
  $env:DATABASE_URL="postgresql://..."
  python scripts/pubg/populate_pas1_playoffs.py --dry-run
  python scripts/pubg/populate_pas1_playoffs.py
"""

import os, sys, argparse
from decimal import Decimal
from datetime import date

try:
    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import Session
except ImportError:
    sys.exit("pip install sqlalchemy psycopg2-binary")

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    sys.exit("Defina DATABASE_URL antes de rodar")

parser = argparse.ArgumentParser()
parser.add_argument("--dry-run", action="store_true")
args = parser.parse_args()
DRY = args.dry_run

# ── CONFIGURAÇÃO ─────────────────────────────────────────────────────────────

CHAMPIONSHIP_NAME  = "PUBG Americas Series 1 2026 - Playoffs 1"
CHAMPIONSHIP_SHORT = "PAS1 PO1"
TIER_WEIGHT        = Decimal("0.85")
SHARD              = "steam"   # Alterar para "pc-tournament" se necessário

STAGE_DAYS = [
    {"name": "Playoffs 1 - Dia 1", "short": "PO1-D1", "date": date(2026, 4, 17), "day_number": 1},
    {"name": "Playoffs 1 - Dia 2", "short": "PO1-D2", "date": date(2026, 4, 18), "day_number": 2},
    {"name": "Playoffs 1 - Dia 3", "short": "PO1-D3", "date": date(2026, 4, 19), "day_number": 3},
]

PRICE = {
    "high": Decimal("33.00"),
    "mid":  Decimal("28.00"),
    "open": Decimal("18.00"),
}
PRICE_MIN      = Decimal("12.00")
PRICE_MAX      = Decimal("35.00")
PRICE_NEWCOMER = Decimal("15.00")

DAY1_TEAMS = {
    "55 e-Sports", "Athletes of Christ", "BESTIA", "Copenhagen Wolves",
    "DUEL", "EUFAREIX10", "FURIA", "Last Breath",
    "Newgen Allstars", "No Way", "Pest Control", "ROC Esports",
    "Team Falcons", "Team Liquid", "TOYO Esports", "What It Takes",
}

ROSTER = {
    "55 e-Sports": {
        "tag": "55PD", "tier": "mid", "players": [
            {"name": "KerakTMz",    "account_id": "account.71ccdb72a45149a1b1f28404045197d3"},
            {"name": "glock77",     "account_id": None},
            {"name": "gabriehw",    "account_id": "account.3909912f84474b4386e8725b5e6f9568"},
            {"name": "OhNytavoN",   "account_id": "account.860d86d8194f4b1fa724cacadaf481c9"},
        ]
    },
    "FURIA": {
        "tag": "FUR", "tier": "high", "players": [
            {"name": "Dr4FTk1NG",   "account_id": None},
            {"name": "bielmtcalmo", "account_id": None},
            {"name": "zKraken",     "account_id": None},
            {"name": "possa",       "account_id": None},
        ]
    },
    "TOYO Esports": {
        "tag": "TOYO", "tier": "mid", "players": [
            {"name": "Capitan",    "account_id": None},
            {"name": "Emi",        "account_id": None},
            {"name": "soldzzzz93", "account_id": "account.2d0d5b6a122b47e7ba347dfe0730e459"},
            {"name": "Fakezin77",  "account_id": None},
        ]
    },
    "ROC Esports": {
        "tag": "ROC", "tier": "mid", "players": [
            {"name": "rbN777",     "account_id": None},
            {"name": "sparkingg",  "account_id": None},
            {"name": "cauan7zin",  "account_id": None},
            {"name": "sxntastico", "account_id": None},
        ]
    },
    "Team Falcons": {
        "tag": "FLCN", "tier": "high", "players": [
            {"name": "Shrimzy",   "account_id": None},
            {"name": "hwinn",     "account_id": None},
            {"name": "Kickstart", "account_id": None},
            {"name": "TGLTN",     "account_id": None},
        ]
    },
    "BESTIA": {
        "tag": "BST", "tier": "mid", "players": [
            {"name": "PIPAA",       "account_id": None},
            {"name": "FROGMAN1",    "account_id": None},
            {"name": "beNjAkaponi", "account_id": None},
            {"name": "v1n1zxz",     "account_id": None},
        ]
    },
    "Copenhagen Wolves": {
        "tag": "WOLF", "tier": "mid", "players": [
            {"name": "SAyFoo",  "account_id": None},
            {"name": "Vox",     "account_id": None},
            {"name": "Snakers", "account_id": None},
            {"name": "Fludd",   "account_id": None},
        ]
    },
    "Team Liquid": {
        "tag": "TL", "tier": "high", "players": [
            {"name": "PurdyKurty", "account_id": None},
            {"name": "aLOW",       "account_id": None},
            {"name": "luke12",     "account_id": None},
            {"name": "CowBoi",     "account_id": None},
        ]
    },
    "Athletes of Christ": {
        "tag": "FE", "tier": "open", "players": [
            {"name": "lfp1s2A", "account_id": "account.65b3300cccc04d42abaefd346de1b565"},
            {"name": "fanafps", "account_id": "account.2eb1a24799c24f029cd2069ef6863d53"},
            {"name": "Tny7_",   "account_id": "account.d8ef6c0370f84fd390fc93e79175933f"},
            {"name": "Haven_-", "account_id": None},
        ]
    },
    "No Way": {
        "tag": "NW", "tier": "open", "players": [
            {"name": "dnL1_",         "account_id": "account.9a5fb3c1fadd470da7772d37203f3d4b"},
            {"name": "DuduGladiador", "account_id": "account.b2f73629c0984b30800601d557e490c4"},
            {"name": "slabyy-_",      "account_id": "account.bd687f002f584467a99cf3b885bc2681"},
            {"name": "ZxLopes",       "account_id": "account.95eea9c45ea64e67b163fbdbb2cc24ea"},
        ]
    },
    "Last Breath": {
        "tag": "LB", "tier": "open", "players": [
            {"name": "danitw",  "account_id": "account.3235d4d11bfb4751b88e6d9af2a28584"},
            {"name": "AleeRv",  "account_id": None},
            {"name": "Blazr",   "account_id": None},
            {"name": "andriu-", "account_id": None},
        ]
    },
    "EUFAREIX10": {
        "tag": "X10", "tier": "open", "players": [
            {"name": "FranXzz",    "account_id": "account.2a78a134890d49058fd410d84a2dfe71"},
            {"name": "Sukehiro--", "account_id": "account.d6d364bcdfea493180d6969784b1f21a"},
            {"name": "San71Hero1", "account_id": None},
            {"name": "Kalniixx",   "account_id": "account.953017e85d8341ba9c7c1d59c6f87ad9"},
        ]
    },
    "Pest Control": {
        "tag": "PEST", "tier": "open", "players": [
            {"name": "conf2031",   "account_id": "account.3bd28c29f0e74f808acf01cb4b34280a"},
            {"name": "Kaymind",    "account_id": "account.b449a56bc9b341cb9e0517c68330600e"},
            {"name": "HotNSpicy-", "account_id": "account.4efe3d4fd2b945c1a9887d62c7a8a77f"},
            {"name": "JoShY-_-",   "account_id": "account.8b6f12191ab543139bcdf5b1ad0dafa9"},
        ]
    },
    "Dream One": {
        "tag": "ONE", "tier": "open", "players": [
            {"name": "XH44444",  "account_id": "account.bc0f906813264836884987ec21acc50a"},
            {"name": "LiiPeeXx", "account_id": "account.28747c0c1b504265b383aeda7030b4b5"},
            {"name": "krizzen",  "account_id": None},
            {"name": "vps1-",    "account_id": "account.1b76952774f64e5198a9d8c77d260f42"},
        ]
    },
    "Tempest": {
        "tag": "TMP", "tier": "open", "players": [
            {"name": "K1lawi",  "account_id": None},
            {"name": "ASMR",    "account_id": None},
            {"name": "Palecks", "account_id": None},
            {"name": "abdou",   "account_id": None},
        ]
    },
    "What It Takes": {
        "tag": "WIT", "tier": "open", "players": [
            {"name": "Maurnzz",     "account_id": None},
            {"name": "SneakAttack", "account_id": None},
            {"name": "enzito_",     "account_id": None},
            {"name": "Luciid_oO",   "account_id": None},
        ]
    },
    "Injected": {
        "tag": "INJ", "tier": "open", "players": [
            {"name": "Choppy-_-",  "account_id": None},
            {"name": "Stokeley",   "account_id": None},
            {"name": "s1mplicityy","account_id": "account.5ac0a156802e4c7ab5a1139651f75dc2"},
            {"name": "Ty-n0ngluv", "account_id": "account.0f2bda72f3d64583a78c732245bf72e7"},
        ]
    },
    "Newgen Allstars": {
        "tag": "NA", "tier": "open", "players": [
            {"name": "Poonage",        "account_id": None},
            {"name": "xxxxxxxxxppppp", "account_id": None},
            {"name": "Shinboi",        "account_id": None},
            {"name": "f1nna-",         "account_id": None},
        ]
    },
    "Chupinsky s": {
        "tag": "INSK", "tier": "open", "players": [
            {"name": "Luizeer4",  "account_id": "account.28f8bd1c5519497fa6a481432f8e6161"},
            {"name": "tuuruuruu", "account_id": "account.5a7726a9b06d41cba3331f839d475b20"},
            {"name": "Gabudo",    "account_id": None},
            {"name": "Oracle_",   "account_id": None},
        ]
    },
    "For Nothing": {
        "tag": "FN", "tier": "open", "players": [
            {"name": "sweezy",   "account_id": None},
            {"name": "M4UR1L1O", "account_id": None},
            {"name": "Liel",     "account_id": None},
            {"name": "gmoo-",    "account_id": None},
        ]
    },
    "RENT FREE": {
        "tag": "FR", "tier": "open", "players": [
            {"name": "Walkerwoman",    "account_id": None},
            {"name": "J4M_d-_-b",      "account_id": "account.a0a1785b15fc44b989bb2281455953e0"},
            {"name": "HoneyBadger-_-", "account_id": "account.60aa9df901a0455dbbba3afe8188fe8b"},
            {"name": "BLZZLER",        "account_id": None},
        ]
    },
    "Collector": {
        "tag": "CLR", "tier": "open", "players": [
            {"name": "DarkDreamzz", "account_id": "account.867d8f818fc34d6d9ffaa9315274f8bb"},
            {"name": "4EARTH-",     "account_id": "account.32d61e3e99ab4c009f1fd9cdcaca82e5"},
            {"name": "HazzL_",      "account_id": "account.86f77d8b042044dd90d9e6732ed441df"},
            {"name": "RedRyderNA",  "account_id": "account.1ac37fb70b184d3092526684e7f6bfbb"},
        ]
    },
    "DUEL": {
        "tag": "DUEL", "tier": "open", "players": [
            {"name": "pentalol", "account_id": None},
            {"name": "Iroh",     "account_id": None},
            {"name": "Kein",     "account_id": None},
            {"name": "Woo1y",    "account_id": None},
        ]
    },
    "DOTS": {
        "tag": "DOTS", "tier": "open", "players": [
            {"name": "shane_doe",  "account_id": None},
            {"name": "sKZ974",     "account_id": None},
            {"name": "TheSpectro", "account_id": None},
            {"name": "M1anHuala-", "account_id": None},
        ]
    },
    "Team FATE": {
        "tag": "FATE", "tier": "open", "players": [
            {"name": "TATER-_-", "account_id": None},
            {"name": "xennny-",  "account_id": "account.7e11ac0260d640838e250e822970d842"},
            {"name": "Myo0",     "account_id": "account.91d1788893d34119b7bee3e9f7d8d265"},
            {"name": "TimFee",   "account_id": "account.d16223ae72f44094ae4f2051e4aea539"},
        ]
    },
    "IAM BOLIVIA": {
        "tag": "BO", "tier": "open", "players": [
            {"name": "4DR",      "account_id": None},
            {"name": "Neyzhera", "account_id": "account.4ed660fa77d54ee188209daef1385056"},
            {"name": "C4MB4",    "account_id": "account.1905ea08faaa4f7a9e1a095aac5dec3f"},
            {"name": "V-I-R-I",  "account_id": "account.bd26bdb3f541484188f0d024c69d3e3a"},
        ]
    },
    "Affinity": {
        "tag": "AFi", "tier": "open", "players": [
            {"name": "Mizbo",   "account_id": "account.2c66edc52eb1437ea7be2f6f91c5d957"},
            {"name": "NDucky-", "account_id": "account.f622ce41c43348c68e5a8c2cd52134c5"},
            {"name": "gh0wst",  "account_id": None},
            {"name": "Zalody",  "account_id": None},
        ]
    },
}

# ── HELPERS ──────────────────────────────────────────────────────────────────

def log(msg): print(msg)

def get_or_create_person(session, display_name):
    row = session.execute(
        text("SELECT id FROM person WHERE display_name = :n"),
        {"n": display_name}
    ).fetchone()
    if row:
        log(f"  [PERSON] exists: {display_name} (id={row[0]})")
        return row[0]
    if DRY:
        log(f"  [PERSON] would create: {display_name}")
        return -1
    r = session.execute(
        text("INSERT INTO person (display_name, is_active) VALUES (:n, true) RETURNING id"),
        {"n": display_name}
    )
    pid = r.fetchone()[0]
    log(f"  [PERSON] created: {display_name} (id={pid})")
    return pid

def get_or_create_player_account(session, person_id, alias, account_id):
    # Busca por account_id confirmado (ignora placeholders pending_*)
    if account_id and not account_id.startswith("pending_"):
        row = session.execute(
            text("SELECT id FROM player_account WHERE account_id = :aid"),
            {"aid": account_id}
        ).fetchone()
        if row:
            log(f"    [ACCOUNT] exists by account_id: {alias}")
            return row[0]
    # Busca por person_id + alias
    row = session.execute(
        text("SELECT id FROM player_account WHERE person_id = :p AND alias = :a"),
        {"p": person_id, "a": alias}
    ).fetchone()
    if row:
        log(f"    [ACCOUNT] exists by alias: {alias}")
        return row[0]
    # Usa placeholder quando account_id não confirmado — atualize depois com manage_player_accounts.py set-account-id
    effective_account_id = account_id if account_id else f"pending_{alias}"
    if DRY:
        log(f"    [ACCOUNT] would create: alias={alias} account_id={account_id or 'PENDING'}")
        return -1
    r = session.execute(
        text("""
            INSERT INTO player_account (person_id, shard, alias, account_id)
            VALUES (:p, :sh, :a, :aid)
            RETURNING id
        """),
        {"p": person_id, "sh": SHARD, "a": alias, "aid": effective_account_id}
    )
    aid = r.fetchone()[0]
    log(f"    [ACCOUNT] created: {alias} (id={aid})")
    return aid

def get_or_create_roster(session, person_id, stage_id, team_name, cost):
    if person_id < 0 or not stage_id:
        log(f"    [ROSTER] skipped (dry run)")
        return
    row = session.execute(
        text("SELECT id FROM roster WHERE person_id = :p AND stage_id = :s"),
        {"p": person_id, "s": stage_id}
    ).fetchone()
    if row:
        log(f"    [ROSTER] exists (id={row[0]})")
        return
    if DRY:
        log(f"    [ROSTER] would create team={team_name} cost={cost}")
        return
    r = session.execute(
        text("""
            INSERT INTO roster (person_id, stage_id, team_name, fantasy_cost, is_available)
            VALUES (:p, :s, :t, :c, true)
            RETURNING id
        """),
        {"p": person_id, "s": stage_id, "t": team_name, "c": cost}
    )
    log(f"    [ROSTER] created (id={r.fetchone()[0]})")

# ── MAIN ─────────────────────────────────────────────────────────────────────

engine = create_engine(DATABASE_URL)

with Session(engine) as session:

    # 1. Championship
    log("\n=== CHAMPIONSHIP ===")
    row = session.execute(
        text("SELECT id FROM championship WHERE name = :n"),
        {"n": CHAMPIONSHIP_NAME}
    ).fetchone()
    if row:
        champ_id = row[0]
        log(f"Championship existe (id={champ_id})")
    elif DRY:
        log(f"[DRY] would create: {CHAMPIONSHIP_NAME}")
        champ_id = None
    else:
        r = session.execute(
            text("""
                INSERT INTO championship (name, short_name, shard, tier_weight, is_active)
                VALUES (:n, :sn, :sh, :tw, true) RETURNING id
            """),
            {"n": CHAMPIONSHIP_NAME, "sn": CHAMPIONSHIP_SHORT, "sh": SHARD, "tw": TIER_WEIGHT}
        )
        champ_id = r.fetchone()[0]
        log(f"Championship criado (id={champ_id})")

    # 2. Stages + StageDays
    log("\n=== STAGES ===")
    stage_ids = []
    for sd in STAGE_DAYS:
        row = session.execute(
            text("SELECT id FROM stage WHERE name = :n AND championship_id = :c"),
            {"n": sd["name"], "c": champ_id}
        ).fetchone() if champ_id else None

        if row:
            sid = row[0]
            log(f"Stage existe: {sd['name']} (id={sid})")
        elif DRY:
            log(f"[DRY] would create stage: {sd['name']}")
            sid = None
        else:
            r = session.execute(
                text("""
                    INSERT INTO stage (
                        championship_id, name, short_name, shard,
                        price_min, price_max, pricing_newcomer_cost,
                        lineup_status, is_active
                    )
                    VALUES (:c, :n, :sn, :sh, :pmin, :pmax, :pnew, 'closed', true)
                    RETURNING id
                """),
                {
                    "c": champ_id, "n": sd["name"], "sn": sd["short"], "sh": SHARD,
                    "pmin": PRICE_MIN, "pmax": PRICE_MAX, "pnew": PRICE_NEWCOMER
                }
            )
            sid = r.fetchone()[0]
            log(f"Stage criada: {sd['name']} (id={sid})")

        # StageDay
        if sid:
            drow = session.execute(
                text("SELECT id FROM stage_day WHERE stage_id = :s AND date = :d"),
                {"s": sid, "d": sd["date"]}
            ).fetchone()
            if not drow:
                if DRY:
                    log(f"  [DRY] would create stage_day: {sd['date']}")
                else:
                    session.execute(
                        text("""
                            INSERT INTO stage_day (stage_id, date, day_number)
                            VALUES (:s, :d, :dn)
                        """),
                        {"s": sid, "d": sd["date"], "dn": sd["day_number"]}
                    )
                    log(f"  StageDay criado: {sd['date']}")

        stage_ids.append(sid)

    stage_day1_id = stage_ids[0] if stage_ids else None

    # 3. Persons + Accounts + Rosters
    log("\n=== PERSONS / ACCOUNTS / ROSTERS ===")
    for team_name, tdata in ROSTER.items():
        in_day1 = team_name in DAY1_TEAMS
        cost = PRICE[tdata["tier"]]
        log(f"\n[ {team_name} | {tdata['tag']} | tier={tdata['tier']} | day1={in_day1} ]")

        for p in tdata["players"]:
            log(f"  {p['name']}")
            person_id = get_or_create_person(session, p["name"])
            get_or_create_player_account(session, person_id, p["name"], p["account_id"])
            if in_day1:
                get_or_create_roster(session, person_id, stage_day1_id, team_name, cost)

    if not DRY:
        session.commit()
        log("\n✅ Commit realizado!")
    else:
        log("\n[DRY RUN] Nenhuma alteração feita.")
