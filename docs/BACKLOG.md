# BACKLOG — XAMA Fantasy

## 🟡 Próximas tarefas (priorizadas)

### Fase 9 — Filtros e correções de UX
- [ ] #094 PlayerStats: filtros por dia, por partida e fix do dropdown de times (shortName não propagado → tags aparecem como "—")
- [ ] #095 TournamentHub: passar shortName da stage como prop para PlayerStatsPage e TeamLogo

### Auth (pendente)
- [ ] #013 Confirmação de email via Resend (aguardando conta Resend)

### Pricing — próximas melhorias (Bloco C)
- [ ] #101 Job de polling de partidas ao vivo — detecta novas partidas durante torneio e importa automaticamente
- [ ] #103 Suporte a upload de jogadores via planilha (CSV) para casos de shard steam

## 🟢 Concluído

### Fase 0 — Setup
- [x] #000 Diagnóstico estrutural e desenho do novo modelo (05/04/2026)
- [x] #000 Projeto movido para C:\Users\lgpas\PROJECTS\pubg-fantasy-platform (05/04/2026)
- [x] #000 Schema antigo movido para _legacy/, projeto resetado (05/04/2026)

### Fase 1 — Fundação
- [x] #010 Migration 0001 — schema completo (14 tabelas) (05/04/2026)
- [x] #011 Swagger dark mode — CSS inline, tema roxo/escuro (05/04/2026)
- [x] #012 APScheduler — lineup_control (1min) + pricing placeholder (30min) (05/04/2026)
- [x] #014 Auth — tabela user, JWT, Google OAuth, /auth/register /login /me /google (05/04/2026)

### Fase 2 — Admin core
- [x] #020 CRUD Championship (05/04/2026)
- [x] #021 CRUD Stage com validações de shard, lineup_open_at e carries_stats_from (05/04/2026)
- [x] #022 CRUD Stage Day (05/04/2026)
- [x] #023 CRUD Person + PlayerAccount (05/04/2026)
- [x] #024 Roster — add/list/update/remove player from stage (05/04/2026)

### Fase 3 — Import e stats
- [x] #030 Import de matches com shard herdado da Stage (06/04/2026)
- [x] #031 Resolução de identidade via PERSON + PLAYER_ACCOUNT (06/04/2026)
- [x] #032 Cálculo de MATCH_STAT e PERSON_STAGE_STAT (06/04/2026)
- [x] #033 Reprocess funcional para qualquer shard (06/04/2026)

### Fase 4 — Lineup e jobs
- [x] #040 Montagem de lineup por STAGE_DAY (06/04/2026)
- [x] #041 APScheduler — abertura/fechamento automático (06/04/2026)
- [x] #042 Replicação de lineup (validação de budget e reserva) (06/04/2026)
- [x] #043 Botão manual de emergência para override de lineup_status (06/04/2026)

### Fase 5 — Pricing
- [x] #050 Cálculo de fantasy_cost com régua linear por stage (06/04/2026)
- [x] #051 Suporte a newcomer_to_tier com custo fixo configurável por stage (06/04/2026)
- [x] #052 cost_override manual com auditoria via RosterPriceHistory (06/04/2026)
- [x] #053 Recálculo automático via APScheduler após cada dia (06/04/2026)
- [x] #054 ROSTER_PRICE_HISTORY — histórico de preços com source auto|override (06/04/2026)

### Fase 6 — Frontend
- [x] #060 LineupBuilder reescrito para novo backend — 4 titulares + 1 reserva + capitão (07/04/2026)
- [x] #061 Exibição de effective_cost por jogador com badge newcomer (07/04/2026)
- [x] #062 Histórico de preços por jogador — modal PriceHistoryModal (07/04/2026)
- [x] #063 Painel admin de override de custo — AdminPricingPanel com recálculo manual (07/04/2026)

### Correções e infra (Fase 6)
- [x] Endpoints públicos /stages/ — list, detail, days, roster, price-history (07/04/2026)
- [x] Migration 0004 — is_captain em lineup_player (07/04/2026)
- [x] Migration 0005 — short_name e is_active em stage (07/04/2026)
- [x] Lineup service corrigido — RESERVE_COUNT=1, capitão com multiplicador x1.3 (07/04/2026)
- [x] Dashboard reescrito para /stages/ (07/04/2026)
- [x] LandingPage corrigida — endpoints /auth/login e /auth/register (07/04/2026)

### Fase 7 — Scoring e resultados (08/04/2026)
- [x] #070 Calcular points_earned por LineupPlayer após cada dia (captain_multiplier por stage)
- [x] #071 Atualizar total_points no Lineup após scoring
- [x] #072 Calcular UserDayStat e UserStageStat após cada dia
- [x] #073 Leaderboard público por stage (/stages/{id}/leaderboard e /days/{id}/leaderboard)
- [x] #074 Migrar TournamentLeaderboard e PlayerStatsPage para novos endpoints
- [x] Migration 0006 — captain_multiplier em stage (default 1.30, configurável por torneio)
- [x] GET /stages/{id}/days/{day_id}/matches — endpoint público de partidas por dia
- [x] GET /stages/{id}/player-stats — stats agregados com filtros stage/dia/partida
- [x] PlayerStatsPage — sparkline de pts por dia + badge melhor partida
- [x] TeamLogo — resolução de pasta por campeonato (PAS/ PGS/) com fallback em cascata
- [x] scoring_job adicionado ao APScheduler (1min, detecta StageDays prontos para pontuar)

### Bloco A — Populate PGS 2026 (08/04/2026)
- [x] Diagnóstico de dados disponíveis na PUBG API (60 matches em 8 stages)
- [x] scripts/pubg/check_pgs_data.py + check_pgs_retry.py
- [x] scripts/pubg/populate_pgs2026.py — Championship + 8 Stages + 12 StageDays + 60 matches
- [x] scripts/pubg/populate_players.py — 97 Persons + 197 PlayerAccounts (agrupamento por alias)
- [x] scripts/pubg/populate_rosters.py — 512 Rosters (64 por stage)
- [x] Correções em client.py (load_dotenv), import_.py, scoring.py, match_stat.py, main.py
- [x] 3840 match_stats com xama_points calculados por dados reais

### Bloco B — Pricing refatorado (08/04/2026)
- [x] Migration 0007 — tier_weight em championship (default 1.00)
- [x] app/services/pricing.py — algoritmo exponencial (λ=0.02, max_days=150, min_valid=20)
- [x] app/models/championship.py + app/schemas/championship.py atualizados
- [x] Pricing validado com dados reais: régua 12–35, Hakatory(NAVI) topo com 35

### Fase 8 — Admin scoring + UX + limpeza de legado (09/04/2026)
- [x] #090 Admin: endpoint POST /admin/stages/{id}/score-day (scoring manual de um StageDay)
- [x] #091 Admin: endpoint POST /admin/stages/{id}/rescore (rescore completo da stage)
- [x] #092 Frontend: LineupResultsPage — pontuação por jogador por dia com acumulado
- [x] #093 Frontend: exibir captain_multiplier no LineupBuilder (badge + slot do capitão)
- [x] #081 Championships page — nova página /championships consumindo novo backend
- [x] #082 Profile — endpoints corrigidos /users/me → /auth/me, estados mortos removidos
- [x] #083 Navbar — link Torneios → Campeonatos (/championships)
- [x] #100 tier_weight validado no Swagger (campo presente em Championship create/update)
- [x] #102 pricing_n_matches deprecated — removido de StageCreate/Update/Response
- [x] #110 distribute_matches_by_day — reescrita com divmod, robusta para N dias
- [x] #111 pgs_match_ids.json — path atualizado para scripts/pubg/data/ com fallback legado

### Limpeza de legado (09/04/2026)
- [x] TournamentSelect.jsx arquivado — substituído por Championships.jsx
- [x] TournamentHub.jsx — legacySharedProps removidos
- [x] TournamentLeaderboard.jsx — props legadas removidas, recebe só token + stageId
- [x] PlayerStatsPage.jsx — props legadas removidas, ChampionshipSelector removido
- [x] App.jsx — rota /tournaments → redirect para /championships
- [x] Correção de ImportError: MatchStat em lineup_scoring.py e scoring_job.py
- [x] Migration 0007 commitada no repositório (estava untracked)
