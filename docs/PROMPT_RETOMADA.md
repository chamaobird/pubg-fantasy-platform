# Prompt de Retomada — XAMA Fantasy

## Contexto

Estou desenvolvendo a XAMA Fantasy, uma plataforma de fantasy sports para PUBG.

- Repositório: https://github.com/chamaobird/pubg-fantasy-platform
- Projeto local: C:\Users\lgpas\PROJECTS\pubg-fantasy-platform
- Stack: FastAPI + Python 3.11 + PostgreSQL + Render
- Frontend: React + Vite em frontend/
- PowerShell (usar ; em vez de && em comandos)
- Sessões síncronas SQLAlchemy (Session, não AsyncSession)

## Comandos essenciais

- Rodar backend: `python -m uvicorn app.main:app --reload` (sem .venv, Python global)
- Rodar frontend: `cd frontend ; npm run dev`
- Migration: `$env:DATABASE_URL="..." ; python -m alembic upgrade head`
- psql: `C:\Program Files\PostgreSQL\18\bin\psql.exe`

## Status atual

Fases 1 a 7 estão 100% concluídas:

- Fase 1: Schema completo (14 tabelas), auth JWT + Google OAuth, APScheduler
- Fase 2: CRUDs admin (championship, stage, stage_day, person, roster)
- Fase 3: Import de matches, resolução de identidade, scoring, MATCH_STAT, PERSON_STAGE_STAT
- Fase 4: Montagem de lineup, replicação automática, override manual de status
- Fase 5: Pricing completo — régua linear por stage, newcomer_cost fixo,
          cost_override com auditoria, recálculo automático via APScheduler
- Fase 6: Frontend completo — LineupBuilder, Dashboard, PriceHistoryModal,
          AdminPricingPanel, endpoints públicos /stages/
- Fase 7: Scoring de lineups, leaderboards, player-stats com sparkline e badge
          melhor partida, captain_multiplier por stage, TeamLogo com resolução
          de pasta por campeonato

## Regras de negócio críticas

### Lineup
- 4 titulares + 1 reserva por dia
- Budget: 100 tokens fixo
- Reserva deve custar <= custo do titular mais barato
- Capitão: um dos 4 titulares, multiplicador configurável por Stage
  (campo captain_multiplier na tabela stage, default 1.30)

### Scoring
- APScheduler (1min) detecta StageDays locked com MatchStats importados
- Calcula points_earned por LineupPlayer (capitão recebe ×captain_multiplier)
- Atualiza Lineup.total_points, UserDayStat, UserStageStat
- Idempotente — pode ser re-executado sem duplicar pontos

### Pricing
- Régua linear ppm → [price_min..price_max] por stage
- Newcomers ou sem histórico → pricing_newcomer_cost (default 15)
- cost_override manual com auditoria via RosterPriceHistory
- Recálculo automático via APScheduler a cada 30min

### Logos de times
- frontend/public/logos/{PAS ou PGS}/{tag_minusculo}.png
- Times com .jpeg: afi, op (pasta PAS)
- TeamLogo.jsx resolve pasta via prop shortName (ex: "PAS26")

## Migrations (ordem atual)
0001_initial_schema → 0002_users → 4bfb4ef75223_fase3 → 0003_pricing_fields → 0004_lineup_captain → 0005_stage_short_name_is_active → 0006_stage_captain_multiplier

## Endpoints públicos principais
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
- POST /auth/login — {email, password}
- POST /auth/register — {email, username, password}
- GET /auth/me — usuário autenticado

## Endpoints admin
- PATCH /admin/pricing/rosters/{id}/cost-override
- POST /admin/pricing/stages/{id}/recalculate-pricing
- POST /admin/stages/{id}/import-matches
- POST /admin/stages/{id}/reprocess-match

## Próxima fase: Fase 8 — Melhorias admin + UX de resultados

- [ ] #090 Admin: endpoint para disparar scoring manual de um StageDay
- [ ] #091 Admin: endpoint para rescore_stage completo
- [ ] #092 Frontend: página de resultados por lineup (ver points_earned de cada jogador)
- [ ] #093 Frontend: exibir captain_multiplier no LineupBuilder
- [ ] #081 TournamentSelect page — adaptar para novo backend (/stages/)
- [ ] #082 Perfil do usuário — verificar endpoints
- [ ] #083 TeamLogo — passar shortName da stage nos componentes que ainda não passam

## Arquivos para anexar neste chat

1. BACKLOG.md
2. CONTEXT.md
3. app/routers/stages.py
4. app/services/lineup_scoring.py
5. app/jobs/scoring_job.py
6. app/services/scheduler.py

Se a próxima tarefa envolver frontend, adicione também:
7. frontend/src/components/PlayerStatsPage.jsx
8. frontend/src/components/TournamentLeaderboard.jsx
9. frontend/src/components/TeamLogo.jsx
