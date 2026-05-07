# XAMA Dashboard Refresh — Relatório de Auditoria

**Data:** 06/05/2026
**Branch:** `feature/dashboard-refresh-v2` (atual em `820f05f`, Fase 2)
**Objetivo:** replicar o design entregue pelo Claude Design no projeto XAMA Fantasy com fidelidade real, mantendo funcionalidade.

---

## 1. Resumo executivo

A captura completa do design do Claude Design revelou **muito mais conteúdo** do que tínhamos detectado nas iterações anteriores. Não é só o Dashboard refinado — é uma **redesign completo do design system** envolvendo 9 componentes novos, navbar refeita, design tokens redefinidos e CSS scoped extenso (862 linhas).

A boa notícia: tudo está bem estruturado e factível.

A má notícia: os tokens CSS do projeto atual (`--color-xama-*`, `--surface-*`) **não são compatíveis** com os tokens do design (`--xm-*`). Isso significa que precisamos **adicionar uma camada nova de tokens** ao projeto sem quebrar o que já existe.

**Sequência recomendada de execução:** 4 branches separados, mergeados independentemente, com a refatoração da Dashboard sendo a última (precisa que tudo abaixo esteja sólido primeiro).

---

## 2. Inventário do design entregue

### 2.1 Arquivos capturados em `docs/design-reference/`

| Arquivo | Tamanho | Função |
|---|---|---|
| `colors_and_type.css` | 12.596 b | Design tokens completos (`--xm-*`), fontes locais, `.xm-bg-*` (atmosfera) |
| `dashboard.css` | 25.889 b | Estilos `.dash-*` e `.xm-nav-*` — todas as classes do Dashboard refinado |
| `navbar.jsx` | 1.770 b | Componente `XamaNavbar` |
| `dash-icon.jsx` | 4.662 b | Componente `DashIcon` com 22 ícones Lucide-style |
| `dashboard-parts.jsx` | 14.588 b | 9 componentes: HeroHud, DashHero, FaceoffBanner, SectionHead, OpenCard, PreviewCard, StageRow, AchievementHero, AnticipationCard, ReplayCard |
| `dashboard-app.jsx` | 6.385 b | App shell que monta tudo (provavelmente referência didática, não vai ser usado direto) |
| `design-canvas.jsx` | 31.136 b | Canvas que renderiza os 3 estados (referência de uso, não vai ser portado) |
| `dashboard-state-1-lineup.html` | 63.085 b | HTML renderizado do estado Lineup Aberta (gold standard visual) |
| `dashboard-state-2-offseason.html` | 52.608 b | HTML do estado Offseason |
| `dashboard-state-3-mobile.html` | 63.085 b | HTML do estado Mobile (mesmo size do 1, mas conteúdo distinto — hash confirmado) |

### 2.2 Componentes propostos pelo design

**Atmosfera global (`colors_and_type.css`):**
- `.xm-bg-base` — fundo `#08090d`
- `.xm-bg-hex` — grade hexagonal SVG inline (idêntica à da Landing — mas com `--xm-hex-opacity: 0.045`)
- `.xm-bg-radial` — gradiente radial elíptico laranja (esquerda 13%, direita 5%)
- `.xm-scan-line` — scan line animada (existente na Landing, **não está no design da Dashboard** — design não tem scan line)

**Navbar (`navbar.jsx` + classes `.xm-nav-*` em `dashboard.css`):**
- Brand lockup: ícone hexagonal SVG laranja + "XAMA" + "FANTASY LEAGUE" (subtitle 8px mono)
- Tabs: Dashboard, Campeonato, Ligas, Perfil, Admin (Rajdhani 14px, ativa em laranja com `text-shadow: 0 0 18px rgba(249,115,22,0.45)`)
- Status: pill `LIVE` verde com pulse + tags "PAS 2026 · PEC 2026"
- Rule line laranja gradiente abaixo do header

**Dashboard (`dashboard-parts.jsx` + classes `.dash-*`):**
- `DashHero` — eyebrow + H1 grande + subtitle + 3 stat chips (Trophy/Calendar/Target)
- `HeroHud` — radar SVG 800×360 com 4 anéis, 36 ticks, sweep line animada, gradientes, coordinate readout, barras XP_TRACK e RANK_DELTA
- `FaceoffBanner` — banner teal com Swords icon e CTA arrow-right
- `SectionHead` — header de seção com ícone, label uppercase, counter mono, toggle expandir
- `OpenCard` — card grande com logo, título Rajdhani, meta, countdown, badge "Aberta", CTA "Montar lineup"
- `PreviewCard` — card compacto recuado com countdown "Abre em"
- `StageRow` — linha de resultado com pontuação ou badge "Sem lineup"
- `AchievementHero` — hero offseason com #N gigante dourado (96px), H2 com `<em>` em dourado, stats inline, CTA "Ver retrospectiva"
- `AnticipationCard` — card próximo torneio com countdown laranja
- `ReplayCard` — card horizontal compacto da última stage jogada

### 2.3 Tokens CSS críticos do design (não existem no projeto atual)

```css
--xm-orange-soft: rgba(249,115,22,0.12);
--xm-orange-glow: rgba(249,115,22,0.35);
--xm-orange-hover: #fb923c;
--xm-text-bright: #f1f5f9;
--xm-text-white: #ffffff;
--xm-muted-soft: #4b5563;
--xm-muted-deep: #374151;
--xm-teal-bright: #2dd4bf;
--xm-blue-soft: #60a5fa;

--xm-font-display: 'Rajdhani', 'Barlow Condensed', 'Segoe UI', sans-serif;
--xm-font-body: 'Inter', 'Segoe UI', system-ui, sans-serif;
--xm-font-mono: 'JetBrains Mono', 'Share Tech Mono', monospace;

--xm-fs-hero: 52px;
--xm-fs-display: 32px;
--xm-fs-page-title: 28px;
--xm-fs-h2: 22px;
--xm-fs-logo: 19px;
--xm-fs-section: 18px;
--xm-fs-card-title: 16px;
--xm-fs-body: 14px;
--xm-fs-label: 11px;
--xm-fs-micro: 10px;

--xm-tracking-mono: 0.22em;
--xm-tracking-eyebrow: 0.12em;
--xm-tracking-tight: -0.01em;

--xm-shadow-glow-orange, --xm-shadow-glow-gold, --xm-shadow-glass
--xm-glass-bg, --xm-glass-blur, --xm-hex-opacity, --xm-scan-color
--xm-ease, --xm-dur, --xm-dur-fast, --xm-dur-slow
--xm-radius-tag, --xm-radius-input, --xm-radius-button, --xm-radius-inner, --xm-radius-card
```

---

## 3. Inventário do estado atual do projeto

### 3.1 `frontend/src/index.css` (1.113 linhas)

**Tokens existentes (camada antiga):**
```css
--color-xama-black: #0d0f14;     /* DIFERENTE do design: #08090d */
--color-xama-surface: #12151c;
--color-xama-border: #1e2330;
--color-xama-muted: #6b7280;
--color-xama-text: #dce1ea;
--color-xama-orange: #f97316;
--color-xama-gold: #f0c040;
--color-xama-blue: #3b82f6;
--color-xama-teal: #14b8a6;
--color-xama-green: #4ade80;
--color-xama-red: #f87171;

--surface-1: #12151c;
--surface-2: #0f1219;
--surface-3: #1a1f2e;
--surface-4: #2a3046;
```

**Discrepância crítica:** `--color-xama-black: #0d0f14` no projeto vs `--xm-bg: #08090d` no design. **Cores diferentes.** Provavelmente o projeto usa `#0d0f14` em produção, e o design usa `#08090d`. Não vamos quebrar essa cor — **vamos adicionar `--xm-*` como camada paralela** sem tocar em `--color-xama-*`.

**Classes utilitárias (`.xbtn-*`, `.xt-*`, `.xstat-*`, `.xlb-*`)** continuam funcionando. Não devem ser tocadas.

### 3.2 `frontend/src/components/Navbar.jsx`

Estado atual: navbar inline, sem classes `.xm-*`, sem pill LIVE, sem brand subtitle "FANTASY LEAGUE". Usa Rajdhani mas em estilos inline. Logo é emoji 🔥.

**Diferenças do design:**
- ❌ Sem brand subtitle "FANTASY LEAGUE"
- ❌ Logo é emoji 🔥 (design usa SVG hexagonal)
- ❌ Sem pill `LIVE — PAS 2026 · PEC 2026`
- ❌ Sem `xm-nav-rule` (linha laranja gradiente abaixo)
- ❌ Backdrop blur ausente
- ❌ Tem botão "Sair" (design não tem — provavelmente movido pro Perfil)
- ❌ Tem condicional `tournament` (contexto do torneio quando está numa página de stage) — **funcionalidade EXISTENTE que precisa ser preservada**
- ❌ Tem ícones emoji 👤 e ⚙ (design não tem ícones nas tabs)

**Funcionalidade que DEVE ser preservada:**
- Lógica de `isAdmin` via JWT decode
- Navegação react-router via `useNavigate` e `useLocation`
- Logout via `useAuth().logout`
- Renderização condicional de "Admin" quando `isAdmin === true`
- Bloco condicional `{tournament && ...}` quando há contexto de stage ativo

### 3.3 `frontend/src/components/AppBackground.jsx`

Estado atual: 3 divs fixas (fundo base, hex grid, gradiente radial). **Quase idêntico ao design.**

**Diferenças mínimas:**
- ✅ Cor de fundo `#08090d` — bate com design
- ✅ Hex grid SVG inline com `opacity: 0.045` — bate
- ✅ Gradiente radial idêntico — bate
- ❌ **Sem scan line** — mas o design da Dashboard também não tem scan line (só a Landing). **OK manter sem.**

**AppBackground está praticamente OK. Mudança mínima ou nenhuma.**

### 3.4 `frontend/src/pages/Dashboard.jsx` (1.446 linhas)

Estado atual: implementação completa funcional, mas com:
- Inline styles em todos os componentes (~mil objetos `style={{}}`)
- Emojis nos chips (🏆 📅 🎯)
- Banner Faceoff em **indigo** (não teal)
- Fontes carregadas via Google Fonts CSS (`xama-fonts` injetado no head)
- Animações CSS injetadas via `document.createElement('style')` no `xama-dash-anim`
- Classes legadas `.xama-*` (de Fase 2, mantidas pra compat)

**Funcionalidade que DEVE ser preservada (nada disso pode ser perdido):**
- `useCountdown(targetIso)` + `computeRemaining(targetIso)` + `CountdownBadge`
- `parseDateLocal`, `fmtDateFull`, `fmtTime`, `buildDateLabel`, `buildDateRange`
- `StageChampLogo` com fallbacks PGS/PAS/PEC
- `CollapseSection`, `StageRow` (existentes), `OpenCard`, `LockedActiveCard`, `PreviewCard`, `ClosedPrimaryCard`, `OffseasonGroupCard`
- Lógica completa do componente Main:
  - 7 useEffects de fetch (auth/me, stages, championships, championship-groups, faceoffs, profile/history, lineups por stage)
  - useMemos derivados: `activeChampGroups`, `previewStages`, `pureLockedStages`, `isOffseason`, `offseasonGroup`, `profileStats`
  - Lógica de `expandedChamps` e `toggleChamp`
- Hooks: `useAuth`, `useNavigate`, `track('dashboard_viewed')`
- Render condicional: hasActive, isOffseason, previewStages.length, openFaceoffs.length

### 3.5 Outros componentes/páginas que usam Navbar (compartilhamento)

Páginas que importam `Navbar`:
- `Dashboard.jsx` — usa `<Navbar />`
- `Championships.jsx` — provavelmente usa
- `Leagues.jsx` — provavelmente usa
- `Profile.jsx` — provavelmente usa
- `LeagueDetail.jsx`, `LineupResultsPage.jsx`, `FaceoffPage.jsx`, `TournamentHub.jsx`, `Admin.jsx` — provavelmente usam

**Implicação:** mudar Navbar afeta TODAS essas páginas. Precisa testar em cada uma.

---

## 4. Discrepâncias mapeadas (item por item)

### 4.1 Tokens CSS (camada de design system)

| Token do design | Existe no projeto? | Ação |
|---|---|---|
| `--xm-bg: #08090d` | Não (tem `--color-xama-black: #0d0f14` que é diferente) | **Adicionar** novo token |
| `--xm-orange-hover: #fb923c` | Não | **Adicionar** |
| `--xm-orange-soft, --xm-orange-glow` | Não | **Adicionar** |
| `--xm-text-bright: #f1f5f9` | Não | **Adicionar** |
| `--xm-text-white: #ffffff` | Não | **Adicionar** |
| `--xm-muted-soft, --xm-muted-deep` | Não | **Adicionar** |
| `--xm-teal-bright, --xm-blue-soft, --xm-gold-hover` | Não | **Adicionar** |
| `--xm-fs-*` (escala tipográfica) | Parcialmente (`--fs-page-title`, etc.) | **Adicionar todos `--xm-fs-*`** sem remover os antigos |
| `--xm-tracking-*` | Não | **Adicionar** |
| `--xm-fw-*` | Não | **Adicionar** |
| `--xm-shadow-*`, `--xm-glass-*`, `--xm-ease`, `--xm-dur-*` | Não | **Adicionar** |
| `--xm-font-display, --xm-font-body, --xm-font-mono, --xm-font-condensed` | Não | **Adicionar** |
| `--xm-radius-*` | Parcialmente (`--radius-card`, `--radius-inner`) | **Adicionar todos** |
| `--xm-space-*` | Não | **Adicionar** |
| `--color-xama-*` (tokens antigos) | Sim, em uso por todo o projeto | **PRESERVAR INTACTO** |

### 4.2 Atmosfera (background)

| Item | Design | Projeto | Discrepância |
|---|---|---|---|
| Cor base | `#08090d` | `#0d0f14` (no body) e `#08090d` no AppBackground.jsx | Pequena divergência entre body global e AppBackground. **Aceitar AppBackground como referência.** |
| Hex grid | `opacity: 0.045`, `--xm-hex-opacity` | `opacity: 0.045` inline | ✅ Igual |
| Gradiente radial | `--xm-bg-radial` | inline igual | ✅ Igual |
| Scan line | Só na Landing, não Dashboard | Não usa na Dashboard | ✅ OK não usar |

### 4.3 Navbar

| Item | Design | Projeto | Status |
|---|---|---|---|
| Estrutura HTML | `xm-nav` > `xm-nav-inner` (grid 1fr/auto/1fr) | inline flex | **Refator total** |
| Brand mark | SVG hexagonal laranja | Emoji 🔥 | **Trocar pra SVG** |
| Brand title | "XAMA" 19px | "XAMA" 20px inline | **Ajustar tamanho** |
| Brand subtitle | "FANTASY LEAGUE" 8px mono | "Fantasy" 11px laranja | **Trocar pra "FANTASY LEAGUE" mono** |
| Tabs | Rajdhani 14px, hover muda cor, ativa em laranja com glow | inline 17px, hover muda cor, ativa em laranja com underline | **Refator de estilo** |
| Pill LIVE | Verde com pulse + tags | Ausente | **Adicionar** |
| Rule line | Gradiente laranja embaixo | Linha simples 2px | **Trocar pra gradiente** |
| Backdrop blur | `rgba(8,9,13,0.6)` + `blur(8px)` | sem blur | **Adicionar** |
| Botão Sair | Ausente (provavelmente em Perfil) | Presente | **Mover ou esconder** |
| Bloco tournament | Não existe no design | Existe no projeto, é funcional | **Preservar — adaptar estilo** |
| Renderização condicional Admin | Não testado no design | Existe via `isAdmin` | **Preservar lógica** |

### 4.4 Dashboard — componentes individuais

#### Hero (Saudação)

| Item | Design | Projeto |
|---|---|---|
| Eyebrow | "XAMA · Painel do jogador" mono 10px laranja | "Olá, BIRDAO 👋" + subtitle (sem eyebrow) |
| H1 | clamp(38-64px) Rajdhani 700 | 42px inline Rajdhani 800 |
| Glow no nome | `text-shadow: 0 0 18px rgba(249,115,22,0.4), 0 0 36px rgba(249,115,22,0.18)` aplicado em `.dash-hello-name` | Ausente |
| HUD radar | SVG 800×360 com 4 anéis, 36 ticks, sweep line, gradients, readouts, barras XP/RANK | Ausente |
| Stat chips | Pílula com DashIcon + texto em 2 spans (`.v` valor + `.l` label) | Pílula com emoji + texto inline |
| Wave 👋 | Animação `@keyframes dash-wave` com rotação | Ausente |

#### Banner Faceoff

| Item | Design | Projeto |
|---|---|---|
| Cor | Teal (`rgba(20,184,166,*)`) | Indigo (`rgba(99,102,241,*)`) |
| Ícone | DashIcon "swords" | Emoji ⚔️ |
| CTA | "Votar agora" + DashIcon arrow-right | "Votar agora" / "✓ Votado" |
| Accent bar | `::before` no topo | Ausente |
| Backdrop blur | `blur(8px)` | Ausente |
| Glassmorphism | `rgba(10,12,18,0.6)` + gradient | Gradient indigo simples |

#### OpenCard / LockedActiveCard

| Item | Design | Projeto |
|---|---|---|
| Glassmorphism | Sim (`backdrop-filter: blur`) | Não |
| Borda dupla | Outer + inner highlight via `::before` accent bar | Borda simples |
| Accent bar | `::before` gradiente laranja com glow radial | Ausente |
| Hover | translateY(-3px) + box-shadow laranja | Mudança de borda apenas |
| Tipografia título | Rajdhani 22-26px | 16-21px inline |
| Badge "ABERTA" | Pílula com dot pulsante | Pílula simples |
| CTA "Montar lineup" | Arrow slide → no hover | Sem animação |

#### Seção Offseason (achievement, anticipation, replay)

| Item | Design | Projeto |
|---|---|---|
| AchievementHero | Componente novo (#N 96px dourado, H2 com em, stats, CTA) | Ausente — só `OffseasonGroupCard` simples |
| AnticipationCard | Componente novo (logo, eyebrow, name, countdown, CTA) | Ausente |
| ReplayCard | Componente novo (logo 48px, eyebrow, name+champ, date, score+rank) | Existe similar dentro do Offseason inline |

### 4.5 Footer

| Item | Design | Projeto |
|---|---|---|
| `.dash-footer` com border-top, mono 10px uppercase letter-spacing | Inline simples | **Adicionar** |
| Texto | "🔥 XAMA Fantasy League — dados reais do PUBG Esports" (Landing) | Mesmo texto inline | **Estilizar** |

---

## 5. Plano de execução por fases

Sequência: **base → componentes compartilhados → Dashboard refinado → polish.**

Cada fase é uma **branch separada** que será mergeada na `main` independentemente. Isso permite reverter qualquer mudança individualmente se quebrar algo.

### Fase A — Design Tokens Layer (baixo risco, 1 commit)

**Branch:** `feature/design-tokens-xm`

**Objetivo:** adicionar a camada `--xm-*` ao projeto sem tocar nos `--color-xama-*` existentes.

**Arquivos:**
- `frontend/src/styles/xm-tokens.css` (novo) — copia o conteúdo de `colors_and_type.css` do design, adaptando os `@font-face` para usar `@fontsource` que já está instalado no projeto (via Landing)
- `frontend/src/main.jsx` — adiciona `import './styles/xm-tokens.css'` no topo

**O que NÃO faz:**
- Não mexe em `index.css`
- Não mexe em `--color-xama-*`
- Não mexe em nenhum componente

**Critério de aceitação:**
- `npm run build` passa
- Inspeção do DOM mostra que `--xm-orange`, `--xm-text-bright`, etc. estão disponíveis em `:root`
- Nada visualmente mudou no app

**Risco:** baixo — só adiciona tokens, não substitui

**Tempo estimado:** 30 min

### Fase B — Refator Navbar (médio risco, 1 commit)

**Branch:** `feature/refactor-navbar`

**Objetivo:** substituir `Navbar.jsx` pela versão fiel ao design, preservando funcionalidade de tournament context, isAdmin e logout.

**Arquivos:**
- `frontend/src/components/Navbar.jsx` — refator completo
- `frontend/src/styles/xm-navbar.css` (novo) — classes `.xm-nav-*` extraídas de `dashboard.css` linhas 3-82

**Decisões importantes:**
- **Manter o bloco `{tournament && ...}`** que aparece no Navbar atual quando estamos em página de stage. É funcional, **não está no design** mas é necessário. Adaptar visual pra harmonizar.
- **Adicionar pill LIVE** — pegar dados de stages ativos via prop ou via store. Por enquanto, hardcode `"PAS 2026 · PEC 2026"` (TODO no backlog: derivar dinamicamente)
- **Mover botão Sair pro Perfil** — adicionar ao `Profile.jsx` se ainda não tiver. Remover da navbar.
- **Substituir 🔥 por SVG hexagonal** — copiar do `navbar.jsx` do design
- **Em mobile (≤880px):** tabs viram menu hambúrguer ou somem (design tem `.xm-nav-tabs { display: none }` em ≤880px — vamos seguir)

**Validação obrigatória — testar em TODAS as páginas autenticadas:**
- `/dashboard`
- `/championships`
- `/championships/{id}`
- `/leagues`, `/leagues/{id}`
- `/profile`
- `/admin`
- `/tournament/{id}/lineup`, `/tournament/{id}/results`
- `/faceoff`

**Critério de aceitação:**
- Build passa
- Visual igual ao design (brand SVG, tabs Rajdhani, pill LIVE, rule)
- Tournament context aparece quando aplicável
- isAdmin funciona
- Logout funciona (movido pra Perfil)
- Responsivo OK

**Risco:** médio — afeta múltiplas páginas

**Tempo estimado:** 2-3h

### Fase C — Refator AppBackground (baixo risco, 1 commit)

**Branch:** `feature/refactor-app-background`

**Objetivo:** trocar inline styles por classes `.xm-bg-*` do design system.

**Arquivos:**
- `frontend/src/components/AppBackground.jsx` — substitui inline por `<div className="xm-bg-base xm-bg-hex xm-bg-radial" />`
- `frontend/src/styles/xm-tokens.css` — confirmar que tem `.xm-bg-*` (já vem do `colors_and_type.css` capturado)

**Crítica decisão:** O AppBackground atual já está visualmente OK. Esta fase é **opcional** — pode ser pulada se a gente quiser economizar tempo. Vale fazer só por consistência (todas as classes via tokens).

**Critério de aceitação:**
- Build passa
- Background visualmente idêntico (hex grid + radial gradient)

**Risco:** baixo

**Tempo estimado:** 20 min

### Fase D — Foundation Dashboard (baixo risco, 1 commit)

**Branch:** `feature/dashboard-foundation`

**Objetivo:** preparar o terreno pra refator dos componentes do Dashboard.

**Arquivos:**
- `frontend/src/components/DashIcon.jsx` — refator pra usar paths inline (igual ao `dash-icon.jsx` capturado, com mais ícones que o atual)
- `frontend/src/components/icons.jsx` — atualizar com TODOS os 22 ícones do design (atual tem 19)
- `frontend/src/pages/dashboard.css` — substituir conteúdo atual pelo `dashboard.css` capturado do design (862 linhas)
- `frontend/src/components/Footer.jsx` (novo, se ainda não existir) — componente footer com classe `.dash-footer`

**Decisões:**
- O `dashboard.css` do projeto (atual da Fase 2) já tem várias classes `.dash-*` mas pode estar desatualizado em relação ao design. **Substituir integralmente pelo design.**
- Confirmar se o `icons.js`/`icons.jsx` órfão precisa ser removido nesta fase
- DashIcon do design usa `dangerouslySetInnerHTML` — manter assim (é controlado, sem risco de XSS porque os paths são hardcoded)

**Critério de aceitação:**
- Build passa
- DashIcon importável e renderizando
- Nada visualmente mudou (Dashboard ainda usa inline styles antigos)

**Risco:** baixo

**Tempo estimado:** 1h

### Fase E — Dashboard Refresh Real (alto risco, multi-commit)

**Branch:** `feature/dashboard-refresh-final`

**Objetivo:** refator do `Dashboard.jsx` aplicando todos os componentes do design.

**Subfases (cada uma 1 commit):**

**E1 — Hero (DashHero + HeroHud + chips)**
- Substitui linhas 1045-1088 do Dashboard atual
- Usa componente `DashHero` adaptado pra consumir `displayName` e `profileStats` reais
- HeroHud com SVG fiel ao design

**E2 — Banner Faceoff teal**
- Substitui linhas 1091-1134 do Dashboard atual
- Usa componente `FaceoffBanner` adaptado pra consumir `openFaceoffs`
- Preserva navegação e lógica de `targetStage`

**E3 — Cards Lineup Aberta (OpenCard + LockedActiveCard)**
- Substitui componentes internos do Dashboard.jsx (linhas 380-630)
- Mantém `CountdownBadge`, `StageChampLogo`, lógica de expand/collapse
- Aplica classes `.dash-open-*`

**E4 — Cards compactos (PreviewCard + ClosedPrimaryCard)**
- Substitui componentes internos (linhas 309-378, 632-730)
- Aplica classes `.dash-preview-*`

**E5 — Seções (Abrindo em Breve + Resultados)**
- Refator do `CollapseSection` e `StageRow`
- Headers usando `SectionHead` do design
- StageRow usando classes `.dash-stage-*`

**E6 — Offseason elaborada**
- Substitui seção offseason inteira (linhas 1210-1285)
- Implementa `AchievementHero`, `AnticipationCard`, `ReplayCard`
- Heurística pra `nextPreviewStage` (já existe como `previewStages[0]`)

**E7 — Footer Dashboard**
- Adiciona `<Footer />` no fim do Dashboard.jsx (se não vier do RequireAuth/layout)

**E8 — Documentação + cleanup**
- Atualiza CHANGELOG, CONTEXT, PROMPT_RETOMADA
- Remove animações `xama-dash-anim` injetadas no head (agora estão no dashboard.css)
- Remove fontes Google CDN injetadas (`xama-fonts`) — fontes vêm do `@fontsource` no main.jsx

**Validação obrigatória ao final de E1-E7:**
- Cada subfase valida com `npm run dev` antes de commit
- Subfase E3-E4 (cards) deve testar fluxo de "Montar lineup" funcionando
- Subfase E5 deve testar expand/collapse das seções
- Subfase E6 deve testar offseason em conta sem dados ativos

**Critério de aceitação final:**
- Visual fiel aos 3 estados do design (Lineup Aberta, Offseason, Mobile)
- Build passa
- Todos os fluxos funcionais (login, lineup builder, faceoff, leaderboard, etc.)

**Risco:** alto — Dashboard tem muita lógica condicional e estado

**Tempo estimado:** 5-7h distribuídos em sessões

### Fase F — Validação Final + Merge

**Não é branch nova.** É a fase de validação cruzada antes do merge da `feature/dashboard-refresh-final` na main.

- Validar todos os fluxos: login, lineup, leaderboard, faceoff, profile, admin
- Testar em viewports: 1920px, 1280px, 880px, 640px
- Comparar visualmente com `dashboard-state-1-lineup.html`, `dashboard-state-2-offseason.html`, `dashboard-state-3-mobile.html`
- Se tudo OK: merge na main

---

## 6. Tabela resumo das fases

| Fase | Branch | Risco | Tempo | Dependências |
|---|---|---|---|---|
| A | `feature/design-tokens-xm` | Baixo | 30min | — |
| B | `feature/refactor-navbar` | Médio | 2-3h | A |
| C | `feature/refactor-app-background` | Baixo | 20min | A (opcional) |
| D | `feature/dashboard-foundation` | Baixo | 1h | A |
| E1 | (parte de `feature/dashboard-refresh-final`) | Médio | 45min | A, B, D |
| E2 | (idem) | Baixo | 30min | A, D |
| E3 | (idem) | Alto | 1h | A, D |
| E4 | (idem) | Médio | 45min | A, D, E3 |
| E5 | (idem) | Médio | 45min | A, D |
| E6 | (idem) | Alto | 1h | A, D |
| E7 | (idem) | Baixo | 20min | — |
| E8 | (idem) | Baixo | 20min | — |
| F | (validação) | — | 1-2h | Todas |
| **Total** | | | **~10-12h** | |

---

## 7. Decisões pendentes (precisam confirmação humana antes de executar)

### 7.1 Qual ordem dos merges?

**Opção 1 (recomendada):** A → B → C → D → E (cada uma mergeada antes de iniciar a próxima)
- Vantagem: cada merge testa fix em isolamento. Se algo quebra, é fácil identificar de onde veio.
- Desvantagem: lento, várias sessões.

**Opção 2:** A → D → E (pula refator de Navbar e AppBackground por enquanto)
- Vantagem: foco no Dashboard, mais rápido.
- Desvantagem: a Navbar e AppBackground continuam fora de sintonia com o resto. **Não é fidelidade total.**

### 7.2 Pill LIVE: hardcode ou dinâmico?

- **Hardcode "PAS 2026 · PEC 2026"** — rápido, OK pra demo, mas vira tech debt
- **Dinâmico** — derivar dos torneios ativos via fetch ou store global, mostra o que está "live" agora. Mais correto mas mais código.

Recomendo **hardcode agora + entrada no BACKLOG.md pra dinamizar depois**.

### 7.3 Botão "Sair" da Navbar — pra onde vai?

- **Opção A:** mover pra `Profile.jsx` (página /profile) com botão proeminente
- **Opção B:** menu dropdown ao clicar em "Perfil" da navbar
- **Opção C:** submenu mobile

Recomendo **Opção A** — mais simples, sem precisar implementar dropdown agora.

### 7.4 Tournament context na Navbar

A Navbar atual mostra contexto do torneio quando você está numa página de stage. **Isso não está no design.**

- **Opção A:** preservar e adaptar visual (menos fiel ao design, mas funcionalidade preservada)
- **Opção B:** remover (mais fiel mas perde funcionalidade)

Recomendo **Opção A** — funcionalidade prevalece sobre fidelidade visual estrita.

---

## 8. Próximos passos

1. **Você confirma:**
   - Ordem dos merges (Opção 1 ou 2)
   - Pill LIVE hardcode
   - Botão Sair vai pro Profile
   - Tournament context preservado na Navbar

2. **Eu te entrego os prompts da Fase A** (tokens) — único arquivo novo, baixíssimo risco

3. **Você executa Fase A no Claude Code** — deve durar 30 min

4. **Validamos juntos** que tokens estão disponíveis sem regressões

5. **Seguimos pra Fase B** (Navbar) — o pulo do gato

Qualquer das fases pode ser pausada/retomada entre sessões. Os arquivos `docs/design-reference/` ficam como nosso "norte" pra qualquer dúvida durante a execução.

---

**Fim do relatório.**
