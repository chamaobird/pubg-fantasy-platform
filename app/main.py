# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.routers import users, players, tournaments
from app.routers.admin import router as admin_router

# Cria/atualiza tabelas automaticamente (create_all e idempotente)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Warzone Fantasy API",
    description="Backend da plataforma de Fantasy PUBG - Warzone Fantasy",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(users.router)
app.include_router(players.router)
app.include_router(tournaments.router)
app.include_router(admin_router)


@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "service": "Warzone Fantasy API"}


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "healthy"}
