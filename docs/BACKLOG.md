# BACKLOG — XAMA Fantasy

## 🔴 Alta prioridade — próxima sessão

### PAS — abrir lineup próxima etapa
- [ ] #PAS-01 Avaliar opções para abertura da próxima etapa da PAS
  - Opção A: Cadastrar nova Stage no championship PAS existente (ou criar championship PAS primeiro)
  - Opção B: Definir roster de jogadores da PAS (importar ou cadastrar manualmente)
  - Opção C: Configurar pricing da stage PAS com base no histórico disponível
  - Decisão necessária: o PAS tem jogadores novos que nunca jogaram na plataforma? Como tratar newcomers?
  - Decisão necessária: qual o shard correto para partidas da PAS? (provavelmente "steam")

---

## 🟡 Média prioridade

### UX — Consistência visual entre páginas
- [ ] #UX-THEME Adequar todas as páginas internas ao tema Atmospheric da Landing
  - Dashboard, Championships, TournamentHub, PlayerStatsPage, LineupBuilder
  - Revisar backgrounds, cards e borders para consistência com #08090d base
  - Considerar adicionar grade hexagonal sutil como background global

### UX — Auth
- [ ] #UX-04 Campo de confirmação de senha no cadastro

### UX — Lineup
- [ ] #UX-18 Logo e tag dos times no LineupBuilder

### UX — Stats
- [ ] #UX-17 Timezone no seletor de partida (ex: "06:00 BRT")

### UX — Dashboard
- [ ] #UX-08 Datas dos eventos (requer start_date/end_date na API)
- [ ] #UX-09 Nº de dias e partidas (requer days_count/matches_count na API)

### UX — Championships
- [ ] #UX-12 Datas e nº de partidas por stage (requer campos na API)

### Infra
- [ ] #120 Desabilitar click tracking do Resend
- [ ] #121 BIMI record DNS

### Pricing — Bloco C
- [ ] #101 Job de polling de partidas ao vivo
- [ ] #103 Upload de jogadores via planilha CSV

---

## 🔧 Tech debt conhecido
- [ ] PlayerHistoryModal tooltip errático em bordas SVG — refatorar para HTML tooltip

---

## 🟢 Concluído

### Sessão 11/04/2026
- [x] Landing Atmospheric: grade hex, gradiente, scan line, form integrado, stats atualizadas
- [x] MIN_VALID_MATCHES 20→5, fantasy_cost Numeric(6,2), migration 0011
- [x] PlayerHistoryModal: barras negativas, tooltip, before_date, logo no header
- [x] Team logos nas Stats (team_map), TeamLogo .webp
- [x] TournamentHeader: logo campeonato + dropdown stages com busca
- [x] Championships: logo, ordem decrescente, short_name discreto, rename Circuito 1
- [x] UX-07, UX-10, Badge status PT-BR, map_name migration 0010

### Sessão 10/04/2026
- [x] BUG-01–06, UX-05, UX-14, UX-15, UX-16
- [x] Google OAuth, forgot/reset password, Resend, migration 0009

### Fases 0–9 + Blocos A–B
- [x] Setup completo, schema, auth, scoring, pricing, lineup, leaderboard, populate PGS
