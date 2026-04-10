# Prompt de Retomada — XAMA Fantasy

## Contexto

Estou desenvolvendo a XAMA Fantasy, uma plataforma de fantasy sports para PUBG esports.

- Repositório: https://github.com/chamaobird/pubg-fantasy-platform
- Projeto local: C:\Users\lgpas\PROJECTS\pubg-fantasy-platform
- Stack: FastAPI + Python 3.11 + PostgreSQL (Render) + React + Vite
- PowerShell: usar `;` em vez de `&&` para encadear comandos
- SQLAlchemy síncrono (Session, não AsyncSession)
- Python global (sem .venv)

## Comandos essenciais

- Backend: `python -m uvicorn app.main:app --reload` (rodar da raiz do projeto)
- Frontend: `cd C:\Users\lgpas\PROJECTS\pubg-fantasy-platform\frontend` depois `npm run dev`
- Migration: `$env:DATABASE_URL="..." ; python -m alembic upgrade head`
- psql Render: SEMPRE usar arquivo .sql com encoding ASCII — nunca -c inline no PowerShell:
  `'SQL;' | Out-File -FilePath ".\q.sql" -Encoding ascii`
  `& "C:\Program Files\PostgreSQL\18\bin\psql.exe" "CONNECTION_STRING" -f ".\q.sql"`

## Regra crítica do Alembic (problema recorrente)

O Alembic usa o valor do campo `revision = "XXXX"` DENTRO do arquivo .py, não o nome do arquivo.
O `down_revision` deve referenciar o valor EXATO do campo `revision` da migration anterior.

Cadeia atual de migrations (valores reais dos campos `revision`):
  "0001" → "0002" → "4bfb4ef75223" → "0003" → "0004" → "0005" → "0006" → "0007" → "0008"

A próxima migration deve ter:
  revision = "0009"
  down_revision = "0008"

Antes de criar qualquer nova migration, verificar o revision real da última:
  `Get-Content alembic\versions\0008_user_email_verification.py | Select-Object -First 15`

## Status atual — Fases 1–9 + Blocos A e B concluídos + Deploy no ar

### Fase 9 (filtros UX + auth — 09/04/2026)
- #094 + #095: shortName propagado TournamentHub → PlayerStatsPage → TeamLogo
- #013: Email verification completo — Resend integrado, migration 0008
  - GET /auth/verify?token=... e POST /auth/resend-verification
  - AuthVerified.jsx — tela pós-verificação (/auth/verified)
  - Login bloqueia não verificados com mensagem clara
  - Google OAuth: email_verified=True automaticamente
- LandingPage: feedback visual pós-cadastro ("Verifique seu email")
- Google OAuth client ID corrigido: 697343070083-au4k11q2j8s0kr0q41e1lbsjkv73k4ni
- bcrypt==4.0.1 + passlib==1.7.4 fixados no requirements.txt
- Incidente de segurança resolvido: credenciais rotacionadas, *.sql no .gitignore

### Limitação atual do Resend
- EMAIL_FROM=onboarding@resend.dev (sem domínio verificado)
- Só envia para lgpassarini@gmail.com em produção
- Para enviar para qualquer email: verificar domínio em resend.com/domains

### Google OAuth em produção
- Configurado e funcionando localmente
- Em produção aguardando propagação do Google Cloud Console (pode levar horas)
- JavaScript origin adicionada: https://pubg-fantasy-frontend.onrender.com

### Rotas do frontend (estado atual)
- /                  → LandingPage
- /dashboard         → Dashboard
- /championships     → Championships
- /tournament/:id    → TournamentHub
- /stages/:id/results → LineupResultsPage
- /auth/verified     → AuthVerified
- /profile           → Profile
- /tournaments       → redirect para /championships

### Banco populado (PGS 2026)
- Championship: PUBG Global Series 2026 (id=2, tier_weight=1.00)
- 8 Stages: PGS1WS(2), PGS1SS(3), PGS1FS(4), PGS2WS(5), PGS2SS(6), PGS2FS(7), PGS3SS(8), PGS3GF(9)
- 12 StageDays (sd_id 1–12), 60 matches, 3840 match_stats com xama_points
- 97 Persons, 197 PlayerAccounts, 512 Rosters com fantasy_cost calculado

## Regras de negócio críticas

### Lineup
- 4 titulares + 1 reserva por dia
- Budget: 100 tokens fixo
- Reserva deve custar <= custo do titular mais barato
- Capitão: um dos 4 titulares, multiplicador configurável por Stage (captain_multiplier, default 1.30)

### Scoring
- APScheduler (1min) detecta StageDays locked com MatchStats importados
- Calcula points_earned por LineupPlayer (capitão recebe ×captain_multiplier)
- Atualiza Lineup.total_points, UserDayStat, UserStageStat
- Idempotente — admin pode forçar via POST /admin/stages/{id}/score-day

### Pricing
- Algoritmo exponencial: decay = e^(-0.02 × dias), tier_weight por championship
- max_days=150, max_matches=50 (MAX_MATCHES global), min_valid_matches=20
- < 20 partidas válidas → newcomer_cost (default 15)
- price_min=12, price_max=35 (configurável por stage)

## Endpoints públicos principais
- GET /championships/ — championships com stages aninhadas
- GET /stages/ — stages ativas (?open_only=true)
- GET /stages/{id}/roster — jogadores com effective_cost
- GET /stages/{id}/days — stage days
- GET /stages/{id}/days/{day_id}/matches — partidas de um dia
- GET /stages/{id}/player-stats — stats agregados (?stage_day_id, ?match_id)
- GET /stages/{id}/leaderboard — ranking acumulado
- GET /stages/{id}/days/{day_id}/leaderboard — ranking do dia
- GET /stages/{id}/roster/{rid}/price-history — histórico de preços
- POST /lineups/ — {stage_day_id, titular_roster_ids[4], reserve_roster_id, captain_roster_id}
- GET /lineups/stage/{id} — lineups do usuário na stage
- GET /auth/me / PATCH /auth/me — perfil do usuário
- POST /auth/login / POST /auth/register
- GET /auth/verify?token=... / POST /auth/resend-verification

## Endpoints admin
- PATCH /admin/pricing/rosters/{id}/cost-override
- POST /admin/pricing/stages/{id}/recalculate-pricing
- POST /admin/stages/{id}/import-matches ← {pubg_match_ids: [...], stage_day_id: N}
- POST /admin/stages/{id}/reprocess-match
- POST /admin/stages/{id}/score-day ← {stage_day_id: N}
- POST /admin/stages/{id}/rescore

## Próximas tarefas
- [ ] #120 Domínio próprio no Resend (desbloqueio de envio para qualquer email)
- [ ] #101 Job de polling de partidas ao vivo
- [ ] #103 Upload de jogadores via CSV (shard steam)

Backlog completo em BACKLOG.md.
Contexto técnico completo em CONTEXT.md.

## Arquivos para anexar neste chat

Obrigatórios:
1. BACKLOG.md
2. CONTEXT.md
3. PROMPT_RETOMADA.md (este arquivo)