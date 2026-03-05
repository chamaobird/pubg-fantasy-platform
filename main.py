from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import fantasy_teams, players, tournaments, users

app = FastAPI(
    title="PUBG Fantasy Platform",
    description="Fantasy league platform for PUBG regional championships and scrims",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Lock down to specific origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(tournaments.router)
app.include_router(players.router)
app.include_router(fantasy_teams.router)


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}
