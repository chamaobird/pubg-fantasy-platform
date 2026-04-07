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

Fases 1 a 6 estão 100% concluídas:

- Fase 1: Schema completo (14 tabelas), auth JWT + Google OAuth, APScheduler
- Fase 2: CRUDs admin (championship, stage, stage_day, person, roster)
- Fase 3: Import de matches, resolução de identidade, scoring, MATCH_STAT, PERSON_STAGE_STAT
- Fase 4: Montagem de lineup, replicação automática, override manual de status
- Fase 5: Pricing completo — régua linear por stage, newcomer_cost fixo,
          cost_override com auditoria, recálculo automático via APScheduler,
          ROSTER_PRICE_HISTORY
- Fase 6: Frontend completo — LineupBuilder, Dashboard, PriceHistoryModal,
          AdminPricingPanel, endpoints públicos /stages/

## Regras de negócio críticas já implementadas

### Lineup
- 4 titulares + 1 reserva por dia
- Budget: 100 tokens fixo
- Reserva deve custar <= custo do titular mais barato
- Capitão: um dos 4 titulares, multiplicador de pontos ×1.3 (is_captain no LineupPlayer)

### Pricing
- Régua linear ppm → [price_min..price_max] por stage
- Newcomers ou sem histórico → pricing_newcomer_cost (default 15)
- cost_override manual com auditoria via RosterPriceHistory
- Recálculo automático via APScheduler a cada 30min

## Migrations (ordem atual)
0001_initial_schema → 0002_users → 4bfb4ef75223_fase3 → 0003_pricing_fields → 0004_lineup_captain → 0005_stage_short_name_is_active

## Endpoints públicos principais
- GET /stages/ — stages ativas (?open_only=true)
- GET /stages/{id}/roster — jogadores com effective_cost, fantasy_cost, cost_override
- GET /stages/{id}/days — stage days
- GET /stages/{id}/roster/{rid}/price-history — histórico de preços
- POST /lineups/ — {stage_day_id, titular_roster_ids[4], reserve_roster_id, captain_roster_id}
- GET /lineups/stage/{id} — lineups do usuário na stage
- POST /auth/login — {email, password}
- POST /auth/register — {email, username, password}
- GET /auth/me — usuário autenticado

## Endpoints admin
- PATCH /admin/pricing/rosters/{id}/cost-override
- POST /admin/pricing/stages/{id}/recalculate-pricing

## Próxima fase: Fase 7 — Scoring e resultados

- [ ] #070 Calcular points_earned por LineupPlayer após cada dia (aplicar ×1.3 para capitão)
- [ ] #071 Atualizar total_points no Lineup após scoring
- [ ] #072 Calcular UserDayStat e UserStageStat após cada dia
- [ ] #073 Leaderboard público por stage (/stages/{id}/leaderboard)
- [ ] #074 Migrar TournamentLeaderboard e PlayerStatsPage para novos endpoints

## Arquivos para anexar neste chat

1. BACKLOG.md
2. docs/CONTEXT.md
3. app/services/lineup.py
4. app/models/lineup.py
5. app/models/user_stat.py
6. app/routers/stages.py

Se a próxima tarefa envolver scoring, adicione também:
7. app/services/scoring.py (se existir)
8. app/jobs/lineup_control.py
