# BACKLOG — XAMA Fantasy

## 🔴 Alta prioridade — próxima sessão

### Operacional — 15/04
- [ ] #PAS-10 Confirmar e ajustar preços dos invited: TGLTN=35 ok, CowBoi=24.34, Kickstart=22.22, hwinn — verificar valor correto
- [ ] #PAS-11 Confirmar roster oficial divulgado e corrigir display_names se necessário
- [ ] #PAS-12 Abrir stage 15: `UPDATE stage SET lineup_status = 'open' WHERE id = 15;`
- [ ] #PAS-13 Após 1ª partida (17/04): validar/corrigir Steam names via `scripts/pubg/manage_player_accounts.py`

---

## 🟡 Média prioridade

### UX — Championships.jsx
- [ ] #UX-CHAMP-01 Badge diferenciado para stages em `preview` (atualmente mostra "EM BREVE" igual às `closed`)
- [ ] #UX-CHAMP-02 Avaliar se Championships vira página mais rica (stats, datas, histórico) para justificar existência separada do Dashboard

### UX — TournamentHub / LineupBuilder
- [ ] #UX-LB-01 Aumentar tipografia da tabela de jogadores (atualmente pequena demais)
- [ ] #UX-LB-02 Replicar colunas e ordenação da aba Stats na tabela do LineupBuilder (Preço, PTS XAMA, PTS/G, K, Ass, Dmg, Surv, Partidas)
- [ ] #UX-LB-03 Logos dos times no LineupBuilder — confirmar paths e ajustar se necessário

### UX — Consistência visual
- [ ] #UX-THEME Redesign atmosférico completo do Dashboard e TournamentHub
- [ ] #UX-04 Campo de confirmação de senha no cadastro

### UX — Stats
- [ ] #UX-17 Timezone no seletor de partida (ex: "21:00 EDT / 22:00 BRT")

### Ordenação (pendência antiga)
- [ ] #UX-SORT Ordenação por nome de time no `PlayerStatsPage` e `LineupBuilder`

### Infra
- [ ] #120 Desabilitar click tracking do Resend
- [ ] #121 BIMI record DNS

### Pricing — Bloco C
- [ ] #101 Job de polling de partidas ao vivo
- [ ] #103 Upload de jogadores via planilha CSV

---

## 🔧 Tech debt conhecido
- [ ] PlayerHistoryModal tooltip errático em bordas SVG — refatorar para HTML tooltip

---

## 🟢 Concluído

### Sessão 13/04/2026 (tarde) — Dashboard redesign
- [x] Migration 0013: `start_date` e `end_date` adicionados à tabela `stage`
- [x] Backend: campos expostos em `StageOut` (router local), `StageCreate`, `StageUpdate`, `StageResponse`
- [x] Datas populadas para todas as stages (PGS e PAS1) via `scripts/populate_stage_dates.sql`
- [x] Dashboard: card preview em destaque com logo real, borda laranja pulsante, hierarquia clara
- [x] Dashboard: datas com dia da semana e horário no fuso local do usuário
- [x] Dashboard: ordenação cronológica por `start_date` em todas as seções
- [x] Dashboard: seção Resultados com pontuação e rank do usuário por stage
- [x] Dashboard: nome do campeonato visível em todos os cards e rows
- [x] Fix: detecção de logo PAS via `includes('AMERICAS')` (nome real não contém "PAS")
- [x] Fix: `StageOut` local no router atualizado (era o que bloqueava `start_date` na API)

### Sessão 13/04/2026 (manhã) — Preview status + PAS1
- [x] Migration 0012: `preview` adicionado ao check constraint `ck_stage_lineup_status`
- [x] Status `preview` implementado no backend (schemas, router, service)
- [x] Frontend: card preview no Dashboard, prop `isPreview` no TournamentHub e LineupBuilder
- [x] 64 jogadores do Playoffs 1 Dia 1 com display_name corrigido para `TAG_PlayerName`
- [x] Championships.jsx: datas das stages, ordem cronológica
- [x] PlayerStatsPage.jsx: ordem de colunas corrigida

### Sessão 11/04/2026
- [x] Landing Atmospheric: grade hex, gradiente, scan line, form integrado, stats atualizadas
- [x] MIN_VALID_MATCHES 20→5, fantasy_cost Numeric(6,2), migration 0011
- [x] PlayerHistoryModal: barras negativas, tooltip, before_date, logo no header
- [x] Team logos nas Stats (team_map), TeamLogo .webp
- [x] TournamentHeader: logo campeonato + dropdown stages com busca
- [x] Championships: logo, ordem decrescente, short_name discreto, rename Circuito 1
- [x] UX-07, UX-10, Badge status PT-BR, map_name migration 0010

### Sessão 10/04/2026
- [x] BUG-01–06, UX-05, UX-14, UX-15, UX-16
- [x] Google OAuth, forgot/reset password, Resend, migration 0009

### Fases 0–9 + Blocos A–B
- [x] Setup completo, schema, auth, scoring, pricing, lineup, leaderboard, populate PGS
