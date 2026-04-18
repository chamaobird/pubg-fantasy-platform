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
`0001 → 0002 → 4bfb4ef75223 → 0003 → 0004 → 0005 → 0006 → 0007 → 0008 → 0009 → 0010 → 0011 → 0012 → 0013 → 0014 → 0015 → 0016`
- `0014`: `survival_secs` + `captain_pts` em `user_stage_stat`
- `0015`: `survival_secs` + `captain_pts` em `user_day_stat`
- `0016`: `match_schedule` (JSONB) + `last_import_at` em `stage_day`
- Próxima: `revision = "0017"`, `down_revision = "0016"`
- Sempre rodar `python -m alembic` da raiz
- Verificar antes de criar: `Get-Content alembic\versions\0016_*.py | Select-Object -First 15`

## Entidades principais
```
CHAMPIONSHIP → STAGE → STAGE_DAY → MATCH → MATCH_STAT
PERSON / PLAYER_ACCOUNT    (identidade multi-shard)
ROSTER                     (person × stage, com fantasy_cost Numeric 6,2)
LINEUP → LINEUP_PLAYER     (4 titulares + 1 reserva, 1 capitão com ×captain_multiplier)
USER_DAY_STAT / USER_STAGE_STAT / PERSON_STAGE_STAT
```

## lineup_status — valores válidos
```
closed   — padrão; stage não aparece nas seções ativas do Dashboard
preview  — visível com roster/stats, lineup desabilitado (aguardando confirmação do roster)
open     — lineup aberto para montagem
locked   — stage encerrada; lineup visível mas não editável
```
Comandos SQL para transições manuais:
```sql
UPDATE stage SET lineup_status = 'preview' WHERE id = <stage_id>;
UPDATE stage SET lineup_status = 'open'    WHERE id = <stage_id>;
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
PATCH /admin/pricing/rosters/{id}/cost-override
POST  /admin/pricing/stages/{id}/recalculate-pricing
POST  /admin/stages/{id}/import-matches
POST  /admin/stages/{id}/reprocess-match
POST  /admin/stages/{id}/score-day
POST  /admin/stages/{id}/rescore
POST  /admin/stages/{id}/force-status          ← aceita: closed | open | locked | preview
POST  /admin/stages/{id}/notify-lineup-open    ← reenvio manual de email "lineup aberta"
POST  /admin/stages/{id}/extend-deadline       ← body: {"minutes": int} — estende lineup_close_at em N minutos
PUT   /admin/stage-days/{day_id}/match-schedule ← salvar JSON schedule de matches do dia
```

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
  - **DadBuff = Palecks** (mesmo jogador, person id=152) — aliases não modelados ainda (backlog)
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
