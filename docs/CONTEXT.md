# CONTEXT — XAMA Fantasy

## Stack
- Backend: FastAPI + Python 3.11 + PostgreSQL + Render
- Frontend: React + Vite (localhost:5173)
- Auth: JWT + Google OAuth
- Scheduler: APScheduler (lineup_control 1min, pricing 30min)
- ORM: SQLAlchemy síncrono (Session, não AsyncSession)

## Comandos essenciais
- Rodar backend: `python -m uvicorn app.main:app --reload` (sem .venv, Python global)
- Rodar frontend: `cd frontend ; npm run dev`
- Migration: `$env:DATABASE_URL="..." ; python -m alembic upgrade head`
- PowerShell: usar `;` em vez de `&&` para encadear comandos

## Estrutura de entidades
CHAMPIONSHIP → STAGE → STAGE_DAY → MATCH
PERSON / PLAYER_ACCOUNT (identidade multi-shard)
ROSTER (person × stage, com fantasy_cost e cost_override)
LINEUP → LINEUP_PLAYER (4 titulares + 1 reserva, 1 capitão com ×1.3)

## Regras de negócio críticas
- Budget: 100 tokens fixo por lineup
- Lineup: 4 titulares + 1 reserva. Reserva custa <= titular mais barato
- Capitão: um dos 4 titulares, multiplicador de pontos ×1.3
- Pricing: régua linear ppm → [price_min..price_max], newcomers → pricing_newcomer_cost
- Replicação: APScheduler replica lineup do dia anterior se usuário não submeter

## Endpoints públicos principais
- GET /stages/ — stages ativas (open_only=true filtra abertas)
- GET /stages/{id}/roster — jogadores com effective_cost, fantasy_cost, cost_override
- GET /stages/{id}/days — stage days
- GET /stages/{id}/roster/{rid}/price-history — histórico de preços
- POST /lineups/ — submeter lineup {stage_day_id, titular_roster_ids[4], reserve_roster_id, captain_roster_id}
- GET /lineups/stage/{id} — lineups do usuário na stage
- GET /auth/me — usuário autenticado
- POST /auth/login — login {email, password}
- POST /auth/register — registro {email, username, password}

## Endpoints admin
- PATCH /admin/pricing/rosters/{id}/cost-override — override manual de custo
- POST /admin/pricing/stages/{id}/recalculate-pricing — recálculo manual

## Migrations (ordem)
0001_initial_schema → 0002_users → 4bfb4ef75223_fase3 → 0003_pricing_fields → 0004_lineup_captain → 0005_stage_short_name_is_active

## Fase atual: 6 concluída — próxima: Fase 7 (Scoring e resultados)
