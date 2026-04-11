# CHANGELOG — XAMA Fantasy
> Histórico de desenvolvimento + estado atual do projeto.
> **Para iniciar uma sessão nova:** anexar CONTEXT.md + este arquivo. A seção "Estado Atual" te situa.

---

## Estado Atual — 11/04/2026 (fim de sessão)

### Próximas tarefas
Ver BACKLOG.md para lista completa. Principais pendentes:

**UX-18** — logos e tags dos times no LineupBuilder
**UX-01 a UX-06** — melhorias na Landing/Auth
**UX-08/09** — datas e nº de partidas no Dashboard (requer campos na API)
**UX-12** — datas por stage em Championships (requer campos na API)
**#120** — desabilitar click tracking Resend
**PlayerHistoryModal** — tooltip com comportamento errático em SVG (conhecido, baixa prioridade)

### Stack e migrations
- Migrations aplicadas até 0011 (roster cost Numeric 6,2)
- Próxima migration: revision = "0012", down_revision = "0011"
- 60 partidas com map_name populado
- Pricing recalculado nas stages 2-8 com decimais

---

## Sessão 11/04/2026 — parte 3

### Pricing corrigido
- MIN_VALID_MATCHES: 20 → 5 (1 dia completo de competição)
- fantasy_cost, cost_override, cost: Integer → Numeric(6,2) — migration 0011
- _interpolate retorna float com 2 casas
- Schemas RosterPlayerOut, PriceHistoryOut, PlayerStatOut: int → float
- Recalculo rodado nas stages 2-8 via Swagger

### PlayerHistoryModal — novo componente
- Modal com gráfico de barras SVG ao clicar no nome de qualquer jogador
- Endpoint: GET /stages/persons/{person_id}/match-history?limit=15&before_date=...
- Logo do time no header do modal
- Barras negativas (early death penalty) crescem para baixo com escala unificada
- Eixo X: ícone de mapa + stage + dia + data DD/MM
- Tooltip ao hover: kills/assists/knocks, dano, colocação, mapa (comportamento errático em bordas — conhecido)
- before_date: filtro por contexto do clique (stage/dia atual)
- Integrado em PlayerStatsPage e LineupBuilder

### Team logos corrigidos
- app/routers/stages.py: team_name vinha null no player-stats → corrigido via team_map dos Rosters
- TeamLogo.jsx + teamLogo.js: .webp adicionado antes de .png na cadeia de fallback

### TournamentHeader
- Logo do campeonato à esquerda do nome
- Dropdown de stages com busca (aparece quando >6 stages), scroll, stage atual destacada
- TournamentHub busca siblingStages via GET /stages/?championship_id=N

### Championships
- Logo carregando de /logos/Tournaments/ (PGS.webp, PAS.png)
- Stages ordenadas do mais recente para o mais antigo
- short_name movido para direita, discreto
- Championship renomeado: "PUBG Global Series 2026 - Circuito 1"

---

## Sessão 11/04/2026 — partes 1 e 2

- Google OAuth localhost fix, StageDayOut.is_active fix
- UX-07, UX-10, Badge status, Navbar PT-BR
- PlayerStatsPage: TOTAL, preço 3 casas, estrela BEST removida, seletor com mapa+fuso
- map_name: migration 0010, import, MatchOut, backfill 60 partidas

---

## Sessão 10/04/2026
- BUG-01 a BUG-06, UX-05, UX-14, UX-15, UX-16
- Google OAuth, forgot/reset password, Resend, migration 0009

---

## Fases anteriores
- Fases 0-9, Blocos A e B — ver histórico completo na versão anterior do CHANGELOG
