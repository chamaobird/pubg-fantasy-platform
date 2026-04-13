# CHANGELOG — XAMA Fantasy
> Para iniciar sessão: anexar CONTEXT.md + este arquivo.

---

## Estado Atual — 13/04/2026 (fim de sessão)

### Próximas tarefas
- Quarta 15/04: ajustar preços dos invited manualmente (verificar TGLTN=35 ok, CowBoi=24.34, Kickstart=22.22, hwinn — confirmar valores corretos)
- Quarta 15/04: mudar lineup_status da stage 15 de `preview` para `open` após confirmar roster oficial
- Após primeira partida 17/04: validar/corrigir Steam names via manage_player_accounts.py

### Backlog UX (próximas sessões)
1. **Dashboard** — título do card mostra "Playoffs 1 - Dia 1"; idealmente mostrar nome do campeonato completo ou abreviado (ex: "PAS1 2026 Playoffs 1"). Logo do torneio já aparece.
2. **Championships.jsx** — stages em `preview` mostram badge "EM BREVE" igual às `closed`; criar badge diferenciado "EM PREVIEW" para consistência com o Dashboard
3. **TournamentHub / LineupBuilder** — aumentar tipografia da tabela de jogadores (atualmente pequena demais para leitura confortável)
4. **LineupBuilder** — replicar colunas e ordenação da aba Stats (Preço, PTS XAMA, PTS/G, K, Ass, Dmg, Surv, Partidas) para manter coerência visual entre as duas abas
5. **Logos dos times** — confirmar localização dos arquivos e ajustar paths se necessário (alguns times aparecem sem logo)
6. **Ordenação por nome de time** no PlayerStatsPage e LineupBuilder (pendência antiga)
7. **Redesign atmosférico** completo do Dashboard e TournamentHub (pendência antiga)

---

## Sessão 13/04/2026 — Preview status + correção de tags + UX Dashboard

### Status `preview` implementado
- Novo valor `preview` adicionado ao check constraint do banco via migration 0012
- `app/schemas/stage.py`: `preview` adicionado aos validators de `StageCreate` e `StageUpdate`
- `app/routers/lineups.py`: `ForceStatusRequest` aceita `preview`; documentação atualizada
- `app/services/lineup.py`: `_assert_lineup_open` distingue `preview` (mensagem específica) de outros status bloqueados
- Stage 15 (Playoffs 1 - Dia 1) ativada em `preview` via SQL
- Comando para abrir de verdade: `UPDATE stage SET lineup_status = 'open' WHERE id = 15;`

### Frontend — preview no Dashboard e TournamentHub
- `Dashboard.jsx`: stages `preview` entram na seção "Lineup Aberta" com badge "⏳ EM PREVIEW", botão "VER LOBBY", texto explicativo de roster em validação
- `TournamentHub.jsx`: prop `isPreview` derivada do status, passada para o LineupBuilder
- `LineupBuilder.jsx`: banner laranja + botão desabilitado "⏳ LINEUP DESABILITADO — AGUARDANDO CONFIRMAÇÃO" quando `isPreview=true`; tabela de jogadores totalmente visível

### Correção de display_name (64 jogadores — stage 15)
- Todos os 64 jogadores do Playoffs 1 Dia 1 tiveram `display_name` corrigido para formato `TAG_PlayerName`
- Times corrigidos: FLCN, TL, FUR, 55PD, TOYO, ROC, BST, WOLF, PEST, X10, WIT, NA, NW, LB, FE, DUEL
- 7 jogadores tinham tag errada ou ausente: dnL1, enzito, Haven-, JoShY-_-, Luciid_oO, slabyy-, Tny7 → corrigidos

### UX — Dashboard e Championships
- `Dashboard.jsx`: logo do campeonato em cada card e row; ordem cronológica (menor data no topo); seção "Aguardando Abertura" defaultOpen=true
- `Championships.jsx`: datas das stages nas rows; ordem cronológica dentro de cada championship
- `PlayerStatsPage.jsx`: ordem de colunas corrigida (Preço → PTS XAMA → PTS/G → K → Ass → Dmg → Surv → P); ordenação por time funcional

### Migration 0012
- Adicionou `preview` ao check constraint `ck_stage_lineup_status`
- Constraint anterior: `('closed', 'open', 'locked')` → Nova: `('closed', 'open', 'locked', 'preview')`

---

## Sessão 12/04/2026 — PAS1 Playoffs 1 + Redesign
(ver versão anterior do CHANGELOG)
