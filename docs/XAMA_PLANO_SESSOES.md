# XAMA Fantasy — Plano de Sessões de Polimento e Crescimento

> Documento de orientação para execução incremental via Claude Code.
> Cada sessão é independente e deve fechar com critérios de aceite claros.
> Após cada sessão, o Birdo revisa antes de prosseguir para a próxima.

---

## Contexto e premissas

Este plano parte de uma auditoria completa do projeto (`AUDIT_REPORT.md`, 29/04/2026) que confirmou:

- **Stack maduro:** FastAPI + Postgres + APScheduler + WebSocket live scoring + auth completo (JWT + Google OAuth) + Resend transacional + painel admin completo + ligas privadas + achievements.
- **Lineup real:** 4 titulares + 1 reserva, captain ×1.30, budget cap, auto-replicação.
- **Gaps críticos identificados:**
  1. Zero instrumentação (sem analytics de eventos, sem feedback in-app, sem session replay).
  2. Dashboard trata usuário novo igual a usuário veterano (sem onboarding, sem estado vazio dedicado).
  3. Features sofisticadas existentes (achievements, ligas privadas, live scoring) sem destaque visual no produto.
- **Restrição atual do projeto:** dev solo, MVP buscando primeiros usuários, sem feedback chegando.

**Estratégia:** instrumentar primeiro (parar de operar no escuro) → resolver fricções óbvias do BACKLOG (ganho rápido) → atacar onboarding (primeira impressão) → 2 semanas operando → revisar com dados reais → escalar.

---

## Constraints técnicas (válidas para todas as sessões)

- **SQLAlchemy:** `Session` síncrono apenas, nunca `AsyncSession`.
- **PowerShell:** usar `;` para encadear comandos, nunca `&&`.
- **Alembic:** rodar como `python -m alembic` (não `alembic` direto). Sempre verificar `down_revision` contra os IDs reais antes de migrar. Cadeia atual vai até `0025`; a próxima migration será `0026`.
- **Dev server:** `python -m uvicorn app.main:app --reload` (sem `.venv`, Python global).
- **Variáveis de ambiente:** `$env:DATABASE_URL` precisa ser setada explicitamente em cada terminal novo.
- **Convenções de naming:** seguir o padrão existente em `app/models/` (snake_case, arquivos no singular: `feedback.py`, não `feedbacks.py`).
- **Frontend stack:** React 18 + Vite + Tailwind v4 + react-router-dom v7. Tokens de design em `src/index.css`. Componentes UI básicos em `src/components/ui/`.
- **AuthContext primário:** está em `App.jsx` (não em `src/context/AuthContext.jsx`). Usar `useAuth()` exportado de `App.jsx`.
- **API:** instância Axios em `src/api/axios.js` injeta JWT automaticamente. Service layer em `src/api/`.
- **Token JWT:** armazenado em `localStorage` sob chave `wf_token`.
- **Encerramento de sessão:** sempre atualizar `BACKLOG.md`, `CONTEXT.md` e `PROMPT_RETOMADA.md` ao fim.

---

## Sessão A — Instrumentação e canal de feedback 🔥

**Objetivo:** sair da cegueira operacional. Em 1 semana após o deploy, ter dados reais de comportamento e feedbacks chegando.

**Por que primeiro:** sem instrumentação, qualquer polimento é especulativo. Esta sessão é pré-requisito para validar todas as outras.

### Escopo

#### A.1 — PostHog no frontend (analytics + session replay)

**Por que PostHog:** combina analytics de eventos, session replay e funil/retention numa só ferramenta. Free tier (1M eventos/mês, 5k replays/mês) é mais que suficiente para o estágio atual. Decisão consciente de não usar uma segunda ferramenta para session replay — manutenção menor, dados correlacionados na mesma timeline.

**Setup:**
- O Birdo cria conta em [posthog.com](https://posthog.com) (Cloud, free tier, região EU ou US — recomendo US por latência menor) e gera uma Project API Key.
- Adicionar `posthog-js` ao `package.json` (frontend).
- Configurar variáveis de ambiente:
  - `VITE_POSTHOG_KEY` — Project API Key.
  - `VITE_POSTHOG_HOST` — `https://us.i.posthog.com` (ou EU equivalente, conforme escolha do Birdo).
- Inicializar em `main.jsx`:
  - **Session replay habilitado** (`session_recording: { maskAllInputs: false }` — sem inputs sensíveis no produto, mas confirmar com Birdo).
  - **Autocapture desabilitado** (`autocapture: false`) — preferimos eventos explícitos e nomeados; autocapture polui o dashboard.
  - **Capture pageviews automático** (`capture_pageview: true`).
- Em `App.jsx`, dentro do `AuthContext`:
  - Ao logar: `posthog.identify(user.id.toString(), { email, username, is_admin })`.
  - Ao deslogar: `posthog.reset()`.
- Criar utilitário `src/lib/analytics.js` com função `track(event, props)` que encapsula PostHog (facilita troca futura ou desativação para debug).

**Eventos mínimos a instrumentar:**
- `signup_completed` — em LandingPage após registro bem-sucedido.
- `login_completed` — em LandingPage após login (incluir `method: "password" | "google"`).
- `dashboard_viewed` — em Dashboard mount.
- `tournament_opened` — em TournamentHub mount, com `stage_id` e `championship_id`.
- `lineup_started` — em LineupBuilder ao abrir, com `stage_id`.
- `lineup_saved` — após submit bem-sucedido, com `total_cost`, `is_first_lineup` (boolean derivado).
- `lineup_abandoned` — em unmount do LineupBuilder se `lineup_started` ocorreu sem `lineup_saved`.
- `leaderboard_viewed` — em TournamentLeaderboard mount.
- `player_stats_opened` — em PlayerStatsPage mount.
- `feedback_submitted` — após envio do widget (ver A.2).

**Guard de ambiente:** PostHog NÃO deve rodar em desenvolvimento. Usar `import.meta.env.PROD` no init e early-return em `track()` se não estiver em produção. Isso evita poluir métricas e gravar replays do próprio Birdo desenvolvendo.

#### A.2 — Widget de feedback in-app

**Backend:**
- Criar migration `0026_feedback.py` com tabela:
  ```
  feedback (
    id PK,
    user_id FK -> user.id NULL,
    page VARCHAR(120),         -- ex: "/dashboard", "/lineup-builder/123"
    message TEXT NOT NULL,
    rating SMALLINT NULL,      -- 1-5, opcional
    user_agent VARCHAR(300),
    created_at TIMESTAMP
  )
  ```
- Criar `app/models/feedback.py` seguindo padrão dos outros models.
- Criar `app/schemas/feedback.py` (`FeedbackCreate`, `FeedbackOut`).
- Criar `app/routers/feedback.py` com:
  - `POST /feedback` — público (não exige auth, mas associa user_id se token presente). Rate limit: 5/min por IP via slowapi.
  - `GET /admin/feedback` — admin only, paginado, ordem desc por created_at.
- Registrar router em `app/main.py`.

**Frontend:**
- Componente `src/components/FeedbackButton.jsx`:
  - Botão flutuante fixed bottom-right, ícone de balão.
  - Visível em todas as páginas protegidas (não na LandingPage).
  - Ao clicar, abre modal com: textarea (obrigatório, min 5 chars), 5 estrelas opcionais, botão Enviar.
  - Captura `window.location.pathname` automaticamente como `page`.
  - Após envio, toast de agradecimento.
- Adicionar service em `src/api/feedback.js`.
- Renderizar `<FeedbackButton />` no `ProtectedRoute` (uma vez só, fora das páginas).
- Página admin de leitura: nova aba em `Admin.jsx` chamada "Feedback" que lista os feedbacks recebidos. Componente `src/pages/admin/AdminFeedback.jsx`.

### Critérios de aceite

- [ ] PostHog recebe pelo menos 5 eventos distintos quando o Birdo navega pelo produto em produção.
- [ ] PostHog grava ao menos 1 session replay completa de navegação real em produção.
- [ ] Widget de feedback envia mensagem com sucesso e aparece em `/admin/feedback`.
- [ ] Nenhum evento, replay ou tracking é disparado em `npm run dev` local.
- [ ] Build sem warnings novos.
- [ ] Migration `0026` aplica e reverte limpamente.

### Arquivos esperados (referência, não exaustivo)

```
NOVO  app/migrations/versions/0026_feedback.py
NOVO  app/models/feedback.py
NOVO  app/schemas/feedback.py
NOVO  app/routers/feedback.py
NOVO  frontend/src/components/FeedbackButton.jsx
NOVO  frontend/src/api/feedback.js
NOVO  frontend/src/lib/analytics.js
NOVO  frontend/src/pages/admin/AdminFeedback.jsx
EDIT  app/main.py                   (registrar router feedback; importar model)
EDIT  frontend/src/main.jsx         (init PostHog)
EDIT  frontend/src/App.jsx          (identify/reset no AuthContext)
EDIT  frontend/src/components/ProtectedRoute.jsx  (montar FeedbackButton)
EDIT  frontend/src/pages/Admin.jsx  (nova aba Feedback)
EDIT  frontend/package.json         (posthog-js)
EDIT  BACKLOG.md, CONTEXT.md, PROMPT_RETOMADA.md
```

---

## Sessão B — Limpeza de débitos rápidos do BACKLOG 🧹

**Objetivo:** zerar a seção 🔴 Alta prioridade do BACKLOG. Ganho de momentum e remoção de fricções já mapeadas. Pode ser feita no mesmo dia que a Sessão A.

### Escopo

- **Fix `LeagueDetail.jsx:152`** — corrigir `style={ST} style={{ marginBottom: 0 }}` para `style={{ ...ST, marginBottom: 0 }}`.
- **Sort por team name** em:
  - `PlayerStatsPage.jsx` — ordenar lista de jogadores por team_name (asc), depois por display_name.
  - `LineupBuilder.jsx` — ordenar roster disponível por team_name (asc), depois por fantasy_cost (desc).
- **Ajustar preço do hwinn** — confirmar valor correto (~13.24) com o Birdo antes de aplicar via `cost_override`.
- **#PAS-13** — rodar `manage_player_accounts.py` para validar Steam names após 1ª partida.
- **#PAS-14** — atualizar `PlayerAccount id=308` (Gustav) com account_id e shard reais.
- **`TeamLogo.jsx`** — remover alias `flcn → flc`.
- **Comentário em `scoring.py` ~L14** — corrigir `×1.25` → `×1.30`.
- **Documentar dev server no `CONTEXT.md`** — adicionar bloco "Como rodar localmente" com:
  ```
  python -m uvicorn app.main:app --reload
  # Sem .venv, Python global
  # PowerShell: $env:DATABASE_URL = "..."
  ```
- **Atualizar `CONTEXT.md`** — remover nota "aguardando merge para main" da rota `/`.
- **Fechar `DEBT-B2`** no BACKLOG (LandingPage já usa tokens próprios).

### Arquivos legados (ação separada — confirmar com Birdo antes)

Deletar definitivamente do repo:
- `Landing.jsx`, `Login.jsx`, `Register.jsx`
- `CreateTeam.jsx`, `MyTeams.jsx`, `TeamDetail.jsx`
- `Players.jsx`, `Leaderboard.jsx`, `Tournaments.jsx`, `TournamentSelect.jsx`, `NotFound.jsx`

> Antes de deletar, fazer `grep -r "from.*pages/Landing" frontend/src/` (e equivalente para cada arquivo) para confirmar zero referências ativas. Se algum arquivo for referenciado, NÃO deletar e reportar ao Birdo. O histórico do git preserva o conteúdo caso seja necessário recuperar.

### AuthContext duplicado

Avaliar se `src/context/AuthContext.jsx` pode ser removido. Se sim, remover. Se não (caso esteja usado em algum lugar), reportar onde para o Birdo decidir.

### Critérios de aceite

- [ ] Seção 🔴 do BACKLOG zerada (ou com itens explicitamente reagendados).
- [ ] Build do Vite sem warnings de duplicate attribute.
- [ ] `CONTEXT.md` atualizado e consistente com o estado real do projeto.
- [ ] Arquivos legados deletados (se aprovado), com confirmação prévia de zero referências ativas.
- [ ] Smoke test manual: dashboard, lineup builder, player stats, league detail abrem sem erro.

---

## Sessão C — Onboarding e estado vazio do Dashboard 🎯

**Objetivo:** primeiro usuário cadastrado consegue chegar a "lineup salvo" sem precisar perguntar nada.

**Pré-requisito:** Sessão A deployada e coletando dados (queremos comparar funil antes/depois).

### Escopo

#### C.1 — Detecção de "first-time user"

- Backend: novo endpoint `GET /profile/has-played` retorna `{ has_lineup: bool, last_stage_played_id: int | null }`.
- Frontend: hook `useFirstTimeUser()` que chama o endpoint e cacheia o resultado durante a sessão.

#### C.2 — Componente `WelcomeHero.jsx`

Em `Dashboard.jsx`, antes de renderizar o conteúdo padrão, checar `isFirstTimeUser`. Se true, renderizar `WelcomeHero`:

- **Headline:** "Bem-vindo ao XAMA Fantasy"
- **3 cards explicativos** (em grid responsivo):
  1. **Monte seu time** — escolha 4 titulares + 1 reserva dentro do budget de 100 tokens
  2. **Acompanhe ao vivo** — pontuação atualizada em tempo real durante as partidas
  3. **Compita** — leaderboards públicos e ligas privadas com amigos
- **CTA principal:**
  - Se há stage com `lineup_status = open`: botão "Montar meu primeiro lineup" → `/tournament/{stage_id}` aba LineupBuilder.
  - Se não há stage aberta mas há `preview`: countdown + "Próxima abertura em X" + link para Profile/Achievements para explorar.
  - Se offseason completo: link para Championships/Profile + texto "Volte quando o próximo torneio começar — te avisamos por email".
- **Dismissable:** botão "X" no canto que seta flag em `localStorage` (`xama:welcome_dismissed`) para esconder permanentemente.

#### C.3 — Tooltip de primeira visita no LineupBuilder

- Quando o usuário entra no LineupBuilder pela primeira vez (sem nenhum lineup salvo no histórico):
  - Tooltip discreto sobre o primeiro slot titular: "Clique para escolher um jogador. Você tem 100 tokens para montar seu time."
  - Tooltip sobre o budget bar: "Mantenha o custo total dentro do budget."
  - Tooltip sobre o slot reserva: "A reserva pontua se algum titular for substituído por lesão/punição."
- Implementar com biblioteca leve (`@floating-ui/react` ou similar) ou solução CSS-only.
- Persistência via `localStorage` (`xama:tour_lineup_seen`).

#### C.4 — Eventos analytics adicionais

- `welcome_hero_viewed` — quando aparece
- `welcome_hero_cta_clicked` — quando clica no CTA principal
- `welcome_hero_dismissed` — quando fecha
- `lineup_tour_completed` — quando vê todos os tooltips

### Critérios de aceite

- [ ] Usuário recém-cadastrado vê WelcomeHero no primeiro acesso ao Dashboard.
- [ ] CTA principal leva ao caminho correto baseado no estado das stages.
- [ ] Após dismiss, WelcomeHero não reaparece mesmo após refresh.
- [ ] LineupBuilder mostra tooltips na primeira visita e não nas subsequentes.
- [ ] Eventos analytics novos aparecem no PostHog.
- [ ] Funil PostHog: `signup_completed` → `welcome_hero_cta_clicked` → `lineup_started` → `lineup_saved` mensurável.

### Arquivos esperados

```
NOVO  frontend/src/components/WelcomeHero.jsx
NOVO  frontend/src/components/LineupTour.jsx
NOVO  frontend/src/hooks/useFirstTimeUser.js
EDIT  app/routers/profile.py        (endpoint /has-played)
EDIT  frontend/src/pages/Dashboard.jsx
EDIT  frontend/src/components/LineupBuilder.jsx
EDIT  frontend/src/api/profile.js (criar se não existir)
EDIT  BACKLOG.md, CONTEXT.md, PROMPT_RETOMADA.md
```

---

## Sessão D — Ponto de revisão com dados reais 📊

**Não é uma sessão de código.** É um momento de análise.

**Pré-requisito:** Sessões A, B e C deployadas há pelo menos 2 semanas.

**O Birdo traz para a próxima conversa:**
- Print do funil PostHog: `signup_completed` → `lineup_saved`.
- 5-10 session replays do PostHog de usuários novos.
- Lista completa de feedbacks recebidos.
- Métricas básicas: total de signups, % que salvaram lineup, % que voltaram no segundo dia.

**Saída esperada:** plano de Sessão E priorizado com base em evidência (não em chute), atacando o maior gargalo identificado.

---

## Sessões candidatas para depois (não priorizar agora)

Estas ficam em standby até a Sessão D mostrar onde focar. Documentadas aqui para não esquecer:

- **Compartilhamento social do lineup** — botão gera imagem/OG do lineup montado. Cada share = canal de aquisição.
- **Página pública `/torneio/:slug`** — leaderboard sem login, compartilhável.
- **Destaque de achievements** — card no Dashboard mostrando última conquista.
- **Banner "convide para liga privada"** — feature existe, falta visibilidade.
- **Mobile Fase 2 completa** — LineupBuilder cards, scroll horizontal, TournamentHeader empilhado, hambúrguer nav (já está no BACKLOG 🟡).
- **Skeleton screens e otimistic UI** — polish de loading states.
- **Snippet de stats curiosas pós-match** — conteúdo orgânico para redes sociais.

---

## Workflow combinado entre Birdo, Claude (web) e Claude Code

1. **Birdo** apresenta esta sessão ao Claude Code com instrução: "execute a Sessão A deste plano".
2. **Claude Code** implementa, reporta arquivos criados/editados, roda testes locais, prepara commits.
3. **Birdo** revisa em produção/staging, valida critérios de aceite, eventualmente pede ajustes ao Claude Code.
4. **Birdo** volta para a conversa web com Claude para discutir resultados, ajustes finos de produto, ou aprovar próxima sessão.
5. **Repete** para a próxima sessão.

Após a Sessão D, o plano é reescrito com base nos dados.

---

## Notas de execução para o Claude Code

- **Não inicie a Sessão B antes da A.** Instrumentação é pré-requisito.
- **Faça commits atômicos por sub-item** (ex: A.1, A.2, A.3 em commits separados) para facilitar revisão e rollback.
- **Cada sessão fecha com:** push para feature branch, PR aberta com checklist de critérios de aceite, atualização dos 3 docs vivos.
- **Em caso de conflito com convenção existente:** seguir a convenção existente, registrar a divergência no PR.
- **Em caso de dúvida de produto** (ex: cor exata do CTA, copy do tooltip): implementar uma versão razoável e marcar com comentário `// REVIEW:` para o Birdo decidir.
- **Migrations Alembic:** sempre verificar `down_revision` lendo o arquivo da migration anterior antes de gerar a nova.
- **Não usar `AsyncSession`.** Tudo síncrono, sempre.
