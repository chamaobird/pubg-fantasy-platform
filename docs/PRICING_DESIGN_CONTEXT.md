# XAMA Fantasy — Contexto de Design: Precificação Dinâmica de Jogadores
> Documento gerado em 02/04/2026 para debate de design e implementação no Claude Pro.
> Objetivo: discutir e implementar um sistema de precificação que evolua a cada nova fase/torneio com base na performance dos jogadores.

---

## 1. O que é este projeto (contexto mínimo)

**XAMA Fantasy** é uma plataforma de fantasy PUBG Esports. Antes de cada dia de competição, os usuários montam uma lineup de 4 jogadores (+ capitão e reserva) respeitando um **orçamento fixo** (`budget_limit`, padrão: 100 créditos). Cada jogador tem um custo (`fantasy_cost`). O orçamento cria a tensão central do jogo: você não pode escalar só os melhores — é preciso escolher.

**Stack:** FastAPI + SQLAlchemy (sync) + PostgreSQL no backend. React + Vite no frontend.

---

## 2. Estado atual da precificação (diagnóstico completo)

### 2.1 O problema: existem 3 fórmulas que não conversam

Atualmente o projeto tem três implementações de cálculo de preço **inconsistentes entre si**:

#### Fórmula A — `app/services/pubg_api.py` → `calculate_fantasy_cost()`
```python
placement_score = max(0, (28 - avg_placement) * 0.5)
fantasy_cost    = (avg_kills * 2.0) + (avg_damage / 100.0) + placement_score
# Mínimo: 5.0 | Sem teto definido
```
**Usada por:** `POST /admin/recalculate-costs` (endpoint ativo em produção)

#### Fórmula B — `app/core/pricing.py` → `calculate_player_price()`
```python
# Pesos configuráveis:
KILL_WEIGHT = 2.5
DAMAGE_WEIGHT = 1.8        # aplicado sobre (damage / 100)
SURVIVAL_WEIGHT = 1.2      # por minuto sobrevivido
PLACEMENT_WEIGHT = 3.0     # sobre placement_score 0-10

base_score  = kill_component + damage_component + survival_component + placement_component
raw_price   = 5.0 + base_score * 0.5
final_price = clamp(raw_price, 5.0, 50.0)
```
**Usada por:** nenhum endpoint ativo ainda (módulo criado mas não conectado)
**Vantagem:** retorna `PriceComponents` completo para transparência (cada parcela calculada)

#### Fórmula C — `frontend/src/components/PriceBreakdown.jsx`
```js
// Constantes no frontend (desacopladas do backend):
KILL_WEIGHT = 2.0, DAMAGE_WEIGHT = 0.05, PLACEMENT_WEIGHT = 3.0, SURVIVAL_WEIGHT = 0.1
BASE_SCORE  = 10
price = Math.round(totalScore / 2)   // divisor fixo = 2
```
**Usada por:** componente de UI "Price breakdown" exibido ao usuário

> ⚠️ **Conclusão:** o preço exibido ao usuário no frontend é calculado com fórmula diferente do backend. `recalculate-costs` usa a Fórmula A. A Fórmula B (mais robusta) nunca foi ativada. É preciso unificar antes de implementar qualquer sistema dinâmico.

---

### 2.2 Estrutura de dados atual (Player)

```python
class Player(Base):
    fantasy_cost: float       # o custo exibido — usado na validação do orçamento
    avg_kills: float          # médias genéricas (população ampla)
    avg_damage: float
    avg_placement: float
    matches_played: int

    # Campos de pricing avançado (existem no DB, mas não populados automaticamente):
    avg_kills_50: float       # média das últimas 50 partidas
    avg_damage_50: float
    avg_placement_50: float
    avg_kills_10: float       # média das últimas 10 partidas
    computed_price: float     # preço calculado pela Fórmula B (não confirmado se usado)
    price_updated_at: datetime
```

### 2.3 Histórico de preços (tabela existe, mas subutilizada)

```python
class PlayerPriceHistory(Base):
    player_id:               int
    old_price:               float
    new_price:               float
    changed_at:              datetime
    reason:                  str        # ex: "recalc after T18 Final"
    formula_components_json: str        # JSON com cada parcela (kills_component, damage_component...)
```

A tabela `player_price_history` **existe no banco** e tem estrutura ideal para auditoria. Ela não é populada pelo endpoint atual (`recalculate-costs`), que apenas sobrescreve `fantasy_cost` sem gravar histórico.

---

### 2.4 Orçamento e distribuição atual

- `Tournament.budget_limit = 100` (padrão)
- Lineup: 4 titulares + 1 capitão (que é um dos 4) + 1 reserva = 5 slots de custo
- Preços atuais: todos os jogadores do T19 (Grand Final) têm `fantasy_cost` definido manualmente no momento do cadastro (geralmente 10.0 por padrão para jogadores copiados entre fases)
- Não existe repricing automático entre fases

---

### 2.5 Endpoint de repricing existente

```
POST /admin/recalculate-costs
```
- Recalcula `fantasy_cost` de **todos os jogadores no banco** usando a Fórmula A
- Baseia-se em `player.avg_kills`, `player.avg_damage`, `player.avg_placement` (campos do model)
- Esses campos são populados? **Incerto** — dependem de um processo de sync não documentado no fluxo atual

---

## 3. Como os stats são calculados (scoring de fantasy points)

É importante diferenciar **fantasy points** (pontuação das lineups) de **fantasy cost** (custo do jogador):

### Fórmula de fantasy_points por partida (lineup_scoring.py — em uso)
```
kill_pts    = kills × 15.0
dmg_pts     = (damage / 100) × 5.0
surv_pts    = minutos_vivo × 1.0
penalty     = -5.0 se morreu antes de 2 minutos
player_pts  = (kill_pts + dmg_pts + surv_pts + penalty) × placement_multiplier

placement_multiplier (configurável via ScoringRule):
  ex: {"1": 1.5, "2": 1.3, "3-5": 1.1, "6-10": 1.0, "11+": 0.8}

captain earns 1.25× (bônus de 0.25×)
reserva substitui titular ausente
```

Esses dados ficam em `match_player_stats`:
- `kills, assists, damage_dealt, placement, survival_secs`
- `fantasy_points, base_points, late_game_bonus, penalty_count, wins_count`

> **Ponto-chave:** o `fantasy_points` acumulado de um jogador numa fase é a matéria-prima natural para a precificação na fase seguinte.

---

## 4. Modelo de torneios e fases (contexto de quando repricing é relevante)

```
Championship (campeonato)
  └─ phase_order 1: Winners Stage (T16)
  └─ phase_order 2: Survival Stage (T17)
  └─ phase_order 3: Final Stage    (T18) ← fase encerrada

Championship 4: Series Final
  └─ phase_order 1: Survival Stage (T20) ← encerrada (5 partidas)
  └─ phase_order 2: Grand Final    (T19) ← ABERTA agora (Dia 1)
```

Cada fase tem seus próprios `players` (linked por `tournament_id`). Jogadores são copiados entre fases via `copy-players-to`, mas os preços são copiados junto (não recalculados).

### Fluxo atual entre fases:
1. Fase X termina → admin copia jogadores para Fase X+1 via `copy-players-to`
2. Jogadores chegam na nova fase **com o mesmo `fantasy_cost` da fase anterior** (ou com o default 10.0 se forem novos)
3. Nenhum repricing automático acontece

---

## 5. O que precisa ser debatido e implementado

### 5.1 Questões de design abertas

**A) Qual é a janela de dados para o repricing?**
- Stats da fase imediatamente anterior?
- Stats do campeonato inteiro (todas as fases)?
- Últimas N partidas independente de fase?
- Combinação ponderada (fase anterior tem mais peso)?

**B) Como tratar jogadores sem histórico na plataforma?**
- Substitutos ou estreantes em novas fases não têm stats anteriores
- Opção 1: preço-base fixo (ex: 10.0) para jogadores sem histórico
- Opção 2: preço-base médio do time
- Opção 3: admin define manualmente os sem-histórico

**C) Repricing deve ser automático ou admin-trigger?**
- Automático ao encerrar fase (ao marcar tournament.status = "finished")?
- Trigger manual via endpoint (`POST /admin/tournaments/{id}/recalculate-prices`)?
- Combinação: cálculo automático com confirmação admin antes de aplicar?

**D) Escopo do repricing: global ou por torneio?**
- Cada `player` no DB tem um `tournament_id` — o mesmo jogador físico aparece como linhas diferentes por fase
- Opção A (recomendada): recalcular `fantasy_cost` dos players da **fase seguinte** com base nos stats da fase anterior
- Opção B: atualizar o player global (sem tournament_id) — mas isso sobrescreveria histórico de outras fases

**E) Como controlar a distribuição de preços?**
- Com budget de 100 e 5 slots, a média ideal por jogador seria ~20 créditos
- Uma distribuição saudável poderia ser: min=8, max=35, mediana~18
- A Fórmula B já tem min=5 e max=50 configuráveis — são bons limites?
- Deve haver normalização para garantir que a distribuição não colapse (todos ~10 ou todos ~50)?

**F) O que fazer com o `PlayerPriceHistory`?**
- Já existe a tabela — deve ser populada toda vez que `fantasy_cost` muda?
- O campo `reason` pode registrar a fase de origem: `"recalc_from_T18_Final"`
- O campo `formula_components_json` pode guardar a transparência (kills_component=X, etc.)
- Isso permitiria exibir ao usuário: "Por que este jogador custa 25 créditos?"

---

### 5.2 O que precisa ser implementado (checklist técnico)

#### Backend

- [ ] **Unificar fórmulas de pricing** — escolher uma e deletar/deprecar as outras duas
- [ ] **Novo endpoint:** `GET /admin/tournaments/{id}/pricing-preview` — calcula os preços sugeridos para os players do torneio com base nos stats de outra fase, **sem aplicar**. Retorna tabela: player, current_price, suggested_price, delta, componentes
- [ ] **Novo endpoint:** `POST /admin/tournaments/{id}/apply-pricing` — aplica os preços calculados pelo preview, grava `PlayerPriceHistory` com `reason` e `formula_components_json`
- [ ] **Parâmetros do endpoint:** `source_tournament_id` (de onde vêm os stats) e opcionalmente `window` (quantas partidas usar)
- [ ] **Migração:** verificar se `avg_kills`, `avg_damage`, `avg_placement` estão sendo populados no import de matches (ou criar lógica para calculá-los sob demanda a partir de `match_player_stats`)
- [ ] **Normalização opcional:** flag `normalize=true` que ajusta os preços para manter soma dentro de um range esperado

#### Frontend

- [ ] **Alinhar `PriceBreakdown.jsx`** com a fórmula escolhida no backend (atualmente divergente)
- [ ] **Exibição de histórico de preço** no card do jogador (opcional/nice-to-have): mostrar se subiu ou desceu vs. fase anterior

---

## 6. Dados disponíveis para repricing (o que existe no banco)

Para calcular preços da próxima fase, temos disponível em `match_player_stats`:

| Campo | Descrição |
|-------|-----------|
| `kills` | Abates por partida |
| `damage_dealt` | Dano causado por partida |
| `placement` | Colocação final por partida |
| `survival_secs` | Segundos vivos por partida |
| `assists` | Assistências por partida |
| `fantasy_points` | Pontuação calculada da partida |
| `wins_count` | Vitórias acumuladas |
| `penalty_count` | Mortes precoces |

Esses dados permitem calcular, via SQL ou Python, as médias por jogador em qualquer janela de tempo ou fase.

---

## 7. Query SQL de referência para calcular médias por fase

```sql
-- Médias de um jogador para todos os matches de um torneio específico
SELECT
  p.id,
  p.name,
  p.fantasy_cost as current_price,
  COUNT(mps.id) as matches_played,
  AVG(mps.kills) as avg_kills,
  AVG(mps.damage_dealt) as avg_damage,
  AVG(mps.placement) as avg_placement,
  AVG(mps.survival_secs) / 60.0 as avg_survival_min,
  SUM(mps.fantasy_points) as total_fantasy_pts,
  AVG(mps.fantasy_points) as avg_fantasy_pts
FROM players p
LEFT JOIN match_player_stats mps ON mps.player_id = p.id
LEFT JOIN matches m ON m.id = mps.match_id
WHERE p.tournament_id = {SOURCE_TOURNAMENT_ID}  -- fase de origem
  AND m.tournament_id = {SOURCE_TOURNAMENT_ID}
GROUP BY p.id, p.name, p.fantasy_cost
ORDER BY avg_fantasy_pts DESC;
```

---

## 8. Fórmula B em detalhe (candidata principal — já existente em `core/pricing.py`)

```python
# Inputs (calculados a partir das médias do período)
avg_kills             → média de abates
avg_damage            → média de dano
avg_survival_minutes  → média de minutos sobrevivido
avg_placement         → média de colocação

# Pesos (ajustáveis)
KILL_WEIGHT     = 2.5
DAMAGE_WEIGHT   = 1.8   # sobre (damage / 100)
SURVIVAL_WEIGHT = 1.2   # por minuto
PLACEMENT_WEIGHT = 3.0  # sobre score 0-10 (invertido: 1º lugar = 10, último = 0)

# Cálculo
placement_score = (total_teams - avg_placement) / (total_teams - 1) * 10.0
base_score = (avg_kills × 2.5) + (avg_damage/100 × 1.8) + (avg_survival_min × 1.2) + (placement_score × 3.0)
raw_price  = 5.0 + base_score × 0.5
final_price = clamp(raw_price, 5.0, 50.0)
```

### Exemplos com valores reais de PUBG esports (PGS nível):
| Perfil | Kills | Dmg | Placement | Surv | Preço calculado |
|--------|-------|-----|-----------|------|-----------------|
| Star fragger (ex: Paraboy) | 4.5k | 550 | 5.2 | 22 min | ~30 cr |
| IGL sólido | 2.0k | 350 | 4.0 | 24 min | ~23 cr |
| Jogador médio | 1.5k | 250 | 8.5 | 18 min | ~16 cr |
| Fraco / eliminado cedo | 0.8k | 150 | 12.0 | 12 min | ~10 cr |

> Esses valores são estimativas para calibrar a discussão — os reais do banco podem diferir.

---

## 9. Arquivos relevantes para implementação

```
app/
  core/pricing.py           ← Fórmula B (candidata principal) — bem documentada
  services/pubg_api.py      ← Fórmula A (calculate_fantasy_cost) — usada em prod atualmente
  models/player.py          ← Player + PlayerPriceHistory
  models/match.py           ← MatchPlayerStat (fonte de dados)
  models/tournament.py      ← Tournament + ScoringRule
  routers/admin.py          ← recalculate-costs endpoint (usa Fórmula A)
  routers/admin_players.py  ← bulk-upsert, resolution-check

frontend/src/components/
  PriceBreakdown.jsx        ← UI de breakdown (Fórmula C — divergente!)
  LineupBuilder.jsx         ← validação de orçamento no frontend

alembic/versions/           ← migrations para novos campos se necessário
```

---

## 10. Como usar este documento no Claude Pro

1. Faça upload deste arquivo em um novo chat
2. Informe a `BASE_URL` da API em produção (ex: `https://xama-api.onrender.com`)
3. Comece com: **"Quero debater o design do sistema de repricing entre fases e depois implementar"**
4. Claude terá contexto completo sobre:
   - As 3 fórmulas existentes e suas inconsistências
   - Os dados disponíveis no banco para repricing
   - Os endpoints e models relevantes
   - As questões de design em aberto (seção 5.1)
   - O checklist de implementação (seção 5.2)
5. Após alinhar o design, Claude pode gerar o código dos novos endpoints, migrations e ajustes de frontend

**Sugestão de ordem de implementação:**
1. Decidir a fórmula (unificar)
2. Implementar `pricing-preview` endpoint (sem persistência — seguro para testar)
3. Testar o preview com dados reais do T18/T20
4. Implementar `apply-pricing` (com persistência em `PlayerPriceHistory`)
5. Corrigir `PriceBreakdown.jsx` para refletir a fórmula real
