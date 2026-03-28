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

## Estado da Produção (atualizado 2026-03-28 — sessão 3)

### Novos Endpoints Disponíveis
- `POST /admin/tournaments/{source_id}/copy-players-to/{target_id}` — copia jogadores que aparecem nos matches do torneio source para o target (sem pubg_id, para evitar unique constraint). Idempotente por nome. **Deployado.**
- `POST /admin/players/bulk-upsert/{tournament_id}` — cria ou atualiza jogadores por pubg_id ou nome. Usa `player_sync.bulk_upsert_players`. Ideal para adicionar reservas/substitutos. **Deployado.**

### ⚠️ Atenção: campos importantes
- `PATCH /admin/players/bulk-set-active` usa `activate` (bool), **não** `is_active`
- `POST /admin/players/bulk-upsert/{id}` body: `{ "players": [{ "name", "pubg_id", "team_name", "fantasy_cost" }] }`
- `POST /admin/reprocess-match-stats/{id}` — preenche stats faltantes de jogadores que ganharam pubg_id após o import original (não duplica rows existentes)

### FCE — Reserva/Substituto (lição aprendida 28/03)
- **FCE_YUDIRT** (`account.25256ae61aa2438cafce60462dced9f4`) substituiu FCE_Br1annn no Dia 1 da Final
- Foi descoberto via `debug-match-resolve` → unresolved participant
- Estava no DB (id 881) mas sem stats → resolvido com `reprocess-match-stats`
- **Fluxo para substitutos:** debug-match-resolve → identificar unresolved → bulk-upsert (se não existir) → reprocess-match-stats

### Torneios cadastrados (DB)
| id | name | pubg_id | matches | players | lineup_open |
|----|------|---------|---------|---------|-------------|
| 7  | PAS 2026 - Americas Open Qualifier · Fase de Cups | am-pas1cup | 50 (Sem 1-5) | 107 | **true** |
| 8  | SEA Thailand Super Cup 2026 | sea-thsc | 24 | 65 | false |
| 9  | SEA MITH Cup 2026 | sea-mith | 19 | 67 | false |
| 10 | Asia China Cup 2026 | as-cncup | 20 | 66 | false |
| 11 | Korea PWS 2026 Phase 1 Cup 5 | kr-pws1c5 | 5 | 64 | false |
| 12-15 | PGS 2026 Circuit 1 (4 fases) | as-pgs1ws/gs/ss/fs | importado | ~50 por fase | false |
| **16** | **PGS 2026 Circuit 2 · Winners Stage** | **as-pgs2ws** | **5 (26/03)** | **64 (pubg_ids reais)** | **false** |
| **17** | **PGS 2026 Circuit 2 · Survival Stage** | **as-pgs2ss** | **5 (27/03)** | **64 ativos** | **false (finished)** |
| **18** | **PGS 2026 Circuit 2 · Final Stage** | **as-pgs2fs** | **5 (Dia 1 — 28/03)** | **65 ativos (64 + YUDIRT)** | **true (lineup aberta)** |

### Championships cadastrados
| id | name | region | fases | start_date |
|----|------|--------|-------|------------|
| 1 | PGS 2026 Circuit 1 · Series 1 | GLOBAL | T13 (Group), T12 (Winners), T14 (Survival), T15 (Final) | 2026-03-16 |
| 2 | PAS 2026 - Americas Series 1 | AM | T7 (Scrims) | null |
| **3** | **PGS 2026 Circuit 2 · Series 2** | **GLOBAL** | **T16 (Winners), T17 (Survival), T18 (Final)** | **2026-03-26** |

### PAS Scrims — Estado atual (atualizado 26/03/2026)

#### Sessões importadas no T7
| Data (BRT) | Matches | Grupos | Formato |
|---|---|---|---|
| 06/03 (Sem 1) | 5 | — | Lobby único (sem group_label) |
| 14/03 (Sem 2) | 5 | — | Lobby único (sem group_label) |
| 21/03 (Sem 3) | 5 | — | Lobby único (sem group_label) |
| 23/03 (Sem 4) | 20 | A, B, C, D | 4 grupos isolados × 5 matches |
| 25/03 (Sem 5 — noite) | 3 | — | 6 grupos, lobbies combinados (A+F, B+C, D+E) |
| 26/03 (Sem 5 — tarde/noite) | 12 | — | 6 grupos, lobbies combinados (4 rounds) |

**Semana 5 (26/03/2026):** 15 matches únicos importados, sem group_label (lobbies combinados de 2 grupos cada)
- Formato: 6 grupos (A–F), 8 times cada, round-robin combinado (cada match tem 2 grupos no mesmo lobby)
- Grupos referência usados: A=FE/fanafps, B=PEST/JoShY-_-, C=SneakAttack, D=X10/Kalniixx, E=BETUNGAS_, F=Ykuz

#### IDs de referência por grupo (Sem 5 — para debug-match-resolve se necessário)
```
A+F: 2bb4fd30-02a8-4a76-9c27-7a94d3d84937 (25/03 BRT)
B+C: 87bc79b5-c979-4b44-964f-2163e17ab5f3 (25/03 BRT)
D+E: f3cf51b0-64fc-4fc9-a846-c48a208e1079 (25/03 BRT)
A+B: c624f43d-d075-4c29-b2ad-c374f7ff4340 (26/03 BRT)
C+D: 5aafe178-d474-4425-b023-e0deba3bd61e (26/03 BRT)
E+F: 32db47e1-5dc5-478b-bc78-f85741174cea (26/03 BRT)
A+C: ba47db77-f4df-46ab-bc61-75bafcde09e8 (26/03 BRT)
B+E: e0555bdb-6835-4db9-88aa-611838a879e2 (26/03 BRT)
D+F: 760f59af-c9d7-4f1f-a404-e145db6bc795 (26/03 BRT)
A+D: a925afed-4a31-40cc-a92f-e55945341a4e (26/03 BRT)
C+E: 742e37e9-6f12-4bb7-ac75-fa844f7edf40 (26/03 BRT)
B+F: 0f5aff4f-aeef-489b-bca0-c23393ae371f (26/03 BRT)
A+E: 25d18d69-282b-48ac-a4b7-4e3b2086c57e (26/03 BRT)
B+D: 42bc6c59-8129-4077-933e-86ac2ff67ca9 (26/03 BRT)
C+F: 57a35758-c9ac-4798-b873-018fc33f8b19 (26/03 BRT)
```

#### Status de mapeamento live_pubg_id
- **79 de 107 jogadores** mapeados (60 auto + 19 manual em 26/03)
- **28 jogadores ainda sem `live_pubg_id`** — Steam names muito diferentes
- ⚠️ Novos mappings da Sem 5 em diante já funcionarão nas importações futuras

### Grupos por time (PAS Scrims)
#### Semana 4 (23/03, grupos isolados)
- **Grupo A**: CAUT, FE, TMP, TQ, WIT, X10
- **Grupo B**: AFi, AKA, CLR, DUEL, FEAR, PEST
- **Grupo C**: EMT, FEAR, NA, NVM, PNG, TTG
- **Grupo D**: BO, CAUT, DOTS, FATE, INJ, INSK, LxB, NW, PSTL, TAES

#### Semana 5 (26/03, lobbies combinados — 6 grupos × 8 times)
Times identificados por match de referência (debug-match-resolve):
- **Grupos A+B** (c624f43d): CLR, EMT, FATE, FE, INJ, NVM, PEST, TQ
- **Grupos B+C** (87bc79b5): AKA, EMT, FATE, FEAR, NVM, NW, PEST, WIT
- **Grupos D+E** (f3cf51b0): AFi, BO, INSK, LxB, NA, PSTL, X10

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

### PGS 2026 Circuit 2 — Estado dos Dados (27/03/2026) ✅
- **Shard:** `pc-tournament` ✓
- **T16 (Winners Stage):** 5 partidas importadas ✓ | stats calculados (top: TWIS_xmpl 192pts) ✓ | lineup_open=false ✓
  - `/tournaments/16/players` mostra 4 (os com tournament_id=16); `/tournaments/16/player-stats` mostra 64 (via match_player_stats join) — comportamento esperado
- **T17 (Survival Stage):** ✅ **FINALIZADO** | status=finished | lineup_open=false
  - 5 partidas importadas (27/03, shard=pc-tournament)
  - 63 players com pubg_id atualizados via seed-players-from-matches
  - **Resultado — Top 8 → Final Stage:** 17, VIT, FUR, PeRo, CR, NAVI, MiTH, FCE
  - **Bottom 8 → Eliminados:** JDG, S2G, T1, CTG, GEN, T5, TL, VP
- **T18 (Final Stage):** ✅ **ATIVO** | status=active | lineup_open=true
  - **64 players ativos, 16 times corretos:**
    - Winners Stage Top 8: DNS, TWIS, 4AM, FLC, FS, TE, EA, AL
    - Survival Stage Top 8: 17, VIT, FUR, PeRo, CR, NAVI, MiTH, FCE
  - Players copiados via copy-players-to (T16→T18 + T17→T18)
  - Times eliminados desativados: JDG, S2G, T1, CTG, GEN, T5, TL, VP

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

### Match IDs Survival Stage T17 (para re-importar se necessário)
```
55bd5139-77c8-43aa-b105-ed40109225ca
71f09e8e-c58e-4906-b9c6-d0d425aeb791
0f0c65a2-3ca7-45ac-8a2b-bbb604e660cc
3291ba58-fce4-4bee-9fd3-1bb8172b169a
304620b4-59b4-47ab-aafc-a05be38e15b6
```

### PGS2 Final Stage — Dia 1 (28/03/2026) ✅
- **5 matches importados** (Erangel, Miramar, Taego, Rondo, Erangel)
- IDs: `7e5820be`, `82e509b2`, `3183d55a`, `26efa7a8`, `5c4b2d3b`
- **64 players com stats** (63 titulares + FCE_YUDIRT substituto)
- FCE_Br1annn não jogou; FCE_YUDIRT (id 881) entrou e tem 106.12pts

### Automação Dia 2 (29/03/2026)
- Scheduled task `pgs2-final-live-import` criada no Claude Desktop (sidebar "Scheduled")
- Roda a cada 10min das **07:00 às 12:59 BRT** (19:00–00:59 KST)
- ⚠️ **Antes do horário: clicar "Run now" uma vez** para pré-aprovar as ferramentas de browser
- Lógica: compara total de matches no PUBG API vs DB → importa novos automaticamente

### Próximos passos PGS2 (Dia 2 e encerramento)
```
# Após Dia 2 (automático via scheduled task, verificar depois):
GET /tournaments/18/matches  → confirmar 10 matches no total

# Encerrar Final Stage:
PATCH /admin/tournaments/18  → { "status": "finished", "lineup_open": false }

# Se algum substituto aparecer como unresolved:
GET /tournaments/18/debug-match-resolve/{match_id}?shard=pc-tournament
POST /admin/players/bulk-upsert/18  (se não existir no DB)
POST /admin/reprocess-match-stats/18
```

## Frontend — Design System XAMA (Refactor em andamento)

### Arquitetura nova (Phase 1–3 concluídas em 27/03/2026)
- **`index.css`** — tokens CSS globais (`--fs-*`, `--space-*`, `--surface-*`, `--radius-*`) + classes XAMA
- **`frontend/src/components/ui/`** — barrel export com: `Card`, `Badge`, `StatusBadge`, `RegionBadge`, `Button`, `PageHeader`, `SectionTitle`, `StatRow`
- **`TournamentHeader.jsx`** — strip breadcrumb (Championship › Phase) + nome + status + rank do usuário
- **`Tabs.jsx`** — tabs horizontais com indicador animado
- **`TournamentLayout.jsx`** — Navbar + TournamentHeader + Tabs + slot de conteúdo
- **`TournamentHub.jsx`** — reescrito; usa `TournamentLayout`; passa `sharedProps` para tabs filhas
- **`Dashboard.jsx`** — reescrito com Cards da ui/, grid de torneios, saudação, badges de status
- **`LineupBuilder.jsx`** — **Phase 3 concluída** — layout 2 colunas + painel sticky

### LineupBuilder — Phase 3 (concluída 27/03/2026)
- Layout `.xlb-grid` (2 colunas: tabela de jogadores | painel sticky 330px)
- Painel direito sticky: BudgetBar (`.xlb-budget`) com barra + 3 stats (Total/Usado/Restante)
- 4 slots titulares (`.xlb-slot`) com placeholder dashed quando vazio
- Capitão via botão ♛ (`.xlb-captain-btn`) em vez de radio — active state dourado
- Slot reserva separado por divisor duplo
- Save button (`.xlb-save-btn`) — `.ready` laranja / `.idle` cinza / `.loading`
- Removido: seletor de torneio (delegado ao TournamentHub/TournamentLayout)
- Removido: imports e helpers desnecessários (ChampionshipSelector, SectionTitle local, Card local)

### Classes CSS por feature
- **Global:** `.xama-page`, `.xama-container`, `.xh-*` (headings), `.xs-title`, `.xb` + variantes, `.xt-*` (tabs)
- **Cards:** `.xama-card-v2`, `.xama-card-hover`, `.xcard-*`, `.xstat-*`
- **Lineup Builder:** `.xlb-page`, `.xlb-grid`, `.xlb-panel`, `.xlb-panel-head/title/body`, `.xlb-budget-*`, `.xlb-slot-*`, `.xlb-captain-*`, `.xlb-remove-btn`, `.xlb-table`, `.xlb-action-btn`, `.xlb-locked-*`, `.xlb-save-btn`, `.xlb-search-*`

## Pendente / Backlog

### 🔴 Alta Prioridade
- [x] **Importar Survival Stage (T17)** ✓
- [x] **Final Stage (T18)** configurada — 64 players, lineup_open=true ✓
- [x] **Week 5 PAS Scrims (26/03)** importada ✓
- [x] **Frontend Phase 1** — tokens CSS + componentes ui/ + TournamentHeader + Tabs + TournamentLayout ✓
- [x] **Frontend Phase 2** — Dashboard + TournamentHub reescritos ✓
- [x] **Frontend Phase 3** — LineupBuilder 2 colunas + sticky panel ✓
- [x] **Final Stage Dia 1 (28/03)** — 5 matches importados, FCE_YUDIRT resolvido ✓
- [ ] **Encerrar T18** após Dia 2 → `PATCH /admin/tournaments/18 { status: finished, lineup_open: false }`
- [ ] **Frontend Phase 4** — Leaderboard refactor (tabela limpa, filtros aprimorados)
- [ ] **Commit/push das mudanças de frontend** ainda não commitadas (Tabs, TournamentHeader, TournamentLayout, ui/, index.css, Dashboard, TournamentHub, LineupBuilder)

### 🟡 Dados
- [ ] **Jogadores sem live_pubg_id** (PAS Scrims) — restam ~26 jogadores
  - **Pendentes:** DUEL_Woo1y, INJ_Plushiee, TAES_Jaxinho, TAES_zMakhul, FEAR_VapeSkr, FEAR_LucasMSzin, TTG_Heatn, TTG_M8, TTG_Maffooo, X10_kl4uZeera, TQ_RxbrrrT, NVM_1Yess, NVM_skatasxtico, PNG_Falw-, EMT_KpN1, DOTS_OtosakaYu-, WIT_marcis, INSK_0racle_, NA_Balefrost, NA_ega, OMG_ALVARO-__--, OMG_FerHopper201, OMG_TUT4NK4M0N_, OMG_XNz-Pain, PSTL_FaKe
  - **Estratégia:** importar futuras sessões → debug-match-resolve → muitos se resolvem sozinhos
  - ⚠️ TAES no DB = VOID/VD no wasdefy (tag esportiva vs tag atual)

### 📅 Infra / Features futuras
- [ ] **Feature: Price History** — adicionar `tournament_id` em `PlayerPriceHistory`, endpoint `GET /players/{id}/price-history`, sparkline no frontend
- [ ] **Guia de atualização manual** criado em `GUIA_ATUALIZACAO_STATS.md` (na raiz do projeto) — commitar junto com as outras mudanças pendentes

## Como Importar Próximas Sessões de PAS Scrims (fluxo rápido)
```powershell
# 1. Obter 1 Steam name por grupo com o usuário (formato "Playing as X" do wasdefy)
# 2. Usar a PUBG API via browser (navegar para api.pubg.com primeiro para evitar CORS):
#    GET https://api.pubg.com/shards/steam/players?filter[playerNames]=NOME
#    Filtrar matches pelo horário da sessão (janela UTC)
# 3. Identificar os 15 match IDs únicos (5 por grupo, round-robin entre grupos)
# 4. Importar:
$body = '{"pubg_match_ids":[{"id":"UUID1"},{"id":"UUID2"},...], "shard":"steam"}'
Invoke-RestMethod -Uri "https://pubg-fantasy-platform.onrender.com/historical/import-matches-by-ids/7?background=true" -Method POST -Headers $headers -Body $body
# 5. Verificar:
Invoke-RestMethod -Uri "https://pubg-fantasy-platform.onrender.com/tournaments/7/matches" -Headers $headers | Select-Object -ExpandProperty days | Select-Object date, matches_count
```

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
Invoke-RestMethod -Uri "https