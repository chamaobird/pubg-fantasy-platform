# XAMA Fantasy — Instruções para o AI

Fantasy league para PUBG esports. Usuários montam lineups de jogadores pro e ganham pontos com base em stats reais de partidas.

## Comportamento esperado

- PowerShell: usar `;` em vez de `&&` para encadear comandos
- SQLAlchemy síncrono — usar `Session`, nunca `AsyncSession`
- Python global (sem .venv) — rodar `python -m uvicorn` direto
- Alembic: sempre `python -m alembic` da raiz; verificar cadeia antes de criar migration
- psql: SEMPRE usar arquivo intermediário `.sql` com encoding ASCII, nunca `-c` inline
- Ao gerar arquivos: sempre incluir o path completo no output
- Preferir PowerShell commands exatos em vez de descrever o que fazer manualmente

## Convenções de código

- Componentes React: `PascalCase`
- CSS classes: prefixo por contexto (`.xlb-*` LineupBuilder, `.xh-*` headings, `.xcard-*` cards)
- Cores e fontes: sempre usar tokens CSS (`var(--color-xama-orange)`, `var(--fs-body)`)
- Player name format: `TEAM_PlayerName` — split em `_` → `[0]` = tag do time
- Endpoints admin: prefixo `/admin/`
- Schemas Pydantic: separar request/response
- Models SQLAlchemy: um arquivo por modelo em `app/models/`

## Stack resumida

| Layer | Tech |
|-------|------|
| Backend | Python 3.11, FastAPI, SQLAlchemy 2.0 (sync) |
| Database | PostgreSQL, Alembic migrations |
| Frontend | React 18, Vite 5, Tailwind CSS v4 |
| Auth | JWT (bcrypt + SHA256 prehash), Google OAuth redirect flow |
| Email | Resend (domínio chamaobird.xyz) |
| Deploy | Render.com |
| Scheduler | APScheduler dentro do FastAPI |

## Estrutura de pastas relevante

```
app/
  models/          # SQLAlchemy ORM — um por arquivo
  schemas/         # Pydantic request/response
  services/        # Lógica de negócio (pricing, scoring, lineup, identity)
  routers/
    admin/         # Endpoints admin
  jobs/            # APScheduler jobs
  core/            # config.py, security.py
  database.py
  main.py

frontend/src/
  pages/           # Páginas por rota
  components/      # Componentes reutilizáveis
    ui/            # Design system base (Card, Badge, Button...)
  api/             # Axios client + service modules
  context/         # AuthContext
  index.css        # Tokens CSS do design system XAMA

alembic/versions/  # Migrations numeradas (0001...000N)
```

## Contexto completo do projeto
Ver CONTEXT.md (técnico/operacional) e CHANGELOG.md (histórico + estado atual).

## Atualização de docs ao final de cada sessão

Ao encerrar qualquer sessão de desenvolvimento, **sempre** atualizar:

1. **CHANGELOG.md** — adicionar entrada com data, o que foi feito e bugs corrigidos. Atualizar a seção "Estado Atual" no topo para refletir o próximo passo.
2. **CONTEXT.md** — atualizar se houver mudança técnica: nova migration, nova env var, nova rota, nova nota importante.

Atualizar quando houver mudança estrutural:
- **ARCHITECTURE.md** — nova entidade, mudança de regra de negócio, decisão de design
- **FRONTEND.md** — novo componente, nova página, novo token CSS
