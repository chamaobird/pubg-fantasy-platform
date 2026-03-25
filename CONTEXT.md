# XAMA Fantasy — Contexto do Projeto

## Stack
- **Backend:** FastAPI + SQLAlchemy (sync) + PostgreSQL (Render free tier)
- **Frontend:** React + Vite + Tailwind v4
- **Deploy:** Render (backend + DB) + frontend via build/deploy automático no push
- **Migrations:** Alembic (idempotente — sempre checar coluna antes de adicionar)

## Design System (XAMA)
- Fontes: `Rajdhani` (UI), `JetBrains Mono` (números/tags)
- Cores: `#f97316` orange, `#f0c040` gold, `#0d0f14` black, `var(--color-xama-*)` tokens
- Componentes base: `dark-select`, `dark-btn`, `msg-error`

## Estrutura de Pastas
```
app/
  models/          # SQLAlchemy models
  routers/         # FastAPI routers (tournaments.py, players.py, auth.py, historical.py, ...)
  services/        # historical.py (importação de dados PUBG)
  database.py
alembic/versions/  # migrations
frontend/src/
  components/      # LineupBuilder, TournamentLeaderboard, PlayerStatsPage, TeamLogo, Navbar, ...
  pages/           # TournamentHub, Dashboard, Profile, TournamentSelect, Login, Register, ...
  App.jsx          # rotas + useAuth context
  config.ts        # API_BASE_URL
```

## Modelo de Dados Relevante
- `tournaments` — id, name, pubg_id, region, status (active/upcoming/finished), lineup_open, budget_limit
- `teams` — id, name, logo_url
- `players` — id, name (formato: `TEAM_PlayerName`), team_id, tournament_id, fantasy_cost, is_active
- `matches` — id, tournament_id, pubg_match_id, map_name, played_at, duration_secs
- `match_player_stats` — player_id, match_id, kills, assists, damage_dealt, placement, survival_secs, fantasy_points, base_points, late_game_bonus, penalty_count, wins_count
- `lineups` — user_id, tournament_id, name, captain_player_id, reserve_player_id, total_points, lineup_open
- `users` — id, username, email, display_name, hashed_password
- `championships` — id, name, region, status; `championship_phases` — championship_id, tournament_id, phase, phase_order

## Convenções
- Player name split: `name.split('_')[0]` = team tag, `name.split('_')[1:]` = player name
- Logos servidas em `/logos/{tag.toLowerCase()}.png` (frontend/public/logos/)
- TimeZone: BRT = UTC-3 para datas de partidas
- Fórmula de pontuação: base_points + late_game_bonus - penalty (morte precoce = -15 × count)

## Endpoints Principais
- `GET /tournaments/` — lista torneios
- `GET /tournaments/{id}/rankings` — leaderboard (inclui username, display_name)
- `GET /tournaments/{id}/player-stats` — stats agregadas por jogador
- `GET /tournaments/{id}/matches` — partidas agrupadas por dia (edição mais recente)
- `GET /championship-phases/` — agrupa torneios por campeonato
- `POST /tournaments/{id}/lineups` — cria lineup (requer auth + lineup_open=true)

## Estado das Migrations (última: c4d5e6f7a8b9)
| Revision | O que faz |
|---|---|
| b2c3d4e5f6a1 | add social fields to users |
| b3f1a2c4d5e6 | add wins_count to match_player_stats |
| c4d5e6f7a8b9 | add logo_url to teams |

## Features Implementadas
- ✅ Importação histórica de partidas (historical.py) com auto-lock e wins_count
- ✅ Lineup Builder com validações (budget, 1 player/time, reserva)
- ✅ Leaderboard — coluna Lineup removida, colunas: # / Manager / Pontos / Ver; badge EU no Manager; logos nos jogadores expandidos; display_name real (não mais hardcoded None)
- ✅ Player Stats Page com filtros por dia/partida/time, colunas W/PTS/SURV/etc., logos de time
- ✅ TournamentSelect com agrupamento por Championship (blocos + mini-cards de fase)
- ✅ TournamentHub com tabs, badge de status (ENCERRADO/AO VIVO/EM BREVE), aba Lineup oculta e default Leaderboard para torneios finalizados
- ✅ Dashboard com 3 estados (Lineup Aberta / Aguardando / Meus Resultados)
- ✅ Perfil com username editável, validação unicidade, seção senha
- ✅ Navbar global
- ✅ Logos de equipe (24 times, fallback iniciais) — arquivos em frontend/public/logos/
- ✅ **Seletor hierárquico Campeonato → Fase** — `ChampionshipSelector.jsx` compartilhado; substitui flat dropdown em PlayerStats, Leaderboard e LineupBuilder; PlayerStats suporta "Campeonato completo" (via `/championship-phases/{id}/player-stats`); TournamentHub busca championships + deriva selectedChampId da URL com override local

## Estado da Produção (atualizado 2026-03-24)
### Torneios cadastrados (DB)
| id | name | pubg_id | matches | players | lineup_open |
|----|------|---------|---------|---------|-------------|
| 7  | PAS 2026 - Americas Open Qualifier · Fase de Cups | am-pas1cup | 15 (Sem 1-3) | 107 (100%) | **true** |
| 8  | SEA Thailand Super Cup 2026 | sea-thsc | 24 | 65 (100%) | false |
| 9  | SEA MITH Cup 2026 | sea-mith | 19 | 67 (100%) | false |
| 10 | Asia China Cup 2026 | as-cncup | 20 | 66 (100%) | false |
| 11 | Korea PWS 2026 Phase 1 Cup 5 | kr-pws1c5 | 5 | 64 (100%) | false |
| 12-15 | PGS 2026 Circuit 1 (4 fases) | eu-race26 etc | — | — | false |

### Championships cadastrados
| id | name | region | fases |
|----|------|--------|-------|
| 1 | PGS 2026 Circuit 1 · Series 1 | GLOBAL | T13 (Group), T12 (Winners), T14 (Survival), T15 (Final) |
| 2 | PAS 2026 - Americas Series 1 | AM | T7 (Scrims) |

### PAS Semana 4 (23/03/2026)
- Partidas jogadas mas AINDA NÃO aparecem no `am-pas1cup` (PUBG API mostra WAITING no wasdefy)
- Quando aparecerem: `POST /historical/import-matches-from-pubg/7 {"pubg_tournament_id": "am-pas1cup"}` (idempotente)
- Lineup já aberta para os usuários fazerem picks para 25-26/03

### PGS 2 (começa 26/03/2026)
- Status: UPCOMING no pubgesports.com (tournament ID da PUBG API: ainda não disponível)
- Quando o torneio for criado: criar T16+ no DB e rodar import

## Pendente / Backlog

### 🔥 Próxima sessão (prioridade)

**1. Dashboard — card "Lineup Aberta"**
- Remover texto "Lineup criado via frontend" do campo "Minha lineup" → substituir por status real: se o usuário já montou lineup para a próxima etapa ("✅ Lineup montada") ou não ("Sem lineup para esta etapa")
- Descrição da fase deve ser mais assertiva — não apenas "Scrims" mas "PAS1 Scrims Week #4" (ou seja, usar o nome real da week conforme wasdefy/DB)

**2. TournamentHub — página do torneio**
- Após salvar lineup: remover mensagem "Lineup criado ID:13" — mostrar apenas "✅ Lineup salvo com sucesso" (sem expor ID interno)
- Seletor de fase: mostrar "Scrims Week #4" ao invés de apenas "Scrims" (verificar se `phase` no DB pode receber valor mais descritivo, ou usar `tournament_name` como fallback)

**3. Player Stats — filtro por semana (Week)**
- Atualmente todas as 3 semanas da PAS ficam consolidadas como "Scrims" sem opção de separar
- Adicionar seletor de "Semana" (Week 1 / Week 2 / Week 3 / Todas) ao lado do seletor de Dia
- Estratégia sugerida: usar os grupos de datas das partidas (cada grupo de ~5 matches = 1 week) para derivar o número da semana automaticamente, ou adicionar campo `week` no modelo `Match`

**4. Leaderboard — regras estruturais**
- Um usuário não deveria poder criar mais de 1 lineup por torneio (etapa); atualmente permite múltiplos (testado: CHAMAOBIRD tem 2 lineups no PAS)
- Adicionar visualização de leaderboard por dia e por partida (não apenas acumulado total)
- Para a PAS SCRIMS WEEK: exibir acumulado de pontos por semana inteira + detalhamento por partida

**5. Logo GENG não carrega na página de stats do PGS**
- Provavelmente o arquivo em `frontend/public/logos/` é `gen.png` mas o team tag extraído do nome do player é `GENG`
- Verificar: `name.split('_')[0]` para jogadores da GENG → deve retornar `GENG`, mas o arquivo deve ser `geng.png`
- Corrigir: renomear arquivo para `geng.png` ou ajustar a lógica de normalização do tag

**6. wins_count / PTS TWIRE**
- Campo `wins_count` em `MatchPlayerStat` já existe mas não está sendo usado corretamente no cálculo de PTS TWIRE
- Verificar fórmula atual no frontend (coluna PTS TWIRE) e garantir que vitórias (placement=1) contam corretamente
- PTS TWIRE = fórmula externa de referência — revisar spec e alinhar com o que já existe

### 📅 Dados / Infra
- [ ] **Importar PAS Semana 4** — rodar `import-matches-from-pubg/7` quando `am-pas1cup` tiver os matches de 23/03 (ainda WAITING no wasdefy em 24/03)
- [ ] **PGS 2** — criar torneios T16+ e championship para Circuit 2 quando iniciar (26/03); pubg_tournament_id ainda não disponível na API
- [ ] **Feature 4 — Price History:** adicionar `tournament_id` em `PlayerPriceHistory`, endpoint `GET /players/{id}/price-history`, sparkline no frontend

## Acessos e Credenciais de Produção

| Recurso | Valor |
|---------|-------|
| **Backend URL** | `https://pubg-fantasy-platform.onrender.com` |
| **Swagger UI** | `https://pubg-fantasy-platform.onrender.com/docs` |
| **DB (External URL)** | ver painel do Render → PostgreSQL → "External Database URL" (não salvar aqui) |
| **Admin login** | `admin@warzone.gg` / `admin123` |
| **PUBG API Key** | ver `.env` local ou painel PUBG Developer (não salvar aqui) |
| **PUBG API Shard** | `pc-tournament` |
| **GitHub repo** | `https://github.com/chamaobird/pubg-fantasy-platform` |
| **wasdefy PAS1 SW#4** | `https://wasdefy.com/pubg/competitions/019c6ffe-0a45-718f-a448-e008cdcb71fa/schedule` |

> ⚠️ A VM sandbox não consegue conectar diretamente ao DB via psycopg2 (sem DNS externo). Usar a API ou o browser para queries.
>
> Para obter JWT admin via browser: `POST /users/login` com `{"email":"admin@warzone.gg","password":"admin123"}`

## Notas de Sessão
- Pasta do projeto montada no Cowork → edições diretas via Edit/Write, sem heredoc
- Para novas sessões: pedir "monta o projeto pubg-fantasy-platform e lê o CONTEXT.md"

## Como Rodar Migrations no Render
```powershell
$env:DATABASE_URL='postgresql://user:pass@host.oregon-postgres.render.com/db'
python -m alembic upgrade head
```

## Como Editar Arquivos (fluxo eficiente)
Com a pasta montada no Cowork, Claude lê e edita diretamente — sem upload, sem heredoc.
Para mudanças pontuais: Claude usa `Edit` cirúrgico.
Para arquivos novos: Claude usa `Write` direto no path correto.
