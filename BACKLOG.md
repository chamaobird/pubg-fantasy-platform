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

- [ ] ReplayCard — Adicionar `stage_date` em `StageHistoryEntry` (app/routers/profile.py)
      pra ReplayCard mostrar data correta. Por ora, exibe `championship_short_name`
      como sufixo do nome da stage.
