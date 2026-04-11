# CHANGELOG — XAMA Fantasy
> Histórico de desenvolvimento + estado atual do projeto.
> **Para iniciar uma sessão nova:** anexar CONTEXT.md + este arquivo. A seção "Estado Atual" te situa.

---

## Estado Atual — 11/04/2026 (fim da sessão)

### Próximas tarefas (UX backlog)
Ver BACKLOG.md para lista completa. Principais pendentes:

**Landing/Auth:** UX-01 (background temático), UX-02 (form centralizado), UX-03 (título no card), UX-04 (confirmação de senha), UX-06 (copy das stats)

**Dashboard:** UX-08 (datas dos eventos — campos start_date/end_date não vêm da API ainda), UX-09 (nº de dias e partidas — days_count/matches_count não vêm da API ainda)

**Championships:** UX-11 (logo do campeonato), UX-12 (datas e partidas por stage), UX-13 (ordenar stages do mais recente)

**Infra pendente:** #120 (desabilitar click tracking Resend), #121 (BIMI record DNS)

### Stack e migrations
- Migrations aplicadas até 0010 (map_name na tabela match)
- Próxima migration: revision = "0011", down_revision = "0010"
- 60 partidas existentes com map_name populado via backfill

---

## Sessão de UX + Bugs — 11/04/2026

### Bugs corrigidos
- Google OAuth redirecionava para localhost em produção → FRONTEND_URL não configurada no Render → criada
- GET /stages/{id}/days retornava 500 → StageDayOut exigia is_active obrigatório → corrigido com default True

### Features implementadas

Dashboard (UX-07, UX-08 parcial, UX-09 parcial, UX-10)
- UX-07: fallback de username usa prefixo do email
- UX-08: datas de abertura/fechamento nas rows do dashboard
- UX-10: badge short_name removido das rows

Badge de status (Badge.jsx + Navbar.jsx)
- StatusBadge suporta lineup_status (open/closed/locked) além de active/upcoming/finished
- locked → ENCERRADO, open → ABERTA, closed → EM BREVE
- Navbar: LOCKED e FINISHED corrigidos para PT-BR

PlayerStatsPage
- Botão Stage renomeado para TOTAL; escondido quando há apenas 1 dia
- Preço com 3 casas decimais
- Estrela BEST removida — só valor numérico
- Seletor de partida exibe ícone de mapa (ex: P1 Erangel 08:00)

Backend — map_name
- app/models/match.py: coluna map_name adicionada
- app/services/import_.py: salva map_name ao importar
- app/routers/stages.py: map_name no MatchOut
- Migration 0010: add map_name to match
- scripts/backfill_map_names.py: 60 partidas populadas

---

## Sessão de UX + Auth — 10/04/2026

- BUG-01 a BUG-06 corrigidos (ver histórico anterior)
- UX-05, UX-14, UX-15, UX-16 implementados
- Google OAuth, forgot/reset password, email templates, domínio Resend
- Migration 0009: password_reset_token + password_reset_expires_at

---

## Fase 7 — Scoring e Results
- lineup_scoring service, APScheduler scoring job, endpoints de leaderboard
- TournamentLeaderboard.jsx e PlayerStatsPage.jsx com sparklines
- TeamLogo.jsx com cascading fallbacks

---

## Fase 5 — Pricing (Bloco B) — 06/04/2026
- Algoritmo linear: melhor=35, pior=12, newcomer=15
- Migration 0003: campos de pricing na Stage

---

## Fases 3–4 — Match Import + Lineup — 06/04/2026
- Import de matches com shard inheritance, resolução de identidade
- Motor de scoring XAMA, submissão de lineup, replicação automática
- Migration 4bfb4ef75223

---

## Fase 0–2 — Setup e Auth — 05/04/2026
- Full reset, novo schema 14 tabelas (0001), User model (0002)
- JWT + Google OAuth, admin CRUD completo

---

## Bloco A — Populate PGS 2026
- 8 Stages, 97 Persons, 197 PlayerAccounts, 512 Rosters, 60 matches, 3840 match_stats

---

## Aprendizados permanentes
- Torneios oficiais: shard pc-tournament; scrims/PAS: steam
- bcrypt==4.0.1 + passlib==1.7.4 fixados
- Google OAuth no Render: BACKEND_URL fixo, nunca request.url_for
- Render free tier dorme após inatividade — aguardar ~30s no primeiro acesso
- psql: sempre arquivo .sql com encoding ASCII, nunca -c inline
