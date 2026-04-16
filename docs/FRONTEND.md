# FRONTEND — XAMA Fantasy
> Referência de frontend: componentes, design system, rotas e convenções.
> Atualizar quando adicionar páginas, componentes ou alterar tokens CSS.

## Localização
```
C:\Users\lgpas\PROJECTS\pubg-fantasy-platform\frontend\
```
Deploy automático no Render a cada `git push origin main`.

## Stack
- React 18 + Vite 5
- Tailwind CSS v4 + CSS customizado em `frontend/src/index.css`
- React Router (rotas em `frontend/src/App.jsx`)
- Axios via `frontend/src/api/` (usar sempre — nunca raw `fetch()`)
- API base: `https://pubg-fantasy-platform.onrender.com` (em `frontend/src/config.ts`)

## Rotas e páginas

| Rota | Arquivo | Descrição |
|------|---------|-----------|
| `/` | `pages/LandingPage.jsx` | Landing pública com login/registro |
| `/dashboard` | `pages/Dashboard.jsx` | Cards de campeonatos pós-login |
| `/championships` | `pages/Championships.jsx` | Lista de campeonatos |
| `/tournament/:id` | `pages/TournamentHub.jsx` | Hub do torneio (Leaderboard, Lineup, Stats) |
| `/stages/:id/results` | `pages/LineupResultsPage.jsx` | Resultados de uma fase |
| `/profile` | `pages/Profile.jsx` | Perfil do usuário |
| `/auth/callback` | `pages/AuthCallback.jsx` | Recebe token do Google OAuth; redireciona para /setup-username se sem username |
| `/auth/reset-password` | `pages/ResetPasswordPage.jsx` | Formulário de reset de senha |
| `/auth/verified` | `pages/AuthVerified.jsx` | Confirmação de email |
| `/setup-username` | `pages/SetupUsername.jsx` | Forçar escolha de username para usuários Google sem username |

## Componentes principais

```
components/
  Navbar.jsx                  # Barra de navegação global
  TournamentLayout.jsx        # Layout: Navbar + Header + Tabs + slot
  TournamentHeader.jsx        # Strip com breadcrumb, nome, status, rank
  TournamentLeaderboard.jsx   # Tabela de classificação (filtros dia/partida, sparklines)
  LineupBuilder.jsx           # Montagem de lineup com header sticky
  PlayerStatsPage.jsx         # Stats por jogador com filtros hierárquicos + best-match badges
  PlayerCard.jsx              # Card de jogador individual
  TeamLogo.jsx                # Logo de time com cascading fallbacks por pasta de campeonato
  ChampionshipSelector.jsx    # Seletor Campeonato → Fase
  Tabs.jsx                    # Tabs com indicador animado
  PriceBreakdown.jsx          # Breakdown de custo do jogador
  Toast.jsx                   # Notificações temporárias

  ui/                         # Design system base (barrel export em ui/index.js)
    Card.jsx, Badge.jsx, Button.jsx, PageHeader.jsx
    SectionTitle.jsx, StatRow.jsx
```

## Design system — tokens CSS

Arquivo: `frontend/src/index.css`

### Cores
```css
--color-xama-black:   #0d0f14   /* Fundo da página */
--color-xama-surface: #12151c   /* Cards e painéis */
--color-xama-border:  #1e2330   /* Bordas */
--color-xama-muted:   #6b7280   /* Texto secundário */
--color-xama-text:    #dce1ea   /* Texto principal */
--color-xama-orange:  #f97316   /* Destaque principal / CTAs */
--color-xama-gold:    #f0c040   /* Destaque dourado / tabs ativas */
--color-xama-blue:    #3b82f6   /* Info / pts por partida */
--color-xama-teal:    #14b8a6   /* Acento secundário */
--color-xama-green:   #4ade80   /* Sucesso */
--color-xama-red:     #f87171   /* Erro / penalidade */
```

Classes Tailwind: `text-xama-orange`, `bg-xama-surface`, `border-xama-border`, etc.

### Tipografia
```css
--fs-page-title:    28px   /* Título principal */
--fs-section-title: 18px   /* Título de seção */
--fs-card-title:    16px   /* Título de card */
--fs-body:          14px   /* Texto normal */
--fs-table:         14px   /* Tabela */
--fs-label:         11px   /* Labels, badges */
--fs-micro:         10px   /* Micro texto */
--fw-heading: 700 | --fw-bold: 600 | --fw-normal: 500
```

Fontes: **Rajdhani** (títulos UI), **JetBrains Mono** (números/tags), **Inter** (body).

### Superfícies e espaçamento
```css
--surface-0: #0d0f14  --surface-1: #12151c  --surface-2: #0f1219  --surface-3: #1a1f2e
--space-section: 32px  --space-card: 20px  --space-row: 46px  --space-gap: 16px
--radius-card: 12px  --radius-inner: 8px  --radius-tag: 5px
```

### Classes globais úteis
```
.xama-page        Wrapper de página (padding, max-width)
.xama-container   Container central
.xama-card-v2     Card padrão com borda e superfície
.xama-card-hover  Card com efeito hover
.dark-input       Input estilizado
.dark-select      Select estilizado
.dark-btn         Botão base dark
.tab-bar .tab-btn Barra de tabs
```

## Estrutura de logos
```
frontend/public/logos/
  PGS/    → times da Grand Final (17.png, 4am.png, al.png...)
  PAS/    → times da Cup PAS (fe.png, pest.png, afi.jpeg...)
```
- `afi` e `op` têm extensão `.jpeg` (não `.png`)
- `TeamLogo.jsx` recebe `logoUrl` da API (campo `team_logo`); fallback: iniciais em laranja
- Cascading fallbacks por pasta de campeonato já implementado

## Convenções
- Componentes: `PascalCase`
- CSS classes: prefixo por contexto (`.xlb-*` LineupBuilder, `.xh-*` headings)
- Cores/fontes: sempre tokens CSS — nunca valores hardcoded
- Player name: `TEAM_PlayerName` → split em `_` → `[0]` tag, `[1:]` nome
- Auth: JWT Bearer token em `localStorage` como `wf_token`
- API calls: idealmente via `api/` service layer; alguns componentes usam `fetch()` diretamente (legacy)

## Desenvolvimento local
```powershell
cd C:\Users\lgpas\PROJECTS\pubg-fantasy-platform\frontend
npm run dev
# Acesse http://localhost:5173
```
Hot reload automático. Deploy: `git push origin main` → Render deploya em ~2 min.
