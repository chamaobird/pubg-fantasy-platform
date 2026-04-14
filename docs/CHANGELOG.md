# CHANGELOG — XAMA Fantasy
> Para iniciar sessão: anexar CONTEXT.md + este arquivo.

---

## Estado Atual — 14/04/2026 (fim de sessão)

### Próxima tarefa de UI
**Sessão de debt técnico — navbar TournamentSelect, fontFamily inline e cores hardcoded**

### Próximas tarefas operacionais
- Quarta 15/04: ajustar preços invited (TGLTN=35, CowBoi=24.34, Kickstart=22.22, hwinn=13.24 — confirmar)
- Quarta 15/04: `UPDATE stage SET lineup_status = 'open' WHERE id = 15;`
- Após primeira partida 17/04: validar Steam names via `manage_player_accounts.py`

### Backlog imediato
1. Corrigir comentário `scoring.py` linha ~14: `×1.25` → `×1.30`
2. **Mobile Fase 2** — LineupBuilder cards, tabelas responsivas, navbar mobile
3. **Debt técnico UI** (auditoria 14/04):
   - `TournamentSelect.jsx` — navbar inline duplicada (não usa `<Navbar />`)
   - `fontFamily` hardcoded em inline styles — 11 arquivos afetados
   - Cores hex → tokens CSS — 15+ arquivos afetados

### Skills disponíveis
- `frontend-design` já ativa em `/mnt/skills/public/frontend-design` — usar em todo trabalho de UI/mobile

---

## Sessão 14/04/2026 — Mobile Fase 1 + statusColors refactor

### Arquivos criados/modificados
- `frontend/src/utils/statusColors.js` ← novo utilitário centralizado
- `frontend/src/index.css` — `overflow-x: hidden` no body; `max-width: 100%` em `.xama-page`; `overflow-x: hidden` em `.xama-container`
- `frontend/src/components/Navbar.jsx` — ordem fixa (Dashboard → Campeonatos → Perfil); destaque ativo com `borderBottom` laranja; importa `statusColors.js`
- `frontend/src/pages/Championships.jsx` — navbar inline duplicada removida → usa `<Navbar />`; importa `statusColors.js`
- `frontend/src/components/TournamentHeader.jsx` — importa `statusColors.js`

### Mobile Fase 1
- `overflow-x: hidden` no `body` e `.xama-container` — elimina scroll horizontal em mobile
- `max-width: 100%` em `.xama-page` — impede overflow de layout
- Viewport meta tag confirmada em `index.html` (já existia)
- Navbar: ordem dos itens fixada; estado ativo usa `borderBottom: 2px solid var(--color-xama-orange)` em vez de borda caixinha
- Bug corrigido: `Championships.jsx` tinha navbar inline própria com `isHere = path === '/championships'` hardcoded e estilo antigo — substituída pelo componente `<Navbar />`

### statusColors.js (refactor)
- Criado `frontend/src/utils/statusColors.js` com `STATUS_COLOR`, `STATUS_LABEL`, `STATUS_CONFIG`, `statusConfig()`
- Todos os status usam `var(--color-xama-*)` em vez de hex direto
- Definições duplicadas removidas de `Navbar.jsx`, `TournamentHeader.jsx`, `Championships.jsx`
- Fallbacks `|| '#6b7280'` → `|| 'var(--color-xama-muted)'`

### Auditoria de inconsistências (não corrigido ainda — ver backlog)
- `TournamentSelect.jsx` — navbar inline duplicada
- `fontFamily` hardcoded em inline styles — 11 arquivos
- Cores hex sem token — 15+ arquivos

---

## Sessão 13/04/2026 (noite) — UX polish pré-torneio

### Arquivos criados/modificados
- `frontend/src/pages/Championships.jsx`
- `frontend/src/components/LineupBuilder.jsx`
- `frontend/src/components/PlayerStatsPage.jsx`
- `frontend/src/components/TournamentLeaderboard.jsx`
- `frontend/src/components/TournamentHeader.jsx`
- `frontend/src/components/TeamLogo.jsx`
- `frontend/src/components/AdminPricingPanel.jsx`
- `frontend/src/components/ui/Badge.jsx`
- `frontend/src/components/ScoringRulesModal.jsx` ← novo
- `frontend/src/index.css` ← scrollbar adicionada
- `frontend/public/logos/PAS/` ← 55pd, bst, roc, toyo, wolf adicionados

### Championships.jsx
- Badge "EM PREVIEW" (laranja) para `preview`; "EM BREVE" cinza para `closed`
- `stageOrder`: open=0, preview=1, closed=2, locked=3
- Fix logo: `ChampLogo` detecta PAS via `includes('AMERICAS')`
- Hover e borda laranja para stages em preview

### LineupBuilder.jsx
- 9 colunas: Time, Jogador, Preço, PTS/G, K, ASS, DMG, SURV, P
- Helper `fmtCost` — preços com 2 casas decimais em toda a UI
- Sort default `team / asc`; `handleSort` asc para time/nome, desc para numéricos
- Botão `📋 Cálculo` na barra de busca — abre ScoringRulesModal
- Banner fixo acima da tabela: resumo da fórmula + "ver detalhes →"
- `ScoringRulesModal` integrado com `captainMultiplier` da stage

### ScoringRulesModal.jsx (novo)
- Fórmula validada: Kills×10, Assists×1, Knocks×1, Dano×0.03, Morte precoce −15
- Late game bonus: sobreviventes vencedor +10, tabela N=1..4
- Capitão ×1.30 (valor real da stage via prop)
- Exemplo prático calculado: 41pts base → 53.3pts como capitão

### PlayerStatsPage.jsx
- Sort default `team / asc`
- Coluna PREÇO: `.toFixed(2)`
- Fundo `transparent`

### TournamentLeaderboard.jsx
- Fundo `transparent`

### TournamentHeader.jsx
- `STATUS_LABEL/COLOR`: preview → "EM PREVIEW" laranja
- Logo inline com título `h2`
- `ChampionshipLogo`: prefixo `PO` → pasta PAS

### TeamLogo.jsx
- Prefixo `PO` no shortName → `primaryFolder = 'PAS'`
- `TEAM_TAG_ALIAS = { flcn: 'flc' }`

### AdminPricingPanel.jsx
- Colunas Jogador, Time, Auto clicáveis com sort
- Sort default `team / asc`
- Preços com `.toFixed(2)`

### Badge.jsx
- `preview` → preset `soon`, label "EM PREVIEW"

### index.css
- Scrollbar tema XAMA: thumb laranja rgba(249,115,22,0.35), track surface
- Webkit + Firefox

### DB (operação manual)
- `UPDATE person SET display_name = 'FLC' || SUBSTRING(display_name FROM 5) WHERE display_name ILIKE 'FLCN_%'`
- 4 jogadores corrigidos: FLC_Shrimzy, FLC_hwinn, FLC_Kickstart, FLC_TGLTN

---

## Sessão 13/04/2026 (tarde) — Dashboard redesign + start_date/end_date
(ver versão anterior do CHANGELOG)

## Sessão 13/04/2026 (manhã) — Preview status + correção de tags
(ver versão anterior do CHANGELOG)
