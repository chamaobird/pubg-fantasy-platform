# BACKLOG — XAMA Fantasy

## 🔴 Alta prioridade — próxima sessão

### Tech debt rápido
- [x] Fix: `LeagueDetail.jsx:152` — duplicate `style` attribute corrigido (30/04/2026)
- [x] Sort padrão por team name em `PlayerStatsTable` e `LineupBuilder` (30/04/2026)
- [x] Corrigir comentário no `app/services/scoring.py` ~L14: `×1.25` → `×1.30` — já estava correto, nada a fazer
- [x] `TeamLogo.jsx`: remover alias `flcn → flc` — alias já inexistente no arquivo, nada a fazer

### Segurança

### Segurança
- [ ] **SEC-001**: Refatorar OAuth callback para não expor JWT na URL — atualmente em `/auth/callback?token=eyJ...`, vaza para PostHog, browser history, server logs e Referer headers. Mover para fragment (`#`) ou state opaco + troca por token via POST.

---

## 🟠 Operacional (torneio — executar manualmente)

- [ ] **hwinn — pricing**: investigar se há `cost_override` travando o preço. Rodar queries SQL de análise e decidir: remover override (deixar automático) ou confirmar que já está correto. Ver queries preparadas em sessão B (30/04/2026).
- [ ] **#PAS-13**: Validar/corrigir Steam names via `scripts/pubg/manage_player_accounts.py` (após 1ª partida do torneio relevante)
- [ ] **#PAS-14**: Atualizar `PlayerAccount id=308` (Gustav) — substituir `account_id=PENDING_Gustav` e `shard=pending` pelos valores reais do PUBG API

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
- [ ] #DEBT-B1 Tokens CSS para surfaces secundárias: `#0f1219` → `--surface-2`, `#1a1f2e` → `--surface-3`, `#2a3046` → `--border-2`, `#13161f` → `--row-hover` — ~30 ocorrências em `index.css` + JSX
- [x] #DEBT-B2 LandingPage: paleta própria — resolvido em LandingPage v5 com tokens `--lp-*` scoped inline no componente (29/04/2026)

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

---

## 🟢 Concluído

### Sessão B — 30/04/2026 — Limpeza de débitos rápidos
- [x] Fix `LeagueDetail.jsx:152` — duplicate style attr corrigido
- [x] Sort padrão por team name em `PlayerStatsTable` (default `team asc`, secundário `person_name asc`) e `LineupBuilder` (default `team asc`, secundário `fantasy_cost desc`)
- [x] 13 arquivos legados deletados: Landing, Login, Register, CreateTeam, MyTeams, TeamDetail, Players, Leaderboard, Tournaments, TournamentSelect, NotFound, ProtectedRoute, context/AuthContext
- [x] Confirmado: `scoring.py` já tinha `×1.30` e `TeamLogo.jsx` já sem alias `flcn` — zero trabalho
- [ ] hwinn pricing — aguardando resultados de queries SQL (investigação pendente com Birdo)

### Sessão A — 29/04/2026 — Instrumentação + Feedback widget
- [x] A.1 — PostHog no frontend: analytics (track events), session replay, identify/reset no AuthContext, guard de ambiente (só produção via `import.meta.env.PROD`)
- [x] A.2 — Widget de feedback: migration 0026 (tabela `feedback`), `POST /feedback` (público, rate-limited), `GET /admin/feedback` (admin), `FeedbackButton.jsx` (botão fixo bottom-right), `AdminFeedback.jsx` (aba "Feedback" em Admin.jsx)
- [x] Migrations 0026 e 0027 aplicadas em prod
- [x] Senha do Postgres rotacionada manualmente; `DATABASE_URL` atualizada no Render

### Sessão 15/04/2026 — Leaderboard avançado + OAuth username + UX lineup
- [x] Migrations 0014/0015: `survival_secs` + `captain_pts` em `user_stage_stat` e `user_day_stat`
- [x] Bug fix: `_upsert_user_stage_stat` reescrito; `MatchStat.xama_points` corrigido
- [x] Tiebreaker: `total_points DESC → survival_secs DESC → captain_pts DESC`
- [x] `GET /championships/{id}/leaderboard` e `/combined?stage_day_ids=`
- [x] `StageOut`: `championship_name`, `championship_short_name`, `stage_days` (usa `s.days`)
- [x] Username max 15 → 18
- [x] `SetupUsername.jsx` + rota `/setup-username` + `AuthCallback` redireciona se sem username
- [x] `TournamentLeaderboard`: dropdown por fase, nomes limpos, `extractPhase`/`extractChampCode`
- [x] `TournamentHeader`: logo 155px; logo removido do header do leaderboard
- [x] `LineupBuilder`: logos 42px, RESERVA label, separação visual do card de reserva

### Sessão 14/04/2026 (noite) — Operacional PAS1
- [x] Roster swap: Gustav criado (FLC), hwinn movido para WOLF, Sayfoo removido da stage 15
- [x] Stage 15 aberta: lineup_status = 'open'

### Sessão 14/04/2026 (tarde/noite) — Debt técnico UI
- [x] TournamentSelect.jsx: navbar inline → `<Navbar />`
- [x] Cores hex → tokens CSS (Categoria A) em 8 arquivos
- [x] fontFamily: "'Rajdhani', sans-serif" removido de 17 arquivos JSX
- [x] Badge.jsx, TeamLogo.jsx tokenizados

### Sessão 14/04/2026 (manhã) — Mobile Fase 1 + statusColors
- [x] overflow-x hidden, max-width containers, viewport confirmado
- [x] Navbar ordem fixa, estado ativo com borderBottom laranja
- [x] statusColors.js criado
- [x] Championships.jsx navbar inline → `<Navbar />`

### Sessão 13/04/2026 (noite) — UX polish pré-torneio
- [x] Championships, LineupBuilder (9 colunas), ScoringRulesModal, PlayerStatsPage, TournamentLeaderboard
- [x] TournamentHeader, TeamLogo, AdminPricingPanel, Badge, scrollbar, logos PAS novos
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

### Dev environment
- [ ] **DEV-001**: Configurar Postgres local para dev/teste de migrations sem usar prod

### Claude Code — rotina de sessão
```powershell
# Iniciar
cd C:\Users\lgpas\PROJECTS\pubg-fantasy-platform
claude

# Ver economia de tokens ao fim da sessão
rtk gain
```

### Claude Code — dicas de uso
- Limite de caracteres por prompt no terminal — dividir em partes (max ~3 arquivos por instrução)
- Fornecer arquivos JSX como upload no Claude.ai em vez de Get-Content
- Prompts concisos funcionam melhor que listas longas

### Claude Code + rtk
- rtk 0.35.0 instalado em `C:\Users\lgpas\.cargo\bin\rtk.exe`
- CLAUDE.md já existe com instruções do projeto
