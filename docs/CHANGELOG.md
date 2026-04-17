# CHANGELOG — XAMA Fantasy
> Para iniciar sessão: anexar CONTEXT.md + este arquivo.

---

## Estado Atual — 17/04/2026 (fim de sessão)

### Próximas tarefas operacionais
- Ajustar preço do hwinn manualmente via AdminPricingPanel (valor ~13.24 — confirmar; painel agora funciona)
- Após primeira partida 17/04: validar Steam names via `manage_player_accounts.py`
- Após primeira partida 17/04: atualizar `account_id` e `shard` do Gustav (PlayerAccount id=308, atualmente PENDING_Gustav/pending)
- Após Dia 1: adicionar os 8 times piores ao roster do Stage 16 e abrir lineup (ver OPERACOES_EVENTO.md)
- Após Dia 2: adicionar times do Dia 2 ao roster do Stage 17 e abrir lineup

### Backlog imediato
1. Corrigir comentário `scoring.py` linha ~14: `×1.25` → `×1.30`
2. **Mobile Fase 2** — LineupBuilder cards, tabelas responsivas, navbar mobile
3. **Debt técnico UI restante:**
   - Cores Categoria B sem token: `#0f1219`, `#1a1f2e`, `#2a3046` — ~30 ocorrências em index.css e JSX
   - LandingPage: cores de paleta própria (`#08090d`, `#f1f5f9`, `#475569`, `#e2e8f0`) — não substituir por tokens
4. **Person aliases**: criar tabela `person_alias` ou coluna JSON para registrar nomes alternativos (ex: DadBuff = Palecks)

### Skills disponíveis
- `frontend-design` já ativa em `/mnt/skills/public/frontend-design` — usar em todo trabalho de UI/mobile

---

## Sessão 17/04/2026 — UX quick wins + fix AdminPricingPanel

### Bug fix crítico — AdminPricingPanel (backend)
- **Causa raiz**: `RosterResponse` em `app/schemas/roster.py` declarava `fantasy_cost`, `cost_override` e `effective_cost` como `Optional[int]`. Valores com casa decimal (ex: hwinn ~13.24) causavam `ValidationError` no Pydantic v2 → FastAPI retornava 500 → frontend mostrava "Erro ao carregar roster"
- **Fix**: campos de custo alterados para `Optional[float]`; adicionado `person_name: Optional[str] = None`
- **Fix**: endpoint `GET /admin/stages/{id}/roster` agora usa `joinedload(Roster.person)` e serialização explícita, alinhado com o endpoint público — player names aparecem corretamente no painel

### UX — Sessão 1 (quick wins, 0 backend)
- **[2F]** LineupBuilder: botão "Titular" desabilitado com `title` tooltip quando 4/4 slots cheios; botão "Reserva" continua ativo
- **[1B]** LineupBuilder: hint dinâmico `"custo ≤ X.XX"` no slot vazio de Reserva; borda laranja + glow no titular mais barato quando erro de reserva
- **[2B]** Dashboard: stages locked navegam com `?tab=leaderboard`; TournamentHub lê tab inicial do query param
- **[2C]** TournamentLeaderboard: auto-scroll suave para linha "EU"; callback `onMyRankFound` popula `myRank` no TournamentHeader (pontos + posição do usuário)

### UX — Sessão 2 (countdown, tutorial, filtros, resultados integrados)
- **[2A]** Dashboard + LineupBuilder: `CountdownBadge` / countdown inline com cores por urgência (cinza >24h, laranja 1–24h, vermelho <1h); atualiza a cada 30s
- **[1A]** LineupBuilder: banner tutorial dispensável (localStorage `xama_lb_tutorial_seen`), 4 dicas fundamentais
- **[2E]** LineupBuilder: pills de filtro por time acima da busca, geradas dinamicamente do roster; cumulativas com texto
- **[2D]** TournamentHub: aba "Montar Lineup" → "📊 Meus Resultados" quando locked; renderiza `LineupResultsPage` embutida

---

## Sessão 16/04/2026 — Correções de roster + UX Dashboard + bugs de display

### Backend (banco direto — sem migration)
- **Stage 16 → preview**: 8 times populados (Affinity, Chupinskys, Collector, IAM BOLIVIA, Injected, RENT FREE, Team FATE, Tempest) — 31 jogadores
- **Stage 17 → preview**: 5 times populados (Also Known As, DOTS, Dream One, For Nothing, Nevermind) — 20 jogadores
- **FATE roster corrigido**: Myo0 e xennny- removidos; DadBuff (= Palecks, person id=152) movido do Tempest para o FATE
- **Tempest roster corrigido**: ASMR removido; `abdou`→`TMP_abdou`, `K1lawi`→`TMP_K1lawi`; TMP_HUGHLIGAN e TMP_xQnn criados (person ids 211/212) e adicionados; tag = TMP
- **backfill-stats endpoint**: `POST /admin/stages/{id}/backfill-stats` adicionado em `app/routers/admin/scoring.py`
- **ensure_participant_stats**: `app/services/lineup_scoring.py` — cria UserDayStat/UserStageStat com 0pts na submissão do lineup (fix leaderboard)

### Frontend
- **`formatTeamTag`** em `LineupBuilder.jsx`: adicionado `TEAM_NAME_TO_TAG` mapeando nome completo → tag curta; lookup por nome tem prioridade sobre extração do person_name (fix times sem tag TEAM_Name)
- **`formatPlayerName`** em `LineupBuilder.jsx`: mesma lógica — só extrai após `_` se prefixo sem hífen E corresponde à tag esperada do time (fix `-_-`, trailing `_`, e `J4M_d-_-b`)
- **Logos Day 2**: `insk.png`, `fate.png`, `clr.png`, `inj.png`, `tmp.png` adicionados/atualizados em `/logos/PAS/`
- **Logos Day 3**: `aka.png`, `dots.png`, `nvm.png`, `fn.png`, `one.png` commitados
- **Dashboard preview cards**: cards menores (logo 28px, título 15px, padding compacto), recuo `clamp(32px, 15%, 120px)` à esquerda, marginTop 10px
- **Auth session expiry**: global event bus `auth:session-expired`; token com 1 ano de validade; mensagem amigável na LandingPage
- **Lineup sort**: default por `effective_cost` DESC

### Docs
- **`docs/OPERACOES_EVENTO.md`** criado: guia de operações manuais durante PAS1 Playoffs (endpoints, horários, fluxo por dia)

---

## Sessão 15/04/2026 — Leaderboard avançado + OAuth username + UX lineup

### Backend
- **Migrations 0014/0015**: `survival_secs` (Integer) + `captain_pts` (Numeric 10,2) em `user_stage_stat` e `user_day_stat`
- **Bug fix crítico**: `_upsert_user_stage_stat` reescrito — agrega de `UserDayStat` (não de MatchStat diretamente); corrigido `MatchStat.xama_points` (era `fantasy_points`)
- **Tiebreaker**: `total_points DESC → survival_secs DESC → captain_pts DESC` em todos os leaderboards
- **`GET /championships/{id}/leaderboard`**: acumulado de todas as stages do campeonato
- **`GET /championships/{id}/leaderboard/combined?stage_day_ids=`**: combinação arbitrária de dias (valida pertencimento ao campeonato)
- **`StageOut`**: adicionado `championship_name`, `championship_short_name`, `stage_days` (corrigido: usa `s.days`, não `s.stage_days`)
- **Username max**: 15 → 18 caracteres em `RegisterRequest` e `UserUpdateRequest`

### Frontend
- **`SetupUsername.jsx`**: nova página forçada pós-OAuth para usuários sem username (3–18 chars, regex)
- **`AuthCallback.jsx`**: após login Google, verifica `/auth/me`; se `username == null` → redireciona `/setup-username`
- **`App.jsx`**: rota `/setup-username` adicionada
- **`TournamentLeaderboard.jsx`**: dropdown hierárquico por fase:
  - `extractPhase` / `extractDayLabel` / `extractChampCode` para nomes limpos
  - `buildPhases` agrupa stages por fase; `PhaseHeader` com checkbox indeterminado
  - Labels: "PAS1 — TOTAL", "Playoffs 1 — todos", "Playoffs 1 — Dia 1", "N selecionados"
  - `togglePhase` seleciona/deseleciona todos os dias de uma fase
  - Logo removido do header do leaderboard; logo no `TournamentHeader` ajustado para 155px
- **`LineupBuilder.jsx`**: logos de time 28px → 42px; card do reserva com `marginLeft: 12`; "RES" → "RESERVA"

### Operacional
- Rescore stage 15 executado via `POST /admin/stages/15/rescore` para popular tiebreaker nos rows existentes

---

## Sessão 14/04/2026 (noite) — Operacional PAS1 Playoffs Dia 1

### Alterações no banco
- `Person` id=202 criado: `FLC_Gustav`, is_active=true
- `PlayerAccount` id=308 criado: alias=Gustav, account_id=PENDING_Gustav, shard=pending (atualizar após 1ª partida)
- `Roster` id=583 criado: stage_id=15, person_id=202, team_name='Team Falcons', fantasy_cost=15.00
- `Person` id=39 atualizado: `FLC_hwinn` → `WOLF_hwinn`
- `Roster` id=536 atualizado: team_name → 'Copenhagen Wolves'
- `Roster` id=543 deletado (Sayfoo removido da stage 15; Person id=122 preservada)
- `stage` id=15: lineup_status → `open`

---

## Sessão 14/04/2026 (tarde/noite) — Debt técnico UI: tokens CSS + fontFamily

### Arquivos modificados
**Remoção de `fontFamily` Rajdhani hardcoded (17 arquivos):**
- `AuthVerified.jsx`, `ResetPasswordPage.jsx`, `ChampionshipSelector.jsx`
- `ScoringRulesModal.jsx`, `PriceHistoryModal.jsx`, `TournamentHeader.jsx`
- `AdminPricingPanel.jsx`, `Profile.jsx`, `Championships.jsx`
- `Dashboard.jsx`, `TournamentSelect.jsx`, `LineupResultsPage.jsx`
- `LineupBuilder.jsx`, `PlayerStatsPage.jsx`, `PlayerHistoryModal.jsx`
- `TournamentLeaderboard.jsx`, `LandingPage.jsx`

**Substituição de cores hex → tokens CSS (Categoria A):**
- `#f97316`/`#fb923c` → `var(--color-xama-orange)`
- `#f0c040` → `var(--color-xama-gold)`
- `#f87171` → `var(--color-xama-red)`
- `#4ade80`/`#34d399` → `var(--color-xama-green)`
- `#6b7280` → `var(--color-xama-muted)`
- `#60a5fa`/`#3b82f6` → `var(--color-xama-blue)`
- `#fff` (texto em botão ativo) → `var(--color-xama-text)`

**Outros:**
- `TournamentSelect.jsx` — navbar inline removida, substituída por `<Navbar />`
- `Badge.jsx` (`ui/`) — RegionBadge tokenizado; EU purple `#818cf8` mantido
- `TeamLogo.jsx` — `fontFamily` removido do fallback badge

### O que foi mantido intencionalmente
- `fontFamily: "'JetBrains Mono', monospace"` — todos preservados
- SVG attributes (`fill=`, `stroke=`) no `PlayerHistoryModal`
- Cores de paleta própria da `LandingPage`
- Cores Categoria B (`#0f1219`, `#1a1f2e`, `#2a3046`) — endereçar em sessão futura

---

## Sessão 14/04/2026 (manhã) — Mobile Fase 1 + statusColors refactor
- `overflow-x: hidden`, `max-width: 100%`, viewport confirmado
- Navbar: ordem fixa, estado ativo com `borderBottom` laranja
- `statusColors.js` criado — fonte única para cores/labels de status
- `Championships.jsx`: navbar inline substituída por `<Navbar />`

## Sessão 13/04/2026 (noite) — UX polish pré-torneio
(Championships, LineupBuilder, ScoringRulesModal, PlayerStatsPage, TournamentLeaderboard, TournamentHeader, TeamLogo, AdminPricingPanel, Badge, scrollbar, logos PAS)

## Sessão 13/04/2026 (tarde) — Dashboard redesign + start_date/end_date
## Sessão 13/04/2026 (manhã) — Preview status + correção de tags
