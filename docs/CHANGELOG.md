# CHANGELOG — XAMA Fantasy
> Para iniciar sessão: anexar CONTEXT.md + este arquivo.

---

## Estado Atual — 14/04/2026 (fim de sessão — tarde/noite)

### Próximas tarefas operacionais
- Quarta 15/04: ajustar preços invited (TGLTN=35, CowBoi=24.34, Kickstart=22.22, hwinn=13.24 — confirmar)
- Quarta 15/04: `UPDATE stage SET lineup_status = 'open' WHERE id = 15;`
- Após primeira partida 17/04: validar Steam names via `manage_player_accounts.py`

### Backlog imediato
1. Corrigir comentário `scoring.py` linha ~14: `×1.25` → `×1.30`
2. **Mobile Fase 2** — LineupBuilder cards, tabelas responsivas, navbar mobile
3. **Debt técnico UI restante:**
   - Cores Categoria B sem token: `#0f1219`, `#1a1f2e`, `#2a3046` — ~30 ocorrências em index.css e JSX
   - LandingPage: cores de paleta própria (`#08090d`, `#f1f5f9`, `#475569`, `#e2e8f0`) — não substituir por tokens

### Nota — Claude Code (limite de prompt)
- O terminal do Claude Code tem limite de caracteres por prompt
- Prompts grandes devem ser divididos em partes menores (3 arquivos por vez no máximo)
- Preferir instruções concisas e diretas; evitar listas com mais de ~8 itens por prompt

### Skills disponíveis
- `frontend-design` já ativa em `/mnt/skills/public/frontend-design` — usar em todo trabalho de UI/mobile

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

**Substituição de cores hex → tokens CSS (8 arquivos, Categoria A):**
- `AdminPricingPanel.jsx`, `LineupBuilder.jsx`, `PlayerHistoryModal.jsx`
- `TournamentLeaderboard.jsx`, `LineupResultsPage.jsx`, `TournamentSelect.jsx`
- `Profile.jsx`, `AuthVerified.jsx`

**Mapa de tokens aplicados:**
- `#f97316` / `#fb923c` → `var(--color-xama-orange)`
- `#f0c040` → `var(--color-xama-gold)`
- `#f87171` → `var(--color-xama-red)`
- `#4ade80` / `#34d399` → `var(--color-xama-green)`
- `#6b7280` → `var(--color-xama-muted)`
- `#60a5fa` / `#3b82f6` → `var(--color-xama-blue)`
- `#fff` (texto em botão ativo) → `var(--color-xama-text)`

**Outros:**
- `TournamentSelect.jsx` — navbar inline (76 linhas) removida e substituída por `<Navbar />`
- `Badge.jsx` (`ui/`) — `RegionBadge`: `#fb923c`→orange, `#6b7280`→muted; EU purple `#818cf8` mantido
- `TeamLogo.jsx` — `fontFamily` removido do fallback initials badge

### O que foi mantido intencionalmente
- `fontFamily: "'JetBrains Mono', monospace"` — todos preservados (tipografia monospace é semântica)
- SVG attributes (`fill=`, `stroke=`) no `PlayerHistoryModal` — não tocar
- Cores de paleta própria da `LandingPage` (`#08090d`, `#f1f5f9`, `#475569`, `#64748b`) — paleta pública diferente das páginas internas
- Cores Categoria B (`#0f1219`, `#1a1f2e`, `#2a3046`, `#13161f`) — sem token; endereçar em sessão futura
- `#818cf8` (EU purple no RegionBadge) — sem token equivalente

---

## Sessão 14/04/2026 (manhã) — Mobile Fase 1 + statusColors refactor

### Arquivos criados/modificados
- `frontend/src/utils/statusColors.js` ← novo utilitário centralizado
- `frontend/src/index.css` — `overflow-x: hidden` no body; `max-width: 100%` em `.xama-page`
- `frontend/src/components/Navbar.jsx` — ordem fixa; destaque ativo com `borderBottom` laranja
- `frontend/src/pages/Championships.jsx` — navbar inline removida → usa `<Navbar />`
- `frontend/src/components/TournamentHeader.jsx` — importa `statusColors.js`

### Mobile Fase 1 (concluída)
- `overflow-x: hidden` no body e `.xama-container`
- `max-width: 100%` em `.xama-page`
- Navbar: ordem fixa (Dashboard → Campeonatos → Perfil); estado ativo com `borderBottom` laranja

### statusColors.js
- `STATUS_COLOR`, `STATUS_LABEL`, `STATUS_CONFIG`, `statusConfig()` — fonte única
- Todos os status usam `var(--color-xama-*)` em vez de hex

---

## Sessão 13/04/2026 (noite) — UX polish pré-torneio
(ver versão anterior do CHANGELOG para detalhes completos)
- Championships, LineupBuilder, ScoringRulesModal, PlayerStatsPage, TournamentLeaderboard
- TournamentHeader, TeamLogo, AdminPricingPanel, Badge, scrollbar, logos PAS

## Sessão 13/04/2026 (tarde) — Dashboard redesign + start_date/end_date
## Sessão 13/04/2026 (manhã) — Preview status + correção de tags
