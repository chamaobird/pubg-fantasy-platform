# CHANGELOG — XAMA Fantasy
> Histórico de desenvolvimento + estado atual do projeto.
> **Para iniciar uma sessão nova:** anexar CONTEXT.md + este arquivo. A seção "Estado Atual" te situa.

---

## Estado Atual — 11/04/2026 (fim da sessão completa)

### Próximas tarefas (UX backlog)
Ver BACKLOG.md para lista completa. Principais pendentes:

**Stats:** UX-17 (timezone no seletor de partida), UX-18 (logo/tag nas páginas de Lineup)

**Pricing:** PRICE-01 (preços saindo como inteiros — revisar fórmula para 2 casas decimais)

**Landing/Auth:** UX-01 a UX-04, UX-06

**Dashboard:** UX-08 (datas — requer campos na API), UX-09 (nº de dias/partidas — requer campos na API)

**Championships:** UX-12 (datas e partidas por stage — requer campos na API)

**Infra:** #120 (click tracking Resend), #121 (BIMI DNS)

### Stack e migrations
- Migrations aplicadas até 0010 (map_name na tabela match)
- Próxima migration: revision = "0011", down_revision = "0010"
- 60 partidas com map_name populado via backfill
- cron-job.org configurado para pingar /stages/ a cada 14 min (evitar sleep do Render free tier)

---

## Sessão de UX + Features — 11/04/2026 (parte 2)

### Features implementadas

**Team logos nas Player Stats**
- Backend: player-stats retornava team_name: null — corrigido criando team_map a partir dos Rosters já carregados
- TeamLogo.jsx: adicionado .webp como tentativa antes de .png (todos os times PGS estão em .webp)
- teamLogo.js: mesmo ajuste no utilitário

**Logo do campeonato + dropdown de stages (TournamentHeader)**
- Logo do campeonato aparece à esquerda do nome (carrega /logos/Tournaments/PGS.webp)
- Nome da stage vira botão clicável com dropdown de todas as stages do mesmo championship
- Dropdown com maxHeight 320px + scroll
- Campo de busca aparece automaticamente quando há mais de 6 stages
- Stage atual destacada em laranja com borda esquerda
- TournamentHub busca siblingStages via GET /stages/?championship_id=N
- TournamentLayout atualizado para repassar novas props

**Championships (UX-11, UX-13)**
- Logo do campeonato carregando de /logos/Tournaments/ (PGS.webp, PGS.png, PAS.png)
- Detecção corrigida para "PUBG Global Series" (não só "PGS")
- Stages ordenadas do mais recente para o mais antigo (id desc)
- short_name movido para direita, sem background — só texto discreto muted
- Championship renomeado no banco: "PUBG Global Series 2026 - Circuito 1"

**Decisões de modelagem confirmadas**
- Um Championship por circuito do PGS
- PAS será Championship separado
- Estrutura atual suporta múltiplos campeonatos em paralelo

---

## Sessão de UX + Bugs — 11/04/2026 (parte 1)

### Bugs corrigidos
- Google OAuth redirecionava para localhost → FRONTEND_URL criada no Render
- GET /stages/{id}/days 500 → StageDayOut.is_active com default True

### Features implementadas
- UX-07: fallback username usa prefixo do email
- UX-10: badge short_name removido das rows do Dashboard
- Badge de status: locked→ENCERRADO, open→ABERTA, closed→EM BREVE (Badge.jsx + Navbar.jsx)
- PlayerStatsPage: botão TOTAL, preço 3 casas, estrela BEST removida
- PlayerStatsPage: seletor de partida com ícone e nome do mapa + fuso do navegador
- Backend: coluna map_name no Match (migration 0010), salvo no import, retornado no MatchOut
- Backfill: 60 partidas com map_name populado

---

## Sessão de UX + Auth — 10/04/2026
- BUG-01 a BUG-06 corrigidos
- UX-05, UX-14, UX-15, UX-16 implementados
- Google OAuth, forgot/reset password, email templates, domínio Resend
- Migration 0009: password_reset_token + password_reset_expires_at

---

## Fases anteriores
- Fase 7: scoring, leaderboard, sparklines, TeamLogo cascading fallbacks
- Fase 5: pricing linear (migration 0003)
- Fases 3-4: import, scoring XAMA, lineup, replicação (migration 4bfb4ef75223)
- Fase 0-2: full reset, schema 14 tabelas (0001, 0002), JWT + Google OAuth
- Bloco A: 8 Stages PGS, 97 Persons, 197 PlayerAccounts, 512 Rosters, 60 matches, 3840 match_stats

---

## Aprendizados permanentes
- Torneios oficiais: shard pc-tournament; scrims/PAS: steam
- bcrypt==4.0.1 + passlib==1.7.4 fixados
- Google OAuth no Render: BACKEND_URL fixo, nunca request.url_for
- Render free tier dorme após inatividade — cron-job.org a cada 14 min
- psql: sempre arquivo .sql com encoding ASCII, nunca -c inline
- team_name vem do Roster, não da Person — player-stats precisava de team_map
- Logos de times PGS estão em .webp — TeamLogo deve tentar .webp antes de .png
