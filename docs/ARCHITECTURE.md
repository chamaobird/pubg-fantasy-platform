# ARCHITECTURE — XAMA Fantasy
> Modelo de dados, regras de negócio e decisões de design.
> Atualizar quando houver mudanças estruturais no schema ou nas regras.

## Hierarquia de entidades

```
CHAMPIONSHIP
  └─ STAGE (fase do campeonato)
       ├─ ROSTER (jogadores disponíveis para fantasy nesta fase)
       │    └─ ROSTER_PRICE_HISTORY
       └─ STAGE_DAY
            ├─ MATCH
            │    └─ MATCH_STAT (por PERSON)
            └─ LINEUP (por usuário)
                 └─ LINEUP_PLAYER

PERSON ──── PLAYER_ACCOUNT (multi-shard, multi-alias)
PERSON ──── PERSON_STAGE_STAT (acumulado por fase)
USER ─────── USER_STAGE_STAT (acumulado por stage: total_points, survival_secs, captain_pts)
USER ─────── USER_DAY_STAT   (por stage_day: points, survival_secs, captain_pts)
```

## Entidades em detalhe

### STAGE
- `shard`: steam (scrims/PAS) ou pc-tournament (PGS e oficiais)
- `carries_stats_from`: lista de stage_ids cujas stats alimentam o pricing
- `lineup_status`: closed | open | locked (pode ser forçado manualmente)
- `roster_source_stage_id`: de onde copiar o roster base
- `lineup_size`: número de titulares (padrão: 4)
- `price_min / price_max`: limites da régua (padrão: 12 / 35)
- `pricing_distribution`: modelo de distribuição (padrão: linear)
- `pricing_newcomer_cost`: custo fixo para jogadores sem histórico (padrão: 15)

### PERSON + PLAYER_ACCOUNT
- PERSON: entidade permanente que representa o jogador real. Nunca deletada.
- PLAYER_ACCOUNT: identidades conhecidas (suporta múltiplas contas e aliases)
- `active_until: null` = conta ainda ativa

### ROSTER
- Jogador disponível para fantasy em uma STAGE específica
- `fantasy_cost`: calculado automaticamente pelo pricing service
- `cost_override`: valor manual (não bloqueia cálculos futuros)
- `newcomer_to_tier`: true = sem histórico nesse nível → recebe custo fixo

### LINEUP
- 4 titulares + 1 reserva por STAGE_DAY por usuário
- Budget: 100 tokens por lineup
- Regra do reserva: `custo_reserva <= custo do titular mais barato`
- `is_auto_replicated`: replicado automaticamente do dia anterior
- `is_valid`: false se algum jogador foi removido após submissão

## Regras de negócio

### Resolução de identidade
1. Busca PLAYER_ACCOUNT pelo account_id da partida
2. Se não encontrar, busca por alias (nome Steam)
3. Se não encontrar, loga warning e skipa (nunca quebra o import)

### Pricing (linear)
1. Para cada Roster ativo, busca últimas N MatchStats da Person (qualquer championship, ordenado por created_at DESC)
2. Calcula `pts_per_match` = média simples das últimas N partidas
3. Monta régua com jogadores que têm histórico e não são newcomers:
   - melhor ppm → `price_max` (35)
   - pior ppm → `price_min` (12)
   - demais → interpolação linear
4. Newcomers (`newcomer_to_tier=true`) ou sem nenhuma MatchStat → `pricing_newcomer_cost` (15)
5. Se todo elenco é newcomer → todos recebem `pricing_newcomer_cost`
6. `cost_override` trava o preço sem afetar cálculos futuros
7. Cada alteração grava registro em ROSTER_PRICE_HISTORY
8. Recalcula a cada 30 min via APScheduler (só stages com `lineup_status != locked`)

### Scoring XAMA
```
xama_points = kills×10 + assists×1 + knocks×1 + damage×0.03
            - 15 (se morte precoce)
            + late_game_bonus (se sobreviveu até fase final)
```
Capitão recebe `×captain_multiplier` (padrão 1.30).

### Tiebreaker (leaderboard)
Ordem: `total_points DESC → survival_secs DESC → captain_pts DESC`
- `survival_secs`: soma dos segundos vivos de todos os titulares no período
- `captain_pts`: soma dos pontos do capitão no período
- Campos presentes em `UserDayStat` e `UserStageStat`

### Leaderboard por campeonato
`GET /championships/{id}/leaderboard` — soma `UserStageStat.total_points` de todas as stages do campeonato.
`GET /championships/{id}/leaderboard/combined?stage_day_ids=1,2,3` — soma `UserDayStat.points` para dias arbitrários (validados como pertencentes ao campeonato).

### Controle de lineup (APScheduler — 1min)
1. Se `agora >= lineup_open_at` e status=closed → seta open
2. Se `agora >= lineup_close_at` e status=open → seta locked
3. Admin pode forçar qualquer transição manualmente
4. Antes do lock: verifica usuários sem lineup e replica o dia anterior se válido

### Shard por stage
- `steam`: scrims, PAS, Live Server
- `pc-tournament`: torneios oficiais PGS e similares
- Import sempre usa o shard da STAGE, nunca configuração global

## Decisões de design

- **Identidade via PERSON permanente**: jogador real nunca é deletado, só desativado. Resolve aliasing e troca de contas entre torneios.
- **Pricing por stage, não por jogador global**: permite réguas diferentes por nível de competição.
- **Stats vinculadas a PERSON, não a PLAYER_ACCOUNT**: permite agregar performance independente de mudanças de conta.
- **Lineup por STAGE_DAY, não por torneio**: permite montagem diária com replicação automática.
- **APScheduler dentro do FastAPI**: evita infra extra no Render free tier.
