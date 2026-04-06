# XAMA Fantasy — Architecture

## Stack
- Backend: FastAPI + Python 3.11
- Database: PostgreSQL (Render, $6.30/mo)
- Deploy: Render (backend + db)
- Frontend: React + Vite
- Scheduler: APScheduler (dentro do FastAPI)

## Modelo de Dados

### CHAMPIONSHIP
Representa uma competição completa (ex: PAS1 2026, PGS 2026 Circuit 2).

### STAGE
Fase dentro de um championship (ex: Week 1 Scrims, Winners Stage).
- Cada stage tem seu proprio shard (steam ou pc-tournament)
- carries_stats_from: lista de stage_ids cujas stats alimentam o pricing desta fase
- lineup_open_at / lineup_close_at: controle automatico via APScheduler
- lineup_status: closed | open | locked (pode ser forcado manualmente em emergencia)
- roster_source_stage_id: stage de onde copiar o roster base
- lineup_size: numero de titulares por lineup (padrao: 4)
- price_min / price_max: limites da regua de custo (padrao: 12 / 35)
- pricing_distribution: modelo de distribuicao de custos (padrao: linear)
- pricing_n_matches: quantas partidas recentes usar para calcular o custo (padrao: 20)
- pricing_newcomer_cost: custo fixo para jogadores sem historico (padrao: 15)

### STAGE_DAY
Dia de competicao dentro de uma stage.
- Usuario monta UM lineup por dia (4 titulares + 1 reserva)
- lineup_close_at = horario da primeira partida do dia
- Se usuario nao montar lineup, o dia anterior e replicado (se valido)

### MATCH
Partida individual vinculada a um STAGE_DAY.
- pubg_match_id: UUID da PUBG API
- shard herdado da STAGE

### PERSON
Entidade permanente que representa o jogador real.
- Nunca deletada, apenas desativada
- Ponto central de resolucao de identidade

### PLAYER_ACCOUNT
Identidades conhecidas de uma PERSON.
- Suporta multiplas contas (steam + pc-tournament)
- Suporta historico de aliases (nome mudou, time mudou)
- active_until: null = ainda ativo

### ROSTER
Jogador disponivel para fantasy em uma STAGE especifica.
- fantasy_cost: calculado automaticamente pelo pricing service
- cost_override: valor manual para exibicao (nao bloqueia calculos futuros)
- newcomer_to_tier: true = sem historico nesse nivel, recebe pricing_newcomer_cost fixo

### ROSTER_PRICE_HISTORY
Historico de precos por roster para auditoria e visualizacao de evolucao.
- source: auto (scheduler) | override (manual)
- stage_day_id: dia associado ao recalculo (opcional)

### MATCH_STAT
Performance de uma PERSON em um MATCH.
- Vinculada a PERSON (nao a um player de torneio especifico)
- account_id_used: rastreabilidade de qual conta foi usada
- xama_points: pontos calculados pelo scoring service

### PERSON_STAGE_STAT
Acumulado de Pontos XAMA por jogador por fase.
- pts_per_match: metrica de referencia (nao usada no pricing atual)

### LINEUP
Time montado por usuario para um STAGE_DAY.
- 4 titulares + 1 reserva
- Reserva deve custar no maximo o mesmo que o titular mais barato
- Budget total: 100 tokens por lineup
- is_auto_replicated: true se foi replicado automaticamente
- is_valid: false se algum jogador foi removido apos submissao

### LINEUP_PLAYER
Jogadores de um lineup com custo no momento do lock e pontos ganhos.

### USER_STAGE_STAT / USER_DAY_STAT
Acumulado de pontos do usuario por fase e por dia para visualizacao de evolucao.

## Regras de Negocio

### Resolucao de identidade
1. Busca PLAYER_ACCOUNT pelo account_id da partida
2. Se nao encontrar, busca por alias (nome Steam)
3. Se nao encontrar, loga warning e skipa (nunca quebra o import)

### Pricing (Fase 5)
1. Para cada Roster ativo da stage, busca as ultimas pricing_n_matches MatchStat
   da Person (qualquer championship, ordenado por created_at DESC)
2. Calcula pts_per_match_efetivo = media simples das ultimas N partidas
3. Monta a regua somente com jogadores que tem historico e nao sao newcomers:
   - melhor ppm -> price_max (padrao 35)
   - pior ppm   -> price_min (padrao 12)
   - demais     -> interpolacao linear entre os dois extremos
4. Newcomers (newcomer_to_tier=true) ou jogadores sem nenhuma MatchStat
   recebem pricing_newcomer_cost fixo (padrao 15), com possibilidade de
   cost_override manual por jogador
5. Se todo o elenco e de newcomers ou ninguem tem historico, todos recebem
   pricing_newcomer_cost (comportamento esperado na primeira stage de um campeonato)
6. cost_override trava o preco manualmente sem afetar calculos futuros
7. Cada alteracao de preco grava um registro em ROSTER_PRICE_HISTORY
8. Recalcula automaticamente a cada 30 minutos via APScheduler
   (apenas stages com lineup_status != locked)

### Controle de lineup
1. APScheduler verifica a cada minuto
2. Se agora >= lineup_open_at e status=closed -> seta open
3. Se agora >= lineup_close_at e status=open -> seta locked
4. Admin pode forcar qualquer transicao manualmente
5. Antes do lock: verifica usuarios sem lineup e replica o dia anterior se valido
6. Regra do reserva: custo_reserva <= custo do titular mais barato (validacao no lineup)

### Shard por stage
- Cada STAGE tem seu proprio shard configurado
- Import sempre usa o shard da STAGE, nunca configuracao global
- steam: scrims, PAS, Live Server
- pc-tournament: torneios oficiais PGS e similares

## Estrutura de Pastas
app/
  models/
    championship.py
    stage.py
    stage_day.py
    match.py
    match_stat.py
    person.py
    player_account.py
    roster.py            (inclui RosterPriceHistory)
    person_stage_stat.py
    lineup.py            (inclui LineupPlayer)
    user.py
  schemas/
    championship.py
    stage.py
    roster.py
    ...
  services/
    identity.py          resolucao PERSON + PLAYER_ACCOUNT
    pricing.py           calculo de precos com regua linear (Fase 5)
    lineup.py            montagem, validacao, replicacao
    scoring.py           calculo de pontos XAMA
    scheduler.py         APScheduler: lineup_control (1min) + pricing (30min)
  routers/
    auth.py
    admin/
      __init__.py        agrega todos os routers admin
      championships.py
      stages.py
      stage_days.py
      persons.py
      roster.py          CRUD de roster
      rosters.py         endpoints de pricing (Fase 5)
    import_.py
    lineups.py
  jobs/
    lineup_control.py    APScheduler: abertura/fechamento automatico
    pricing.py           APScheduler: recalculo de precos (Fase 5)
  database.py
  main.py

alembic/
  versions/
    0001_initial_schema.py
    0002_users.py
    0003_pricing_fields.py   (Fase 5: campos de pricing na Stage, remocao de campos legados)
    20260406_0129_4bfb4ef75223_fase3_match_stats.py