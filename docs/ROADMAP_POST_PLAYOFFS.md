# Roadmap Pós-Playoffs — XAMA Fantasy
> Criado em 19/04/2026 após encerramento das Playoffs 1 (PAS + PEC).
> Este documento captura as decisões estruturais tomadas e o plano de implementação
> para o próximo ciclo de torneios (PAS 2 Open Qualifiers e similares).

---

## 1. Contexto — o que aprendemos nas Playoffs 1

Operamos dois championships simultâneos pela primeira vez (PEC + PAS), ambos com shard
`pc-tournament`. Os principais atritos identificados:

| Problema | Causa raiz | Status |
|---|---|---|
| Shard errado (steam em vez de pc-tournament) | Campo livre, sem validação | **Resolvido** (detect-shard) |
| 53 PENDING_ no PAS D1 | Times SA só tinham conta steam | **Parcialmente** (pc-tournament: PENDING_ ainda ocorre) |
| 48 PENDING_ no PEC D1 | Times fora do roster da stage | **Resolvido** (validate_event) |
| Re-execução causava UniqueViolation | known_ids zerado a cada execução | **Resolvido** (import_pec_day.py) |
| Sequences PostgreSQL dessincronizadas | Inserts fora do SQLAlchemy | **Resolvido** (fix_sequences.py) |
| Reprocessar matches exigia Claude | Sem endpoint no Swagger | **Resolvido** (reprocess-all-matches) |
| Tags/logos ausentes descobertos em produção | Sem checklist pré-evento | **Resolvido** (validate_event.py) |

---

## 2. Decisões estruturais tomadas

### 2.1 Modelo de Championship para torneios regionais semanais

**Decisão: 1 championship por semana, shard no championship (não na stage).**

Estrutura padrão de uma semana de qualificatória regional:
```
PAS 2 - Open Qualify WEEK #1  (championship, shard=steam, tier_weight=TBD)
  ├── Stage 1 — Dia 1   (40+ times, ~160 jogadores, newcomer_cost)
  ├── Stage 2 — Dia 2   (mesmos times, pricing ajustado pelo D1)
  ├── Stage 3 — Dia 3   (mesmos times, pricing ajustado pelo D1+D2)
  └── Stage 4 — Final   (16 melhores times das stages 1-3, subconjunto do roster)

PAS 2 - Playoffs 1  (championship, shard=pc-tournament)
  └── mesma estrutura dos Playoffs 1 que já operamos
```

**Por que funciona:**
- Shard é uniforme dentro de uma semana (steam para qualificatórias, pc-tournament para playoffs)
- Lineup por stage (por dia) — model atual já suporta
- Pricing entre semanas acontece automaticamente via decay exponencial (150 dias)
- Mesmo `Person` e `PlayerAccount` reutilizados entre semanas — só `Roster` é recriado

**Nota sobre `tier_weight`:** qualificatórias steam regionais devem ter tier_weight menor que
Playoffs pc-tournament. Valor exato a definir antes do primeiro evento (sugestão: steam=0.5, playoffs=0.8, grand_final=1.0).

### 2.2 Identidade de jogadores — steam vs pc-tournament

**Decisão: manter modelo atual (múltiplos PlayerAccount por Person, um por shard).**

Um jogador que participa de qualificatória (steam) E playoffs (pc-tournament) terá:
```
Person(id=X, display_name="TEAM_Player")
  ├── PlayerAccount(shard='steam',         account_id='account.steam.xxx')
  └── PlayerAccount(shard='pc-tournament', account_id='account.pctournament.xxx')
```

O identity service (`build_lookup`) já filtra por shard da stage — funciona sem mudança de modelo.

### 2.3 Resolução de PENDING_ para steam

**Decisão: eliminar PENDING_ para shards steam usando player lookup pré-evento.**

O endpoint `GET /shards/steam/players?filter[playerNames]=nome1,nome2,...` (máx 10 por request)
retorna account_ids por nome. Para 160 jogadores = 16 requests ≈ 2 minutos.

Isso muda o fluxo:
- **pc-tournament (Playoffs):** PENDING_ inevitável → reconciliar após 1a partida (fluxo atual)
- **steam (qualificatórias):** resolver account_id antes do evento → zero PENDING_ no lineup open

### 2.4 Escala — 40+ times por semana

**Decisão: bulk roster import é pré-requisito para os próximos eventos.**

Processo manual atual (1 jogador por vez via psql/Swagger) não escala para 160+ entradas.
Um único championship semanal exige: ~40 times × 4 jogadores = 160 rosters D1 + 64 rosters Final.

---

## 3. O que precisa ser construído

### Prioridade 1 — Steam Player Lookup Service
**Dependência:** nada. **Desbloqueia:** bulk import, validate_event melhorado.

Novo script/endpoint que recebe lista de nomes de jogadores e retorna account_ids via PUBG API steam.

```python
# Interface esperada (script)
python scripts/pubg/lookup_steam_accounts.py --names "Player1,Player2,Player3"
# → {Player1: account.steam.xxx, Player2: ..., Player3: NOT_FOUND}

# Interface esperada (endpoint admin)
POST /admin/players/lookup-steam
body: {"names": ["Player1", "Player2"]}
→ [{"name": "Player1", "account_id": "account.steam.xxx", "found": true}, ...]
```

**Detalhes de implementação:**
- Batches de 10 nomes por request (limite da API)
- Rate limit: 1 request a cada 6.5s (~9 req/min, margem de segurança)
- Retornar `found: false` para nomes não encontrados (jogador novo ou nome errado)
- Integrar com `validate_event.py`: após criar roster, chamar lookup para confirmar que todos têm account

---

### Prioridade 2 — Bulk Roster Import
**Dependência:** Steam Player Lookup. **Desbloqueia:** operação dos próximos eventos.

Fluxo completo de setup de um dia de torneio a partir de uma lista de times/jogadores.

**Input esperado** (arquivo TXT ou formulário admin):
```
TEAM_NAME | TAG  | PLAYER1 | PLAYER2 | PLAYER3 | PLAYER4 | PLAYER5(sub)
Baldinini | BAL  | DIFX    | Mellman | Staed   | SoseD   | reserve
YOOO      | YO   | vjeemzz | pw9d    | mykLe   | K4pii   |
```

**O que o script faz:**
1. Para cada linha: `UPSERT Person` (cria se não existe, atualiza display_name se mudou)
2. Para cada jogador: lookup steam (ou marcar PENDING_ se pc-tournament)
3. `UPSERT PlayerAccount` com account_id resolvido
4. Criar `Roster` na stage especificada (4 titulares + sub como extra)
5. Relatório final: criados / atualizados / não encontrados / duplicatas

**Interface:**
```bash
python scripts/pubg/bulk_import_roster.py \
  --stage-id 25 \
  --shard steam \
  --file roster_week1.txt
```

---

### Prioridade 3 — Página Admin (frontend)
**Dependência:** bulk import + steam lookup implementados (usados como serviços internos).

Rota `/admin` protegida por `is_admin`, com sidebar + área de conteúdo.

**Estrutura de navegação (seleção em cascata, sem rotas separadas):**
```
Sidebar
  ├── Championships    → listar todos; criar novo; detect-shard integrado
  │     └── [selecionado] → Stages do championship
  │           └── [selecionada] → painel operacional da stage
  │                 ├── Roster      (add/remove player, toggle is_available, move entre times)
  │                 ├── Import      (tournament_id, buscar matches, importar, reprocess-all)
  │                 ├── Scoring     (score-day, rescore, backfill, visualizar leaderboard)
  │                 └── Pricing     (override por jogador, recalculate, tabela de preços)
  └── Players          → buscar/filtrar persons; criar; editar display_name + accounts
```

**Seções e o que cada uma faz:**

| Seção | Endpoints usados | Notas |
|---|---|---|
| Championships | `GET/POST/PATCH /admin/championships/` + detect-shard | Inline create form |
| Stages | `GET/POST/PATCH /admin/stages/` | Filtrado por championship selecionado |
| Roster | `GET/POST/PATCH/DELETE /admin/stages/{id}/roster` | Busca person por nome para adicionar |
| Import | `POST import-matches`, `POST reprocess-all-matches` | Input de tournament_id; mostra match list |
| Scoring | `POST score-day`, `POST rescore`, `POST backfill-stats` | Botões com confirmação |
| Pricing | `PATCH cost-override`, `POST recalculate-pricing` | Tabela editável |
| Players | `GET/POST/PATCH /admin/persons/` + accounts | Search, create, edit |

**Componentes existentes a reutilizar:**
- `AdminOpsPanel.jsx` → migrar lógica para seções Import + Scoring
- `AdminPricingPanel.jsx` → migrar lógica para seção Pricing

**Arquivos a criar:**
```
frontend/src/pages/AdminPage.jsx
frontend/src/components/admin/
  AdminLayout.jsx              (sidebar + content wrapper)
  ChampionshipsSection.jsx
  StagesSection.jsx
  RosterSection.jsx
  ImportSection.jsx
  ScoringSection.jsx
  PricingSection.jsx
  PlayersSection.jsx
frontend/src/api/admin.js      (client functions para todos os endpoints admin)
```

---

## 4. Ordem de implementação recomendada

```
[1] Steam Player Lookup
    → script + endpoint
    → Tempo estimado: 1 sessão

[2] Bulk Roster Import
    → script CLI com input TXT
    → Integra lookup de [1]
    → Tempo estimado: 1 sessão

[3] validate_event.py melhorado
    → Adicionar check de accounts steam via lookup
    → Rápido: ~30min (extensão do script existente)

[4] Página Admin — fase 1 (estrutura + Championships + Players)
    → AdminLayout + rota /admin + ChampionshipsSection + PlayersSection
    → Sem dependência de [1] e [2]
    → Tempo estimado: 1-2 sessões

[5] Página Admin — fase 2 (operações por stage)
    → RosterSection + ImportSection + ScoringSection + PricingSection
    → Migra AdminOpsPanel e AdminPricingPanel
    → Tempo estimado: 1-2 sessões
```

---

## 5. O que NÃO precisa mudar no modelo atual

- `shard` em `Championship` e `Stage` — modelo correto, não mover para outro nível
- `PlayerAccount` com múltiplos registros por `Person` — já suportado
- Pricing com decay exponencial — já funciona entre championships
- `carries_stats_from` em `Stage` — útil mas não obrigatório (pricing já usa histórico global)
- `lineup_status` e fluxo de transições — modelo atual correto
- Scheduler de scoring, pricing, lineup control — funciona, não tocar

---

## 6. Referência rápida — próximo evento

Quando iniciar o setup do primeiro championship steam (ex: PAS 2 Week 1):

```bash
# 1. Confirmar tournament_id e shard
GET /admin/championships/detect-shard?tournament_id=am-pas2-week1

# 2. Criar championship
POST /admin/championships/
{ "name": "PAS 2 - Open Qualify WEEK #1", "short_name": "PAS2W1",
  "shard": "steam", "tier_weight": 0.5 }

# 3. Criar 4 stages (uma por dia + final)
POST /admin/stages/ × 4

# 4. Bulk import de roster
python scripts/pubg/bulk_import_roster.py --stage-id X --shard steam --file roster.txt

# 5. Validar
python scripts/pubg/validate_event.py --stage-id X --tournament-id am-pas2-week1

# 6. Abrir lineup
POST /admin/stages/X/force-status { "status": "open" }
```
