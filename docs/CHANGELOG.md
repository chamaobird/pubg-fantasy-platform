# CHANGELOG — XAMA Fantasy
> Para iniciar sessão: anexar CONTEXT.md + este arquivo.

---

## Estado Atual — 12/04/2026 (fim de sessão)

### Próximas tarefas
- Quarta 15/04: ajustar preços dos invited manualmente (TGLTN, CowBoi etc. estão com preço do PGS)
- Quarta 15/04: mudar lineup_status da stage 15 para 'open' para abrir montagem
- Após primeira partida 17/04: validar/corrigir Steam names via manage_player_accounts.py
- UX: Dashboard e TournamentHub ainda sem redesign atmosférico completo
- UX: ordenação por nome de time no PlayerStatsPage e LineupBuilder (pendência antiga)

### Stack e migrations
- Migrations aplicadas até 0011 (roster cost Numeric 6,2)
- Próxima migration: revision = "0012", down_revision = "0011"

---

## Sessão 12/04/2026 — PAS1 Playoffs 1 + Redesign

### PAS1 Playoffs 1 — banco populado
- Championship "PUBG Americas Series 1 2026 - Playoffs 1" (id=7, shard=steam)
- 3 Stages: Playoffs 1 Dia 1/2/3 (ids 15/16/17), lineup_status=closed
- 3 StageDays: 17/04, 18/04, 19/04
- 64 Rosters no Dia 1 (16 times × 4 jogadores), preços por tier: high=33, mid=28, open=18
- 199 Persons, 305 PlayerAccounts (pending_ALIAS para sem Steam ID confirmado)
- Scripts em scripts/pubg/: populate_pas1_playoffs.py, manage_player_accounts.py
- SHARD configurável no topo do populate script (steam vs pc-tournament)

### Estudo PAS — fluxo documentado
- shard=steam para scrims públicas; shard do Esports Server a confirmar após 1ª partida
- Sessão BR confirmada via 5 partidas esports-squad-fpp do dia 11/04
- 40 account_ids confirmados via cruzamento com scrims públicas
- Protocolo pós-partida: comparar nomes da API com player_account.alias → corrigir via manage_player_accounts.py sem afetar lineups dos usuários

### Frontend — redesign atmosférico
- AppBackground.jsx: grade hexagonal + gradiente radial laranja (valores idênticos à Landing)
- RequireAuth em App.jsx: injeta AppBackground em todas as páginas internas automaticamente
- Championships.jsx: cards com backdropFilter blur, navbar semi-transparente
- Profile.jsx: cards semi-transparentes
- Dashboard: transparente via .xama-page (index.css)
- lineup_status=locked: lineup visível mas não editável (prop canEdit no LineupBuilder)
- TournamentHub: isLocked e canEdit separados do isFinished

---

## Sessão 11/04/2026 — Landing/Auth redesign + pricing + modais
(ver versão anterior do CHANGELOG)
