# app/main.py
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer

from app.routers import auth, players, tournaments, admin
from app.routers.championships import router as championships_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Migrations são aplicadas pelo Dockerfile antes de iniciar o uvicorn.
    # Aqui apenas confirmamos que a aplicação subiu corretamente.
    logger.info("Warzone Fantasy API iniciada. Migrations já aplicadas no startup.")
    yield
    logger.info("Warzone Fantasy API encerrando.")


app = FastAPI(
    title="Warzone Fantasy API",
    description="Backend da plataforma de Fantasy PUBG — Warzone Fantasy",
    version="2.0.0",
    lifespan=lifespan,
)

security = HTTPBearer()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(players.router)
app.include_router(tournaments.router)
app.include_router(admin.router)
app.include_router(championships_router)


@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "service": "Warzone Fantasy API", "version": "2.0.0"}


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "healthy"}
