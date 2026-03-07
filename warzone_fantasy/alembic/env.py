# alembic/env.py
"""
Configuração do ambiente Alembic para o Warzone Fantasy.

Suporta dois modos:
  - offline: gera SQL sem conectar ao banco (útil para revisar migrations)
  - online:  conecta ao banco e aplica as migrations diretamente

A DATABASE_URL é lida da variável de ambiente (ou do .env via app/config.py),
garantindo que o mesmo valor usado pelo FastAPI seja usado pelo Alembic.
"""

import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

# Garante que o diretório raiz do projeto está no path,
# permitindo importar `app.*` independente de onde o alembic é chamado.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Importa Base (com todos os models registrados) e a config da aplicação.
# O import de models.py é obrigatório para que o Alembic detecte as tabelas.
from app.database import Base
from app.config import settings
import app.models  # noqa: F401 — registra todos os models no Base.metadata

# Objeto de configuração do Alembic (lê alembic.ini)
config = context.config

# Configura logging a partir do alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Passa o metadata dos models para o Alembic usar na detecção de mudanças
target_metadata = Base.metadata

# Injeta a DATABASE_URL da aplicação no Alembic,
# sobrescrevendo qualquer valor que esteja no alembic.ini.
# Isso garante que dev, staging e prod usem sempre a URL correta.
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)


def run_migrations_offline() -> None:
    """
    Modo offline: gera o SQL das migrations sem conectar ao banco.
    Útil para revisar o SQL antes de aplicar, ou para ambientes
    onde não há acesso direto ao banco durante o desenvolvimento.

    Uso: alembic upgrade head --sql > migration.sql
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        # Detecta alterações em tipos de colunas além de adições/remoções
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """
    Modo online: conecta ao banco e aplica as migrations diretamente.
    Usado pelo comando `alembic upgrade head` e pelo script de startup.
    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,  # NullPool: sem pool, fecha conexão após uso
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
