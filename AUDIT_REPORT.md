# AUDIT REPORT — XAMA Fantasy
> Gerado em 29/04/2026. Snapshot somente-leitura do estado atual do projeto.

---

## 1. Estrutura de pastas

### `app/` (backend)
```
app/
├── config.py
├── database.py
├── dependencies.py
├── main.py
├── core/
│   ├── config.py          # Settings via pydantic-settings
│   └── limiter.py         # Rate limiter (slowapi)
├── jobs/
│   ├── lineup_control.py
│   ├── match_import_job.py
│   ├── pricing.py
│   └── scoring_job.py
├── models/
│   ├── achievement.py, championship.py, championship_group.py
│   ├── email_log.py, league.py, lineup.py, match.py, match_stat.py
│   ├── person.py, person_alias.py, person_stage_stat.py
│   ├── player_account.py, roster.py, stage.py, stage_day.py
│   ├── team.py, team_member.py, user.py, user_stat.py
├── pubg/
│   └── client.py          # PUBG API HTTP client
├── routers/
│   ├── achievements.py, auth.py, championship_groups.py
│   ├── championships.py, import_.py, leagues.py, lineups.py
│   ├── profile.py, stages.py, ws.py
│   └── admin/
│       ├── championships.py, championship_groups.py, email.py
│       ├── persons.py, roster.py, rosters.py, scoring.py
│       ├── stages.py, stage_days.py, teams.py
├── schemas/
│   └── auth.py, championship.py, championship_group.py, person.py,
│       roster.py, stage.py, stage_day.py, team.py
├── services/
│   ├── achievements.py, auth.py, email.py, identity.py, import_.py
│   ├── league.py, lineup.py, lineup_scoring.py, match_discovery.py
│   ├── pricing.py, scheduler.py, scoring.py
└── ws/
    └── manager.py         # WebSocket connection manager
```

### `frontend/src/` (frontend)
```
frontend/src/
├── App.jsx                # Rotas + AuthContext
├── config.ts              # API_BASE_URL
├── index.css              # Design tokens + Tailwind v4
├── main.jsx               # Entry point + @fontsource imports
├── api/
│   ├── axios.js           # Instância axios + interceptors JWT/401
│   ├── auth.js, fantasyTeams.js, players.js, tournaments.js
├── components/
│   ├── AdminOpsPanel.jsx, AdminPricingPanel.jsx, AppBackground.jsx
│   ├── ChampionshipSelector.jsx, LineupBuilder.jsx, LoadingSpinner.jsx
│   ├── Navbar.jsx, PlayerCard.jsx, PlayerHistoryModal.jsx
│   ├── PlayerStatsPage.jsx, PlayerStatsTable.jsx, PriceBreakdown.jsx
│   ├── PriceHistoryModal.jsx, ProtectedRoute.jsx, ScoringRulesModal.jsx
│   ├── Tabs.jsx, TeamBudgetBar.jsx, TeamLogo.jsx, Toast.jsx
│   ├── TournamentCard.jsx, TournamentHeader.jsx, TournamentLayout.jsx
│   ├── TournamentLeaderboard.jsx
│   └── ui/
│       └── Badge.jsx, Button.jsx, Card.jsx, PageHeader.jsx,
│           SectionTitle.jsx, StatRow.jsx, index.js
├── config/
│   └── pas2026.js         # Config específica do PAS 2026
├── context/
│   └── AuthContext.jsx    # (existe mas não é o AuthContext primário — ver App.jsx)
├── hooks/
│   └── useLiveScoring.js  # Hook WebSocket para scoring ao vivo
├── pages/
│   ├── (ver seção 3)
│   └── admin/
│       ├── AdminChampionships.jsx, AdminChampionshipGroups.jsx
│       ├── AdminEmail.jsx, AdminPersons.jsx, AdminStages.jsx, AdminTeams.jsx
│       └── Modal.jsx
└── utils/
    ├── statusColors.js    # Fonte única de cores/labels por status
    ├── teamLogo.js
    └── teamUtils.js
```

---

## 2. Backend

### Routers

| Arquivo | Prefixo | O que faz |
|---|---|---|
| `auth.py` | `/auth` | Registro, login, JWT, Google OAuth, forgot/reset password, verificação de email |
| `stages.py` | `/stages` | Listagem de stages ativas, roster, player-stats, leaderboard por dia/stage |
| `championships.py` | `/championships` | Listagem de championships e leaderboard acumulado |
| `championship_groups.py` | `/championship-groups` | Grupos de championships; leaderboard e stats combinadas |
| `lineups.py` | `/lineups` | Submit/leitura de lineup do usuário; endpoints admin de force-status |
| `leagues.py` | `/leagues` | Ligas privadas: criar, entrar (invite_code), leaderboard filtrado |
| `achievements.py` | `/achievements` | Definições de conquistas e conquistas desbloqueadas do usuário |
| `profile.py` | `/profile` | Histórico de stages disputadas de qualquer usuário (público) |
| `import_.py` | `/admin/stages/{id}` | Import de matches PUBG API, reprocess, recalculate stats |
| `ws.py` | `/ws` | WebSocket — live scoring updates por `stage_day_id` |
| `admin/championships.py` | `/admin/championships` | CRUD de championships e detecção de shard |
| `admin/stages.py` | `/admin/stages` | CRUD de stages, force-status, notify, backfill, rescore |
| `admin/stage_days.py` | `/admin/stage-days` | CRUD de stage days e match schedule |
| `admin/roster.py` | `/admin/stages/{id}/roster` | Adicionar/editar/remover jogadores do roster; importar times |
| `admin/persons.py` | `/admin/persons` | CRUD de persons, player accounts, aliases |
| `admin/teams.py` | `/admin/teams` | CRUD de times e membros |
| `admin/scoring.py` | `/admin/stages/{id}` | score-day, rescore |
| `admin/email.py` | `/admin/email` | Templates, dispatch, preview, logs de email |
| `admin/championship_groups.py` | `/admin/championship-groups` | CRUD de grupos de championships |

### Models (tabelas e colunas principais)

| Tabela | Colunas principais |
|---|---|
| `user` | id, email, username, password_hash, google_id, avatar_url, is_admin, is_active, email_verified, email_verify_token, email_verify_expires_at, password_reset_token, password_reset_expires_at, created_at, updated_at |
| `championship` | id, name, short_name, shard, is_active, tier_weight, created_at |
| `championship_group` | (groups de championships para visão agregada) |
| `championship_group_member` | (championship_id × group_id) |
| `stage` | id, championship_id, name, short_name, shard, lineup_open_at, lineup_close_at, start_date, end_date, lineup_status, stage_phase, lineup_size, captain_multiplier, price_min, price_max, pricing_distribution, pricing_n_matches, pricing_newcomer_cost, is_active |
| `stage_day` | id, stage_id, day_number, match_schedule (JSONB), last_import_at |
| `match` | id, stage_day_id, pubg_match_id, shard, played_at, map_name, created_at |
| `match_stat` | id, match_id, person_id, account_id_used, kills, assists, damage, placement, survival_time, knocks, base_points, late_game_bonus, xama_points, created_at |
| `person` | id, display_name, is_active, created_at |
| `person_alias` | (alias único global para busca alternativa) |
| `player_account` | (account_id PUBG por shard; multi-conta por person) |
| `person_stage_stat` | (acumulado de stats de jogador por stage) |
| `roster` | id, stage_id, person_id, team_name, fantasy_cost, cost_override, newcomer_to_tier, is_available, created_at |
| `roster_price_history` | id, roster_id, stage_day_id, cost, source, recorded_at |
| `lineup` | id, user_id, stage_day_id, is_auto_replicated, is_valid, total_cost, total_points, submitted_at |
| `lineup_player` | id, lineup_id, roster_id, slot_type, is_captain, locked_cost, points_earned |
| `user_stage_stat` | id, user_id, stage_id, total_points, days_played, survival_secs, captain_pts, rank, updated_at |
| `user_day_stat` | id, user_id, stage_day_id, points, survival_secs, captain_pts, rank, updated_at |
| `user_achievement` | (conquistas desbloqueadas por usuário) |
| `team` | (times esportivos) |
| `team_member` | (person × team; partial unique index: 1 time ativo por person) |
| `league` | (ligas privadas criadas por usuários) |
| `league_member` | (user × league) |
| `email_log` | id, template_key, subject, recipient_group, stage_id, sent_count, failed_count, variables (JSON), triggered_by, sent_at |

### Jobs APScheduler

| ID | Frequência | Função | O que faz |
|---|---|---|---|
| `lineup_control` | 1 min | `_lineup_control_job` | Transições automáticas de status: closed→open→locked com base em lineup_open_at / lineup_close_at; replica lineup do dia anterior antes do lock |
| `scoring` | 1 min | `_scoring_job` | Pontua lineups dos stage days finalizados |
| `pricing` | 30 min | `_pricing_job` | Recalcula fantasy_cost de todos os rosters de stages não-locked |
| `match_import` | 2 min | `_match_import_job` | Auto-importa matches via `stage_day.match_schedule` (JSONB) |

### CORS
```python
allow_origins = ["http://localhost:5173", "http://localhost:3000", settings.FRONTEND_URL]
allow_methods = ["GET", "POST", "PATCH", "PUT", "DELETE"]
allow_headers = ["Content-Type", "Authorization"]
allow_credentials = True
```

### Autenticação
- JWT (HS256), `SECRET_KEY` via env, expiração 7 dias
- Password: SHA256 prehash → bcrypt
- Google OAuth: redirect flow via `/auth/google` → callback → JWT
- Email verification e forgot-password via Resend (domínio chamaobird.xyz)

### Variáveis de ambiente esperadas

| Var | Descrição |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SECRET_KEY` | JWT signing key |
| `BACKEND_URL` | URL pública do backend (usado para OAuth redirect URI) |
| `FRONTEND_URL` | URL pública do frontend (CORS + links de email) |
| `GOOGLE_CLIENT_ID` | OAuth2 Google |
| `GOOGLE_CLIENT_SECRET` | OAuth2 Google |
| `PUBG_API_KEY` | PUBG Developer API |
| `RESEND_API_KEY` | API de email transacional |
| `EMAIL_FROM` | Remetente (padrão: `noreply@chamaobird.xyz`) |

---

## 3. Frontend

### Árvore de rotas (React Router)

```
/                          → LandingPage (pública — landing + auth)
/dashboard                 → Dashboard (protegida)
/championships             → Championships (protegida)
/tournament/:id            → TournamentHub (protegida)
/stages/:stageId/results   → LineupResultsPage (protegida)
/profile                   → Profile (protegida)
/leagues                   → Leagues (protegida)
/leagues/:id               → LeagueDetail (protegida)
/group/:id                 → ChampionshipGroupDetail (protegida)
/admin                     → Admin (protegida + is_admin)
/auth/callback             → AuthCallback (pública — recebe token Google OAuth)
/auth/verified             → AuthVerified (pública — confirmação de email)
/auth/reset-password       → ResetPasswordPage (pública)
/setup-username            → SetupUsername (forçado pós-OAuth para usuários sem username)
/tournaments               → redirect para /championships
*                          → redirect para /dashboard
```

### Páginas em `src/pages/`

| Página | O que faz |
|---|---|
| `LandingPage.jsx` | Landing pública com login, cadastro, Google OAuth e recuperação de senha. CSS scoped `.lp-*`. v5. |
| `Dashboard.jsx` | Visão principal pós-login: stages ativas, preview, resultados, offseason. Stat chips do perfil. |
| `Championships.jsx` | Lista championships com auto-expand no mais recente. |
| `ChampionshipGroupDetail.jsx` | Detalhe de um grupo: leaderboard combinado + stats combinadas de jogadores. |
| `TournamentHub.jsx` | Hub de uma stage: tabs Leaderboard / Lineup Builder / Stats. |
| `LineupResultsPage.jsx` | Resultados de um stage day: pontuação da lineup do usuário. |
| `Leagues.jsx` | Ligas privadas: criar ou entrar com código. |
| `LeagueDetail.jsx` | Detalhe de uma liga: leaderboard filtrado por membros. |
| `Profile.jsx` | Perfil do usuário com histórico de stages. |
| `Admin.jsx` | Shell do painel admin com sidebar (Jogadores / Times / Championships / Stages / Email). |
| `admin/AdminPersons.jsx` | CRUD de persons + player accounts + aliases. |
| `admin/AdminTeams.jsx` | CRUD de times e membros. |
| `admin/AdminChampionships.jsx` | CRUD de championships. |
| `admin/AdminStages.jsx` | CRUD de stages + roster + pricing + import de matches + email. |
| `admin/AdminChampionshipGroups.jsx` | CRUD de grupos de championships. |
| `admin/AdminEmail.jsx` | Dispatch de emails transacionais com preview. |
| `AuthCallback.jsx` | Recebe `?token=` do Google OAuth; redireciona para /setup-username se sem username. |
| `AuthVerified.jsx` | Feedback após confirmação de email. |
| `SetupUsername.jsx` | Forçado pós-Google OAuth para usuários sem username. |
| `ResetPasswordPage.jsx` | Formulário de reset de senha via token de email. |
| `Landing.jsx`, `Login.jsx`, `Register.jsx` | Arquivos legados — não usados nas rotas ativas. |
| `CreateTeam.jsx`, `MyTeams.jsx`, `TeamDetail.jsx` | Arquivos legados — não usados nas rotas ativas. |
| `Players.jsx`, `Leaderboard.jsx`, `Tournaments.jsx`, `TournamentSelect.jsx`, `NotFound.jsx` | Arquivos legados — não usados nas rotas ativas. |

### Gerenciamento de estado de autenticação

- **React Context** (`AuthContext`) definido diretamente em `App.jsx`
- `useAuth()` = `useContext(AuthContext)` — exportado de `App.jsx`
- Token armazenado em `localStorage` sob a chave `wf_token`
- `loadValidToken()`: ao inicializar, decodifica o JWT e descarta se expirado (verificação client-side do campo `exp`)
- `handleSetToken()`: salva no localStorage + state
- `handleLogout()`: remove do localStorage + redireciona para `/`
- Evento global `auth:session-expired` disparado pelo interceptor Axios no 401; `App.jsx` escuta e chama logout com mensagem de sessão expirada

> Nota: existe também `src/context/AuthContext.jsx`, mas o contexto primário em uso é o de `App.jsx`.

### Chamadas à API

- **Instância Axios** em `frontend/src/api/axios.js`
  - `baseURL`: `VITE_API_URL` (env) ou `https://pubg-fantasy-platform.onrender.com`
  - Request interceptor: injeta `Authorization: Bearer <token>` do localStorage
  - Response interceptor: em 401, dispara `auth:session-expired`
- **Service layer** em `frontend/src/api/`: `auth.js`, `fantasyTeams.js`, `players.js`, `tournaments.js`
- `LandingPage.jsx` usa `fetch()` diretamente (não axios) para os endpoints de auth

### Bibliotecas principais (`package.json`)

| Pacote | Uso |
|---|---|
| `react` / `react-dom` `^18.2` | UI |
| `react-router-dom` `^7.13` | Roteamento SPA |
| `@fontsource/rajdhani` | Fonte display (700) |
| `@fontsource/inter` | Fonte body (400/500) |
| `@fontsource/jetbrains-mono` | Fonte mono (400/700) |
| `tailwindcss` `^4.2` | Utilitários CSS (via `@tailwindcss/vite`) |

---

## 4. Estado do Dashboard para usuário novo

**Não há onboarding, tour guiado, nem tela de boas-vindas.**

O comportamento depende do estado das stages no banco:

| Condição | O que o usuário vê |
|---|---|
| Há stages com `lineup_status = open` ou `live` | Cards de stage ativos na seção principal |
| Há stages com `stage_phase = preview` | Seção "Abrindo em Breve" com contagem regressiva |
| Nenhuma stage ativa nem preview (`isOffseason = true`) | Seção "Entre Temporadas" — card do último championship group + card da última stage jogada |
| Carregando | Spinner com texto "Carregando dashboard..." |

**Componente responsável:** `Dashboard.jsx`, linhas ~979–1153

- `isOffseason` = `!loading && !hasActive && previewStages.length === 0`
- Quando `isOffseason`: exibe `OffseasonGroupCard` (último championship group) e card da última stage jogada pelo usuário, se houver
- Um usuário recém-cadastrado sem nenhum lineup verá o estado offseason ou os cards de stage ativa — ambos sem contexto de "o que fazer primeiro"
- **Não há estado vazio específico para "nunca jogou"** — o componente trata usuário novo e usuário veterano de forma idêntica

---

## 5. Documentos vivos

### BACKLOG.md (resumo — 129 linhas)

**🔴 Alta prioridade**
- Ajustar preço do hwinn (~13.24 — confirmar)
- #PAS-13 Validar Steam names via `manage_player_accounts.py` (pós 1ª partida)
- #PAS-14 Atualizar PlayerAccount id=308 (Gustav) com account_id e shard reais
- Fix: `LeagueDetail.jsx:152` — duplicate `style` attribute (`style={{ ...ST, marginBottom: 0 }}`)
- Corrigir comentário `scoring.py` ~L14: `×1.25` → `×1.30`
- `TeamLogo.jsx`: remover alias `flcn → flc`

**🟡 Média prioridade**
- Mobile Fase 2: LineupBuilder cards, scroll horizontal, TournamentHeader empilhado, hambúrguer nav
- Debt CSS: superfícies hardcoded → tokens (`--surface-2`, `--surface-3`, etc.)
- UX: confirmation de senha no cadastro, timezone no seletor de partida
- Infra: desabilitar click tracking Resend, BIMI DNS
- PlayerHistoryModal: tooltip errático em bordas SVG

**🔧 Tech debt conhecido**
- PlayerHistoryModal tooltip errático

### CONTEXT.md (354 linhas)
Contém: stack completo, cadeia de migrations (0001→0025), próxima migration (0026), entidades principais, valores de `lineup_status`, fluxo de auth, env vars de produção, rotas do frontend, todos os endpoints (públicos e admin), dados reais no banco (championships, stages, counts), times cadastrados (58 times PAS+PEC).

### ARCHITECTURE.md (resumo)

**Hierarquia:** `Championship → Stage → StageDay → Match → MatchStat` / `Lineup → LineupPlayer`

**Regras de negócio centrais:**
- Resolução de identidade: PLAYER_ACCOUNT → alias → warning (nunca quebra import)
- Pricing linear: ppm médio dos últimos N matches; min→max interpolado; newcomers recebem custo fixo
- Scoring: `kills×10 + assists×1 + knocks×1 + damage×0.03 − 15 (morte precoce) + late_game_bonus`; capitão ×1.30
- Tiebreaker: `total_points DESC → survival_secs DESC → captain_pts DESC`
- Lineup: 4 titulares + 1 reserva; budget 100; custo da reserva ≤ custo do titular mais barato
- `is_auto_replicated`: lineup replicado do dia anterior se usuário não submeteu novo

---

## 6. Instrumentação atual

### Analytics / tracking de eventos
**Não existe.** Nenhuma chamada a Mixpanel, Amplitude, PostHog, Google Analytics, Segment, Heap ou similar foi encontrada no frontend ou backend.

### Logging de comportamento do usuário
**Não existe.** O backend tem logging de erros via `logging` padrão do Python (sem sink estruturado para análise). O único registro persistido de ação é `email_log` (auditoria de disparos de email admin).

### Mecanismo de feedback in-app
**Não existe.** Nenhum widget de feedback, survey ou chat de suporte encontrado.

---

## 7. Pontos de atenção

### TODOs / FIXMEs no código
Nenhum comentário `TODO`, `FIXME`, `HACK` ou `XXX` encontrado no código-fonte ativo.

### Arquivos legados não usados nas rotas ativas
Os seguintes arquivos em `src/pages/` não estão referenciados em `App.jsx` e provavelmente são legados:
- `Landing.jsx`, `Login.jsx`, `Register.jsx`
- `CreateTeam.jsx`, `MyTeams.jsx`, `TeamDetail.jsx`
- `Players.jsx`, `Leaderboard.jsx`, `Tournaments.jsx`, `TournamentSelect.jsx`, `NotFound.jsx`

### AuthContext duplicado
`src/context/AuthContext.jsx` existe mas o `AuthContext` primário em uso está em `App.jsx`. Potencial confusão para quem navega no código.

### Bug conhecido registrado no BACKLOG
`LeagueDetail.jsx:152` — `<div style={ST} style={{ marginBottom: 0 }}>` — duplicate `style` attribute. Gera warning no build do Vite. Correção: `style={{ ...ST, marginBottom: 0 }}`.

### Inconsistência em CONTEXT.md
A rota `/` em `CONTEXT.md` ainda menciona "aguardando merge para main" — o merge já foi feito em 29/04/2026. O arquivo pode ser atualizado para remover essa nota.

### `DEBT-B2` parcialmente resolvido
O backlog menciona "LandingPage: paleta própria — avaliar se vale criar tokens separados". A LandingPage v5 já usa tokens próprios (`.lp-*` com variáveis CSS `--lp-*` inline no componente). O item pode ser fechado ou atualizado.

### Render free tier
Backend e frontend no Render free tier — APScheduler rodando dentro do processo FastAPI. Possível latência em cold starts (não há warm-up configurado).
