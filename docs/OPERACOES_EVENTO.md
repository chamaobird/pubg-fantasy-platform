# Operações Manuais — PAS1 Playoffs

Guia de sobrevivência para operar a plataforma durante o evento sem assistência do Claude.

---

## Acesso ao Swagger (painel admin)

URL: `https://pubg-fantasy-platform.onrender.com/docs`

### Autenticação

1. Abra o site, faça login com sua conta admin
2. No console do browser (F12 → Console), rode:
   ```js
   localStorage.getItem('wf_token')
   ```
3. Copie o token que aparecer
4. No Swagger, clique em **Authorize** (canto superior direito)
5. Cole o token no campo `HTTPBearer (http, Bearer)` → **Authorize**

---

## Stages das Playoffs

| Stage ID | Nome              | Status atual |
|----------|-------------------|--------------|
| **15**   | Playoffs 1 - Dia 1 | `open`       |
| **16**   | Playoffs 1 - Dia 2 | `preview`    |
| **17**   | Playoffs 1 - Dia 3 | `preview`    |

---

## Operações por etapa do evento

### Antes das partidas começarem (20h Brasília = 23h UTC)

**Fechar a montagem de lineup manualmente:**

```
PATCH /admin/stages/{stage_id}
```

Body:
```json
{ "lineup_status": "locked" }
```

> Exemplo: para fechar o Dia 1, use `stage_id = 15`

**Ou agendar o fechamento automático** (recomendado — fecha sozinho no horário):

```
PATCH /admin/stages/{stage_id}
```

Body (substitua a data/hora):
```json
{ "lineup_close_at": "2026-04-17T23:00:00Z" }
```

> Conversão: 20h Brasília = 23h UTC (BRT = UTC-3)
> O sistema verifica a cada minuto e fecha automaticamente quando chegar o horário.

---

### Após o Dia 1 encerrar

**1. Rodar backfill de stats** (garante que todos aparecem no leaderboard):

```
POST /admin/stages/15/backfill-stats
```

Sem body. Resposta esperada:
```json
{ "ok": true, "stage_id": 15, "lineups_processed": N }
```

**2. Adicionar os 8 times piores do Dia 1 ao roster do Dia 2**

Isso requer assistência do Claude — os times dependem do resultado do Dia 1.

**3. Abrir montagem do Dia 2:**

```
PATCH /admin/stages/16
```

Body:
```json
{ "lineup_status": "open" }
```

**Ou agendar abertura automática:**
```json
{ "lineup_open_at": "2026-04-18T10:00:00Z" }
```

---

### Após o Dia 2 encerrar

**1. Rodar backfill de stats do Dia 2:**

```
POST /admin/stages/16/backfill-stats
```

**2. Adicionar times do Dia 2 ao roster do Dia 3** (requer Claude)

**3. Abrir montagem do Dia 3:**

```
PATCH /admin/stages/17
```

Body:
```json
{ "lineup_status": "open" }
```

---

## Fluxo resumido por dia

```
[Abertura do lineup]
  → PATCH /admin/stages/{id}  { "lineup_status": "open" }
  → OU definir lineup_open_at no dia anterior

[Partidas começam — 20h BRT / 23h UTC]
  → PATCH /admin/stages/{id}  { "lineup_status": "locked" }
  → OU definir lineup_close_at com antecedência

[Após scoring]
  → POST /admin/stages/{id}/backfill-stats
```

---

## Transições de status válidas

```
closed  → open    (abre montagem)
closed  → locked  (pula direto para travado)
open    → locked  (trava montagem)
locked  → open    (reabre em emergência)
```

> **Atenção:** `preview` (visível, sem montagem) só pode ser alterado via Claude
> ou diretamente no banco de dados. O Swagger não aceita transição para `preview`.

---

## Emergências

### Reabrir lineup após travar por engano

```
PATCH /admin/stages/{stage_id}
```
```json
{ "lineup_status": "open" }
```

### Forçar qualquer status (endpoint dedicado)

```
POST /admin/stages/{stage_id}/force-status
```
```json
{ "status": "open" }
```

> Aceita: `open`, `locked`, `closed`

---

## Referência rápida de horários (UTC)

| Horário Brasília | UTC       |
|------------------|-----------|
| 10h00            | 13h00     |
| 12h00            | 15h00     |
| 18h00            | 21h00     |
| 19h30            | 22h30     |
| **20h00**        | **23h00** |
| 21h00            | 00h00+1   |
