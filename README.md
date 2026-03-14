# PUBG Fantasy Platform

Fantasy league platform for PUBG regional championships, qualifiers, and custom scrims.  
Better than Twire — transparent player pricing, regional focus, full API.

---

## Stack

| Layer    | Tech                               |
|----------|------------------------------------|
| Backend  | Python 3.12 + FastAPI              |
| Database | PostgreSQL 16 (SQLAlchemy + Alembic)|
| Cache    | Redis 7                            |
| Deploy   | Render.com                         |

---

## Local Setup (Docker — recommended)

### Prerequisites
- Docker Desktop installed and running
- Git

```bash
# 1. Clone
git clone https://github.com/chamaobird/pubg-fantasy-platform.git
cd pubg-fantasy-platform

# 2. Create .env from example
cp .env.example .env
# Edit SECRET_KEY to any random 32+ char string

# 3. Start all services
docker compose up --build -d

# 4. Run database migrations
docker compose exec api alembic upgrade head

# 5. Seed mock data (3 teams, 12 players, 1 tournament)
docker compose exec api python scripts/seed.py

# Alternative seed for lineup builder tests (tournaments + players with budget-friendly EU options)
docker compose exec api python scripts/seed_data.py

# 6. Open API docs
open http://localhost:8000/docs
```

Admin credentials after seed: `admin@pubgfantasy.gg` / `changeme123`

---

## Local Setup (without Docker)

### Prerequisites
- Python 3.12+
- PostgreSQL 16 running locally
- Redis running locally (optional, not required for core API)

```bash
# 1. Clone and create virtualenv
git clone https://github.com/chamaobird/pubg-fantasy-platform.git
cd pubg-fantasy-platform
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Edit DATABASE_URL to point to your local Postgres, e.g.:
# DATABASE_URL=postgresql://postgres:password@localhost:5432/pubg_fantasy

# 4. Create the database
psql -U postgres -c "CREATE DATABASE pubg_fantasy;"

# 5. Run migrations
alembic upgrade head

# 6. Seed mock data
python scripts/seed.py

# Alternative seed for lineup builder tests (tournaments + players with budget-friendly EU options)
python scripts/seed_data.py

# 7. Start the API
uvicorn app.main:app --reload

# 8. Open API docs
open http://localhost:8000/docs
```

---

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/users/register` | Register new user |
| POST | `/users/login` | Get JWT token |
| GET  | `/users/me` | Current user info |
| GET  | `/tournaments/` | List tournaments (filter by region, status) |
| POST | `/tournaments/` | Create tournament (auth required) |
| GET  | `/tournaments/{id}` | Get tournament details |
| PATCH| `/tournaments/{id}` | Update tournament |
| POST | `/tournaments/{id}/scoring-rules` | Set scoring rules (admin) |
| GET  | `/players/` | List players (filter by team, active) |
| POST | `/players/` | Create player (admin) |
| GET  | `/players/{id}/price-history` | Full transparent price history |
| POST | `/players/{id}/recalculate-price` | Recalculate price from stats (admin) |
| GET  | `/fantasy-teams/` | My fantasy teams |
| POST | `/fantasy-teams/` | Create fantasy team |
| PATCH| `/fantasy-teams/{id}` | Edit lineup |
| POST | `/fantasy-teams/{id}/score` | Refresh score from match results |
| GET  | `/fantasy-teams/leaderboard/{tournament_id}` | Top 50 teams |

Full interactive docs at `/docs` (Swagger) or `/redoc`.

---

## Suggested test scenario — Lineup with reserve (budget 100)

After running `python scripts/seed_data.py`, use the tournament **"PUBG Global Championship 2024 - Europe"** (region EU). In the lineup builder:

- Pick 4 starters including at least one of the cheap EU players (e.g. `EU_Budget_Anchor_15`, `EU_Budget_Anchor_12`, `EU_Budget_Anchor_10`, `EU_Budget_Anchor_5`).
- Pick the reserve as another cheap EU player not in starters (e.g. reserve = `EU_Budget_Anchor_8`).

Budget math example:

- Starters: 15 + 12 + 10 + 5 = 42
- Reserve applied cost = min(starters) = 5
- Total with reserve = 42 + 5 = 47 (<= 100)

---

## Pricing Engine

Player prices are calculated transparently. Every price change stores **all formula components** in `player_price_history.formula_components_json`:

```
price = BASE_PRICE + (
    avg_kills            × KILL_WEIGHT
  + (avg_damage / 100)   × DAMAGE_WEIGHT
  + avg_survival_minutes × SURVIVAL_WEIGHT
  + placement_score      × PLACEMENT_WEIGHT
) × SCORE_TO_PRICE_MULTIPLIER
```

Weights are constants at the top of `app/core/pricing.py` — no magic, no black boxes.

---

## Deploy on Render.com

### Step-by-step

1. **Push to GitHub**
   ```bash
   git remote set-url origin https://github.com/chamaobird/pubg-fantasy-platform.git
   git push origin main
   ```

2. **Create PostgreSQL database on Render**
   - Dashboard → New → PostgreSQL
   - Copy the **Internal Database URL**

3. **Create Web Service on Render**
   - Dashboard → New → Web Service → connect your GitHub repo
   - Runtime: `Docker`
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

4. **Set environment variables** (Render → Environment tab):
   ```
   DATABASE_URL=<Internal Database URL from step 2>
   SECRET_KEY=<random 32+ char string>
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=60
   ```

5. **Run migrations** (Render → Shell tab):
   ```bash
   alembic upgrade head
   python scripts/seed.py
   ```

6. Your API is live at `https://<your-service>.onrender.com/docs` 🎉

### Render auto-deploy
Render will automatically redeploy on every push to `main`.  
Run `alembic upgrade head` in the Shell tab after any migration.

---

## Project Structure

```
pubg-fantasy-platform/
├── app/
│   ├── main.py              # FastAPI app, CORS, router registration
│   ├── database.py          # SQLAlchemy engine + session + Base
│   ├── core/
│   │   ├── config.py        # Pydantic settings from .env
│   │   ├── security.py      # JWT + bcrypt
│   │   └── pricing.py       # Transparent player pricing engine
│   ├── models/              # SQLAlchemy ORM models (one per file)
│   ├── schemas/             # Pydantic request/response schemas
│   ├── routers/             # FastAPI routers (endpoints)
│   └── services/            # Business logic (auth, scoring)
├── alembic/                 # Alembic migrations
├── scripts/
│   └── seed.py              # Mock data: 3 teams, 12 players, 1 tournament
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
├── alembic.ini
└── .env.example
```
