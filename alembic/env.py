"""
Alembic environment configuration for XAMA Fantasy.

Supports two modes:
  - offline: generates SQL without connecting to the database
  - online:  connects to the database and applies migrations directly

DATABASE_URL is read from the environment variable (or .env via app/core/config.py),
ensuring the same value used by FastAPI is used by Alembic.
"""
import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

# Ensure project root is on the path so `app.*` imports work
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Import Base with all models registered, and app settings
from app.database import Base
from app.core.config import settings

# Import all models so Alembic can detect them via Base.metadata
import app.models  # noqa: F401

# Alembic config object (reads alembic.ini)
config = context.config

# Configure logging from alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Pass model metadata to Alembic for autogenerate support
target_metadata = Base.metadata

# Inject DATABASE_URL from app settings, overriding alembic.ini
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)


def run_migrations_offline() -> None:
    """
    Offline mode: generate SQL without connecting to the database.
    Usage: alembic upgrade head --sql > migration.sql
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """
    Online mode: connect to the database and apply migrations directly.
    Used by `alembic upgrade head`.
    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
