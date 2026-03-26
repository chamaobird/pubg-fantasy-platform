# XAMA Fantasy — Contexto do Projeto

## Stack
- **Backend:** FastAPI + SQLAlchemy (sync) + PostgreSQL (Render free tier)
- **Frontend:** React + Vite + Tailwind v4
- **Deploy:** Render (backend + DB) + frontend via build/deploy automático no push
- **Migrations:** Alembic (idempotente — sempre checar coluna antes de adicionar)

## Design System (XAMA)
- Fontes: `Rajdhani` (UI), `JetBrains Mono` (números/tags)
- Cores: `#f97316` orange, `#f0c040` gold, `#0d0f14` black, `var(--color-xama-*)` tokens
- Componentes base: `dark-select`, `dark-btn`, `msg-error`

## Estrutura de Pastas
```
app/
  models/          # SQLAlchemy models
  routers/         # FastAPI routers (tournaments.py, players.py, auth.py, historical.py, ...)
  services/        # historical.py (importação de dados PUBG)
  database.py
alembic/versions/  # migrations
frontend/src/
  components/      # LineupBuilder, TournamentLeaderboard, PlayerStatsPage, TeamLogo, Navbar, ...
  pages/           # TournamentHub, Dashboard, Profile, TournamentSelect, Login, Register, ...
  config/          # pas2026.js — config estática de fases (may_have_groups)
  App.jsx          # rotas + useAuth context
  config.ts        # API_BASE_URL
```

## Modelo de Dados Relevante
- `tournaments` — id, name, pubg_id, region, status (active/upcoming/finished), lineup_open, budget_limit
- `teams` — id, name, logo_url
- `players` — id, name (formato: `TEAM_PlayerName`), team_id, tournament_id, fantasy_cost, is_active, pubg_id, **live_pubg_id**
  - `pubg_id`: ID da conta de torneio (PUBG esports server)
  - `live_pubg_id`: ID da conta Steam pessoal (Live Server); usado para resolver partidas de scrims
- `matches` — id, tournament_id, pubg_match_id, map_name, played_at, duration_secs, match_number, phase, day, **group_label**
  - `group_label`: "A", "B", "C", "D" ou null
- `match_player_stats` — player_id, match_id, kills, assists, damage_dealt, placement, survival_secs, fantasy_points, base_points, late_game_bonus, penalty_count, wins_count
- `lineups` — user_id, tournament_id, name, captain_player_id, reserve_player_id, total_points, lineup_open
- `users` — id, username, email, display_name, hashed_password
- `championships` — id, name, region, status, **start_date**; `championship_phases` — championship_id, tournament_id, phase, phase_order

## Convenções
- Player name split: `name.split('_')[0]` = team tag, `name.split('_')[1:]` = player name
- Logos servidas em `/logos/{tag.toLowerCase()}.png` (frontend/public/logos/)
- TimeZone: BRT = UTC-3 para datas de partidas
- Fórmula de pontuação: base_points + late_game_bonus - penalty (morte precoce = -15 × count)

## Endpoints Principais
- `GET /tournaments/` — lista torneios
- `GET /tournaments/{id}/rankings` — leaderboard (inclui username, display_name)
- `GET /tournaments/{id}/player-stats` — stats agregadas por jogador (suporta `?group_label=A`)
- `GET /tournaments/{id}/matches` — partidas agrupadas por dia (edição mais recente); inclui `group_label` e `stats_count` por partida
- `GET /tournaments/{id}/debug-players` — lista todos os players com pubg_id e live_pubg_id (diagnóstico)
- `GET /tournaments/{id}/debug-match-resolve/{pubg_match_id}?shard=steam` — dry-run de resolução de participantes sem salvar
- `GET /championship-phases/` — agrupa torneios por campeonato
- `GET /championship-phases/{id}/player-stats` — stats agregadas de todas as fases (filtra por start_date)
- `PATCH /championship-phases/{id}` — [Admin] atualiza campeonato (ex: start_date)
- `POST /tournaments/{id}/lineups` — cria lineup (requer auth + lineup_open=true)
- `PATCH /admin/players/bulk-set-active` — [Admin] ativa/desativa jogadores em massa por lista de IDs
- `POST /admin/players/bulk-set-live-ids` — [Admin] seta live_pubg_id em massa; corpo: `[{player_name, pubg_id, live_pubg_id}]`
- `POST /historical/import-matches-by-ids/{tournament_id}?background=true` — importa partidas PUBG por UUID; suporta `shard` e `group_label`; modo repair automático se match existe com 0 stats

## Estado das Migrations (última: 20260326_0100)
| Revision | O que faz |
|---|---|
| b2c3d4e5f6a1 | add social fields to users |
| b3f1a2c4d5e6 | add wins_count to match_player_stats |
| c4d5e6f7a8b9 | add logo_url to teams |
| d5e6f7a8b9c0 | add start_date to championships |
| 20260322_... | add group_label to matches |
| 20260326_0100_f2a3b4c5d6e7 | add live_pubg_id to players (unique index) |

## Features Implementadas
- ✅ Importação histórica de partidas (historical.py) com auto-lock e wins_count
- ✅ **Repair mode**: se match já existe com 0 stats, recria os stats sem duplicar o match
- ✅ Lineup Builder com validações (budget, 1 player/time, reserva); **1 lineup por usuário por torneio** (backend bloqueia duplicata); mensagem de sucesso sem expor ID
- ✅ Leaderboard — coluna Lineup removida, colunas: # / Manager / Pontos / Ver; badge EU no Manager; logos nos jogadores expandidos; display_name real; **filtro por dia/partida com re-ranking client-side** (pontos em azul, total em subscrito)
- ✅ Player Stats Page com filtros hierárquicos **Fase → Week → Dia → Grupo → Partida**
  - Week agrupada por **ISO calendar week** (segunda–domingo) — robusto a sessões em dias consecutivos
  - Seletor de Grupo aparece automaticamente quando o dia tem partidas com `group_label` e `may_have_groups=true` no config
  - Filtra stats da API por `?group_label=X` quando grupo selecionado
- ✅ `frontend/src/config/pas2026.js` — mapa estático `tournament_id → PhaseConfig { may_have_groups }`
  - Tournament 7 (Scrims): `may_have_groups: true`
- ✅ TournamentSelect com agrupamento por Championship (blocos + mini-cards de fase)
- ✅ TournamentHub com tabs, badge de status (ENCERRADO/AO VIVO/EM BREVE), aba Lineup oculta e default Leaderboard para torneios finalizados
- ✅ Dashboard com 3 estados (Lineup Aberta / Aguardando / Meus Resultados); card mostra "✅ Lineup montada" em vez do nome interno
- ✅ Perfil com username editável, validação unicidade, seção senha
- ✅ Navbar global
- ✅ Logos de equipe (24 times, fallback iniciais) — arquivos em frontend/public/logos/
- ✅ **Seletor hierárquico Campeonato → Fase** — `ChampionshipSelector.jsx`
- ✅ **Championship stats dedup** — agrupa por nome normalizado, soma stats de todas as fases
- ✅ **Championship start_date filter** — filtra partidas por `champ.start_date`
- ✅ **Bulk activate/deactivate players** — `PATCH /admin/players/bulk-set-active`
- ✅ **live_pubg_id** — campo no Player para conta Steam pessoal (Live Server scrims)
  - `_build_player_lookup` indexa `live_pubg_id` além de `pubg_id` e nome
  - `POST /admin/players/bulk-set-live-ids` para atualizar em massa

## Estado da Produção (atualizado 2026-03-26)

### Torneios cadastrados (DB)
| id | name | pubg_id | matches | players | lineup_open |
|----|------|---------|---------|---------|-------------|
| 7  | PAS 2026 - Americas Open Qualifier · Fase de Cups | am-pas1cup | 35 (Sem 1-4) | 107 | **true** |
| 8  | SEA Thailand Super Cup 2026 | sea-thsc | 24 | 65 | false |
| 9  | SEA MITH Cup 2026 | sea-mith | 19 | 67 | false |
| 10 | Asia China Cup 2026 | as-cncup | 20 | 66 | false |
| 11 | Korea PWS 2026 Phase 1 Cup 5 | kr-pws1c5 | 5 | 64 | false |
| 12-15 | PGS 2026 Circuit 1 (4 fases) | eu-race26 etc | importado | 96 jogadores ativos | false |

### Championships cadastrados
| id | name | region | fases | start_date |
|----|------|--------|-------|------------|
| 1 | PGS 2026 Circuit 1 · Series 1 | GLOBAL | T13 (Group), T12 (Winners), T14 (Survival), T15 (Final) | 2026-03-16 |
| 2 | PAS 2026 - Americas Series 1 | AM | T7 (Scrims) | null |

### PAS Scrims Week 4 (23/03/2026) — Estado atual
- **20 partidas importadas** no tournament 7 com shard `steam` (Live Server)
- **Groups A, B, C, D** com `group_label` setado ✓
- **Stats count por grupo**: A=15, B=15, C=8, D=22 por partida
- **60 de 107 jogadores** têm `live_pubg_id` mapeado (auto-match por nome normalizado)
- **47 jogadores ainda sem `live_pubg_id`** — não aparecem nas stats da Week 4
- Partidas importadas via `POST /historical/import-matches-by-ids/7?background=true` com `shard=steam`

### Match IDs Week 4 (para re-importar se necessário)
```
Grupo A: b951fa9e, 57f8d62b, c32cbca7, 42f37586, 89282bab
Grupo B: 456c148c, b698ce93, c5b9f10e, e020c349, 0fc2a916
Grupo C: 9e11a640, 8a970e0c, a030a52f, 23cbe39e, fe6aefe2
Grupo D: 5d4e2dee, 0296c330, e2549f68, 5017894b, facc92c6
```
(UUIDs completos no arquivo `fetch_week4_matches.py` na raiz do projeto)

### PGS 2026 Circuit 1 — Estado dos Dados
- **96 jogadores ativos** em 24 times, todos com stats corretas no "Campeonato completo"
- Filtro de data: `start_date = 2026-03-16` bloqueia dados de edições anteriores
- Match counts esperados por estágio: Group Stage = 6, chegou à Final = 21-26

### PGS 2 (começa 26/03/2026)
- Status: UPCOMING no pubgesports.com (tournament ID da PUBG API: ainda não disponível)
- Quando o torneio for criado: criar T16+ no DB, rodar import, e setar `start_date` no novo championship

## Pendente / Backlog

### 🔴 Alta Prioridade
- [ ] **Mapear live_pubg_id dos 47 jogadores restantes** — os jogadores sem `live_pubg_id` não aparecem nas stats da Week 4
  - Usar `GET /tournaments/7/debug-players` para ver quem ainda não tem `live_pubg_id`
  - Usar `GET /tournaments/7/debug-match-resolve/{match_id}?shard=steam` para ver quem ficou unresolved
  - Atualizar via `POST /admin/players/bulk-set-live-ids` com o payload correto
  - Script `build_live_id_mapping.py` na raiz pode ser adaptado para os grupos faltantes
- [ ] **Verificar Week 4 aparece como "Week 4"** no frontend após push do fix de ISO week (feito mas ainda não pushado)

### 📅 Dados / Infra
- [ ] **PGS 2** — criar torneios T16+ e championship para Circuit 2 quando iniciar; pubg_tournament_id ainda não disponível
- [ ] **Feature: Price History** — adicionar `tournament_id` em `PlayerPriceHistory`, endpoint `GET /players/{id}/price-history`, sparkline no frontend

## Como Mapear live_pubg_id dos Jogadores Faltantes
```powershell
# 1. Ver quem não tem live_pubg_id
Invoke-RestMethod -Uri "https://pubg-fantasy-platform.onrender.com/tournaments/7/debug-players" -Headers $headers | Where-Object { -not $_.live_pubg_id } | Select name, pubg_id

# 2. Ver quem ficou unresolved num match específico (ex: grupo A, partida 1)
Invoke-RestMethod -Uri "https://pubg-fantasy-platform.onrender.com/tournaments/7/debug-match-resolve/b951fa9e-6a6a-4b23-8ecf-fcf07e0eb208?shard=steam" -Headers $headers

# 3. Montar payload e enviar
$payload = '[{"player_name":"TEAM_Nick","live_pubg_id":"account.xxx"},...]' | ConvertFrom-Json
Invoke-RestMethod -Uri "https://pubg-fantasy-platform.onrender.com/admin/players/bulk-set-live-ids" -Method POST -Headers $headers -Body ($payload | ConvertTo-Json)
```

## Acessos e Credenciais de Produção

| Recurso | Valor |
|---------|-------|
| **Backend URL** | `https://pubg-fantasy-platform.onrender.com` |
| **Swagger UI** | `https://pubg-fantasy-platform.onrender.com/docs` |
| **DB (External URL)** | ver painel do Render → PostgreSQL → "External Database URL" (não salvar aqui) |
| **Admin login** | `admin@warzone.gg` / `admin123` |
| **PUBG API Key** | ver `.env` local ou painel PUBG Developer (não salvar aqui) |
| **PUBG API Shard (Live Server scrims)** | `steam` |
| **PUBG API Shard (tournament server)** | `pc-tournament` |
| **GitHub repo** | `https://github.com/chamaobird/pubg-fantasy-platform` |
| **wasdefy PAS1 SW#4** | `https://wasdefy.com/pubg/competitions/019c6ffe-0a45-718f-a448-e008cdcb71fa/schedule` |

### Login correto (admin)
```
POST /users/login
{"email":"admin@warzone.gg","password":"admin123"}
```
Retorna `{"access_token": "..."}`

> ⚠️ A VM sandbox não consegue conectar diretamente ao DB via psycopg2 (sem DNS externo). Usar a API via `mcp__Claude_in_Chrome__javascript_tool` (fetch no browser) para queries e mutações.

## Notas de Sessão
- Pasta do projeto montada no Cowork → edições diretas via Edit/Write, sem heredoc
- Para novas sessões: pedir "monta o projeto pubg-fantasy-platform e lê o CONTEXT.md"

## Como Rodar Migrations no Render
```powershell
$env:DATABASE_URL='postgresql://user:pass@host.oregon-postgres.render.com/db'
python -m alembic upgrade head
```

## Como Importar Week 4 (shard steam, background)
```powershell
$resp = Invoke-RestMethod -Uri "https://pubg-fantasy-platform.onrender.com/users/login" -Method POST -ContentType "application/json" -Body '{"email":"admin@warzone.gg","password":"admin123"}'
$token = $resp.access_token
$headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }

# Grupo A (exemplo)
$body = '{"pubg_match_ids":[{"id":"b951fa9e-6a6a-4b23-8ecf-fcf07e0eb208","group_label":"A"},...],"shard":"steam"}'
Invoke-RestMethod -Uri "https://pubg-fantasy-platform.onrender.com/historical/import-matches-by-ids/7?background=true" -Method POST -Headers $headers -Body $body
```

## Como Editar Arquivos (fluxo eficiente)
Com a pasta montada no Cowork, Claude lê e edita diretamente — sem upload, sem heredoc.
Para mudanças pontuais: Claude usa `Edit` cirúrgico.
Para arquivos novos: Claude usa `Write` direto no path correto.
