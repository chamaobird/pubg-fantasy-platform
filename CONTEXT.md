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

## Como encontrar tournament ID na PUBG API (lição aprendida)
O endpoint correto é **sem shard**: `GET https://api.pubg.com/tournaments` (não `/shards/pc-tournament/tournaments`).
Matches de torneios oficiais usam shard `pc-tournament` (não steam).
Para buscar o ID de um torneio novo: filtrar por `t.id.includes('26')` na lista retornada.

## Estado das Migrations (última: 20260326_0100)
| Revision | O que faz |
|---|---|
| b2c3d4e5f6a1 | add social fields to users |
| b3f1a2c4d5e6 | add wins_count to match_player_stats |
| c4d5e6f7a8b9 | add logo_url to teams |
| d5e6f7a8b9c0 | add start_date to championships |
| 20260322_... | add group_label to matches |
| 20260326_0100_f2a3b4c5d6e7 | add live_pubg_id to players (unique index) |

## Convenção de Input Manual para Novas Fases
Para fases seguintes de qualquer campeonato, o fluxo correto é:
1. Fase termina → usuário informa quais times avançam para cada fase seguinte
2. Checar quais times já têm players no DB (fases anteriores) — usar `copy-players-to` para reaproveitar
3. Para times novos: usuário traz o roster, criamos via API
4. Desativar players de times que não devem aparecer no lineup (top/bottom de fases anteriores)
Isso é mais rápido, assertivo e confiável do que qualquer automação de detecção de avanço.

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
- ✅ **Logos no Lineup Builder** — `TeamLogo` integrado (tabela de jogadores, cards de titulares e reserva)
- ✅ **live_pubg_id** — campo no Player para conta Steam pessoal (Live Server scrims)
  - `_build_player_lookup` indexa `live_pubg_id` além de `pubg_id` e nome
  - `POST /admin/players/bulk-set-live-ids` para atualizar em massa

## Estado da Produção (atualizado 2026-03-26)

### Novo Endpoint Disponível
- `POST /admin/tournaments/{source_id}/copy-players-to/{target_id}` — copia jogadores que aparecem nos matches do torneio source para o target (sem pubg_id, para evitar unique constraint). Idempotente por nome. **Deployado em produção.**

### Torneios cadastrados (DB)
| id | name | pubg_id | matches | players | lineup_open |
|----|------|---------|---------|---------|-------------|
| 7  | PAS 2026 - Americas Open Qualifier · Fase de Cups | am-pas1cup | 35 (Sem 1-4) | 107 | **true** |
| 8  | SEA Thailand Super Cup 2026 | sea-thsc | 24 | 65 | false |
| 9  | SEA MITH Cup 2026 | sea-mith | 19 | 67 | false |
| 10 | Asia China Cup 2026 | as-cncup | 20 | 66 | false |
| 11 | Korea PWS 2026 Phase 1 Cup 5 | kr-pws1c5 | 5 | 64 | false |
| 12-15 | PGS 2026 Circuit 1 (4 fases) | as-pgs1ws/gs/ss/fs | importado | ~50 por fase | false |
| **16** | **PGS 2026 Circuit 2 · Winners Stage** | **as-pgs2ws** | **5 (26/03)** | **64 (pubg_ids reais)** | **false** |
| **17** | **PGS 2026 Circuit 2 · Survival Stage** | **as-pgs2ss** | 0 (partidas amanhã) | **64 (copiados de T16, sem pubg_id)** | **true** |
| **18** | **PGS 2026 Circuit 2 · Final Stage** | **as-pgs2fs** | 0 (upcoming) | **64 (copiados de T16, sem pubg_id)** | false |

### Championships cadastrados
| id | name | region | fases | start_date |
|----|------|--------|-------|------------|
| 1 | PGS 2026 Circuit 1 · Series 1 | GLOBAL | T13 (Group), T12 (Winners), T14 (Survival), T15 (Final) | 2026-03-16 |
| 2 | PAS 2026 - Americas Series 1 | AM | T7 (Scrims) | null |
| **3** | **PGS 2026 Circuit 2 · Series 2** | **GLOBAL** | **T16 (Winners), T17 (Survival), T18 (Final)** | **2026-03-26** |

### PAS Scrims Week 4 (23/03/2026) — Estado atual
- **20 partidas importadas** no tournament 7 com shard `steam` (Live Server)
- **Groups A, B, C, D** com `group_label` setado ✓
- **Stats count por grupo**: A=15, B=15, C=8, D=22 por partida
- **79 de 107 jogadores** têm `live_pubg_id` mapeado (60 auto + 19 via fuzzy/reverse/leet matching em 26/03)
- **28 jogadores ainda sem `live_pubg_id`** — Steam names muito diferentes, requerem mapeamento manual
- Partidas importadas via `POST /historical/import-matches-by-ids/7?background=true` com `shard=steam`
- ⚠️ Os 19 novos mappings NÃO afetam as Week 4 já importadas (repair mode só ativa com stats_count=0). Stats corretas a partir de Week 5.

### Grupos por time (PAS Scrims)
- **Grupo A**: CAUT, FE, TMP, TQ, WIT, X10
- **Grupo B**: AFi, AKA, CLR, DUEL, FEAR, PEST
- **Grupo C**: EMT, FEAR, NA, NVM, PNG, TTG
- **Grupo D**: BO, CAUT, DOTS, FATE, INJ, INSK, LxB, NW, PSTL, TAES

### Match IDs referência por grupo (1 match each — last of week)
```
A: 89282bab-c579-4025-8a36-f7c63fa59207
B: 0fc2a916-f48f-4377-9eb0-41a0137a13aa
C: fe6aefe2-6920-422e-be09-1a19ff8a9ddb
D: facc92c6-633f-4f0a-b937-78ff782d33d0
```

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

### PGS 2026 Circuit 2 — Estado dos Dados (26/03/2026) ✅
- **Shard:** `pc-tournament` ✓
- **T16 (Winners Stage):** 5 partidas importadas ✓ | stats calculados (top: TWIS_xmpl 192pts) ✓ | lineup_open=false ✓
  - `/tournaments/16/players` mostra 4 (os com tournament_id=16); `/tournaments/16/player-stats` mostra 64 (via match_player_stats join) — comportamento esperado
- **T17 (Survival Stage):** lineup_open=true ✓ | **64 jogadores ativos** (16 times corretos) | status=upcoming | partidas 27/03
  - **8 times do T16 bottom (Winners Stage):** FCE, FUR, JDG, MiTH, NAVI, PeRo, S2G, T1
  - **8 times do T14 bottom (PGS1 Survival):** 17(i7Gaming), CR, CTG, GEN, T5, TL, VIT, VP
  - 32 players do T16 top (4AM, AL, DNS, EA, FLC, FS, TE, TWIS → Final Stage) desativados
  - Players sem pubg_id (serão resolvidos via seed-players-from-matches após import)
- **T18 (Final Stage):** jogadores copiados ✓ | lineup_open=false | upcoming

### Formato PGS2 (Series 2)
- **Winners Stage** (T16): 16 times, 5 partidas → Top 8 → Final Stage; Bottom 8 → Survival Stage
- **Survival Stage** (T17): 16 times (8 do bottom Winners + 8 do bottom Series 1), 5 partidas → Top 8 → Final Stage
- **Final Stage** (T18): 16 times, 10 partidas → standings finais

### Resultado Winners Stage (26/03/2026)
**→ Final Stage (top 8):** DN soopers, Twisted Minds, Four Angry Men, Team Falcons, Full Sense, The Expendables, eArena, Anyone's Legend
**→ Survival Stage (bottom 8):** FURIA, Natus Vincere, S2G Esports, Made in Thailand, T1, Petrichor Road, Finhay Cerberus, JD Gaming

### Match IDs Winners Stage T16 (para re-importar se necessário)
```
e6904b8a-7a46-4222-ab53-a41fb6dca6f7
416b9ac3-cf79-43ac-85fa-f70fe386ab5f
5e858e6e-cebc-414c-9218-50fed078fb1f
dd289599-8e43-43e4-aa05-8285ec5a31f6
d134b210-3515-4d2e-a4fe-24b0b796484e
```

### Próximos passos PGS2 (próxima sessão)
```
# Quando as partidas da Survival Stage forem jogadas (as-pgs2ss vai aparecer na API):
POST /historical/import-matches-by-ids/17?background=true  (shard=pc-tournament)
POST /admin/seed-players-from-matches/17     # atualiza pubg_ids nos players copiados
PATCH /admin/tournaments/17  → { status: "finished", lineup_open: false }
PATCH /admin/tournaments/18  → { lineup_open: true }

# Quando Final Stage tiver dados (as-pgs2fs):
POST /historical/import-matches-by-ids/18?background=true
PATCH /admin/tournaments/18  → { status: "finished", lineup_open: false }
```

## Pendente / Backlog

### 🔴 Alta Prioridade
- [ ] **Importar Survival Stage (T17)** quando as partidas de 27/03 forem jogadas (shard=pc-tournament) — ver runbook abaixo
- [ ] **Fazer push do frontend** para deploy da correção de logos no Lineup Builder
- [ ] **28 jogadores sem live_pubg_id** (PAS Scrims) — mapeamento manual necessário para os que têm Steam names muito diferentes
  - Jogadores faltantes: DUEL_Iroh, DUEL_Woo1y, INJ_Plushiee, TAES_Jaxinho, TAES_zMakhul, TAES_zZRISE, FEAR_VapeSkr, TTG_Heatn, TTG_M8, X10_San71Hero1, X10_kl4uZeera, TQ_RxbrrrT, NVM_1Yess, PNG_Falw-, EMT_KpN1, NVM_skatasxtico, DOTS_OtosakaYu-, TTG_Maffooo, WIT_marcis, FEAR_LucasMSzin, INSK_0racle_, NA_Balefrost, NA_ega, OMG_ALVARO-__--, OMG_FerHopper201, OMG_TUT4NK4M0N_, OMG_XNz-Pain, PSTL_FaKe
  - Script: `build_live_id_mapping.py` (usa `debug-match-resolve` endpoint com os match IDs do runbook)

### 📅 Dados / Infra
- [ ] **Feature: Price History** — adicionar `tournament_id` em `PlayerPriceHistory`, endpoint `GET /players/{id}/price-history`, sparkline no frontend

## Como Mapear live_pubg_id dos Jogadores Faltantes
```powershell
# 1. Ver quem não tem live_pubg_id
Invoke-RestMethod -Uri "https://pubg-fantasy-platform.onrender.com/tournaments/7/debug-players" | Select-Object -ExpandProperty all_players | Where-Object { -not $_.live_pubg_id } | Select name, pubg_id

# 2. Ver unresolved num match (use os Match IDs de referência por grupo no CONTEXT.md)
Invoke-RestMethod -Uri "https://pubg-fantasy-platform.onrender.com/tournaments/7/debug-match-resolve/fe6aefe2-6920-422e-be09-1a19ff8a9ddb?shard=steam"

# 3. Enviar payload
$body = '{"entries":[{"player_name":"TEAM_Nick","live_pubg_id":"account.xxx"}]}'
Invoke-RestMethod -Uri "https://pubg-fantasy-platform.onrender.com/admin/players/bulk-set-live-ids" -Method POST -Headers $headers -Body $body
```

## Algoritmo de Matching (para novas semanas)
O script `build_live_id_mapping.py` já implementa: normalização + stripped prefix.
Para casos difíceis (sesão 26/03): usado matching adicional — leet (1→i, 0→o), reversed name, dedup chars.
Resultados aplicados: 60 automático + 19 manual = 79/107 mapeados.

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
