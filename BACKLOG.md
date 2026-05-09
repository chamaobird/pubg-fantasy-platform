# BACKLOG

Lista de melhorias e tech debt identificados durante o desenvolvimento.

## Navbar

- [ ] Navbar: dinamizar pill "LIVE — PAS 2026 · PEC 2026"
      (atualmente hardcoded). Derivar de torneios com stages ativos
      via fetch ou store global. Mostrar até 3 torneios; se mais,
      truncar com "+N".

## LeagueDetail

- [ ] LeagueDetail:152 — bug identificado durante landing refresh
      (ver projeto memory project_landing_refresh)

## Dashboard — Offseason

- [ ] AnticipationCard (próximo torneio) — precisa de fonte de dados de championship
      futuro pra renderizar. Pulado na Fase E6; retomar quando houver endpoint ou
      lógica de "próximo championship agendado".

- [x] ReplayCard — `stage_date` adicionado em `StageHistoryEntry` (app/routers/profile.py)
      na Fase F (09/05/2026). ReplayCard exibe data da stage com `buildDateLabel`.
