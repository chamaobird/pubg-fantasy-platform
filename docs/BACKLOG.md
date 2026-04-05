# BACKLOG — XAMA Fantasy

## 🔴 Bugs ativos (producao)
- [ ] #001 player-stats retorna jogadores de outros torneios (falta filtro por tournament_id)
- [ ] #002 late_game_bonus zerado no reprocess-match-stats (nao recalcula bonus)
- [ ] #003 seed-players-from-matches e reprocess-match-stats ignoram shard da stage

## 🟡 Proximas tarefas (priorizadas)

### Fundacao (Fase 1)
- [ ] #010 Novo schema completo — migrations Alembic (ver ARCHITECTURE.md)
- [ ] #011 Swagger dark mode (main.py)
- [ ] #012 APScheduler integrado ao FastAPI

### Admin core (Fase 2)
- [ ] #020 CRUD Championship
- [ ] #021 CRUD Stage (com validacao de lineup_open_at obrigatorio)
- [ ] #022 CRUD Stage Day
- [ ] #023 CRUD Person + Player Account
- [ ] #024 Endpoint para adicionar jogador ao Roster de uma Stage

### Import e stats (Fase 3)
- [ ] #030 Import de matches com shard herdado da Stage
- [ ] #031 Resolucao de identidade via PERSON + PLAYER_ACCOUNT
- [ ] #032 Calculo de MATCH_STAT e PERSON_STAGE_STAT
- [ ] #033 Reprocess funcional para qualquer shard

### Lineup e jobs (Fase 4)
- [ ] #040 Montagem de lineup por STAGE_DAY
- [ ] #041 APScheduler — abertura/fechamento automatico
- [ ] #042 Replicacao de lineup (validacao de budget e disponibilidade)
- [ ] #043 Botao manual de emergencia para override de lineup_status

### Pricing (Fase 5)
- [ ] #050 Calculo de fantasy_cost com pesos por championship
- [ ] #051 Suporte a newcomer_to_tier com cap configuravel
- [ ] #052 cost_override manual com auditoria
- [ ] #053 Recalculo automatico apos cada dia
- [ ] #054 ROSTER_PRICE_HISTORY

## 🟢 Concluido
- [x] #000 Diagnostico estrutural e desenho do novo modelo (05/04/2026)
- [x] #000 Projeto movido para C:\Users\lgpas\PROJECTS\pubg-fantasy-platform (05/04/2026)
