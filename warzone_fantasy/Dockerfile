# Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Instala dependências primeiro (camada cacheável)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia o código
COPY . .

# Script de startup:
#   1. alembic upgrade head  → aplica todas as migrations pendentes
#   2. uvicorn               → sobe a API
#
# O `&&` garante que o servidor SÓ sobe se as migrations passarem.
# Se uma migration falhar, o container para e o Render exibe o erro nos logs.
CMD alembic upgrade head && \
    uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
