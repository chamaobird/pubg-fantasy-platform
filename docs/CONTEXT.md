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
`0001 → 0002 → 4bfb4ef75223 → 0003 → 0004 → 0005 → 0006 → 0007 → 0008 → 0009`
- Próxima: `revision = "0010"`, `down_revision = "0009"`
- Sempre rodar `python -m alembic` da raiz
- Verificar antes de criar: `Get-Content alembic\versions\0009_*.py | Select-Object -First 15`

## Entidades principais
```
CHAMPIONSHIP → STAGE → STAGE_DAY → MATCH → MATCH_STAT
PERSON / PLAYER_ACCOUNT    (identidade multi-shard)
ROSTER                     (person × stage, com fantasy_cost)
LINEUP → LINEUP_PLAYER     (4 titulares + 1 reserva, 1 capitão com ×captain_multiplier)
USER_DAY_STAT / USER_STAGE_STAT / PERSON_STAGE_STAT
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
```

## Dados reais no banco
- Championship: PUBG Global Series 2026 (id=2, tier_weight=1.00)
- 8 Stages: PGS1WS(2), PGS1SS(3), PGS1FS(4), PGS2WS(5), PGS2SS(6), PGS2FS(7), PGS3SS(8), PGS3GF(9)
- 12 StageDays, 60 matches, 3840 match_stats, 97 Persons, 197 PlayerAccounts, 512 Rosters

## Notas importantes
- `pricing_n_matches`: campo DEPRECATED no modelo Stage
- MatchStat está em `app/models/match_stat.py` (NÃO em `app/models/match.py`)
- `bcrypt==4.0.1` + `passlib==1.7.4` fixados no requirements.txt
- `*.sql` no .gitignore
- `UserResponse` inclui `has_password` (bool) para frontend detectar conta Google-only
- Profile usa `/auth/me` (GET/PATCH)
