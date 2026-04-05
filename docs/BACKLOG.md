# BACKLOG — XAMA Fantasy

## 🔴 Bugs ativos (producao)
> Os bugs #001-#003 eram do schema antigo e foram descartados com o reset.

## 🟡 Proximas tarefas (priorizadas)

### Fundacao (Fase 1) ✅
- [x] #010 Novo schema completo — migrations Alembic
- [x] #011 Swagger dark mode (main.py)
- [x] #012 APScheduler integrado ao FastAPI (lineup_control + pricing placeholder)
- [x] #014 Auth — User model, JWT, Google OAuth, register/login/me
- [ ] #013 Confirmacao de email via Resend (aguardando conta Resend)

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
- [x] #000 Schema antigo movido para _legacy/, projeto resetado (05/04/2026)
- [x] #010 Migration 0001 — schema completo (14 tabelas) (05/04/2026)
- [x] #011 Swagger dark mode — CSS inline, tema roxo/escuro (05/04/2026)
- [x] #012 APScheduler — lineup_control (1min) + pricing placeholder (30min) (05/04/2026)
- [x] #014 Auth — tabela user, JWT, Google OAuth, /auth/register /login /me /google (05/04/2026)
