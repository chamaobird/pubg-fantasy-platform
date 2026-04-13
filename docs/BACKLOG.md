# BACKLOG — XAMA Fantasy

## 🔴 Alta prioridade — próxima sessão

### Operacional — 15/04
- [ ] #PAS-10 Confirmar e ajustar preços dos invited: TGLTN=35 ok, CowBoi=24.34, Kickstart=22.22, hwinn=13.24 (verificar se correto)
- [ ] #PAS-11 Confirmar roster oficial divulgado e corrigir display_names se necessário
- [ ] #PAS-12 Abrir stage 15: `UPDATE stage SET lineup_status = 'open' WHERE id = 15;`
- [ ] #PAS-13 Após 1ª partida (17/04): validar/corrigir Steam names via `scripts/pubg/manage_player_accounts.py`

### Tech debt rápido
- [ ] Corrigir comentário no `app/services/scoring.py` linha ~14: capitão `×1.25` → `×1.30`

---

## 🟡 Média prioridade

### Mobile — Fase 1 (quick wins, ~1 sessão)
- [ ] #MOB-01 Navbar: ordem fixa dos itens (`Campeonatos · Dashboard · Perfil · Sair`), ativo = destaque visual apenas, sem reordenação
- [ ] #MOB-02 `overflow-x: hidden` no body + `max-width: 100%` nos containers — elimina scroll lateral
- [ ] #MOB-03 Verificar `<meta name="viewport">` no `index.html`

### Mobile — Fase 2 (componentes, sessão dedicada)
- [ ] #MOB-04 LineupBuilder: layout em cards por jogador em vez de tabela
- [ ] #MOB-05 PlayerStatsPage: scroll horizontal controlado nas tabelas
- [ ] #MOB-06 TournamentHeader: empilhar verticalmente em telas pequenas
- [ ] #MOB-07 Navbar: hambúrguer ou bottom bar para mobile
- [ ] Nota: usar skill `frontend-design` (já ativa em `/mnt/skills/public/frontend-design`) em todo trabalho visual mobile
- [ ] Nota: Playwright para testes E2E — avaliar após estabilização do mobile

### UX — Championships.jsx
- [ ] #UX-CHAMP-02 Avaliar se Championships vira página mais rica (stats, datas, histórico)

### UX — Consistência visual
- [ ] #UX-THEME Redesign atmosférico completo do Dashboard e TournamentHub
- [ ] #UX-04 Campo de confirmação de senha no cadastro

### UX — Stats
- [ ] #UX-17 Timezone no seletor de partida (ex: "21:00 EDT / 22:00 BRT")

### Infra
- [ ] #120 Desabilitar click tracking do Resend
- [ ] #121 BIMI record DNS

### Pricing — Bloco C
- [ ] #101 Job de polling de partidas ao vivo
- [ ] #103 Upload de jogadores via planilha CSV

---

## 🔧 Tech debt conhecido
- [ ] PlayerHistoryModal tooltip errático em bordas SVG — refatorar para HTML tooltip
- [ ] TeamLogo.jsx: remover alias `flcn → flc` (display_names já corrigidos no banco)

---

## 🟢 Concluído

### Sessão 13/04/2026 (noite) — UX polish pré-torneio
- [x] Championships.jsx: badge "EM PREVIEW", ordenação stageOrder, hover laranja, fix logo PAS via `includes('AMERICAS')`
- [x] LineupBuilder: 9 colunas (Time, Jogador, Preço, PTS/G, K, ASS, DMG, SURV, P)
- [x] LineupBuilder: tipografia aumentada, sort default team/asc, preços 2 casas decimais
- [x] LineupBuilder: botão 📋 Cálculo na barra de busca + banner resumo da fórmula
- [x] ScoringRulesModal.jsx: modal com fórmula completa, late game, capitão ×1.30, exemplo prático
- [x] PlayerStatsPage: sort default team/asc, preço 2 casas decimais, fundo transparent
- [x] TournamentLeaderboard: fundo transparent (fundo hex visível)
- [x] TournamentHeader: badge "EM PREVIEW", logo inline com título, detecção prefixo PO → pasta PAS
- [x] TeamLogo: detecção prefixo PO → pasta PAS, alias flcn→flc
- [x] AdminPricingPanel: ordenação por Jogador/Time/Auto, preços 2 casas decimais
- [x] Badge.jsx: preview → "EM PREVIEW"
- [x] Scrollbar customizada tema XAMA (laranja) em `index.css`
- [x] DB: display_names FLCN→FLC (4 jogadores: Shrimzy, hwinn, Kickstart, TGLTN)
- [x] Assets: logos PAS novos — 55pd.png, bst.png, roc.png, toyo.png, wolf.png

### Sessão 13/04/2026 (tarde) — Dashboard redesign
- [x] Migration 0013, start_date/end_date, Dashboard hierarquia de cards, logos, datas, ordenação

### Sessão 13/04/2026 (manhã) — Preview status + PAS1
- [x] Migration 0012, status preview backend+frontend, 64 display_names corrigidos

### Sessão 11/04/2026
- [x] Landing Atmospheric, PlayerHistoryModal, TeamLogo, TournamentHeader dropdown, Championships

### Sessão 10/04/2026
- [x] BUG-01–06, Google OAuth, forgot/reset password, Resend

### Fases 0–9 + Blocos A–B
- [x] Setup completo, schema, auth, scoring, pricing, lineup, leaderboard, populate PGS
