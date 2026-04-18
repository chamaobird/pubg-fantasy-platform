# CHANGELOG — XAMA Fantasy
> Para iniciar sessão: anexar CONTEXT.md + este arquivo.

---

## Estado Atual — 18/04/2026 (noite) — PEC D2 encerrado, D3 aberto; PAS D2 em andamento

### PEC Spring Playoffs 1 — estado atual
- **Stage 21 (D1):** `locked` — 5 partidas, 64/64 jogadores resolvidos
- **Stage 22 (D2):** `locked` — 5 partidas, 63/64 resolvidos (Blazor- substituido por GTG_anybodezz, intencional), scoring completo
- **Stage 23 (D3):** `open` — 64 jogadores (16 times: 5 originais + 11 do D2), lineup aberto
  - 4 PENDING a resolver na 1a partida: BR1GHTS1D3, Paidaros2, Sallen, annico

### PAS Playoffs 1 — estado atual
- **Stage 15 (D1):** `locked` — encerrado
- **Stage 16 (D2):** `open` — 8 times, 32 jogadores (fl8nkr adicionado) — partidas hoje a noite
- **Stage 17 (D3):** `preview` — 5 times, 20 jogadores

### Proximas tarefas operacionais
- **PEC D3 (19/04):** importar partidas -> Recalcular Stats -> Rescore Completo -> resolver 4 PENDING
  - `python scripts/pubg/import_pec_day.py --stage-id 23 --stage-day-id 24`
- **PAS D2 (18/04 noite):** fechar lineup 23h UTC -> importar -> scoring -> resolver PENDING (Gustav, fl8nkr)
- **PAS D2 fim:** identificar rebaixados -> adicionar ao Stage 17 -> pricing -> abrir Stage 17

### Backlog imediato
1. Corrigir comentario `scoring.py` linha ~14: x1.25 -> x1.30
2. **Mobile Fase 2** — LineupBuilder cards, tabelas responsivas, navbar mobile
3. **Debt tecnico UI restante:**
   - Cores Categoria B sem token: `#0f1219`, `#1a1f2e`, `#2a3046` — ~30 ocorrencias em index.css e JSX
   - LandingPage: cores de paleta propria (`#08090d`, `#f1f5f9`, `#475569`, `#e2e8f0`) — nao substituir por tokens
4. **Person aliases**: criar tabela `person_alias` ou coluna JSON para registrar nomes alternativos (ex: DadBuff = Palecks)
5. **Reconciliacao PENDING_ automatica:** script que roda apos import e resolve os 4 PEC D3 + Gustav/fl8nkr PAS

### Skills disponiveis
- `frontend-design` ja ativa em `/mnt/skills/public/frontend-design` — usar em todo trabalho de UI/mobile
---

## Sessão 18/04/2026 (noite) — PEC D2 completo + D3 abertura

### PEC D2 — Import, Resolucao de Accounts e Scoring
- **5 partidas importadas** (stage_id=22, stage_day_id=23): matches 94-96 (manha) + 100-101 (tarde)
- **32 jogadores D2 originais com PENDING_** identificados e resolvidos:
  - 23 resolvidos automaticamente via normalizacao de alias
  - 6 resolvidos manualmente com matchs de confianca alta
  - GTG_Blazor: intencional PENDING (substituido por GTG_anybodezz — sera resolvido se jogar D3)
  - STS_N1tro = TOP4IK_PB; STS_Momme = KnorkiS (confirmado pelo usuario)
- **force_reprocess=True** nos 3 matches iniciais apos resolucao de accounts
- **Recalcular Stats:** 63 pessoas, 313 match_stats (5 partidas)
- **Rescore:** 2 lineups pontuados
- Fluxo minimo por ciclo: Rescore Completo (so pontos managers) | + Recalcular Stats (stats jogadores tambem)

### PEC D2 — Transicao para D3
- Top 5 que avancam: PGG, ACEND Club, BORZ, Starry SKY, Bushido Wildcats
- 11 times para o D3: TMO, SQU, NOT, YO, S2G, WORK, BAL, GTG, VIT, HOWL, JB
- **Script novo:** `scripts/pubg/insert_pec_d2_to_d3_roster.py` — copia 11 times D2 para Stage 23 com pricing por performance
  - Pricing por pts D2: >=100pts=22, >=70=18, >=50=14, >=30=11, <30=8
  - 44 jogadores adicionados ao Stage 23
- **Stage 22:** fechada (`locked`)
- **Stage 23:** aberta (`open`) com 64 jogadores (16 times x 4)

### PEC D3 — Ajuste de Roster (5 times originais)
- Validacao contra Wasdefy revelou diferencas entre dados iniciais e roster oficial:
  - **EVER:** youngwhitetrash = fantasia (mesmo jogador); rinazxc movido para “5o extra” fora do roster
  - **GN:** Acaliptos movido para extra; Paidaros2 adicionado
  - **PBRU:** quintx movido para extra; Sallen adicionado
  - **RL:** sniipZEKO = ZEKO (mesmo jogador confirmado)
  - **VPX:** Mikzenn movido para extra; annico adicionado
- **10 aliases atualizados** em Person.display_name + PlayerAccount.alias:
  - fantasia, saintxd, IZIO, MAXXX, F1Nee, Nabat, karxx, DYNNO, ZEKO, Blissed
- **4 novos jogadores criados** (Person + PENDING_ account + Roster D3):
  - BR1GHTS1D3 (EVER), Paidaros2 (GN), Sallen (PBRU), annico (VPX)
- **4 extras removidos do roster D3** (ficam como Person/account para sub): rinazxc, Acaliptos, quintx, Mikzenn
- Correcao de sequencias PostgreSQL dessincronizadas (`setval` em person, player_account, roster)

### Aprendizado chave desta sessao
- Nomes com traco `-` (DYNNO-, F1Nee-, etc.) costumam ser editados na PUBG API — sempre usar versao da API como oficial
- 5o jogador de cada time = “extra” para substituicao: existe como Person/account mas NAO entra no Roster da stage
- Sequencias PostgreSQL podem desincronizar quando insercoes sao feitas fora do SQLAlchemy (psql direto) — rodar `setval` preventivamente antes de insercoes em lote
- `import_pec_day.py` tenta reimportar todos os matches do tournament — usar import direto por IDs especificos quando quiser so os novos
- find_pas_matches.py nao funcionava no PEC por falta de `sys.stdout.reconfigure` e por usar shard errado (steam vs pc-tournament)


## Sessão 18/04/2026 — PAS D2: infra de automação + fl8nkr + horários corrigidos

### Backend — APScheduler: auto-import de matches
- **Migration 0016** (`alembic/versions/0016_stage_day_match_schedule.py`): adicionou `match_schedule` (JSONB) e `last_import_at` a `stage_day`
- **`app/models/stage_day.py`**: campos `match_schedule` e `last_import_at` adicionados
- **`app/schemas/stage_day.py`**: `StageDayResponse` expõe ambos os campos
- **`app/services/match_discovery.py`** (novo): descobre match IDs via overlap de jogadores (steam, MIN_OVERLAP=3, amostra 6 players) ou tournament API (pc-tournament)
- **`app/jobs/match_import_job.py`** (novo): job APScheduler, a cada 2min processa entradas de `match_schedule` onde `import_after <= now`; auto-scoring após todos importados
- **`app/services/scheduler.py`**: job `match_import` registrado (2min interval)
- **`app/routers/admin/stage_days.py`**: `PUT /{stage_day_id}/match-schedule` para salvar schedule via frontend

### Backend — Email notifications
- **`app/services/email.py`**: `broadcast_lineup_open()` — envia email HTML para todos os usuários verificados com deadline BRT e botão para a stage
- **`app/routers/admin/scoring.py`**: `POST /{stage_id}/notify-lineup-open` para reenvio manual
- **Scheduler**: ao transicionar stage `closed → open`, dispara automaticamente `broadcast_lineup_open()`
- **EMAIL_FROM**: corrigido de `onboarding@resend.dev` para `noreply@chamaobird.xyz` (produção)

### Frontend — AdminOpsPanel
- **`frontend/src/components/AdminOpsPanel.jsx`** (novo): painel admin com seções:
  - **Schedule**: editor JSON de `match_schedule` com badges de status por match (pending/imported/scheduled)
  - **Import Manual**: botão para importar matches e reprocessar match_id específico
  - **Stats & Scoring**: score-day, rescore completo, backfill-stats
  - **Notificações**: reenviar email lineup-open manual
  - **Controle de Lineup**: force-status (closed/preview/open/locked) com confirmação
- **`TournamentHub.jsx`**: `AdminOpsPanel` adicionado lado a lado com `AdminPricingPanel` na aba admin

### Horários corrigidos (PAS D2 e D3)
- Stage 16 (`start_date`): corrigido de `01:00 UTC` → `22:45 UTC` (6:45pm EDT)
- Stage 16 (`lineup_close_at`): `23:00 UTC` (7pm EDT)
- Stage 16 (`end_date`): `02:15 UTC` (10:15pm EDT)
- Stage 17: mesmos ajustes aplicados
- **`LineupBuilder.jsx`**: countdown usa `lineup_close_at` como fonte primária (antes usava `start_date`)

### PAS D2 — fl8nkr (FATE)
- **Person id=310**: `display_name = 'fl8nkr'`
- **PlayerAccount id=457**: `alias='fl8nkr'`, `account_id='pending_fl8nkr'`, `shard='pc-tournament'`
- **Roster Stage 16**: Team FATE, `fantasy_cost=15.00`
- Steam alias público: `fl8nkr-_-`; servidores oficiais: `fl8nkr`

### PAS D1 — Resolução de accounts PENDING
- 43 PlayerAccounts atualizados de `pending_*` → `account.xxx` com `shard='pc-tournament'`
- Gustav (pa_id=308): PENDENTE — não jogou D1, será resolvido após D2
- fl8nkr (pa_id=457): PENDENTE — novo jogador, será resolvido após D2

---

## Sessão 17/04/2026 (noite) — PEC Spring Playoffs 1: setup completo D1→D2

### PEC Championship criado
- Championship id=8: "PEC: Spring Playoffs" / short_name="PEC1" / shard="pc-tournament" / tier_weight=1.0
- 3 stages: 21 (D1/17abr), 22 (D2/18abr), 23 (D3/19abr) — price_min=12, price_max=35, newcomer_cost=15
- 3 stage_days: 22 (D1), 23 (D2), 24 (D3)
- Tournament PUBG API: `eu-pecs26` (shard `pc-tournament`)
- `pricing_distribution` corrigido de `'linear'` (com aspas extras) para `linear` nas 3 stages

### PEC D1 — Roster e Import
- 64 jogadores criados (Person + PlayerAccount PENDING_ + Roster) para 16 times do D1
- Times PGS reutilizados: NAVI (63-66), VIT (95-98), VP (99-102), S2G (71-74), S8UL (93+254-256), TWIS (91,92,94+229)
- 22 novos times: 44 Person/PlayerAccount criados (NMSS, HIVE, BW, SLCK, JB, VIS, WORK, HOWL, ACE, TMO)
- Tags in-game confirmadas via PUBG API (diferem das tags "oficiais": NMS→NMSS, TM→TWIS, NSLK→SLCK, ACEND→ACE, CW→WORK, EXHWL→HOWL)
- 5 partidas importadas, 64/64 jogadores resolvidos

### PEC D2 — Roster, Pricing e Abertura
- Times rebaixados identificados: JB, ACE, BW, HOWL, S2G, TMO, WORK, VIT (8 piores do D1)
- 32 jogadores D1 adicionados ao roster da Stage 22 via `scripts/pubg/open_pec_d2.py`
- 32 times D2 originais criados: YO, NOT, BORZ, PGG, BAL, GTG, SQU, STS (via `insert_pec_d2d3_roster.py`)
- Pricing calculado: D1 losers → [12–35] baseado em performance; D2 originais → 15 (newcomer)
  - Top: slqven (JB) 35.00, Ketter (ACE) 34.00, Lev4nte (VIT) 33.03
  - Bottom: TeaBone (ACE) 12.00, crossberk (BW) 15.77
- Stage 22 aberta (`lineup_status = 'open'`)
- Stage 23: 20 jogadores (5 times D3: VPX, RL, GN, PBRU, EVER) a 15.00 cada

### Frontend — Dashboard e Championships
- `Dashboard.jsx`: championship grouping — PAS e PEC como blocos independentes com card grande + cards preview recuados
- `LockedActiveCard`: novo componente para stage locked "EM JOGO" (com pulse dot laranja)
- Botão expand/collapse nos cards principais para mostrar/ocultar etapas seguintes (expandido por padrão)
- Logos: `PASshort.png` no Dashboard/Championships; `PECshort.png` para PEC; `PEC.png` nos tournament headers
- `TournamentHeader.jsx`: suporte a PEC (logo PEC.png, mesmas dimensões da PAS)
- `Championships.jsx`: PEC detectado com logo PECshort; PAS sempre acima de PEC; "EM JOGO" só quando sem stage open irmã
- Fix: stage locked com open irmã → vai para Resultados (não some do Dashboard)
- Fix: "EM JOGO" apagado quando próximo dia abre

### Frontend — Tags e Logos de Time
- `frontend/src/utils/teamUtils.js` criado: fonte única para `TEAM_NAME_TO_TAG`, `formatTeamTag`, `formatPlayerName`
- `LineupBuilder.jsx` e `PlayerStatsPage.jsx` agora importam de `teamUtils.js`
- Bug corrigido: `PlayerStatsPage` tinha `formatTeamTag` local sem lookup → times PEC mostravam iniciais
- `TeamLogo.jsx`: pasta `/logos/PEC/` adicionada como fallback (além de PAS e PGS)
- 29 logos de times PEC commitadas em `frontend/public/logos/PEC/`
- `vpx.png` renomeado de `bpx.png`; tag TMO corrigida para "The Myth of"

### Docs e Scripts
- `docs/AUTOMATION_LEARNINGS.md` criado: análise do ciclo operacional completo para base de automação futura
- `scripts/pubg/import_pec_day.py`: script de import com polling para PEC
- `scripts/pubg/insert_pec_d2d3_roster.py`: insert de 52 jogadores para D2 e D3
- `scripts/pubg/open_pec_d2.py`: adiciona rebaixados, roda pricing, abre D2
- `scripts/pubg/check_pgs_data.py` e `check_pgs_retry.py` removidos (debug descartável)

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
