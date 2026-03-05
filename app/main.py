import subprocess
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def run_migrations():
    """Run Alembic migrations, fall back to create_all if Alembic fails."""
    try:
        logger.info("Attempting to run Alembic migrations...")
        result = subprocess.run(
            ["alembic", "upgrade", "head"],
            capture_output=True,
            text=True,
            check=True
        )
        logger.info("Alembic migrations completed successfully.")
        logger.info(result.stdout)
    except subprocess.CalledProcessError as e:
        logger.error(f"Alembic migration failed: {e.stderr}")
        logger.warning("Falling back to SQLAlchemy Base.metadata.create_all()...")
        try:
            Base.metadata.create_all(bind=engine)
            logger.info("create_all() fallback succeeded.")
        except Exception as fallback_error:
            logger.error(f"create_all() also failed: {fallback_error}")
            raise


@asynccontextmanager
async def lifespan(app: FastAPI):
    run_migrations()
    yield


app = FastAPI(
    title="PUBG Fantasy Platform",
    description="Fantasy league platform for PUBG regional championships and scrims",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Lock down to specific origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.routers import fantasy_teams, players, tournaments, users

app.include_router(users.router)
app.include_router(tournaments.router)
app.include_router(players.router)
app.include_router(fantasy_teams.router)


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}
