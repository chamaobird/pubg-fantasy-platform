# BACKLOG — XAMA Fantasy

## 🟡 Próximas tarefas (priorizadas)

### UX — Stats (PlayerStatsPage)
- [ ] #UX-17 Seletor de partida — exibir timezone do usuário ao lado do horário (ex: "06:00 BRT")
- [ ] #UX-18 Logo e tag dos times nas páginas de Stats e Lineup (atualmente sem logo)

### Pricing
- [ ] #PRICE-01 Preços saindo como inteiros ($30, $22) — revisar fórmula para gerar valores com 2 casas decimais (ex: $28.47). Pode ser arredondamento no serviço ou ao salvar no banco.

### UX — Landing/Auth
- [ ] #UX-01 Background temático voltado para fantasy league (não só PUBG raw)
- [ ] #UX-02 Formulário de auth centralizado flutuante (não colado à direita)
- [ ] #UX-03 Título explícito dentro do card (ENTRAR / CADASTRAR)
- [ ] #UX-04 Campo de confirmação de senha no cadastro
- [ ] #UX-06 Stats da landing (262+ jogadores etc.) — repensar copy e posicionamento

### UX — Dashboard
- [ ] #UX-08 Adicionar datas dos eventos — requer campos start_date/end_date na API (não retornados ainda)
- [ ] #UX-09 Nos stages encerrados, exibir nº de dias e nº de partidas — requer days_count/matches_count na API

### UX — Championships
- [ ] #UX-11 Logo do campeonato no lugar do badge PUB ID
- [ ] #UX-12 Datas e nº de partidas por stage
- [ ] #UX-13 Ordenar stages do mais recente para o mais antigo

### Infra
- [ ] #120 Desabilitar click tracking do Resend (domínio já verificado — executar)
- [ ] #121 BIMI record DNS para ícone do remetente no email (opcional, cosmético)

### Pricing — Bloco C
- [ ] #101 Job de polling de partidas ao vivo
- [ ] #103 Suporte a upload de jogadores via planilha CSV

---

## 🟢 Concluído

### Sessão de UX + Bugs (11/04/2026)
- [x] BUG Google OAuth redirecionava para localhost em produção → FRONTEND_URL criada no Render
- [x] BUG GET /stages/{id}/days retornava 500 → StageDayOut.is_active com default True
- [x] UX-07 Usuário sem username aparece como "JOGADOR" → fallback usa prefixo do email
- [x] UX-10 Badge short_name muito proeminente → removido das rows de Dashboard
- [x] Badge de status corrigido: locked→ENCERRADO, open→ABERTA, closed→EM BREVE (Badge.jsx + Navbar.jsx)
- [x] Navbar: "LOCKED" e "FINISHED" corrigidos para PT-BR
- [x] PlayerStatsPage: botão "Stage" renomeado para "TOTAL", escondido quando há 1 dia
- [x] PlayerStatsPage: preço com 3 casas decimais
- [x] PlayerStatsPage: estrela BEST removida — só valor numérico
- [x] PlayerStatsPage: seletor de partida com ícone e nome do mapa (P1 🌿 Erangel — 06:00)
- [x] PlayerStatsPage: horário das partidas convertido para fuso do navegador do usuário
- [x] Backend: coluna map_name adicionada ao modelo Match (migration 0010)
- [x] Backend: import_.py salva map_name ao importar/reprocessar matches
- [x] Backend: MatchOut inclui map_name
- [x] Backfill: 60 partidas existentes com map_name populado via scripts/backfill_map_names.py

### Sessão de UX + Auth (10/04/2026)
- [x] BUG-01 a BUG-06 corrigidos
- [x] UX-05, UX-14, UX-15, UX-16 implementados
- [x] Google OAuth, forgot/reset password, email templates, domínio Resend
- [x] Migration 0009: password_reset_token + password_reset_expires_at

### Fase 0–9 + Blocos A e B
- [x] Fases 1–9 completas
- [x] Bloco A — Populate PGS 2026
- [x] Bloco B — Pricing refatorado
