# CHANGELOG — XAMA Fantasy
> Para iniciar sessão: anexar CONTEXT.md + este arquivo.

---

## Estado Atual — 11/04/2026 (fim de sessão)

### Próximas tarefas — ver BACKLOG.md
- Abrir lineup da próxima etapa da PAS (próxima sessão)
- Adequar cores/tema das páginas internas ao visual da Landing (backlog UX)
- UX-18: logos no LineupBuilder
- Landing/Auth: confirmação de senha no cadastro (UX-04)

### Stack e migrations
- Migrations aplicadas até 0011 (roster cost Numeric 6,2)
- Próxima migration: revision = "0012", down_revision = "0011"

---

## Sessão 11/04/2026 — Landing/Auth redesign

### Landing Atmospheric implementada
- Background: grade hexagonal SVG inline + gradiente radial laranja + scan line animada
- Hero: eyebrow com traço laranja, tipografia Rajdhani bold, stats em grid unificado
- Stats atualizadas: 262+ jogadores, 9 stages, 60 partidas
- Form: fundo escuro translúcido rgba + borda laranja + backdropFilter blur
- Título explícito no card: "Entrar na plataforma" / "Criar conta"
- Toggle Entrar/Cadastrar: ativo com fundo laranja sólido
- Botão Google adaptado ao tema escuro
- Classes CSS isoladas (xama-landing-input, xama-msg-error, xama-msg-success) para não conflitar com o resto da app

---

## Sessão 11/04/2026 — parte 3 (pricing + modais)

### Pricing corrigido
- MIN_VALID_MATCHES: 20→5, fantasy_cost Numeric(6,2), migration 0011
- Recalculo executado nas stages 2-8

### PlayerHistoryModal
- Endpoint: GET /stages/persons/{person_id}/match-history?limit=15&before_date=...
- Gráfico de barras SVG com barras negativas (escala unificada), tooltip, data no eixo X
- Logo do time no header, filtro por contexto do clique
- Integrado em PlayerStatsPage e LineupBuilder

### Team logos e TournamentHeader
- team_name corrigido via team_map no player-stats
- TeamLogo: .webp antes de .png
- TournamentHeader: logo campeonato + dropdown stages com busca
- Championship renomeado: "PUBG Global Series 2026 - Circuito 1"

---

## Sessões anteriores
- 10/04/2026: Google OAuth, forgot/reset password, Resend, migration 0009
- Fases 0-9 + Blocos A-B: setup completo, schema, auth, scoring, pricing, lineup, leaderboard
