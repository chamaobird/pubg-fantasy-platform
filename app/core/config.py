from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://user:password@localhost/warzone_fantasy"

    # Auth
    # PONTO CRÍTICO: em produção (Render), você DEVE definir SECRET_KEY via variável de ambiente
    # e manter esse valor estável entre deploys/instâncias, senão tokens emitidos não serão validados.
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # PUBG API
    PUBG_API_KEY: str = ""        # set via .env
    PUBG_SHARD: str = "pc-eu"    # pc-eu | pc-na | pc-as | pc-sea | etc.

    # Misc
    REDIS_URL: str = "redis://localhost:6379"

    class Config:
        env_file = ".env"


settings = Settings()
