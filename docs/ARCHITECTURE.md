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
- pricing_weight: peso para calculos de pricing de campeonatos futuros
- pricing_cap_newcomer: teto de preco para jogadores sem historico no nivel

### STAGE
Fase dentro de um championship (ex: Week 1 Scrims, Winners Stage).
- Cada stage tem seu proprio shard (steam ou pc-tournament)
- carries_stats_from: lista de stage_ids cujas stats alimentam o pricing desta fase
- lineup_open_at / lineup_close_at: controle automatico via APScheduler
- lineup_status: closed | open | locked (pode ser forcado manualmente em emergencia)
- roster_source_stage_id: stage de onde copiar o roster base

### STAGE_DAY
Dia de competicao dentro de uma stage.
- Usuario monta UM lineup por dia
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
- fantasy_cost: calculado automaticamente
- cost_override: valor manual (nao quebra calculos futuros)
- newcomer_to_tier: true = sem historico nesse nivel, cap = championship.pricing_cap_newcomer

### ROSTER_PRICE_HISTORY
Historico de precos por stage/day para auditoria e visualizacao de evolucao.

### MATCH_STAT
Performance de uma PERSON em um MATCH.
- Vinculada a PERSON (nao a um player de torneio especifico)
- account_id_used: rastreabilidade de qual conta foi usada

### PERSON_STAGE_STAT
Acumulado de Pontos XAMA por jogador por fase.
- pts_per_match: metrica principal de performance

### LINEUP
Time montado por usuario para um STAGE_DAY.
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

### Pricing
1. Busca MATCH_STAT das stages configuradas em carries_stats_from
2. Aplica pricing_weight do championship de origem de cada stat
3. Jogadores com newcomer_to_tier=true tem teto pricing_cap_newcomer
4. cost_override trava o preco manualmente sem afetar calculos futuros
5. Recalcula automaticamente apos cada dia de competicao

### Controle de lineup
1. APScheduler verifica a cada minuto
2. Se agora >= lineup_open_at e status=closed -> seta open
3. Se agora >= lineup_close_at e status=open -> seta locked
4. Admin pode forcar qualquer transicao manualmente
5. Antes do lock: verifica usuarios sem lineup e replica o dia anterior se valido

### Shard por stage
- Cada STAGE tem seu proprio shard configurado
- Import sempre usa o shard da STAGE, nunca configuracao global
- steam: scrims, PAS, Live Server
- pc-tournament: torneios oficiais PGS e similares

## Estrutura de Pastas
app/
models/         definicoes de tabelas SQLAlchemy
schemas/        Pydantic (entrada/saida de API)
services/
identity.py   resolucao PERSON + PLAYER_ACCOUNT
pricing.py    calculo de precos com pesos
lineup.py     montagem, validacao, replicacao
import.py     import de matches
scoring.py    calculo de pontos XAMA
routers/
admin/        endpoints administrativos
championships.py
stages.py
lineups.py
players.py
jobs/
lineup_control.py   APScheduler: abertura/fechamento automatico
pricing.py          APScheduler: recalculo de precos
