# CONTEXT — XAMA Fantasy

## Stack
- Backend: FastAPI + Python 3.11 + PostgreSQL + Render
- Frontend: React + Vite (localhost:5173)
- Auth: JWT + Google OAuth + email verification (Resend)
- Scheduler: APScheduler (lineup_control 1min, scoring 1min, pricing 30min)
- ORM: SQLAlchemy síncrono (Session, não AsyncSession)

## Comandos essenciais
- Rodar backend: `python -m uvicorn app.main:app --reload` (sem .venv, Python global, rodar da raiz do projeto)
- Rodar frontend: `cd C:\Users\lgpas\PROJECTS\pubg-fantasy-platform\frontend` depois `npm run dev`
- Migration: `$env:DATABASE_URL="..." ; python -m alembic upgrade head`
- PowerShell: usar `;` em vez de `&&` para encadear comandos
- psql Render: usar arquivo .sql com encoding ASCII (ver nota abaixo)

## psql no PowerShell — nota crítica
Nunca passar SQL inline com -c no PowerShell — escaping de aspas duplas é problemático.
Sempre usar arquivo intermediário:
  `'SQL aqui com ''aspas simples'' escapadas assim' | Out-File -FilePath ".\query.sql" -Encoding ascii`
  `& "C:\Program Files\PostgreSQL\18\bin\psql.exe" "CONNECTION_STRING" -f ".\query.sql"`
A connection string atual do Render está nas env vars do backend (DATABASE_URL).

## Alembic — regras críticas
- Sempre rodar `python -m alembic` da raiz do projeto
- O campo `revision` dentro do arquivo é o ID que o Alembic usa — NÃO o nome do arquivo
- O `down_revision` deve referenciar o valor do campo `revision` da migration anterior
- Cadeia atual: 0001 → 0002 → 4bfb4ef75223 → 0003 → 0004 → 0005 → 0006 → 0007 → 0008
- Próxima migration deve ter `revision = "0009"` e `down_revision = "0008"`
- Sempre verificar o `revision` real antes de criar nova migration:
  `Get-Content alembic\versions\0008_user_email_verification.py | Select-Object -First 15`

## Estrutura de entidades
CHAMPIONSHIP → STAGE → STAGE_DAY → MATCH → MATCH_STAT
PERSON / PLAYER_ACCOUNT (identidade multi-shard, múltiplos account_ids por jogador)
ROSTER (person × stage, com fantasy_cost, cost_override, team_name)
LINEUP → LINEUP_PLAYER (4 titulares + 1 reserva, 1 capitão com ×captain_multiplier)
USER_DAY_STAT / USER_STAGE_STAT (ranking por dia e acumulado)
PERSON_STAGE_STAT (ppm por jogador por stage, usado no pricing)

## Regras de negócio críticas
- Budget: 100 tokens fixo por lineup
- Lineup: 4 titulares + 1 reserva. Reserva custa <= titular mais barato
- Capitão: um dos 4 titulares, multiplicador configurável por Stage (campo captain_multiplier, default 1.30)
- Pricing: algoritmo exponencial decay (λ=0.02, max_days=150, min_valid_matches=20)
  → ppm_ponderado = Σ(xama_pts × tier_weight × e^(-0.02×dias)) / Σ(tier_weight × e^(-0.02×dias))
  → tier_weight fica no Championship (PGS=1.00, PAS=0.70, etc.)
  → menos de 20 partidas válidas → newcomer_cost
- Replicação: APScheduler replica lineup do dia anterior se usuário não submeter
- Scoring: APScheduler detecta StageDays locked com MatchStats e calcula points_earned

## Auth — email verification
- Cadastro via email/senha exige verificação de email antes do login
- Resend API usada para envio (RESEND_API_KEY + EMAIL_FROM nas env vars do Render)
- EMAIL_FROM=onboarding@resend.dev (sem domínio verificado — só envia para lgpassarini@gmail.com)
- Quando tiver domínio próprio: verificar em resend.com/domains e atualizar EMAIL_FROM
- Google OAuth: email_verified=True automaticamente
- Endpoints: GET /auth/verify?token=... e POST /auth/resend-verification
- Frontend: /auth/verified → AuthVerified.jsx (tela de confirmação)

## Rotas do frontend
- /                  → LandingPage (redirect para /dashboard se logado)
- /dashboard         → Dashboard (stages abertas + histórico do usuário)
- /championships     → Championships (lista todos os championships com stages)
- /tournament/:id    → TournamentHub (lineup + leaderboard + stats + admin)
- /stages/:id/results → LineupResultsPage (pontuação por jogador por dia)
- /auth/verified     → AuthVerified (tela pós-verificação de email)
- /profile           → Profile
- /tournaments       → redirect para /championships (legado)

## Endpoints públicos principais
- GET /championships/ — championships com stages aninhadas (?include_inactive=true)
- GET /championships/{id} — detalhe de um championship
- GET /stages/ — stages ativas (open_only=true filtra abertas)
- GET /stages/{id}/roster — jogadores com effective_cost, fantasy_cost, cost_override
- GET /stages/{id}/days — stage days
- GET /stages/{id}/days/{day_id}/matches — partidas de um dia
- GET /stages/{id}/player-stats — stats agregados (?stage_day_id, ?match_id)
- GET /stages/{id}/leaderboard — ranking acumulado da stage
- GET /stages/{id}/days/{day_id}/leaderboard — ranking do dia
- GET /stages/{id}/roster/{rid}/price-history — histórico de preços
- POST /lineups/ — {stage_day_id, titular_roster_ids[4], reserve_roster_id, captain_roster_id}
- GET /lineups/stage/{id} — lineups do usuário na stage
- GET /auth/me — usuário autenticado
- PATCH /auth/me — atualizar username/avatar
- POST /auth/login / POST /auth/register
- GET /auth/verify?token=... — verificação de email
- POST /auth/resend-verification — reenvio de email

## Endpoints admin
- PATCH /admin/pricing/rosters/{id}/cost-override
- POST /admin/pricing/stages/{id}/recalculate-pricing
- POST /admin/stages/{id}/import-matches  ← payload: {pubg_match_ids: [...], stage_day_id: N}
- POST /admin/stages/{id}/reprocess-match
- POST /admin/stages/{id}/score-day  ← {stage_day_id: N} — scoring manual
- POST /admin/stages/{id}/rescore    ← rescore completo da stage

## Migrations (ordem e revision IDs reais)
0001_initial_schema (revision="0001")
→ 0002_users (revision="0002")
→ 4bfb4ef75223_fase3 (revision="4bfb4ef75223")
→ 0003_pricing_fields (revision="0003")
→ 0004_lineup_captain (revision="0004")
→ 0005_stage_short_name_is_active (revision="0005")
→ 0006_stage_captain_multiplier (revision="0006")
→ 0007_championship_tier_weight (revision="0007")
→ 0008_user_email_verification (revision="0008")  ← ATUAL HEAD

## Dados reais no banco (PGS 2026)
- Championship: PUBG Global Series 2026 (id=2, tier_weight=1.00)
- 8 Stages: PGS1WS(2), PGS1SS(3), PGS1FS(4), PGS2WS(5), PGS2SS(6), PGS2FS(7), PGS3SS(8), PGS3GF(9)
- 12 StageDays (sd_id 1-12), 60 matches, 3840 match_stats
- 97 Persons, 197 PlayerAccounts (shard pc-tournament)
- 512 Rosters (64 por stage), todos com fantasy_cost calculado pelo novo algoritmo

## Scripts em scripts/pubg/
- check_pgs_data.py — diagnóstico de tournaments disponíveis na API
- check_pgs_retry.py — retry de IDs que falharam por rate limit
- populate_pgs2026.py — cria estrutura + importa matches (idempotente)
- populate_players.py — cria Person + PlayerAccount da PGS 2026
- populate_rosters.py — cria Rosters baseado nos MatchStats existentes
- scripts/pubg/data/pgs_match_ids.json — match IDs salvos por tournament ID

## Logos de times
- Ficam em frontend/public/logos/{PASTA}/{tag}.png
- PASTA = PAS ou PGS (derivado do short_name da stage)
- Times com .jpeg: afi, op (pasta PAS)
- TeamLogo.jsx resolve pasta automaticamente via prop shortName

## Notas de implementação importantes
- pricing_n_matches: campo DEPRECATED no modelo Stage — existe no banco mas não é lido
- MatchStat está em app/models/match_stat.py — NÃO em app/models/match.py
- Profile usa /auth/me (GET/PATCH) — não existe /users/me
- TournamentSelect.jsx arquivado — substituído por Championships.jsx
- bcrypt==4.0.1 + passlib==1.7.4 fixados no requirements.txt (incompatibilidade com versões superiores no Render)
- *.sql adicionado ao .gitignore (evitar exposição de credenciais)
- Google OAuth client ID: 697343070083-au4k11q2j8s0kr0q41e1lbsjkv73k4ni.apps.googleusercontent.com

## Fase atual: 9 concluída — próxima: Bloco C (Pricing) ou domínio