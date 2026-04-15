# app/core/config.py
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://user:password@localhost/xama_fantasy"

    # Backend public URL (used for OAuth redirect URI)
    BACKEND_URL: str = "http://localhost:8000"

    # PUBG API
    PUBG_API_KEY: str = ""

    # Auth — JWT
    SECRET_KEY: str = "change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 365  # 1 year

    # Auth — Google OAuth
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # Frontend URL (used for OAuth redirect and email links)
    FRONTEND_URL: str = "http://localhost:5173"

    # Email — Resend
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "onboarding@resend.dev"

    class Config:
        env_file = ".env"


settings = Settings()