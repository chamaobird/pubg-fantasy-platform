# XAMA Fantasy — Guia de Frontend para Claude

> Este documento serve como contexto para sessões de chat focadas em alterações de frontend.
> Cole este conteúdo no início da conversa antes de fazer suas solicitações.

---

## Raiz do Projeto

```
C:\Users\lgpas\OneDrive\Área de Trabalho\pubg-fantasy-platform-clean\
```

**Frontend fica em:**
```
C:\Users\lgpas\OneDrive\Área de Trabalho\pubg-fantasy-platform-clean\frontend\
```

**Deploy:** qualquer `git push origin main` na raiz do projeto faz deploy automático no Render (frontend + backend).

---

## Stack do Frontend

- **Framework:** React + Vite
- **Estilo:** Tailwind v4 + CSS customizado em `frontend/src/index.css`
- **Roteamento:** React Router (rotas em `frontend/src/App.jsx`)
- **API:** `https://pubg-fantasy-platform.onrender.com` (configurado em `frontend/src/config.ts`)

---

## Páginas (Routes)

| Rota | Arquivo | Descrição |
|------|---------|-----------|
| `/` | `src/pages/LandingPage.jsx` | Landing pública (login/registro) |
| `/dashboard` | `src/pages/Dashboard.jsx` | Página inicial pós-login com cards de torneios |
| `/tournaments` | `src/pages/TournamentSelect.jsx` | Seleção de torneio agrupado por campeonato |
| `/tournament/:id` | `src/pages/TournamentHub.jsx` | Hub do torneio (tabs: Leaderboard, Lineup, Stats) |
| `/profile` | `src/pages/Profile.jsx` | Perfil do usuário |

**Rotas são definidas em:** `frontend/src/App.jsx`

---

## Componentes Principais

```
frontend/src/components/
  Navbar.jsx                   # Barra de navegação global (topo)
  TournamentLayout.jsx         # Layout de página de torneio (Navbar + Header + Tabs + slot)
  TournamentHeader.jsx         # Strip com breadcrumb (Championship › Phase), nome, status, rank
  TournamentLeaderboard.jsx    # Tabela de classificação com filtros por dia/partida
  LineupBuilder.jsx            # Montagem de lineup com header sticky
  PlayerStatsPage.jsx          # Tabela de stats por jogador com filtros hierárquicos
  PlayerCard.jsx               # Card de jogador individual
  TeamLogo.jsx                 # Logo de time (usa logoUrl da API; fallback: iniciais em laranja)
  ChampionshipSelector.jsx     # Seletor Campeonato → Fase
  Tabs.jsx                     # Tabs horizontais com indicador animado
  PriceBreakdown.jsx           # Breakdown de preço de jogador
  Toast.jsx                    # Notificações temporárias

  ui/                          # Componentes base do Design System XAMA
    Card.jsx                   # Container de card
    Badge.jsx                  # Badge genérico
    Button.jsx                 # Botão estilizado
    PageHeader.jsx             # Cabeçalho de página (título + subtítulo)
    SectionTitle.jsx           # Título de seção
    StatRow.jsx                # Linha de estatística (label + valor)
    index.js                   # Barrel export de todos os ui/
```

---

## Design System XAMA — CSS Tokens

O arquivo principal de estilos é: `frontend/src/index.css`

### Cores (usar como classes Tailwind: `text-xama-orange`, `bg-xama-surface`, etc.)
```css
--color-xama-black:    #0d0f14   /* Fundo da página */
--color-xama-surface:  #12151c   /* Cards e painéis */
--color-xama-border:   #1e2330   /* Bordas */
--color-xama-muted:    #6b7280   /* Texto secundário/desabilitado */
--color-xama-text:     #dce1ea   /* Texto principal */
--color-xama-orange:   #f97316   /* Destaque principal / CTAs */
--color-xama-gold:     #f0c040   /* Destaque dourado / tabs ativas */
--color-xama-blue:     #3b82f6   /* Info / pontos por partida */
--color-xama-teal:     #14b8a6   /* Acento secundário */
--color-xama-green:    #4ade80   /* Sucesso */
--color-xama-red:      #f87171   /* Erro / penalidade */
```

### Tipografia (variáveis CSS — usar em `style={{ fontSize: 'var(--fs-body)' }}` ou em classes CSS)
```css
--fs-page-title:    28px   /* Título principal da página */
--fs-section-title: 18px   /* Título de seção */
--fs-card-title:    16px   /* Título de card */
--fs-body:          14px   /* Texto normal */
--fs-table:         14px   /* Texto de tabela */
--fs-label:         11px   /* Labels, badges, caps */
--fs-micro:         10px   /* Micro texto */

--fw-heading: 700   /* Peso de títulos */
--fw-bold:    600
--fw-normal:  500
```

### Espaçamento
```css
--space-section: 32px   /* Entre seções principais */
--space-card:    20px   /* Padding interno de card */
--space-row:     46px   /* Altura mínima de linha de tabela */
--space-gap:     16px   /* Gap padrão entre cards */
```

### Superfícies (layers de profundidade)
```css
--surface-0: #0d0f14   /* Fundo da página */
--surface-1: #12151c   /* Cards / painéis */
--surface-2: #0f1219   /* Header de tabela / sub-painel */
--surface-3: #1a1f2e   /* Inputs / chips / seletores */
```

### Raios de borda
```css
--radius-card:  12px
--radius-inner: 8px
--radius-tag:   5px
```

### Classes CSS globais úteis (definidas em index.css)
```
.xama-page          Wrapper de página (padding, max-width)
.xama-container     Container central
.xama-card-v2       Card padrão com borda e superfície
.xama-card-hover    Card com efeito hover
.dark-input         Input estilizado (dark theme)
.dark-select        Select estilizado
.dark-btn           Botão base dark
.tab-bar / .tab-btn Barra de tabs
```

---

## Fontes

O projeto usa `Inter` como fonte principal (body). Para números e tags usa `JetBrains Mono`.
As fontes `Rajdhani` (títulos UI) e `JetBrains Mono` fazem parte do design system XAMA.

Para alterar a fonte de um elemento, editar o CSS do componente ou adicionar em `index.css`.

---

## Estrutura de Logos

### Logos de Times
```
frontend/public/logos/
  PGS/    → Times da Grand Final PGS (ex: 17.png, 4am.png, al.png...)
  PAS/    → Times da Cup PAS (ex: fe.png, pest.png, afi.jpeg...)
```
- **Atenção:** `afi` e `op` têm extensão `.jpeg` (não `.png`)
- O componente `TeamLogo.jsx` recebe `logoUrl` como prop (vem da API, campo `team_logo`)
- Se não houver logo, exibe as iniciais do time em laranja

### Logos de Campeonato (a implementar)
Para adicionar logos dos campeonatos, o fluxo planejado é:
1. Salvar arquivos em `frontend/public/logos/championships/` (ex: `pgs.png`, `pas.png`)
2. Criar componente `ChampionshipLogo.jsx` similar ao `TeamLogo.jsx`
3. Usar o campo `championship.name` ou `championship.region` para determinar qual logo exibir
4. Os campeonatos existentes no banco são:
   - ID 1: PGS 2026 Circuit 1 · Series 1 (GLOBAL)
   - ID 2: PAS 2026 - Americas Series 1 (AM)
   - ID 3: PGS 2026 Circuit 2 · Series 2 (GLOBAL)
   - ID 4: PGS 2026 Circuit 1 · Series Final (GLOBAL)

---

## API — Endpoints Úteis para Frontend

**Base URL:** `https://pubg-fantasy-platform.onrender.com`

```
GET  /tournaments/                              → lista todos os torneios (inclui championship_id)
GET  /championship-phases/                     → torneios agrupados por campeonato
GET  /tournaments/{id}/rankings                → leaderboard; ?day=N para filtrar por dia
GET  /tournaments/{id}/player-stats            → stats de jogadores; ?group_label=A para filtrar grupo
GET  /tournaments/{id}/matches                 → partidas agrupadas por dia (BRT)
GET  /tournaments/{id}/players                 → lista jogadores com team_logo
GET  /tournaments/{id}/lineups/me              → lineups do usuário logado (uma por dia)
POST /tournaments/{id}/lineups                 → submete lineup (requer auth)
POST /users/login                              → login; body: {"email":"...","password":"..."}
```

---

## Banco de Dados — Acesso via PowerShell

```powershell
# Login admin na API (guardar token)
$resp = Invoke-RestMethod -Uri "https://pubg-fantasy-platform.onrender.com/users/login" -Method POST -ContentType "application/json" -Body '{"email":"admin@warzone.gg","password":"admin123"}'
$token = $resp.access_token
$headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }

# Verificar torneios
Invoke-RestMethod -Uri "https://pubg-fantasy-platform.onrender.com/tournaments/" -Headers $headers

# Acesso direto ao PostgreSQL (substituir *** pela senha do Render)
docker exec -it pubg_fantasy_db psql "postgresql://pubgfantasydb_b478_user:***@dpg-d6ke3plm5p6s73domdmg-a.oregon-postgres.render.com/pubg_fantasy_db"
```

> A senha do banco está em `.env` na raiz do projeto (campo DATABASE_URL). O banco é remoto (Render), não local.

---

## Torneios Ativos no Momento

| ID | Nome | Status | Lineup |
|----|------|--------|--------|
| 19 | PGS 2026 Grand Final | active | true (Dia 1) |
| 21 | PAS1 Cup Week #5 | active | true |

---

## Como Fazer Alterações de Frontend

1. **Editar o arquivo** diretamente na pasta do projeto
2. **Salvar** — o Vite atualiza automaticamente no browser (hot reload) se o servidor de dev estiver rodando
3. **Fazer deploy:** `git add . && git commit -m "mensagem" && git push origin main`
   - O Render faz o deploy automático em ~2 min após o push

### Servidor de desenvolvimento local (opcional)
```powershell
cd "C:\Users\lgpas\OneDrive\Área de Trabalho\pubg-fantasy-platform-clean\frontend"
npm run dev
```
Acesse em `http://localhost:5173`

---

## Convenções de Código

- Componentes em `PascalCase` (ex: `TeamLogo.jsx`)
- CSS classes: prefixo por contexto (`.xlb-*` para LineupBuilder, `.xh-*` para headings, `.xcard-*` para cards)
- Player name format: `TEAM_PlayerName` → split em `_` → `[0]` = tag do time, `[1:]` = nome
- Cores e fontes: **sempre usar os tokens CSS** (`var(--color-xama-orange)`, `var(--fs-body)`) em vez de valores hardcoded
- Para classes Tailwind de cor XAMA: `text-xama-orange`, `bg-xama-surface`, `border-xama-border` etc.
