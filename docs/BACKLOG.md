# BACKLOG — XAMA Fantasy

## 🟡 Próximas tarefas (priorizadas)

### UX — Stats (PlayerStatsPage)
- [ ] #UX-17 Seletor de partida — exibir timezone do usuário ao lado do horário (ex: "06:00 BRT")
- [ ] #UX-18 Logo e tag dos times na página de Lineup (LineupBuilder)

### Pricing
- [x] #PRICE-01a MIN_VALID_MATCHES corrigido de 20 para 5 (1 dia completo de competição)
- [ ] #PRICE-01b Preços saindo como inteiros ($30, $22) — fantasy_cost salvo como int, revisar para float com 2 decimais
- [ ] #PRICE-02 Rodar recalculo nas stages 2-8 após deploy (fantasy_cost está null)

### UX — Landing/Auth
- [ ] #UX-01 Background temático voltado para fantasy league
- [ ] #UX-02 Formulário de auth centralizado flutuante
- [ ] #UX-03 Título explícito dentro do card (ENTRAR / CADASTRAR)
- [ ] #UX-04 Campo de confirmação de senha no cadastro
- [ ] #UX-06 Stats da landing — repensar copy e posicionamento

### UX — Dashboard
- [ ] #UX-08 Datas dos eventos — requer start_date/end_date na API
- [ ] #UX-09 Nº de dias e partidas nos stages encerrados — requer days_count/matches_count na API

### UX — Championships
- [ ] #UX-12 Datas e nº de partidas por stage — requer campos na API

### Infra
- [ ] #120 Desabilitar click tracking do Resend (domínio já verificado)
- [ ] #121 BIMI record DNS (cosmético)

### Pricing — Bloco C
- [ ] #101 Job de polling de partidas ao vivo
- [ ] #103 Suporte a upload de jogadores via planilha CSV

---

## 🟢 Concluído

### Sessão 11/04/2026 (parte 2)
- [x] Team logos nas Player Stats — team_name vinha null do endpoint, corrigido via team_map dos Rosters
- [x] TeamLogo.jsx e teamLogo.js — adicionado .webp como tentativa antes de .png
- [x] TournamentHeader: logo do campeonato à esquerda do nome
- [x] TournamentHeader: dropdown de stages com busca, scroll e stage atual destacada
- [x] TournamentHub: busca siblingStages via GET /stages/?championship_id=N
- [x] TournamentLayout: repassando novas props para TournamentHeader
- [x] UX-11: logo do campeonato em Championships (PGS.webp, PAS.png)
- [x] UX-13: stages ordenadas do mais recente para o mais antigo
- [x] short_name nas rows de Championships: movido para direita, sem background
- [x] Championship renomeado: "PUBG Global Series 2026 - Circuito 1"
- [x] app/routers/stages.py: team_map corrige team_name null no player-stats

### Sessão 11/04/2026 (parte 1)
- [x] BUG: Google OAuth localhost em produção → FRONTEND_URL no Render
- [x] BUG: GET /stages/{id}/days 500 → StageDayOut.is_active default True
- [x] UX-07: fallback username → prefixo do email
- [x] UX-10: badge short_name removido das rows do Dashboard
- [x] Badge.jsx + Navbar.jsx: locked→ENCERRADO, open→ABERTA, closed→EM BREVE
- [x] PlayerStatsPage: botão TOTAL, preço 3 casas, estrela BEST removida
- [x] PlayerStatsPage: seletor com ícone de mapa e fuso do navegador
- [x] map_name: migration 0010, import_.py, MatchOut, backfill 60 partidas

### Sessão 10/04/2026
- [x] BUG-01 a BUG-06, UX-05, UX-14, UX-15, UX-16
- [x] Google OAuth, forgot/reset password, email templates, Resend
- [x] Migration 0009: password_reset

### Fases 0–9 + Blocos A e B
- [x] Fases 1–9 completas
- [x] Bloco A — Populate PGS 2026
- [x] Bloco B — Pricing refatorado
