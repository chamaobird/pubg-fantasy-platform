# BACKLOG — XAMA Fantasy

## 🟡 Próximas tarefas (priorizadas)

### UX — Lineup
- [ ] #UX-18 Logo e tag dos times no LineupBuilder

### UX — Landing/Auth
- [ ] #UX-01 Background temático voltado para fantasy league
- [ ] #UX-02 Formulário de auth centralizado flutuante
- [ ] #UX-03 Título explícito dentro do card (ENTRAR / CADASTRAR)
- [ ] #UX-04 Campo de confirmação de senha no cadastro
- [ ] #UX-06 Stats da landing — repensar copy e posicionamento

### UX — Dashboard
- [ ] #UX-08 Datas dos eventos — requer start_date/end_date na API
- [ ] #UX-09 Nº de dias e partidas — requer days_count/matches_count na API

### UX — Championships
- [ ] #UX-12 Datas e nº de partidas por stage — requer campos na API

### UX — Stats
- [ ] #UX-17 Timezone no seletor de partida (ex: "06:00 BRT")

### Infra
- [ ] #120 Desabilitar click tracking do Resend
- [ ] #121 BIMI record DNS (cosmético)

### Pricing — Bloco C
- [ ] #101 Job de polling de partidas ao vivo
- [ ] #103 Upload de jogadores via planilha CSV

### Tech debt conhecido
- [ ] PlayerHistoryModal tooltip errático em bordas do SVG — refatorar para HTML tooltip

---

## 🟢 Concluído

### Sessão 11/04/2026
- [x] MIN_VALID_MATCHES 20→5, fantasy_cost Numeric(6,2), migration 0011
- [x] Schemas roster/stats corrigidos para float
- [x] Pricing recalculado stages 2-8
- [x] PlayerHistoryModal: gráfico histórico, barras negativas, tooltip, before_date
- [x] Team logos nas Stats: team_map corrige team_name null
- [x] TeamLogo: .webp antes de .png
- [x] TournamentHeader: logo campeonato + dropdown stages com busca
- [x] Championships: logo, ordem decrescente, short_name discreto
- [x] Championship renomeado para "Circuito 1"
- [x] UX-07, UX-10, Badge status, Navbar PT-BR
- [x] PlayerStatsPage: TOTAL, preço 3 casas, seletor com mapa+fuso
- [x] map_name: migration 0010, import, backfill
- [x] Google OAuth fix, StageDayOut fix
- [x] cron-job.org configurado (14 min)

### Sessão 10/04/2026
- [x] BUG-01 a BUG-06, UX-05, UX-14, UX-15, UX-16
- [x] Google OAuth, forgot/reset password, Resend, migration 0009

### Fases 0-9 + Blocos A e B
- [x] Setup completo, schema, auth, scoring, pricing, lineup, leaderboard
