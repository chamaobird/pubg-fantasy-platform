# BACKLOG — XAMA Fantasy

## 🟡 Proximas tarefas (priorizadas)

### Auth (pendente)
- [ ] #013 Confirmacao de email via Resend (aguardando conta Resend)

### Fase 6 — Frontend
- [ ] #060 Tela de lineup builder com budget e validacao de reserva
- [ ] #061 Exibicao de fantasy_cost e effective_cost por jogador
- [ ] #062 Historico de precos por jogador (RosterPriceHistory)
- [ ] #063 Painel admin de override de custo

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
