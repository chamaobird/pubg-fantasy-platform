# BACKLOG — XAMA Fantasy

## 🟡 Proximas tarefas (priorizadas)

### Auth (pendente)
- [ ] #013 Confirmacao de email via Resend (aguardando conta Resend)

### Melhorias pendentes
- [ ] #081 TournamentSelect page — adaptar para novo backend (/stages/)
- [ ] #082 Perfil do usuario — verificar endpoints
- [ ] #083 TeamLogo — passar shortName da stage nos componentes que usam <TeamLogo /> para resolucao correta de pasta

### Fase 8 — Melhorias de UX e admin
- [ ] #090 Admin: endpoint para disparar scoring manual de um StageDay
- [ ] #091 Admin: endpoint para rescore_stage completo
- [ ] #092 Frontend: pagina de resultados por lineup (ver pontos de cada jogador apos o dia)
- [ ] #093 Frontend: exibir captain_multiplier configurado na stage no LineupBuilder

## 🟢 Concluido

### Fase 0 — Setup
- [x] #000 Diagnostico estrutural e desenho do novo modelo (05/04/2026)
- [x] #000 Projeto movido para C:\Users\lgpas\PROJECTS\pubg-fantasy-platform (05/04/2026)
- [x] #000 Schema antigo movido para _legacy/, projeto resetado (05/04/2026)

### Fase 1 — Fundacao
- [x] #010 Migration 0001 — schema completo (14 tabelas) (05/04/2026)
- [x] #011 Swagger dark mode — CSS inline, tema roxo/escuro (05/04/2026)
- [x] #012 APScheduler — lineup_control (1min) + pricing placeholder (30min) (05/04/2026)
- [x] #014 Auth — tabela user, JWT, Google OAuth, /auth/register /login /me /google (05/04/2026)

### Fase 2 — Admin core
- [x] #020 CRUD Championship (05/04/2026)
- [x] #021 CRUD Stage com validacoes de shard, lineup_open_at e carries_stats_from (05/04/2026)
- [x] #022 CRUD Stage Day (05/04/2026)
- [x] #023 CRUD Person + PlayerAccount (05/04/2026)
- [x] #024 Roster — add/list/update/remove player from stage (05/04/2026)

### Fase 3 — Import e stats
- [x] #030 Import de matches com shard herdado da Stage (06/04/2026)
- [x] #031 Resolucao de identidade via PERSON + PLAYER_ACCOUNT (06/04/2026)
- [x] #032 Calculo de MATCH_STAT e PERSON_STAGE_STAT (06/04/2026)
- [x] #033 Reprocess funcional para qualquer shard (06/04/2026)

### Fase 4 — Lineup e jobs
- [x] #040 Montagem de lineup por STAGE_DAY (06/04/2026)
- [x] #041 APScheduler — abertura/fechamento automatico (06/04/2026)
- [x] #042 Replicacao de lineup (validacao de budget e reserva) (06/04/2026)
- [x] #043 Botao manual de emergencia para override de lineup_status (06/04/2026)

### Fase 5 — Pricing
- [x] #050 Calculo de fantasy_cost com regua linear por stage (06/04/2026)
- [x] #051 Suporte a newcomer_to_tier com custo fixo configuravel por stage (06/04/2026)
- [x] #052 cost_override manual com auditoria via RosterPriceHistory (06/04/2026)
- [x] #053 Recalculo automatico via APScheduler apos cada dia (06/04/2026)
- [x] #054 ROSTER_PRICE_HISTORY — historico de precos com source auto|override (06/04/2026)

### Fase 6 — Frontend
- [x] #060 LineupBuilder reescrito para novo backend — 4 titulares + 1 reserva + capitao (07/04/2026)
- [x] #061 Exibicao de effective_cost por jogador com badge newcomer (07/04/2026)
- [x] #062 Historico de precos por jogador — modal PriceHistoryModal (07/04/2026)
- [x] #063 Painel admin de override de custo — AdminPricingPanel com recalculo manual (07/04/2026)

### Correccoes e infra (Fase 6)
- [x] Endpoints publicos /stages/ — list, detail, days, roster, price-history (07/04/2026)
- [x] Migration 0004 — is_captain em lineup_player (07/04/2026)
- [x] Migration 0005 — short_name e is_active em stage (07/04/2026)
- [x] Lineup service corrigido — RESERVE_COUNT=1, capitao com multiplicador x1.3 (07/04/2026)
- [x] Dashboard reescrito para /stages/ (07/04/2026)
- [x] LandingPage corrigida — endpoints /auth/login e /auth/register (07/04/2026)
- [x] Schemas championship e stage corrigidos para refletir models reais (07/04/2026)

### Fase 7 — Scoring e resultados (08/04/2026)
- [x] #070 Calcular points_earned por LineupPlayer apos cada dia (captain_multiplier por stage)
- [x] #071 Atualizar total_points no Lineup apos scoring
- [x] #072 Calcular UserDayStat e UserStageStat apos cada dia
- [x] #073 Leaderboard publico por stage (/stages/{id}/leaderboard e /days/{id}/leaderboard)
- [x] #074 Migrar TournamentLeaderboard e PlayerStatsPage para novos endpoints
- [x] Migration 0006 — captain_multiplier em stage (default 1.30, configuravel por torneio)
- [x] GET /stages/{id}/days/{day_id}/matches — endpoint publico de partidas por dia
- [x] GET /stages/{id}/player-stats — stats agregados com filtros stage/dia/partida
- [x] PlayerStatsPage — sparkline de pts por dia + badge melhor partida
- [x] TeamLogo — resolucao de pasta por campeonato (PAS/ PGS/) com fallback em cascata
- [x] scoring_job adicionado ao APScheduler (1min, detecta StageDays prontos para pontuar)
