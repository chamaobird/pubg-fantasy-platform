# CONTEXT — XAMA Fantasy

## Stack
- Backend: FastAPI + Python 3.11 + PostgreSQL + Render
- Frontend: React + Vite (localhost:5173)
- Auth: JWT + Google OAuth
- Scheduler: APScheduler (lineup_control 1min, scoring 1min, pricing 30min)
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
LINEUP → LINEUP_PLAYER (4 titulares + 1 reserva, 1 capitão com ×captain_multiplier)
USER_DAY_STAT / USER_STAGE_STAT (ranking por dia e acumulado)

## Regras de negócio críticas
- Budget: 100 tokens fixo por lineup
- Lineup: 4 titulares + 1 reserva. Reserva custa <= titular mais barato
- Capitão: um dos 4 titulares, multiplicador configurável por Stage (campo captain_multiplier, default 1.30)
- Pricing: régua linear ppm → [price_min..price_max], newcomers → pricing_newcomer_cost
- Replicação: APScheduler replica lineup do dia anterior se usuário não submeter
- Scoring: APScheduler detecta StageDays locked com MatchStats e calcula points_earned

## Endpoints públicos principais
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
- POST /auth/login / POST /auth/register

## Endpoints admin
- PATCH /admin/pricing/rosters/{id}/cost-override
- POST /admin/pricing/stages/{id}/recalculate-pricing
- POST /admin/stages/{id}/import-matches
- POST /admin/stages/{id}/reprocess-match

## Migrations (ordem)
0001_initial_schema → 0002_users → 4bfb4ef75223_fase3 → 0003_pricing_fields → 0004_lineup_captain → 0005_stage_short_name_is_active → 0006_stage_captain_multiplier

## Logos de times
- Ficam em frontend/public/logos/{PASTA}/{tag}.png
- PASTA = PAS ou PGS (derivado do short_name da stage)
- Times com .jpeg: afi, op (pasta PAS)
- TeamLogo.jsx resolve pasta automaticamente via prop shortName

## Fase atual: 7 concluída — próxima: Fase 8 (melhorias admin + UX de resultados)
