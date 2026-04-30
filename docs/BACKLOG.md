# BACKLOG — XAMA Fantasy

## 🔴 Alta prioridade — próxima sessão

### Tech debt rápido
- [x] Fix: `LeagueDetail.jsx:152` — duplicate `style` attribute corrigido (30/04/2026)
- [x] Sort padrão por team name em `PlayerStatsTable` e `LineupBuilder` (30/04/2026)
- [x] Corrigir comentário no `app/services/scoring.py` ~L14: `×1.25` → `×1.30` — já estava correto, nada a fazer
- [x] `TeamLogo.jsx`: remover alias `flcn → flc` — alias já inexistente no arquivo, nada a fazer

### Segurança
- [x] **SEC-001**: OAuth callback refatorado — `?token=JWT` substituído por `?code=<opaco>` + `POST /auth/exchange-code` (TTL 120s, uso único, Postgres). Deployar para confirmar no PostHog. (30/04/2026)
- [ ] **SEC-002**: JWT de 7 dias sem revogação — se token vazar, acesso válido por até 7 dias. Mitigações possíveis: refresh token + access token de vida curta (ex: 15min), ou blocklist de tokens revogados no logout.
- [ ] **SEC-003**: Tokens de reset de senha e verificação de email ainda trafegam em query string (`?token=`). Risco menor (tokens opacos, curta duração, uso único) — avaliar se vale refatorar para POST também.

---

## 🟠 Operacional (torneio — executar manualmente)

- [x] **hwinn — pricing**: investigado em 30/04/2026 — stage atual já em automático (20.20). Overrides em stages históricas (15, 24) preservados. Nenhuma ação necessária.
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

### SEC-001 — 30/04/2026 — OAuth callback seguro
- [x] Migration 0028 (`oauth_code`): code PK, user_id, is_admin, expires_at, created_at
- [x] `app/models/oauth_code.py` + registrado em `models/__init__.py`
- [x] `google_callback`: gera código opaco (TTL 120s) e redireciona com `?code=`
- [x] `POST /auth/exchange-code`: cleanup oportunístico + troca código por JWT + uso único
- [x] `AuthCallback.jsx`: lê `?code=`, faz POST, retry 1x, estado de erro com botão "Tentar novamente"
- [ ] Validação final em produção: PostHog deve mostrar `?code=` sem JWT

### Sessão B — 30/04/2026 — Limpeza de débitos rápidos
- [x] Fix `LeagueDetail.jsx:152` — duplicate style attr corrigido
- [x] Sort padrão por team name em `PlayerStatsTable` (default `team asc`, secundário `person_name asc`) e `LineupBuilder` (default `team asc`, secundário `fantasy_cost desc`)
- [x] 13 arquivos legados deletados: Landing, Login, Register, CreateTeam, MyTeams, TeamDetail, Players, Leaderboard, Tournaments, TournamentSelect, NotFound, ProtectedRoute, context/AuthContext
- [x] Confirmado: `scoring.py` já tinha `×1.30` e `TeamLogo.jsx` já sem alias `flcn` — zero trabalho
- [x] hwinn pricing — investigação 30/04/2026: stage atual (id 30) já em pricing automático (20.20). Overrides históricos em stages 15 e 24 preservados como registro operacional. Nenhuma ação necessária.

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
