# CHANGELOG — XAMA Fantasy
> Para iniciar sessão: anexar CONTEXT.md + este arquivo.

---

## Estado Atual — 13/04/2026 (fim de sessão tarde)

### Próximas tarefas operacionais
- Quarta 15/04: ajustar preços dos invited manualmente (verificar TGLTN=35 ok, CowBoi=24.34, Kickstart=22.22, hwinn — confirmar valores corretos)
- Quarta 15/04: mudar lineup_status da stage 15 de `preview` para `open` após confirmar roster oficial
- Após primeira partida 17/04: validar/corrigir Steam names via manage_player_accounts.py

### Backlog UX (próximas sessões)
1. **Championships.jsx** — stages em `preview` mostram badge "EM BREVE" igual às `closed`; criar badge diferenciado "EM PREVIEW"
2. **TournamentHub / LineupBuilder** — aumentar tipografia da tabela de jogadores
3. **LineupBuilder** — replicar colunas e ordenação da aba Stats (Preço, PTS XAMA, PTS/G, K, Ass, Dmg, Surv, Partidas)
4. **Logos dos times** — confirmar paths no LineupBuilder
5. **Ordenação por nome de time** no PlayerStatsPage e LineupBuilder (pendência antiga)

---

## Sessão 13/04/2026 (tarde) — Dashboard redesign + start_date/end_date

### Migration 0013
- Adicionou `start_date` e `end_date` (DateTime, timezone=True, nullable) à tabela `stage`
- Arquivo: `alembic/versions/0013_stage_dates.py`

### Backend
- `app/models/stage.py`: campos `start_date` e `end_date` adicionados
- `app/schemas/stage.py`: campos adicionados em `StageCreate`, `StageUpdate` e `StageResponse`
- `app/routers/stages.py`: `StageOut` (schema local com `from_orm_stage()`) atualizado para expor `start_date`, `end_date`, `lineup_open_at`, `lineup_close_at`

### Datas populadas no banco
- Script: `scripts/populate_stage_dates.sql`
- PAS1 Playoffs: Dia 1 = 2026-04-18 01:00 UTC, Dia 2 = 2026-04-19 01:00 UTC, Dia 3 = 2026-04-20 01:00 UTC
- PGS Circuit 1: todas as 8 stages com start_date/end_date baseados nos horários oficiais dos jogos

### Dashboard redesign completo
- **Hierarquia de cards**: open = card grande (grid), preview = card médio horizontal com borda laranja pulsante, closed/locked = rows compactos
- **Logo real** nos cards (PAS.png detectado via `includes('AMERICAS')`)
- **Datas com dia da semana e horário** no fuso local do usuário — ex: "sex., 17 de abr. · 21:00"
- **Ordenação cronológica** por `start_date` (fallback `lineup_open_at`) em todas as seções
- **Mensagem preview** corrigida: "Lineup aguardando confirmação — a montagem será liberada em breve."
- **Seção Resultados**: mostra pontuação e rank do usuário por stage; busca lineups também para stages `locked`
- **Nome do campeonato** visível em todos os cards e rows
- Logos: `PreviewCard` = 56px, `StageRow` = 32px

---

## Sessão 13/04/2026 (manhã) — Preview status + correção de tags + UX Dashboard

### Status `preview` implementado
- Novo valor `preview` adicionado ao check constraint do banco via migration 0012
- `app/schemas/stage.py`: `preview` adicionado aos validators de `StageCreate` e `StageUpdate`
- `app/routers/lineups.py`: `ForceStatusRequest` aceita `preview`; documentação atualizada
- `app/services/lineup.py`: `_assert_lineup_open` distingue `preview` (mensagem específica) de outros status bloqueados
- Stage 15 (Playoffs 1 - Dia 1) ativada em `preview` via SQL

### Frontend — preview no Dashboard e TournamentHub
- `Dashboard.jsx`: stages `preview` entram na seção "Lineup Aberta" com badge "⏳ EM PREVIEW"
- `TournamentHub.jsx`: prop `isPreview` derivada do status, passada para o LineupBuilder
- `LineupBuilder.jsx`: banner laranja + botão desabilitado quando `isPreview=true`

### Correção de display_name (64 jogadores — stage 15)
- Todos os 64 jogadores do Playoffs 1 Dia 1 corrigidos para formato `TAG_PlayerName`

### Migration 0012
- Adicionou `preview` ao check constraint `ck_stage_lineup_status`

---

## Sessão 12/04/2026 — PAS1 Playoffs 1 + Redesign
(ver versão anterior do CHANGELOG)
