# app/main.py
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.migrations import run_migrations
from app.routers import auth, players, tournaments
from app.routers.admin import router as admin_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# ------------------------------------------------------------------
# LIFESPAN — substitui o @app.on_event("startup") deprecado
# Tudo antes do `yield` roda no startup; depois do yield, no shutdown.
# ------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── STARTUP ───────────────────────────────────────────────────
    logger.info("Iniciando Warzone Fantasy API...")
    try:
        run_migrations()
        logger.info("Banco de dados pronto. API disponível.")
    except Exception as e:
        # Se a migration crítica falhar (ex: banco inacessível),
        # logamos e deixamos o servidor subir — o Render vai mostrar
        # o erro nos logs e o healthcheck vai falhar, alertando o time.
        logger.critical(f"FALHA NA MIGRATION DE STARTUP: {e}")

    yield  # ← aplicação fica rodando aqui

    # ── SHUTDOWN ──────────────────────────────────────────────────
    logger.info("Warzone Fantasy API encerrando.")


# ------------------------------------------------------------------
# APP
# ------------------------------------------------------------------

app = FastAPI(
    title="Warzone Fantasy API",
    description="Backend da plataforma de Fantasy PUBG — Warzone Fantasy",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router)
app.include_router(players.router)
app.include_router(tournaments.router)
app.include_router(admin_router)


@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "service": "Warzone Fantasy API"}


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "healthy"}
