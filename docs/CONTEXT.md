# CONTEXT — XAMA Fantasy
> Referência técnica viva. Atualizar sempre que stack, env, migrations ou entidades mudarem.

## Stack
- Backend: FastAPI + Python 3.11 + SQLAlchemy síncrono (Session) + PostgreSQL (Render)
- Frontend: React 18 + Vite 5 + Tailwind CSS v4
- Auth: JWT (bcrypt + SHA256 prehash) + Google OAuth (redirect flow) + email verification (Resend)
- Scheduler: APScheduler — lineup_control (1min), scoring (1min), pricing (30min), match_import (2min)
- Deploy: Render.com — backend + db + frontend (auto-deploy no push)

## Comandos essenciais
```powershell
# Backend (da raiz do projeto, Python global, sem .venv)
python -m uvicorn app.main:app --reload

# Frontend
cd C:\Users\lgpas\PROJECTS\pubg-fantasy-platform\frontend ; npm run dev

# Migration
$env:DATABASE_URL="..." ; python -m alembic upgrade head

# psql — SEMPRE usar arquivo intermediário (nunca -c inline no PowerShell)
'SQL;' | Out-File -FilePath ".\query.sql" -Encoding ascii
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" "CONNECTION_STRING" -f ".\query.sql"

# Claude Code
cd C:\Users\lgpas\PROJECTS\pubg-fantasy-platform ; claude
rtk gain   # ver economia de tokens ao fim da sessão
```

## Projeto
- Local: `C:\Users\lgpas\PROJECTS\pubg-fantasy-platform`
- GitHub: `chamaobird/pubg-fantasy-platform`
- PowerShell: usar `;` em vez de `&&` para encadear comandos

## Migrations (cadeia real)
`0001 → 0002 → 4bfb4ef75223 → 0003 → 0004 → 0005 → 0006 → 0007 → 0008 → 0009 → 0010 → 0011 → 0012 → 0013 → 0014 → 0015 → 0016 → 0017 → 0018 → 0019 → 0020`
- `0014`: `survival_secs` + `captain_pts` em `user_stage_stat`
- `0015`: `survival_secs` + `captain_pts` em `user_day_stat`
- `0016`: `match_schedule` (JSONB) + `last_import_at` em `stage_day`
- `0017`: `add_live_lineup_status` — live status em stage
- `0018`: `email_verify_expires_at` (DateTime, nullable) em `user` — tokens de verificação expiram em 24h
- `0019`: tabelas `team` e `team_member` — modelo de times com membros; partial unique index `uq_team_member_active_person` (1 time ativo por person)
- `0020`: tabela `person_alias` — aliases únicos globalmente para busca alternativa de jogadores
- Próxima: `revision = "0021"`, `down_revision = "0020"`
- Sempre rodar `python -m alembic` da raiz
- Verificar antes de criar: `Get-Content alembic\versions\0020_*.py | Select-Object -First 15`

## Entidades principais
```
CHAMPIONSHIP → STAGE → STAGE_DAY → MATCH → MATCH_STAT
PERSON / PLAYER_ACCOUNT    (identidade multi-shard)
ROSTER                     (person × stage, com fantasy_cost Numeric 6,2)
LINEUP → LINEUP_PLAYER     (4 titulares + 1 reserva, 1 capitão com ×captain_multiplier)
USER_DAY_STAT / USER_STAGE_STAT / PERSON_STAGE_STAT
TEAM → TEAM_MEMBER         (times esportivos com membros; 1 time ativo por person via partial unique index)
```

## lineup_status — valores válidos
```
closed   — padrão; stage não aparece nas seções ativas do Dashboard
preview  — visível com roster/stats, lineup desabilitado (aguardando confirmação do roster)
open     — lineup aberto para montagem
live     — dia de jogo em andamento; tratado igual a locked no frontend (visível, não editável)
locked   — stage encerrada; lineup visível mas não editável
```
**Transições válidas** (guard em `app/routers/admin/stages.py`):
```
closed  → open, locked, preview, live
preview → open, closed, live, locked
open    → locked, closed, live, preview
live    → locked, open, preview
locked  → open, closed, live, preview
```
Comandos SQL para transições manuais:
```sql
UPDATE stage SET lineup_status = 'preview' WHERE id = <stage_id>;
UPDATE stage SET lineup_status = 'open'    WHERE id = <stage_id>;
UPDATE stage SET lineup_status = 'live'    WHERE id = <stage_id>;
UPDATE stage SET lineup_status = 'locked'  WHERE id = <stage_id>;
```

## Auth — fluxo
- Cadastro email/senha → email de verificação → login
- Google OAuth: `/auth/google` → Google → `/auth/google/callback` → `/auth/callback?token=`
- Forgot password: `POST /auth/forgot-password` → email → `/auth/reset-password?token=`
- Email verification aponta para BACKEND_URL/auth/verify (não frontend)
- Resend domínio: chamaobird.xyz (verificado) — EMAIL_FROM=noreply@chamaobird.xyz
- Google OAuth usa BACKEND_URL fixo (não request.url_for) para evitar problema de proxy no Render

## Env vars críticas (Render backend)
```
DATABASE_URL
SECRET_KEY
GOOGLE_CLIENT_ID=697343070083-au4k11q2j8s0kr0q41e1lbsjkv73k4ni.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET
FRONTEND_URL=https://pubg-fantasy-frontend.onrender.com
BACKEND_URL=https://pubg-fantasy-platform.onrender.com
RESEND_API_KEY
EMAIL_FROM=noreply@chamaobird.xyz
```

## URLs de produção
- Frontend: https://pubg-fantasy-frontend.onrender.com
- Backend: https://pubg-fantasy-platform.onrender.com
- Swagger: https://pubg-fantasy-platform.onrender.com/docs

## Rotas do frontend
```
/                     → LandingPage
/dashboard            → Dashboard
/championships        → Championships
/tournament/:id       → TournamentHub
/stages/:id/results   → LineupResultsPage
/auth/verified        → AuthVerified
/auth/callback        → AuthCallback (token Google OAuth; redireciona para /setup-username se sem username)
/auth/reset-password  → ResetPasswordPage
/setup-username       → SetupUsername (forçado pós-OAuth para usuários sem username)
/profile              → Profile
/admin                → Admin (requires is_admin=true no JWT; sidebar com Jogadores/Times/Championships/Stages)
```

## Endpoints públicos principais
```
GET  /championships/
GET  /championships/{id}/leaderboard                          ← acumulado de todas as stages
GET  /championships/{id}/leaderboard/combined?stage_day_ids=  ← combinação arbitrária de dias
GET  /stages/
GET  /stages/{id}/roster
GET  /stages/{id}/days
GET  /stages/{id}/days/{day_id}/matches
GET  /stages/{id}/player-stats
GET  /stages/{id}/leaderboard
GET  /stages/{id}/days/{day_id}/leaderboard
POST /lineups/
GET  /lineups/stage/{id}
GET/PATCH /auth/me
POST /auth/login | /auth/register | /auth/forgot-password | /auth/reset-password
GET  /auth/verify?token= | /auth/google | /auth/google/callback
POST /auth/resend-verification
```

## Endpoints admin
```
GET   /admin/championships/detect-shard?tournament_id=X  ← detecta shard via PUBG API (probe)
POST  /admin/championships/                               ← criar championship
PATCH /admin/championships/{id}                           ← editar championship
GET   /admin/championships/                               ← listar (include_inactive param)
POST  /admin/stages/                                      ← criar stage
PATCH /admin/stages/{id}                                  ← editar stage
GET   /admin/stages/                                      ← listar
POST  /admin/stage-days/                                  ← criar stage day
PATCH /admin/stage-days/{id}                              ← editar stage day
PUT   /admin/stage-days/{id}/match-schedule               ← salvar JSON schedule de matches
POST  /admin/persons/                                     ← criar person
PATCH /admin/persons/{id}                                 ← editar person
GET   /admin/persons/                                     ← buscar persons (search, include_inactive)
POST  /admin/persons/{id}/accounts                        ← adicionar player account
PATCH /admin/persons/{id}/accounts/{account_id}           ← fechar account
POST  /admin/persons/{id}/aliases                         ← adicionar alias de busca
DELETE /admin/persons/{id}/aliases/{alias_id}             ← remover alias
POST  /admin/stages/{id}/roster                           ← adicionar jogador ao roster
PATCH /admin/stages/{id}/roster/{roster_id}               ← editar entrada do roster
DELETE /admin/stages/{id}/roster/{roster_id}              ← remover do roster
POST  /admin/stages/{id}/roster/import-team               ← importar todos membros ativos de um time para a stage
GET   /admin/stages/{id}/roster/teams                     ← listar times distintos já no roster da stage
POST  /admin/stages/{id}/roster/copy-from-stage           ← copiar times selecionados de outra stage (idempotente; body: {source_stage_id, team_names[]})
PATCH /admin/pricing/rosters/{id}/cost-override           ← custo manual override
POST  /admin/pricing/stages/{id}/recalculate-pricing      ← recalcular pricing da stage
POST  /admin/stages/{id}/import-matches                   ← importar lista de match IDs
POST  /admin/stages/{id}/reprocess-match                  ← reprocessar match específico
POST  /admin/stages/{id}/reprocess-all-matches            ← reprocessar todos os matches (pós PENDING_)
POST  /admin/stages/{id}/recalculate-stage-stats          ← reconstruir PERSON_STAGE_STAT do zero
POST  /admin/stages/{id}/score-day                        ← pontuar dia específico
POST  /admin/stages/{id}/rescore                          ← repontuar todos os dias
POST  /admin/stages/{id}/backfill-stats                   ← criar 0pts para usuários sem registros
POST  /admin/stages/{id}/force-status                     ← aceita: closed | open | locked | preview
POST  /admin/stages/{id}/notify-lineup-open               ← reenvio manual de email "lineup aberta"
POST  /admin/stages/{id}/extend-deadline                  ← body: {"minutes": int}
POST  /admin/teams/                                       ← criar time
GET   /admin/teams/                                       ← listar times (q, region, is_active)
GET   /admin/teams/{id}                                   ← detalhar time com membros ativos
PATCH /admin/teams/{id}                                   ← editar time
POST  /admin/teams/{id}/members                           ← adicionar membro (enforça 1 time ativo por person)
DELETE /admin/teams/{id}/members/{person_id}              ← remover membro (set left_at)
```

## Times no banco (criados em 22/04/2026)
- **58 Teams** + **232 TeamMembers** — todos os times das Playoffs PAS e PEC
  - PEC (29 times, ids 1–29): ACE, BAL, BORZ, BW, EVER, GN, GTG, HIVE, HOWL, JB, NAVI, NMSS, NOT, PBRU, PGG, RL, S2G, S8UL, SLCK, SQU, STS, TMO, TWIS, VIS, VIT, VP, VPX, WORK, YO
  - PAS (29 times, ids 30–58): 55PD, AKA, BO, BST, CLR, DOTS, DUEL, FATE, FE, FLC, FN, FR, FUR, INJ, INSK, NA, NVM, NW, ONE, PEST, ROC, AFi, LxB, TL, TMP, TOYO, WIT, WOLF, X10
- Scripts usados: `rename_persons_canonical.py` (111 renames) → `seed_team_records.py` (58 teams, 232 members)
- Próxima ação: usar admin "↓ Importar" para selecionar 16 times por Finals stage

## Dados reais no banco
- Championship: PUBG Global Series 2026 (id=2, tier_weight=1.00)
  - 8 Stages: PGS1WS(2), PGS1SS(3), PGS1FS(4), PGS2WS(5), PGS2SS(6), PGS2FS(7), PGS3SS(8), PGS3GF(9)
  - 12 StageDays, 60 matches, 3840 match_stats, 97 Persons, 197 PlayerAccounts, 512 Rosters
  - Datas populadas via migration 0013 (start_date/end_date preenchidos)
- Championship: PUBG Americas Series 1 2026 - Playoffs 1 (id=7, shard=steam)
  - 3 Stages: Playoffs 1 Dia 1(15), Dia 2(16), Dia 3(17)
  - Stage 15: lineup_status=**locked** — encerrado
  - Stage 16: lineup_status=**open** — 8 times, 32 jogadores (Affinity, Chupinskys, Collector, IAM BOLIVIA, Injected, RENT FREE, Team FATE, Tempest) — fl8nkr (id=310, pa=457) adicionado ao FATE
  - Stage 17: lineup_status=**preview** — 5 times, 20 jogadores (Also Known As, DOTS, Dream One, For Nothing, Nevermind)
  - Preços por tier: high=33, mid=28, open=18 (TGLTN fixado em 35 via cost_override); Stage 16/17: custo fixo 15.00
  - Scripts: `scripts/pubg/populate_pas1_playoffs.py`, `scripts/pubg/manage_player_accounts.py`
  - **Gustav** (Person id=202, PlayerAccount id=308): account_id=PENDING_Gustav — atualizar após D2 (não jogou D1)
  - **fl8nkr** (Person id=310, PlayerAccount id=457): account_id=pending_fl8nkr, shard=pc-tournament — atualizar após D2
  - **DadBuff = Palecks** (mesmo jogador, person id=152) — adicionar via admin Jogadores → Editar → Aliases
- Championship: PEC Spring Playoffs 1 (id=8, shard=pc-tournament, tier_weight=1.0)
  - Tournament PUBG API: `eu-pecs26`
  - 3 Stages: Spring Playoffs 1 Dia 1(21), Dia 2(22), Dia 3(23)
  - 3 StageDays: 22 (D1/17abr), 23 (D2/18abr), 24 (D3/19abr)
  - price_min=12, price_max=35, newcomer_cost=15, pricing_distribution=linear (sem aspas)
  - Stage 21: lineup_status=**locked** — 64 jogadores (16 times), 5 partidas importadas
  - Stage 22: lineup_status=**locked** — 5 partidas, 63/64 resolvidos (Blazor- intencional PENDING/sub GTG_anybodezz)
  - Stage 23: lineup_status=**open** — 64 jogadores (16 times: 5 D3-originais + 11 vindos D2), pricing por performance D2
    - 5 originais (EVER/GN/PBRU/RL/VPX): custo 15 (sem historico D1)
    - 11 D2 promotes: custo 8–22 conforme pts D2 (>=100=22, >=70=18, >=50=14, >=30=11, <30=8)
    - 4 PENDING: BR1GHTS1D3(EVER), Paidaros2(GN), Sallen(PBRU), annico(VPX) — resolver apos 1a partida D3
    - Extras fora do roster (disponiveis para sub): rinazxc, Acaliptos, quintx, Mikzenn
  - Persons PEC: ids 213–310 (D1 novos), 257–314 (D2+D3). Times PGS reutilizados: NAVI(63-66), VIT(95-98), VP(99-102), S2G(71-74)
  - Scripts: `scripts/pubg/import_pec_day.py`, `scripts/pubg/insert_pec_d2d3_roster.py`, `scripts/pubg/insert_pec_d2_to_d3_roster.py`, `scripts/pubg/open_pec_d2.py`
  - Import D3: `python scripts/pubg/import_pec_day.py --stage-id 23 --stage-day-id 24`
- Championship: PAS Finals (dentro do id=7 ou championship separado — verificar no banco)
  - 3 Stages: Finals D1(24), D2(25), D3(26)
  - Stage 24: lineup_status=**locked** — D1 scoring completo, encerrado em 25/04
  - Stage 25: lineup_status=**open** — D2 em andamento; fecha 23:00 UTC (7pm EDT, 25/04); start_date=2026-04-25 23:00 UTC
  - Stage 26: lineup_status=**preview** — aguardando D2
- Championship: PEC Finals (championship separado — verificar no banco)
  - 3 Stages: Finals D1(27), D2(28), D3(29)
  - Stage 27: lineup_status=**locked** — D1 encerrado
  - Stage 28: lineup_status=**open** — D2 em andamento; fecha 16:00 UTC (12pm EDT, 25/04); start_date=2026-04-25 16:00 UTC; foi reaberta após fechamento errado à meia-noite
  - Stage 29: lineup_status=**preview** — aguardando D2

## Scripts operacionais
```bash
# Renomear display_names de Persons para nomes canônicos da API PUBG
python scripts/pubg/rename_persons_canonical.py --dry-run
python scripts/pubg/rename_persons_canonical.py

# Criar Teams + TeamMembers (idempotente)
python scripts/pubg/seed_team_records.py --dry-run
python scripts/pubg/seed_team_records.py

# Extrair roster de torneio via PUBG API → draft txt para edição
python scripts/pubg/extract_finals_teams.py

# Seed Finals: Person + PlayerAccount(PENDING_) + Roster
python scripts/pubg/seed_finals_teams.py --pec-stage-id 27 --pas-stage-id 24 --dry-run
python scripts/pubg/seed_finals_teams.py --pec-stage-id 27 --pas-stage-id 24

# Validação pré-evento (PENDING_, logos, teamUtils, shard, lineup_close_at)
python scripts/pubg/validate_event.py --stage-id X --tournament-id eu-pecs26

# Ressincronizar sequences PostgreSQL após inserts em lote
python scripts/fix_sequences.py --dry-run   # preview
python scripts/fix_sequences.py             # executa

# Import de partidas PEC (inicializa known_ids do banco)
python scripts/pubg/import_pec_day.py --stage-id 23 --stage-day-id 24 --watch 5

# Import de partidas PAS (polling)
python scripts/pubg/watch_pas_matches.py --stage-id 17 --stage-day-id 18 --watch 3

# Lembrete por email
python -m scripts.broadcast_last_day_reminder
```

## PUBG API — referências
```
# Busca matches de um torneio (pc-tournament e steam)
GET https://api.pubg.com/tournaments/{tournament_id}
  → PEC: eu-pecs26  |  PAS1 Playoffs: am-pas126

# Busca match pelo shard
GET https://api.pubg.com/shards/pc-tournament/matches/{match_id}
GET https://api.pubg.com/shards/steam/matches/{match_id}

# Lookup de account_id por nome de jogador (APENAS steam — não funciona em pc-tournament)
GET https://api.pubg.com/shards/steam/players?filter[playerNames]=nome1,nome2,...
  → Máximo 10 nomes por request | rate limit: 10 req/min
  → Resolve PENDING_ antes do evento para qualificatórias steam

# Confirmação de shard (use detect-shard endpoint em vez de fazer manualmente)
GET https://api.pubg.com/tournaments/{id}         → pegar primeiro match_id
GET https://api.pubg.com/shards/pc-tournament/matches/{match_id}  → 200 = pc-tournament, 404 = steam
```

## Notas importantes
- `pricing_n_matches`: campo DEPRECATED no modelo Stage
- MatchStat está em `app/models/match_stat.py` (NÃO em `app/models/match.py`)
- `MatchStat.xama_points` (não `fantasy_points`) — campo correto para pontuação
- `bcrypt==4.0.1` + `passlib==1.7.4` fixados no requirements.txt
- `*.sql` no .gitignore
- `UserResponse` inclui `has_password` (bool) para frontend detectar conta Google-only
- Username: 3–18 chars, `[a-zA-Z0-9_\-.]` — validado em `RegisterRequest` e `UserUpdateRequest`
- Google OAuth: se usuário não tem username → `AuthCallback` redireciona para `/setup-username`
- Profile usa `/auth/me` (GET/PATCH)
- `lineup_status=locked`: lineup visível mas não editável (prop `canEdit` no LineupBuilder)
- `lineup_status=preview`: visível com roster/stats, prop `isPreview=true` no LineupBuilder — botão desabilitado com mensagem "Lineup desabilitado — Aguardando confirmação"
- TournamentHub: `isLocked`, `isPreview` e `canEdit` derivados do status, separados de `isFinished`
- AppBackground.jsx injetado via RequireAuth em App.jsx — aplica grade hexagonal + gradiente laranja em todas as páginas internas
- `frontend/src/utils/statusColors.js` — fonte única para cores/labels de status (open/preview/closed/locked/active/upcoming/finished); exporta `STATUS_COLOR`, `STATUS_LABEL`, `STATUS_CONFIG`, `statusConfig()`; usar em qualquer novo componente que precise de cor por status
- Stage tem `start_date` e `end_date` (DateTime, nullable) — adicionados na migration 0013
- `StageOut` em `app/routers/stages.py` tem schema local próprio com `from_orm_stage()` — campos novos devem ser adicionados lá (não só em `app/schemas/stage.py`)
- `StageOut` inclui `championship_name`, `championship_short_name`, `stage_days` — relacionamento `s.days` (não `s.stage_days`)
- `UserDayStat` e `UserStageStat` têm `survival_secs` (Integer) e `captain_pts` (Numeric 10,2) — migrations 0014/0015
- Tiebreaker leaderboard: `total_points DESC → survival_secs DESC → captain_pts DESC`
- `_upsert_user_stage_stat` agrega de `UserDayStat` (não de MatchStat diretamente)
- Logos de torneios: `frontend/public/logos/Tournaments/PAS.png` e `PGS.png`
- Detecção de logo no Dashboard usa `includes('AMERICAS')` para PAS e `includes('GLOBAL SERIES')` para PGS
- Datas no Dashboard exibidas no fuso local do usuário (sem timeZone fixo)
- `TournamentLeaderboard`: dropdown hierárquico por fase; helpers `extractPhase`, `extractDayLabel`, `extractChampCode`; endpoint routes via `selectedKeys` Set (`__champ__`, `stage_N`)
- `TEAM_NAME_TO_TAG` em `LineupBuilder.jsx`: mapeamento nome completo → tag curta para times sem formato `TEAM_PlayerName` nos display_names (ex: "RENT FREE"→"FR", "Injected"→"INJ", "Tempest"→"TMP")
- `formatTeamTag` e `formatPlayerName` em `LineupBuilder.jsx`: só extraem prefixo do person_name se não contiver hífen, não for trailing `_`, E corresponder à tag esperada do time — evita bugs com IGNs como `Choppy-_-`, `J4M_d-_-b`
- Logos PAS: `/logos/PAS/` contém tags em lowercase — ex: `fr.png`, `inj.png`, `tmp.png`, `aka.png`
- Dashboard: cards preview com recuo `clamp(32px, 15%, 120px)` à esquerda para hierarquia visual abaixo do open card
- `POST /admin/stages/{id}/backfill-stats`: cria UserDayStat/UserStageStat com 0pts para usuários sem registros no leaderboard
- Escala de superfícies CSS em `index.css` `:root`: `--surface-0` (transparent) → `--surface-1` (#12151c) → `--surface-2` (#0f1219) → `--surface-3` (#1a1f2e) → `--surface-4` (#2a3046); usar tokens em vez de hex hardcoded
- `PlayerStatsPage`: dropdown multi-stage com checkboxes (default = Tudo); rótulos "Dia N" por índice; WINS após ASS; zebra nas linhas; coluna DIAS (multi-stage) mostra em quantas stages o jogador aparece; busca por aliases
- `person_alias`: alias único globalmente (constraint); `RosterPlayerOut` e `PlayerStatOut` incluem `aliases: list[str]`; busca por alias funciona no LineupBuilder e PlayerStatsPage; gerenciado via AdminPersons → modal Editar → seção Aliases
- `preflight_accounts.py`: detecta 4 status — `[OK]`, `[PENDING]` (UPDATE), `[STEAM]` (INSERT pc-tournament), `[UNKNOWN]`; use `--fix` para corrigir PENDING e STEAM em uma execução
- `replicate_lineup_for_day` em `app/services/lineup.py`: só funciona dentro da mesma stage (procura `day_number - 1` no mesmo `stage_id`); cada Finals day é uma stage separada → replicação cross-stage requer script manual com mapeamento `person_id → roster_id`
- `replicate_lineup_for_day`: checa `total_cost > 100` após calcular custo com preços da nova stage; se exceder, seta `is_valid = False` automaticamente + log de warning
- `send_over_budget_notification(to_email, username, stage_name, stage_id, total_cost, budget_cap=100)` em `app/services/email.py`: template XAMA para avisar usuário de lineup invalidado por budget excedido
- `lineup_status=live`: tratado igual a `locked` no frontend (`isLocked` true) — aparece na seção "Em Jogo" do Dashboard; adicionado em migration 0017
- Stage transition guard (`app/routers/admin/stages.py`): todas as transições operacionais permitidas — ver tabela completa acima em "lineup_status — valores válidos"; PATCH com mesmo status (`open → open`) é permitido (útil para atualizar `lineup_close_at` sem mudar status)
- `_maybe_send_over_budget_reminders(db, stage, now)` em `app/services/scheduler.py`: dispara 1h antes de `lineup_close_at` para stages `open`; envia `send_over_budget_notification` para usuários com `is_valid=False`; guard in-memory `_over_budget_reminder_sent: set[int]` evita reenvio (reset no restart do servidor)
- **Armadilha seeding de Finals**: `start_date` e `lineup_close_at` do Stage devem ser definidos com o horário real do match (ex: 16:00 UTC), nunca meia-noite. O scheduler usa `stage.lineup_close_at` para disparar `open → live`; valor errado (00:00 UTC) transiciona o stage antes do início do jogo
