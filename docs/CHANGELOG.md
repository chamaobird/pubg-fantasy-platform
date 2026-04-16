# CHANGELOG — XAMA Fantasy
> Para iniciar sessão: anexar CONTEXT.md + este arquivo.

---

## Estado Atual — 15/04/2026 (fim de sessão)

### Próximas tarefas operacionais
- Ajustar preço do hwinn manualmente via AdminPricingPanel (valor ~13.24 — confirmar)
- Após primeira partida 17/04: validar Steam names via `manage_player_accounts.py`
- Após primeira partida 17/04: atualizar `account_id` e `shard` do Gustav (PlayerAccount id=308, atualmente PENDING_Gustav/pending)

### Backlog imediato
1. Corrigir comentário `scoring.py` linha ~14: `×1.25` → `×1.30`
2. **Mobile Fase 2** — LineupBuilder cards, tabelas responsivas, navbar mobile
3. **Debt técnico UI restante:**
   - Cores Categoria B sem token: `#0f1219`, `#1a1f2e`, `#2a3046` — ~30 ocorrências em index.css e JSX
   - LandingPage: cores de paleta própria (`#08090d`, `#f1f5f9`, `#475569`, `#e2e8f0`) — não substituir por tokens

### Skills disponíveis
- `frontend-design` já ativa em `/mnt/skills/public/frontend-design` — usar em todo trabalho de UI/mobile

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
