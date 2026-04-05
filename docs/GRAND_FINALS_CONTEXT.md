# XAMA Fantasy — Contexto Operacional: PGS Grand Finals
> Documento gerado em 02/04/2026 para orientar atualizações da Grand Final no chat Claude Pro.

---

## O que é este projeto

**XAMA Fantasy** é uma plataforma de fantasy PUBG Esports. Os usuários montam lineups de jogadores antes de cada dia de competição, e os pontos são calculados automaticamente com base nas stats das partidas importadas da PUBG API.

- **Backend:** FastAPI + PostgreSQL hospedado no Render
- **Frontend:** React + Vite (deploy automático)
- **Base URL da API (produção):** você precisará informar ao Claude qual é a URL do backend no Render ao iniciar a sessão

---

## Estado atual do banco de dados (02/04/2026)

### Championships
| id | name | fases incluídas | start_date |
|----|------|-----------------|------------|
| 4 | PGS 2026 Circuit 1 · Series Final | T20 (Survival), T19 (Grand Final) | 2026-04-02 |

### Torneios relevantes
| id | name | pubg_id no DB | status | lineup_open | current_day |
|----|------|---------------|--------|-------------|-------------|
| 20 | PGS 2026 Circuit 1 · Series Final — Survival Stage | as-pgs3ss | finished | false | 1 |
| **19** | **PGS 2026 Circuit 1 · Series Final — Grand Final** | tbd-pgc1-gf ⚠️ | **active** | **true** | **1** |

### ⚠️ Limitação crítica: pubg_id do T19
O campo `pubg_id` do torneio 19 está como `"tbd-pgc1-gf"` — um placeholder. O endpoint `PATCH /admin/tournaments/{id}` **não atualiza o campo pubg_id** (bug conhecido).

**Workaround:** Para importar matches da Grand Final, **não use o pubg_id do torneio**. Em vez disso, busque os UUIDs individuais de cada match diretamente na PUBG API e importe pelo endpoint `import-matches-by-ids`.

---

## T19 — Grand Final: Detalhes

### Times classificados (16 times — 64 players ativos)
- **Via pontos PGS Circuit 1+2 (Top 8):** PeRo, NAVI, AL, 4AM, DNS, MiTH, TWIS, T1
- **Via Survival Stage Top 8:** EA, TL, VP, JDG, T5, CR, VIT, 17

### Times eliminados (players desativados no DB)
CTG, FCE, FLC, FS, FUR, GEN, S2G, TE

### Estado atual
- Players: 64 ativos (copiados do T20 via `copy-players-to`, times eliminados desativados)
- Matches importados: 0 (ainda sem partidas)
- lineup_open: **true** (Dia 1 aberto para submissões)
- current_day: **1**

---

## Como buscar os Match UUIDs da Grand Final na PUBG API

O torneio na PUBG API provavelmente usa o ID `as-pgs3fs`. Para obter os UUIDs:

```
GET https://api.pubg.com/tournaments/as-pgs3fs
Authorization: Bearer {PUBG_API_KEY}
Accept: application/vnd.api+json
```

Isso retorna uma lista de match UUIDs. Cada UUID tem formato como `12345678-abcd-1234-abcd-1234567890ab`.

> **Nota:** matches de torneios oficiais usam shard `pc-tournament` (não `steam`).

---

## Fluxo Operacional: Atualizar Partidas do Dia

### Passo a passo padrão para cada dia de competição

#### 1. Importar as partidas
Para cada match UUID do dia, faça:
```
POST {BASE_URL}/historical/import-matches-by-ids/19?background=false
Body (JSON): { "match_ids": ["uuid1", "uuid2", "uuid3", "uuid4", "uuid5"] }
```
- O import é **idempotente**: se o match já existe com stats, não duplica
- Se o match existe com 0 stats (falha anterior), entra em **repair mode** automaticamente
- O primeiro match importado **fecha automaticamente o lineup_open** (auto-lock)

#### 2. Pontuar os matches
Após importar, para cada match (você receberá os IDs numéricos do DB na resposta do import):
```
POST {BASE_URL}/admin/matches/{match_id}/score
```
Isso calcula os fantasy_points de cada player e atualiza as lineups do dia correspondente.

#### 3. Abrir o próximo dia (quando necessário)
Após encerrar as partidas de um dia e antes do dia seguinte:
```
POST {BASE_URL}/admin/tournaments/19/open-day/2
```
Isso define `current_day=2` e reabre `lineup_open=true`.

#### 4. Fechar manualmente (se necessário)
```
POST {BASE_URL}/admin/tournaments/19/close-day
```

---

## Fluxo Multi-Dia (implementado)

A Grand Final usa o sistema multi-dia:
- Uma lineup por usuário **por dia** (não apenas por torneio)
- Matches de um dia só pontuam lineups daquele dia
- Leaderboard mostra tabs: Total / Dia 1 / Dia 2 / ...

| Ação | Endpoint |
|------|----------|
| Ver estado atual do torneio | `GET {BASE_URL}/tournaments/19` |
| Abrir submissões para Dia N | `POST {BASE_URL}/admin/tournaments/19/open-day/{N}` |
| Fechar submissões | `POST {BASE_URL}/admin/tournaments/19/close-day` |
| Importar matches | `POST {BASE_URL}/historical/import-matches-by-ids/19` |
| Pontuar um match | `POST {BASE_URL}/admin/matches/{id}/score` |
| Ver rankings (total) | `GET {BASE_URL}/tournaments/19/rankings` |
| Ver rankings (dia N) | `GET {BASE_URL}/tournaments/19/rankings?day=N` |
| Ver matches do torneio | `GET {BASE_URL}/tournaments/19/matches` |

---

## Diagnóstico de Problemas

### Se um jogador não recebe stats (unresolved participant)
1. **Diagnosticar:** `GET {BASE_URL}/tournaments/19/debug-match-resolve/{pubg_match_uuid}?shard=pc-tournament`
2. **Se o jogador é substituto e não está no DB:** usar `POST {BASE_URL}/admin/players/bulk-upsert/19`
3. **Se o jogador está no DB mas sem stats:** `POST {BASE_URL}/admin/reprocess-match-stats/{match_id_db}`

### Se um match foi importado mas com 0 stats
Basta reimportar — o sistema entra em repair mode automaticamente:
```
POST {BASE_URL}/historical/import-matches-by-ids/19
Body: { "match_ids": ["uuid-do-match"] }
```

---

## Fórmula de Pontuação (referência)

```
fantasy_points = base_points + late_game_bonus - penalty
penalty = 15 × penalty_count  (mortes precoces)
```

Campos em `match_player_stats`: `kills, assists, damage_dealt, placement, survival_secs, fantasy_points, base_points, late_game_bonus, penalty_count, wins_count`

---

## Endpoints Admin Adicionais (referência)

```
GET  {BASE_URL}/tournaments/19/debug-players          # lista players com pubg_id
GET  {BASE_URL}/tournaments/                           # lista todos torneios
GET  {BASE_URL}/championship-phases/                   # agrupa por campeonato
GET  {BASE_URL}/championship-phases/4/player-stats     # stats acumuladas do Championship 4
PATCH {BASE_URL}/admin/tournaments/19                  # atualiza status, lineup_open, etc (NÃO atualiza pubg_id)
PATCH {BASE_URL}/admin/players/bulk-set-active         # ativa/desativa players em massa
                                                       # body: { "player_ids": [...], "activate": true/false }
```

---

## Como iniciar a sessão no Claude Pro

Ao abrir um novo chat, informe:
1. Faça upload deste arquivo
2. Diga qual é a `BASE_URL` do backend no Render (ex: `https://xama-api.onrender.com`)
3. Se tiver os UUIDs dos matches do dia em mãos, já os informe
4. Peça para Claude te guiar no fluxo do dia (import → score → open-day se necessário)

O Claude será capaz de gerar os `curl` commands ou te orientar passo a passo com os endpoints corretos.
