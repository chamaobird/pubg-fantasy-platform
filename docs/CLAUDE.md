# XAMA Fantasy — Instruções para o AI

Fantasy league para PUBG esports. Usuários montam lineups de jogadores pro e ganham pontos com base em stats reais de partidas.

## Comandos essenciais

```powershell
# Backend (raiz do projeto, Python global, sem .venv)
python -m uvicorn app.main:app --reload

# Frontend
cd frontend ; npm run dev

# Migration (sempre da raiz)
$env:DATABASE_URL="..." ; python -m alembic upgrade head

# psql — SEMPRE arquivo intermediário (nunca -c inline)
'SQL;' | Out-File -FilePath ".\query.sql" -Encoding ascii
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" "CONNECTION_STRING" -f ".\query.sql"
```

## Regras obrigatórias

- **PowerShell**: usar `;` em vez de `&&` para encadear comandos
- **SQLAlchemy**: síncrono — usar `Session`, nunca `AsyncSession`
- **Alembic**: sempre `python -m alembic` da raiz; verificar cadeia antes de criar migration
- **Próxima migration**: `revision = "0014"`, `down_revision = "0013"`
- **Outputs**: sempre incluir path completo nos arquivos gerados
- **RTK instalado**: usar `rtk pytest`, `rtk git status`, `rtk git diff`, `rtk read`, etc. para economizar tokens

## Convenções de código

- Componentes React: `PascalCase`; CSS classes: prefixo por contexto (`.xlb-*`, `.xh-*`, `.xcard-*`)
- Cores/fontes: sempre tokens CSS (`var(--color-xama-orange)`, `var(--fs-body)`) — nunca hardcoded
- Player name: `TEAM_PlayerName` → split em `_` → `[0]` = tag do time
- `StageOut` em `app/routers/stages.py` tem schema local com `from_orm_stage()` — campos novos devem ser adicionados lá também
- `MatchStat` está em `app/models/match_stat.py` (não em `app/models/match.py`)

## O que NÃO mexer

- `_legacy/` — código antigo, somente referência
- `*.sql` — ignorado no git, não commitar
- `bcrypt==4.0.1` + `passlib==1.7.4` — versões fixadas, não atualizar

## Stack

Backend: Python 3.11, FastAPI, SQLAlchemy 2.0 (sync), PostgreSQL, APScheduler
Frontend: React 18, Vite 5, Tailwind CSS v4, React Router, Axios
Auth: JWT (bcrypt + SHA256 prehash), Google OAuth redirect flow
Deploy: Render.com (auto-deploy no push para main)

## Contexto completo

Ver `CONTEXT.md` (técnico/operacional) e `CHANGELOG.md` (estado atual + próximos passos).

## Ao encerrar a sessão

Atualizar obrigatoriamente:
1. `CHANGELOG.md` — o que foi feito, bugs corrigidos, próximo passo na seção "Estado Atual"
2. `CONTEXT.md` — se houver nova migration, env var, rota ou nota técnica importante

Atualizar se houver mudança estrutural:
- `FRONTEND.md` — novo componente, página ou token CSS
- `ARCHITECTURE.md` — nova entidade ou decisão de design
