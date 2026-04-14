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

### Mobile — Fase 2 (componentes, sessão dedicada)
- [ ] #MOB-04 LineupBuilder: layout em cards por jogador em vez de tabela
- [ ] #MOB-05 PlayerStatsPage: scroll horizontal controlado nas tabelas
- [ ] #MOB-06 TournamentHeader: empilhar verticalmente em telas pequenas
- [ ] #MOB-07 Navbar: hambúrguer ou bottom bar para mobile
- [ ] Nota: usar skill `frontend-design` (já ativa em `/mnt/skills/public/frontend-design`) em todo trabalho visual mobile
- [ ] Nota: Playwright para testes E2E — avaliar após estabilização do mobile

### Debt técnico UI — Categoria B (pós PAS1)
- [ ] #DEBT-B1 Tokens CSS para surface secundárias: `#0f1219` → `--surface-2`, `#1a1f2e` → `--surface-3`, `#2a3046` → `--border-2`, `#13161f` → `--row-hover` — ~30 ocorrências em `index.css` + JSX
- [ ] #DEBT-B2 LandingPage: paleta própria (`#08090d`, `#f1f5f9` etc.) — avaliar se vale criar tokens separados para a landing

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

### Sessão 14/04/2026 (tarde/noite) — Debt técnico UI: tokens CSS + fontFamily
- [x] TournamentSelect.jsx: navbar inline removida → usa `<Navbar />`
- [x] Cores hex → tokens CSS (Categoria A) em 8 arquivos: orange, gold, red, green, blue, muted, text, black, surface, border
- [x] fontFamily: "'Rajdhani', sans-serif" removido de 17 arquivos JSX
- [x] fontFamily: "'JetBrains Mono', monospace" preservado em todos os arquivos (semântico)
- [x] Badge.jsx (ui/): RegionBadge cores tokenizadas; EU purple mantido
- [x] TeamLogo.jsx: fontFamily removido do fallback badge

### Sessão 14/04/2026 (manhã) — Mobile Fase 1 + statusColors refactor
- [x] Mobile Fase 1: overflow-x hidden, max-width containers, viewport confirmado
- [x] Navbar: ordem fixa, estado ativo com borderBottom laranja
- [x] statusColors.js: utilitário centralizado criado
- [x] Championships.jsx: navbar inline substituída por `<Navbar />`

### Sessão 13/04/2026 (noite) — UX polish pré-torneio
- [x] Championships, LineupBuilder (9 colunas, sort, preços), ScoringRulesModal
- [x] PlayerStatsPage, TournamentLeaderboard, TournamentHeader, TeamLogo
- [x] AdminPricingPanel, Badge, scrollbar tema XAMA, logos PAS novos
- [x] DB: display_names FLCN→FLC (4 jogadores)

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

---

## 🔵 Infraestrutura / Workflow

### Claude Code — dicas de uso
- Limite de caracteres por prompt no terminal — dividir prompts grandes em partes (max ~3 arquivos por instrução)
- Instruções concisas e diretas funcionam melhor que listas longas
- Fornecer arquivos como upload ao Claude.ai em vez de colar conteúdo em texto

### Claude Code + rtk (configurado, não ativo)
- Claude Code instalado no projeto
- rtk 0.35.0 instalado globalmente em `C:\Users\lgpas\.cargo\bin\rtk.exe`
- CLAUDE.md já existe com instruções do projeto
- Para ativar: `rtk init` na raiz do projeto, depois `claude`
- Recomendado iniciar após o PAS1 (pós 20/04)
