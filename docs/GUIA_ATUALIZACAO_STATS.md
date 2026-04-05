# Guia de Atualização de Stats — XAMA Fantasy

> Referência prática para atualizar partidas, stats e status de torneios manualmente.
> Sem AI necessária — só browser + PowerShell.

---

## 1. Autenticação (faça isso primeiro sempre)

Você precisará de um token de admin para todas as operações de escrita.

### Via PowerShell
```powershell
$resp = Invoke-RestMethod `
  -Uri "https://pubg-fantasy-platform.onrender.com/users/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"email":"admin@warzone.gg","password":"admin123"}'

$token = $resp.access_token
$headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }

# Teste rápido:
Write-Host "Token obtido:" ($null -ne $token)
```

### Via browser (para chamar direto do console)
Acesse `https://api.pubg.com` no browser (para evitar CORS) e execute no console (F12):
```js
fetch('https://pubg-fantasy-platform.onrender.com/users/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@warzone.gg', password: 'admin123' })
}).then(r => r.json()).then(d => { window._token = d.access_token; console.log('OK:', !!window._token); });
```

---

## 2. Descobrir os Match IDs de uma Sessão

### Passo 1 — Listar torneios disponíveis na PUBG API
```
GET https://api.pubg.com/tournaments
Header: Authorization: Bearer {PUBG_API_KEY}
Header: Accept: application/vnd.api+json
```

**Via browser** (execute em `https://api.pubg.com`):
```js
const PUBG_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...'; // sua key
fetch('https://api.pubg.com/tournaments', {
  headers: { 'Authorization': `Bearer ${PUBG_KEY}`, 'Accept': 'application/vnd.api+json' }
}).then(r => r.json()).then(d => {
  // Filtrar por ano/nome relevante
  console.log(JSON.stringify(d.data.filter(t => t.id.includes('26')).map(t => t.id)));
});
```

> **Nota importante:** O endpoint correto é `/tournaments` (sem shard). Nunca use `/shards/pc-tournament/tournaments`.

### Passo 2 — Buscar matches de um torneio específico
```
GET https://api.pubg.com/tournaments/{pubg_tournament_id}
```

```js
fetch('https://api.pubg.com/tournaments/as-pgs2fs', {  // troque pelo ID correto
  headers: { 'Authorization': `Bearer ${PUBG_KEY}`, 'Accept': 'application/vnd.api+json' }
}).then(r => r.json()).then(d => {
  const matches = d.included || [];
  console.log('Total:', matches.length);
  console.log(JSON.stringify(matches.map(m => ({ id: m.id, createdAt: m.attributes.createdAt }))));
});
```

Os matches aparecem ordenados aleatoriamente — use o `createdAt` para identificar quais são do dia correto.

> **Shard de torneios oficiais:** sempre `pc-tournament`
> **Shard de scrims (Live Server):** sempre `steam`

---

## 3. Importar Partidas

### Via PowerShell
```powershell
# Monte a lista de IDs (substitua pelos IDs reais)
$matchIds = @(
  "uuid-1-aqui",
  "uuid-2-aqui",
  "uuid-3-aqui"
)

$body = @{
  pubg_match_ids = $matchIds | ForEach-Object { @{ id = $_ } }
  shard = "pc-tournament"  # ou "steam" para scrims
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
  -Uri "https://pubg-fantasy-platform.onrender.com/historical/import-matches-by-ids/{TOURNAMENT_ID}?background=true" `
  -Method POST `
  -Headers $headers `
  -Body $body
```

### Via browser
```js
const matchIds = ["uuid-1", "uuid-2", "uuid-3"]; // substitua

const body = {
  pubg_match_ids: matchIds.map(id => ({ id })),
  shard: "pc-tournament"  // ou "steam"
};

fetch('https://pubg-fantasy-platform.onrender.com/historical/import-matches-by-ids/18?background=true', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${window._token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
}).then(r => r.json()).then(console.log);
```

**Resposta esperada:**
```json
{ "status": "queued", "tournament_id": 18, "match_count": 5, "message": "Queued 5 match(es) for background import..." }
```

> **Repair mode automático:** se um match já existe no DB com 0 stats, ele é reimportado sem duplicar o registro. Seguro reenviar todos os IDs.

---

## 4. Verificar se as Stats Foram Importadas

### Verificar matches no torneio
```powershell
Invoke-RestMethod `
  -Uri "https://pubg-fantasy-platform.onrender.com/tournaments/18/matches" `
  -Headers $headers | Select-Object total_matches, @{n='dias'; e={ $_.days | Select-Object date, matches_count }}
```

### Verificar stats de jogadores (top 5)
```powershell
$stats = Invoke-RestMethod `
  -Uri "https://pubg-fantasy-platform.onrender.com/tournaments/18/player-stats" `
  -Headers $headers

$stats | Select-Object -ExpandProperty players | Sort-Object fantasy_points -Descending | Select-Object -First 5 | Select-Object name, fantasy_points, kills
```

### Verificar via browser
```js
fetch('https://pubg-fantasy-platform.onrender.com/tournaments/18/matches', {
  headers: { 'Authorization': `Bearer ${window._token}` }
}).then(r => r.json()).then(d => {
  console.log('Total matches:', d.total_matches);
  d.days.forEach(day => console.log(`${day.date}: ${day.matches_count} partidas`));
});
```

---

## 5. Atualizar Status do Torneio

### Encerrar torneio (após todas as partidas)
```powershell
$body = '{"status": "finished", "lineup_open": false}'
Invoke-RestMethod `
  -Uri "https://pubg-fantasy-platform.onrender.com/admin/tournaments/18" `
  -Method PATCH `
  -Headers $headers `
  -Body $body
```

### Abrir/fechar montagem de lineup
```powershell
# Abrir lineup
$body = '{"lineup_open": true}'
Invoke-RestMethod -Uri ".../admin/tournaments/18" -Method PATCH -Headers $headers -Body $body

# Fechar lineup
$body = '{"lineup_open": false}'
Invoke-RestMethod -Uri ".../admin/tournaments/18" -Method PATCH -Headers $headers -Body $body
```

### Deixar torneio como "em andamento"
```powershell
$body = '{"status": "active", "lineup_open": false}'
Invoke-RestMethod -Uri ".../admin/tournaments/18" -Method PATCH -Headers $headers -Body $body
```

---

## 6. Seed de Jogadores a partir dos Matches (novo torneio)

Quando um torneio novo começa e os jogadores ainda não têm `pubg_id`, use:

```powershell
Invoke-RestMethod `
  -Uri "https://pubg-fantasy-platform.onrender.com/admin/seed-players-from-matches/18" `
  -Method POST `
  -Headers $headers
```

Isso atualiza automaticamente os `pubg_id` dos jogadores com base nas partidas já importadas.

---

## 7. Copiar Jogadores Entre Fases (fase anterior → nova fase)

Quando times avançam de uma fase para outra:

```powershell
# Copia jogadores do torneio 16 (source) para o 18 (target)
# Idempotente — não duplica se o jogador já existir no destino
Invoke-RestMethod `
  -Uri "https://pubg-fantasy-platform.onrender.com/admin/tournaments/16/copy-players-to/18" `
  -Method POST `
  -Headers $headers
```

---

## 8. Ativar/Desativar Jogadores em Massa

Útil quando times são eliminados e não devem aparecer no LineupBuilder:

```powershell
# Desativar (ex: times eliminados — informe os IDs dos jogadores)
$body = '{"player_ids": [1, 2, 3, 4], "activate": false}'
Invoke-RestMethod `
  -Uri "https://pubg-fantasy-platform.onrender.com/admin/players/bulk-set-active" `
  -Method PATCH `
  -Headers $headers `
  -Body $body

# Ativar
$body = '{"player_ids": [1, 2, 3, 4], "activate": true}'
Invoke-RestMethod `
  -Uri "https://pubg-fantasy-platform.onrender.com/admin/players/bulk-set-active" `
  -Method PATCH `
  -Headers $headers `
  -Body $body
```

> **Atenção:** o campo é `activate` (bool), não `is_active`.

Para descobrir os IDs de jogadores de um time específico:
```powershell
$players = Invoke-RestMethod -Uri ".../tournaments/18/debug-players" -Headers $headers
$players.all_players | Where-Object { $_.name -like "JDG*" } | Select-Object id, name
```

---

## 9. Fluxo Completo para Nova Sessão de Scrims (PAS)

```powershell
# 1. Obter 1 Steam name por grupo do wasdefy ("Playing as X")
# 2. Buscar o accountId do jogador na PUBG API
$player = Invoke-RestMethod `
  -Uri "https://api.pubg.com/shards/steam/players?filter[playerNames]=NOME_STEAM" `
  -Headers @{ Authorization = "Bearer $PUBG_KEY"; Accept = "application/vnd.api+json" }

# 3. Pegar os match IDs recentes do jogador (filtrar pela janela horária da sessão)
$matchIds = $player.data.relationships.matches.data | Select-Object -ExpandProperty id

# 4. Importar (shard: steam, tournament: 7)
$body = @{
  pubg_match_ids = $matchIds | ForEach-Object { @{ id = $_ } }
  shard = "steam"
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
  -Uri "https://pubg-fantasy-platform.onrender.com/historical/import-matches-by-ids/7?background=true" `
  -Method POST -Headers $headers -Body $body

# 5. Verificar
Invoke-RestMethod -Uri ".../tournaments/7/matches" -Headers $headers |
  Select-Object -ExpandProperty days | Select-Object date, matches_count
```

---

## 10. Fluxo Completo para Nova Fase de Campeonato

Quando uma nova fase começa (ex: nova Winners/Survival/Final Stage):

```powershell
# 1. Criar o torneio via API ou Swagger (GET /docs)
# POST /admin/tournaments  { name, pubg_id, region, status: "upcoming" }

# 2. Copiar jogadores das fases anteriores
Invoke-RestMethod -Uri ".../admin/tournaments/SOURCE_ID/copy-players-to/TARGET_ID" -Method POST -Headers $headers

# 3. Desativar times eliminados
# (bulk-set-active com activate: false)

# 4. Quando partidas começarem: importar matches
# (histórico acima — seção 3)

# 5. Seed pubg_ids
Invoke-RestMethod -Uri ".../admin/seed-players-from-matches/TARGET_ID" -Method POST -Headers $headers

# 6. Abrir lineup (se for fase com fantasy)
# PATCH /admin/tournaments/TARGET_ID  { "lineup_open": true, "status": "active" }

# 7. Ao final: fechar torneio
# PATCH /admin/tournaments/TARGET_ID  { "status": "finished", "lineup_open": false }
```

---

## 11. IDs de Referência dos Torneios Atuais

| ID | Nome | pubg_id | Shard |
|----|------|---------|-------|
| 7 | PAS 2026 - Americas Open Qualifier · Scrims | am-pas1cup | steam |
| 16 | PGS 2026 Circuit 2 · Winners Stage | as-pgs2ws | pc-tournament |
| 17 | PGS 2026 Circuit 2 · Survival Stage | as-pgs2ss | pc-tournament |
| **18** | **PGS 2026 Circuit 2 · Final Stage** | **as-pgs2fs** | **pc-tournament** |

---

## 12. Links Úteis

| Recurso | URL |
|---------|-----|
| Backend / Swagger | https://pubg-fantasy-platform.onrender.com/docs |
| PUBG API (lista torneios) | https://api.pubg.com/tournaments |
| PUBG Developer Portal | https://developer.pubg.com |
| wasdefy PAS1 | https://wasdefy.com/pubg/competitions/019c6ffe-0a45-718f-a448-e008cdcb71fa/schedule |
| GitHub | https://github.com/chamaobird/pubg-fantasy-platform |

---

*Última atualização: 28/03/2026*
