# app/core/config.py
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://user:password@localhost/xama_fantasy"

    # PUBG API
    PUBG_API_KEY: str = ""

    class Config:
        env_file = ".env"


settings = Settings()