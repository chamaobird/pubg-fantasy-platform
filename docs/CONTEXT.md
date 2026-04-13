# CONTEXT — XAMA Fantasy
> Referência técnica viva. Atualizar sempre que stack, env, migrations ou entidades mudarem.

## Stack
- Backend: FastAPI + Python 3.11 + SQLAlchemy síncrono (Session) + PostgreSQL (Render)
- Frontend: React 18 + Vite 5 + Tailwind CSS v4
- Auth: JWT (bcrypt + SHA256 prehash) + Google OAuth (redirect flow) + email verification (Resend)
- Scheduler: APScheduler — lineup_control (1min), scoring (1min), pricing (30min)
- Deploy: Render.com — backend + db + frontend (auto-deploy no push)

## Comandos essenciais
```powershell
# Backend (da raiz do projeto, Python global, sem .venv)
python -m uvicorn app.main:app --reload

# Frontend
cd C:\Users\lgpas\PROJECTS\pubg-fantasy-platform\frontend ; npm run dev

# Migration
$env:DATABASE_URL="..." ; python -m alembic upgrade head

# psql — SEMPRE usar arquivo intermediário (nunca -c inline no PowerShell)
'SQL;' | Out-File -FilePath ".\query.sql" -Encoding ascii
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" "CONNECTION_STRING" -f ".\query.sql"
```

## Projeto
- Local: `C:\Users\lgpas\PROJECTS\pubg-fantasy-platform`
- GitHub: `chamaobird/pubg-fantasy-platform`
- PowerShell: usar `;` em vez de `&&` para encadear comandos

## Migrations (cadeia real)
`0001 → 0002 → 4bfb4ef75223 → 0003 → 0004 → 0005 → 0006 → 0007 → 0008 → 0009 → 0010 → 0011 → 0012 → 0013`
- Próxima: `revision = "0014"`, `down_revision = "0013"`
- Sempre rodar `python -m alembic` da raiz
- Verificar antes de criar: `Get-Content alembic\versions\0013_*.py | Select-Object -First 15`

## Entidades principais
```
CHAMPIONSHIP → STAGE → STAGE_DAY → MATCH → MATCH_STAT
PERSON / PLAYER_ACCOUNT    (identidade multi-shard)
ROSTER                     (person × stage, com fantasy_cost Numeric 6,2)
LINEUP → LINEUP_PLAYER     (4 titulares + 1 reserva, 1 capitão com ×captain_multiplier)
USER_DAY_STAT / USER_STAGE_STAT / PERSON_STAGE_STAT
```

## lineup_status — valores válidos
```
closed   — padrão; stage não aparece nas seções ativas do Dashboard
preview  — visível com roster/stats, lineup desabilitado (aguardando confirmação do roster)
open     — lineup aberto para montagem
locked   — stage encerrada; lineup visível mas não editável
```
Comandos SQL para transições manuais:
```sql
UPDATE stage SET lineup_status = 'preview' WHERE id = <stage_id>;
UPDATE stage SET lineup_status = 'open'    WHERE id = <stage_id>;
UPDATE stage SET lineup_status = 'locked'  WHERE id = <stage_id>;
```

## Auth — fluxo
- Cadastro email/senha → email de verificação → login
- Google OAuth: `/auth/google` → Google → `/auth/google/callback` → `/auth/callback?token=`
- Forgot password: `POST /auth/forgot-password` → email → `/auth/reset-password?token=`
- Email verification aponta para BACKEND_URL/auth/verify (não frontend)
- Resend domínio: chamaobird.xyz (verificado) — EMAIL_FROM=noreply@chamaobird.xyz
- Google OAuth usa BACKEND_URL fixo (não request.url_for) para evitar problema de proxy no Render

## Env vars críticas (Render backend)
```
DATABASE_URL
SECRET_KEY
GOOGLE_CLIENT_ID=697343070083-au4k11q2j8s0kr0q41e1lbsjkv73k4ni.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET
FRONTEND_URL=https://pubg-fantasy-frontend.onrender.com
BACKEND_URL=https://pubg-fantasy-platform.onrender.com
RESEND_API_KEY
EMAIL_FROM=noreply@chamaobird.xyz
```

## URLs de produção
- Frontend: https://pubg-fantasy-frontend.onrender.com
- Backend: https://pubg-fantasy-platform.onrender.com
- Swagger: https://pubg-fantasy-platform.onrender.com/docs

## Rotas do frontend
```
/                     → LandingPage
/dashboard            → Dashboard
/championships        → Championships
/tournament/:id       → TournamentHub
/stages/:id/results   → LineupResultsPage
/auth/verified        → AuthVerified
/auth/callback        → AuthCallback (token Google OAuth)
/auth/reset-password  → ResetPasswordPage
/profile              → Profile
```

## Endpoints públicos principais
```
GET  /championships/
GET  /stages/
GET  /stages/{id}/roster
GET  /stages/{id}/days
GET  /stages/{id}/days/{day_id}/matches
GET  /stages/{id}/player-stats
GET  /stages/{id}/leaderboard
GET  /stages/{id}/days/{day_id}/leaderboard
POST /lineups/
GET  /lineups/stage/{id}
GET/PATCH /auth/me
POST /auth/login | /auth/register | /auth/forgot-password | /auth/reset-password
GET  /auth/verify?token= | /auth/google | /auth/google/callback
POST /auth/resend-verification
```

## Endpoints admin
```
PATCH /admin/pricing/rosters/{id}/cost-override
POST  /admin/pricing/stages/{id}/recalculate-pricing
POST  /admin/stages/{id}/import-matches
POST  /admin/stages/{id}/reprocess-match
POST  /admin/stages/{id}/score-day
POST  /admin/stages/{id}/rescore
POST  /admin/stages/{id}/force-status   ← aceita: closed | open | locked | preview
```

## Dados reais no banco
- Championship: PUBG Global Series 2026 (id=2, tier_weight=1.00)
  - 8 Stages: PGS1WS(2), PGS1SS(3), PGS1FS(4), PGS2WS(5), PGS2SS(6), PGS2FS(7), PGS3SS(8), PGS3GF(9)
  - 12 StageDays, 60 matches, 3840 match_stats, 97 Persons, 197 PlayerAccounts, 512 Rosters
  - Datas populadas via migration 0013 (start_date/end_date preenchidos)
- Championship: PUBG Americas Series 1 2026 - Playoffs 1 (id=7, shard=steam)
  - 3 Stages: Playoffs 1 Dia 1(15), Dia 2(16), Dia 3(17)
  - Stage 15: lineup_status=preview → abrir com `open` após confirmar roster em 15/04
  - Stage 16 e 17: lineup_status=closed
  - Datas: Dia 1 = 18/04 01:00 UTC, Dia 2 = 19/04 01:00 UTC, Dia 3 = 20/04 01:00 UTC
  - 3 StageDays: 17/04, 18/04, 19/04 (horário local do evento: 21:00 EDT)
  - 64 Rosters no Dia 1 (16 times × 4 jogadores), todos com display_name no formato TAG_PlayerName
  - Preços por tier: high=33, mid=28, open=18 (TGLTN fixado em 35 via cost_override)
  - 199 Persons, 305 PlayerAccounts (pending_ALIAS para contas sem Steam ID confirmado)
  - Scripts: `scripts/pubg/populate_pas1_playoffs.py`, `scripts/pubg/manage_player_accounts.py`
  - shard=steam para scrims públicas; shard do Esports Server a confirmar após 1ª partida

## Notas importantes
- `pricing_n_matches`: campo DEPRECATED no modelo Stage
- MatchStat está em `app/models/match_stat.py` (NÃO em `app/models/match.py`)
- `bcrypt==4.0.1` + `passlib==1.7.4` fixados no requirements.txt
- `*.sql` no .gitignore
- `UserResponse` inclui `has_password` (bool) para frontend detectar conta Google-only
- Profile usa `/auth/me` (GET/PATCH)
- `lineup_status=locked`: lineup visível mas não editável (prop `canEdit` no LineupBuilder)
- `lineup_status=preview`: visível com roster/stats, prop `isPreview=true` no LineupBuilder — botão desabilitado com mensagem "Lineup desabilitado — Aguardando confirmação"
- TournamentHub: `isLocked`, `isPreview` e `canEdit` derivados do status, separados de `isFinished`
- AppBackground.jsx injetado via RequireAuth em App.jsx — aplica grade hexagonal + gradiente laranja em todas as páginas internas
- Stage tem `start_date` e `end_date` (DateTime, nullable) — adicionados na migration 0013
- `StageOut` em `app/routers/stages.py` tem schema local próprio com `from_orm_stage()` — campos novos devem ser adicionados lá (não só em `app/schemas/stage.py`)
- Logos de torneios: `frontend/public/logos/Tournaments/PAS.png` e `PGS.png`
- Detecção de logo no Dashboard usa `includes('AMERICAS')` para PAS e `includes('GLOBAL SERIES')` para PGS
- Datas no Dashboard exibidas no fuso local do usuário (sem timeZone fixo)
