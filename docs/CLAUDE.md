# XAMA Fantasy — PUBG Fantasy Platform

Fantasy league for PUBG esports. Users pick pro players, earn points from real match stats, compete on leaderboards.

## RTK / Shell output (token saving)

- Sempre que precisar rodar comandos de terminal que geram muita saída (git status, git diff, logs, pytest etc.), use `rtk` na frente (ex.: `rtk git status`, `rtk git diff`).
- Ao mostrar resultados de comandos, prefira o output resumido do RTK em vez da saída completa do comando.
- Evite colar ou manter no contexto histórico saídas completas de testes ou logs; resuma em bullets.

## Stack

| Layer    | Tech                                        |
|----------|---------------------------------------------|
| Backend  | Python 3.12, FastAPI, SQLAlchemy 2.0 (sync) |
| Database | PostgreSQL 16, Alembic migrations           |
| Frontend | React 18, Vite 5, Tailwind CSS v4           |
| Auth     | JWT (bcrypt + SHA256 prehash), Google OAuth  |
| Deploy   | Render.com (Docker)                         |

## Project layout

```
app/
├── main.py                  # FastAPI app, CORS, router registration
├── database.py              # SQLAlchemy engine + SessionLocal + Base
├── dependencies.py          # JWT auth dependency (get_current_user, require_admin)
├── core/
│   ├── config.py            # Pydantic Settings from .env
│   ├── security.py          # Password hashing (bcrypt), JWT encode/decode
│   └── pricing.py           # Player pricing engine (pure functions)
├── models/                  # SQLAlchemy ORM — one model per file
├── schemas/                 # Pydantic request/response schemas
├── routers/                 # FastAPI route handlers
│   ├── users.py             # Auth (register, login, Google OAuth, profile)
│   ├── tournaments.py       # Tournament CRUD, lineups, leaderboards
│   ├── players.py           # Player listing
│   ├── championships.py     # Championship management
│   ├── championship_phases.py
│   ├── historical.py        # Historical stats, match import
│   ├── admin.py             # Admin endpoints (large — 998 lines)
│   ├── admin_players.py     # Admin: bulk player ops
│   └── admin_pricing.py     # Admin: pricing preview & apply
└── services/                # Business logic
    ├── scoring.py           # Match point calculation (pure) + DB persistence
    ├── fantasy_scoring.py   # Captain 2x bonus
    ├── lineup_scoring.py    # Per-lineup per-match scoring
    ├── pubg_api.py          # PUBG API client wrapper
    ├── pubg_client.py       # Raw PUBG API HTTP calls
    ├── player_sync.py       # Bulk upsert players
    ├── historical.py        # Historical data import
    └── scheduler.py         # APScheduler background tasks

frontend/src/
├── App.jsx                  # React Router + auth context
├── main.jsx                 # Entry point
├── config.ts                # API_BASE_URL
├── api/                     # Axios client + service modules
├── context/AuthContext.jsx   # Auth state (JWT in localStorage)
├── pages/                   # Route pages (Dashboard, TournamentHub, etc.)
└── components/              # UI components (LineupBuilder, Leaderboard, etc.)

tests/                       # pytest — mirrors app/ structure
├── services/test_scoring.py
└── core/test_pricing.py
```

## Key models (database)

- **User** — auth, profile, `is_admin` flag
- **Tournament** — `pubg_id`, region, status, `lineup_open`, `current_day`, `budget_limit`
- **Team** — pro PUBG teams
- **Player** — `pubg_id`, `live_pubg_id` (Steam), `fantasy_cost`, `team_id`, `tournament_id`
- **Match** — `pubg_match_id`, `phase`, `day`, `group_label`
- **MatchPlayerStat** — per-player per-match stats + precalculated `fantasy_points`
- **Lineup** — user's player picks per tournament per day, captain + reserve
- **LineupScore** — cached per-lineup per-match score
- **PlayerScore** — league-scoped aggregation (player × league)
- **FantasyTeam / FantasyEntry** — legacy fantasy team system
- **Championship / ChampionshipTournament** — groups tournaments into phases

Player name convention: `TEAM_PlayerName` — split on `_` for team tag vs player name.

## Architecture patterns

### Pure functions for core logic

`scoring.py` and `pricing.py` export pure functions (no DB access) for calculation, with separate functions for persistence. This makes them easy to test and audit.

### Dependency injection for auth

All protected routes use FastAPI's `Depends()`:
```python
@router.get("/me")
def get_me(user: User = Depends(get_current_user)): ...

@router.post("/admin/...")
def admin_op(user: User = Depends(require_admin)): ...
```

### Scoring formula

```
points = kills×10 + assists×4 + damage×0.05 + PLACEMENT_TABLE[place]
         + survival_secs×0.01 + headshots×2 + knocks×1
```
Constants are at the top of `app/services/scoring.py`.

### Pricing formula

Weighted pts/match across tournament phases → linear normalization to [12, 35] credit range. Modes: day-zero (flat 25), pre-Grand Final, intra-Grand Final. See `app/core/pricing.py`.

## Running locally

```bash
# Backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # edit DATABASE_URL, SECRET_KEY
alembic upgrade head
python scripts/seed.py
uvicorn app.main:app --reload

# Frontend
cd frontend && npm install && npm run dev

# Tests
pip install pytest
pytest -v
```

## Testing

```bash
pytest tests/ -v                    # all tests
pytest tests/services/ -v           # scoring tests only
pytest tests/core/ -v               # pricing tests only
pytest -k "test_placement" -v       # run by keyword
```

Tests mirror the app structure: `tests/services/test_scoring.py` tests `app/services/scoring.py`, etc. Focus on pure functions first — no DB mocking needed.

## Conventions

- **Timezone**: BRT (UTC-3) for match dates
- **Player logos**: served from `frontend/public/logos/{team_tag}.png` (lowercase)
- **PUBG API shards**: `pc-tournament` for official events, `steam` for live server scrims
- **Migrations**: Alembic, always check if column exists before adding (idempotent)
- **Frontend auth**: JWT Bearer token stored in `localStorage` as `wf_token`
- **CSS**: XAMA design system with CSS custom properties in `frontend/src/index.css`; fonts are Rajdhani (display) and JetBrains Mono (numbers/tags)

## Known tech debt

1. `app/routers/admin.py` is 998 lines — should be split into focused modules
2. `require_admin()` is defined in 4 places — canonical version is in `app/dependencies.py`
3. `app/routers/auth.py` is dead code (not registered in main.py) — safe to delete
4. Two player-team association systems coexist: legacy `fantasy_team_players` table and newer `FantasyEntry` model — should consolidate on `FantasyEntry`
5. Some frontend pages use raw `fetch()` while others use the `api/` service layer — should standardize on the service layer
