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
- Frontend: `cd frontend ; npm run dev`
- Migration: `$env:DATABASE_URL="..." ; python -m alembic upgrade head`
- psql Render: `& "C:\Program Files\PostgreSQL\18\bin\psql.exe" "postgresql://pubgfantasydb_b478_user:XTomgiAI5eaPRpoe8NbdVz3rroHHSC1y@dpg-d6ke3plm5p6s73domdmg-a.oregon-postgres.render.com/pubg_fantasy_db?sslmode=require"`

## Regra crítica do Alembic (problema recorrente)

O Alembic usa o valor do campo `revision = "XXXX"` DENTRO do arquivo .py, não o nome do arquivo.
O `down_revision` deve referenciar o valor EXATO do campo `revision` da migration anterior.

Cadeia atual de migrations (valores reais dos campos `revision`):
  "0001" → "0002" → "4bfb4ef75223" → "0003" → "0004" → "0005" → "0006" → "0007"

A próxima migration deve ter:
  revision = "0008"
  down_revision = "0007"

Antes de criar qualquer nova migration, verificar o revision real da última:
  `Get-Content alembic\versions\0007_championship_tier_weight.py | Select-Object -First 15`

## Status atual — Fases 1 a 8 + Blocos A e B concluídos + Deploy no ar

### Fase 8 (admin scoring + UX + limpeza de legado)
- Endpoints admin: POST /admin/stages/{id}/score-day e /rescore
- LineupResultsPage: pontuação por jogador por dia com acumulado da stage
- LineupBuilder: badge ⭐ CAP ×1.30 no header e multiplicador no slot do capitão
- Championships page: nova página /championships consumindo GET /championships/
- Profile corrigido: /users/me → /auth/me, bloco de senha removido (endpoint não existe)
- Navbar: link Torneios → Campeonatos (/championships)
- Limpeza de legado: TournamentSelect arquivado, ChampionshipSelector removido,
  legacySharedProps removidos do TournamentHub
- Bug fix: MatchStat importado de app.models.match_stat (não app.models.match)
- Migration 0007 commitada no repositório (estava untracked — causava falha no deploy)
- pricing_n_matches deprecated nos schemas (campo existe no banco mas não é lido)
- distribute_matches_by_day reescrita com divmod (robusta para N dias)
- pgs_match_ids.json movido para scripts/pubg/data/

### Rotas do frontend (estado atual)
- /                  → LandingPage
- /dashboard         → Dashboard (stages abertas + histórico)
- /championships     → Championships (todos os campeonatos com stages)
- /tournament/:id    → TournamentHub (lineup + leaderboard + stats + admin)
- /stages/:id/results → LineupResultsPage
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

### Identity resolution (PUBG pc-tournament)
- Uma Person pode ter N PlayerAccounts todos com o mesmo alias
- Agrupamento feito por alias.lower() no populate_players.py

## Endpoints públicos principais
- GET /championships/ — championships com stages aninhadas (?include_inactive=true)
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

## Endpoints admin
- PATCH /admin/pricing/rosters/{id}/cost-override
- POST /admin/pricing/stages/{id}/recalculate-pricing
- POST /admin/stages/{id}/import-matches  ← {pubg_match_ids: [...], stage_day_id: N}
- POST /admin/stages/{id}/reprocess-match
- POST /admin/stages/{id}/score-day  ← {stage_day_id: N}
- POST /admin/stages/{id}/rescore

## Próxima fase: Fase 9 — Filtros e correções de UX

- [ ] #094 PlayerStats: filtros por dia e por partida (chips de dia + seletor de partida)
- [ ] #095 PlayerStats + TeamLogo: shortName não propagado → tags de time aparecem como "—"
        TournamentHub precisa passar stage.short_name como prop para PlayerStatsPage

Backlog completo em BACKLOG.md.
Contexto técnico completo em CONTEXT.md.

## Arquivos para anexar neste chat

Obrigatórios:
1. BACKLOG.md
2. CONTEXT.md
3. frontend/src/components/PlayerStatsPage.jsx
4. frontend/src/pages/TournamentHub.jsx

Se a tarefa envolver outros componentes:
5. frontend/src/components/TeamLogo.jsx
6. frontend/src/components/TournamentLeaderboard.jsx
