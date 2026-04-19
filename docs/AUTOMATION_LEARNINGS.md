# Learnings — Automação de Championships
> Documento de trabalho. Iniciado em 17/04/2026 durante PEC Spring Playoffs 1 + PAS Playoffs 1.
> Atualizado em 17/04/2026 após encerramento do PAS Playoffs Dia 1.
> **Status:** em progresso — será finalizado ao término das playoffs.

---

## Contexto

Primeira vez que operamos dois championships simultâneos com shards diferentes:
- **PAS Playoffs 1** — shard `pc-tournament`, torneio esports, stages 15/16/17 (**corrigido**: era `steam` no setup inicial — ver bug log)
- **PEC Spring Playoffs 1** — shard `pc-tournament`, torneio esports, stages 21/22/23

O ciclo completo (setup → população → import → pricing → abertura → encerramento) foi executado manualmente e revelou padrões e fricções que guiarão a automação futura.

---

## 1. Ciclo de vida de uma Stage

```
PREVIEW → OPEN → LOCKED → (aparece em Resultados)
```

### Estados e o que significam operacionalmente

| Status | Visível para usuário | Lineup | Import de matches |
|---|---|---|---|
| `preview` | Sim (card menor, recuado) | Não | Não |
| `open` | Sim (card grande, destaque) | Sim | Não |
| `locked` | Sim (Resultados ou EM JOGO) | Não | Sim |
| `closed` | Não (seção "Aguardando") | Não | Não |

### Regras de transição que descobrimos

- `locked` com stages `preview` irmãs e **sem** stage `open` → exibido como **EM JOGO**
- `locked` com stage `open` no mesmo championship → exibido como **ENCERRADO** (vai para Resultados)
- Abertura de D2 torna D1 "Encerrado" automaticamente no frontend — mas só depois que corrigimos o bug

---

## 2. Fases operacionais e ações necessárias

### Fase A — Setup do Championship (pré-evento)

**O que fazer:**
1. Criar `championship` com: `name`, `short_name`, `shard`, `tier_weight`
2. Criar N `stage`s com: `name`, `short_name`, `price_min`, `price_max`, `pricing_newcomer_cost`, `pricing_distribution`, `lineup_status=preview`
3. Criar 1 `stage_day` por stage

**Crítico:**
- `shard` precisa ser definido corretamente antes de qualquer import — errar exige UPDATE em todos os registros
- `pricing_distribution` deve ser salvo sem aspas extras (`linear`, não `'linear'`) — bug encontrado que silencia o algoritmo
- `tier_weight` do championship afeta o peso das partidas no pricing futuro

**Fonte de verdade para `shard`:**
- ~~Torneios regionais (PAS, PAS Americas, PAS EMEA): `steam`~~ **ERRADO** — ver abaixo
- **REGRA CORRETA:** qualquer torneio acessível via `GET /tournaments/{id}` na PUBG API usa `pc-tournament`
- Torneios `steam` são exclusivamente partidas públicas ranqueadas/casual
- Torneios esports oficiais **e regionais** (PGS, PEC, PGC, PAS, FACEIT, etc.): `pc-tournament`
- **Sempre confirmar antes de criar o championship:**
  ```
  GET /tournaments/{tournament_id}
  → data.relationships.matches.data[0].id  (pegar um match_id)
  GET /pc-tournament/matches/{match_id}    (confirmar que retorna 200)
  GET /steam/matches/{match_id}            (deve retornar 404 se for pc-tournament)
  ```
- Se o endpoint `/tournaments/{id}` retorna os matches → o shard é `pc-tournament`, sem exceção

---

### Fase B — População do Roster (pré-evento ou até D1)

**O que fazer:**
1. Para cada time e jogador: criar `Person` + `PlayerAccount` + `Roster`
2. `PlayerAccount.alias` = nome exato do jogador no jogo (usado para resolução de identidade no import)
3. `PlayerAccount.account_id` = `PENDING_<nome>` até a primeira partida
4. `Roster.fantasy_cost` = `newcomer_cost` da stage (será sobrescrito pelo pricing)

**Crítico:**
- O **identity service** (`app/services/identity.py`) só carrega contas de persons que já estão no roster da stage — jogador com account válido mas fora do roster = não resolvido no import
- Tags in-game diferem das tags "oficiais": NMS→NMSS, TM→TWIS, NSLK→SLCK, ACEND→ACE, CW→WORK, EXHWL→HOWL (PEC D1). A PUBG API é a fonte de verdade, não listas externas
- Times dos dias seguintes (D2, D3) só têm jogadores conhecidos depois que D1 acontece — o processo é naturalmente bloqueante para N-players

**Padrão descoberto:**
- Criar roster com `PENDING_<nome>` antes do torneio funciona bem
- Após a primeira partida: rodar reconciliação para substituir `PENDING_` pelo `account_id` real

**Aliases e nomes in-game divergem frequentemente:**

Times que rebranding/renomeação entre campeonatos é comum. Exemplos do PAS D1:
| Nome no roster | Nome real in-game (PUBG API) | Ação necessária |
|---|---|---|
| LB_andriu- | LxB_andreww | Novo account_id |
| LB_AleeRv | LxB_arv10 | Novo account_id |
| NA_ega | NA_Poonage | Novo account_id |
| NA_Balefrost | NA_xxxxxxxxxppppp | Novo account_id |
| X10_kl4uZeera | X10_Sukehiro-- | Novo account_id |
| DUEL_Iroh | (não jogou — substituído por DUEL_Sharpshot4K) | Novo person + account |

**Times sul-americanos:** costumam ter accounts Steam no DB (histórico PGS). Para tournaments `pc-tournament`, precisam de account_id separado com `shard='pc-tournament'`. O import resolve automaticamente quem já tem account de torneio cadastrado — os sem account viram `skip=1` e precisam de reconciliação manual.

**Fluxo de reconciliação após skip:**
1. Identificar `account_id` dos não-resolvidos via PUBG API (buscar pelo participant do torneio)
2. `INSERT INTO player_account (person_id, account_id, shard, alias)` para cada um
3. Rodar `reprocess_match` com `force_reprocess=True` para reprocessar os matches com skip

---

### Fase C — Assets de Frontend (pré-evento)

**O que fazer:**
1. Logos nomeados `<tag_lowercase>.png` (ou `.jpeg`) na pasta `/logos/<TOURNAMENT>/`
2. Adicionar times ao `TEAM_NAME_TO_TAG` em `frontend/src/utils/teamUtils.js`
3. Commitar e fazer push **antes** de abrir o lineup

**Crítico:**
- Logos não commitadas = deploy sem logo (usuários veem iniciais)
- `TEAM_NAME_TO_TAG` ausente = tag exibida como nome completo ("ACEND Club") = logo não encontrada
- `teamUtils.js` é a **fonte única de verdade** para tags — `LineupBuilder` e `PlayerStatsPage` importam dali
- `TeamLogo` procura em ordem: pasta primária (pelo shortName da stage) → PAS → PGS → PEC

**Nomes de arquivo vs tags:**
- `bpx.png` era o logo da Vuptrox (tag VPX) — arquivo nomeado errado, corrigido manualmente
- `tmo.png` existia como legado do Twisted Minds — tag atual é TWIS, logo atual é `twis.png`

---

### Fase D — Import de Partidas (durante/após cada dia)

**Comando:**
```bash
python scripts/pubg/import_pec_day.py --stage-id <X> --stage-day-id <Y>
# Polling durante o dia:
python scripts/pubg/import_pec_day.py --stage-id <X> --stage-day-id <Y> --watch 5
```

**Mapeamento PEC (referência):**
| Dia | stage_id | stage_day_id | tournament_id |
|---|---|---|---|
| D1 (17/04) | 21 | 22 | eu-pecs26 |
| D2 (18/04) | 22 | 23 | eu-pecs26 |
| D3 (19/04) | 23 | 24 | eu-pecs26 |

**Mapeamento PAS Playoffs 1 (referência):**
| Dia | stage_id | stage_day_id | tournament_id | Horário início |
|---|---|---|---|---|
| D1 (17/04) | 15 | 16 | am-pas126 | ~23:00 UTC (20h BRT) |
| D2 (18/04) | 16 | 17 | am-pas126 | 23:00 UTC (20h BRT) |
| D3 (19/04) | 17 | 18 | am-pas126 | 23:00 UTC (20h BRT) |

**Descoberta do tournament_id:**
- O endpoint `GET /tournaments/{id}` é a forma confiável de obter match IDs
- Para descobrir o ID de um torneio desconhecido: tentar variações do padrão `{region}-{nome}{ano}` (ex: `am-pas126`, `eu-pecs26`)
- Alternativa: buscar no histórico de partidas dos jogadores conhecidos

**Crítico:**
- Um match pode aparecer na API antes de estar finalizado — o import pode retornar `pts=0` e status `skipped` → re-rodar após o término resolve
- A PUBG API acumula todos os matches do torneio no mesmo `tournament_id` — filtrar por `known_ids` para não reimportar
- Partidas com `force_reprocess=False` são ignoradas se já importadas — usar `True` apenas para correções
- **Rate limit:** PUBG API = 10 req/min. Throttle de 6.5s entre requests (9 req/min) é seguro. Throttle de 0.7s causa HTTP 429

**Encoding (Windows):**
- Caracteres especiais em strings de print (`->`, emojis, `──`) causam `UnicodeEncodeError` no Windows cp1252
- Solução: evitar caracteres fora do ASCII em scripts Python, ou rodar com `PYTHONIOENCODING=utf-8`

---

### Fase E — Transição entre Dias (fim de cada dia)

**O que fazer:**
1. Verificar `ok=64 skip=0` em todos os matches importados
2. Rodar scoring manual se o scoring job não disparou (partidas noturnas — ver bug log)
3. Identificar os N times rebaixados (piores por pontuação total)
4. Copiar roster dos times rebaixados da stage anterior para a próxima stage
5. **Revisar accounts dos jogadores que vão ao próximo dia** (ver checklist abaixo)
6. Marcar substitutos como `is_available=False` no roster do próximo dia
7. Rodar pricing na próxima stage
8. Abrir a próxima stage (`lineup_status = 'open'`)
9. Fechar/trancar a stage anterior (`lineup_status = 'locked'`)

**Checklist pré-D2 — Revisão de accounts:**
```python
# Para cada time rebaixado, verificar:
# 1. Todos os jogadores têm account pc-tournament cadastrado?
# 2. Todos apareceram nos stats do D1 (ok=64)?
# 3. Houve substituições? O substituto tem account? O titular deve ser is_available=False?

SELECT p.display_name, pa.account_id
FROM roster r
JOIN person p ON r.person_id = p.id
LEFT JOIN player_account pa ON pa.person_id = p.id AND pa.shard = 'pc-tournament'
WHERE r.stage_id = <stage_d1_id>
  AND r.team_name IN (<times rebaixados>)
ORDER BY r.team_name, p.display_name;
-- Resultado esperado: nenhuma linha com account_id NULL
```

**Regra de substituições:**
- Jogador substituto no D1 → adicionar `Person` + `PlayerAccount(pc-tournament)` antes do import
- Titular substituído → manter no roster D1 (marcação histórica), mas no roster D2 setar `is_available=False`
- Nunca remover o titular do roster D1 — afetaria lineups já submetidos

**Crítico:**
- Pricing usa `MIN_VALID_MATCHES = 5` — jogadores com menos de 5 partidas históricas viram newcomers (custo fixo)
- Com exatamente 5 partidas (1 dia de PEC), o algoritmo já consegue precificar
- O algoritmo usa **todas** as partidas dos últimos 150 dias com decay exponencial — histórico PGS afeta o preço mesmo em stages PEC
- Times newcomers (sem histórico algum) = `newcomer_cost` fixo — correto, pois não há base para avaliação
- Após abertura do D2, o D1 deve aparecer em Resultados automaticamente (corrigido no frontend)

**Configuração de horários (obrigatório ao criar stages com horário fixo):**
```python
# 20h BRT = 23h UTC
stage_d2.lineup_close_at = datetime(2026, 4, 18, 23, 0, 0, tzinfo=timezone.utc)
stage_d3.lineup_open_at  = datetime(2026, 4, 19, 12, 0, 0, tzinfo=timezone.utc)  # 09h BRT
stage_d3.lineup_close_at = datetime(2026, 4, 19, 23, 0, 0, tzinfo=timezone.utc)
```
- `lineup_close_at` no Stage → APScheduler fecha o lineup automaticamente
- `lineup_open_at` no Stage → APScheduler abre o lineup automaticamente
- Sem esses campos: a transição depende de `force_stage_status` manual

**Fórmula de pricing (referência):**
```
decay = e^(-0.02 × dias_atrás)
ppm_ponderado = Σ(xama_points × tier_weight × decay) / Σ(tier_weight × decay)
preço = linear(ppm_ponderado, ppm_min, ppm_max, price_min, price_max)
```

---

## 3. Bugs e Correções (log)

| Bug | Causa | Correção |
|---|---|---|
| PEC com shard `steam` | Inserção manual errada | UPDATE championship + stages |
| PAS com shard `steam` | Assumimos regional = steam; na verdade toda partida de torneio é `pc-tournament` | UPDATE stages 15/16/17 + shard no DB |
| `pricing_distribution = "'linear'"` | SQL com aspas duplas aninhadas | UPDATE direto, validação futura |
| 48 jogadores não resolvidos no D1 PEC | Roster de times TWIS/S8UL não estava na stage 21 | Adicionar ao roster antes do import |
| 53 jogadores não resolvidos no D1 PAS | Times sul-americanos só tinham account `steam`, precisavam de `pc-tournament` | Buscar participants do torneio na API, inserir player_accounts |
| `FUR_zkraken` mapeado para person errada | account_id estava linked a person_id=50 (zkraken) em vez de 109 (FUR_zKraken) | UPDATE player_account SET person_id=109 |
| Scoring job não rodou automaticamente no D1 PAS | StageDay.date=17/04 mas matches terminaram às 00:04 UTC 18/04 (date==hoje falhou) | Corrigido: scoring_job agora checa `date IN (hoje, ontem)` |
| "Meu Resultados" mostrando apenas `—` | `LineupPlayerOut` não retornava `person_name`/`team_name`; selectinload com strings inválido no SQLAlchemy 2.0 | Reescrever model_validator → dict; usar model class refs no selectinload |
| `selectinload("roster")` quebrando endpoint | Strings não aceitas no SQLAlchemy 2.0 → `ArgumentError` em runtime | Usar `selectinload(LineupPlayer.roster).selectinload(Roster.person)` |
| Logos PEC não aparecendo | Arquivos não commitados no git | git add + push |
| Tags exibidas como nome completo | `PlayerStatsPage` tinha `formatTeamTag` local sem lookup | Centralizar em `teamUtils.js` |
| PEC D1 sumindo do Dashboard quando D2 abriu | `pureLockedStages` excluía todos os locked em `activeChampGroups` | Excluir só locked sem `open` irmão |
| PEC D1 mostrando "EM JOGO" após D2 abrir | `hasLive` não verificava presença de `open` | Adicionar `!hasOpen` à condição |
| Logo PAS virou PASshort nos tournaments | TournamentHeader alterado junto com Dashboard | Reverter — short só no Dashboard/Championships |
| Dropdown branco-sobre-branco no AdminOpsPanel | select com background transparente; OS renderiza opcoes com fundo branco | Usar background solido (#1a1f2e) + colorScheme: dark |
| Resultados mostrando dia mais antigo primeiro | pureLockedStages nao ordenava desc | Adicionar desc=true ao sortByDate |
| 32 jogadores D2 PEC sem stats | 32 accounts com PENDING_ bloqueavam match_stat | Fetch participants API, normalizar aliases, UPDATE player_account + force_reprocess=True |
| Sequencias PostgreSQL dessincronizadas | INSERTs diretos via psql nao avancam sequences SQLAlchemy | setval(pg_get_serial_sequence(table,id), MAX(id)) antes de insercoes em lote |
| import_pec_day.py reimportava todos os matches | known_ids vazio a cada execucao | Importar IDs especificos via import_stage_matches() ou inicializar known_ids do banco |
| find_pas_matches.py falhava com UnicodeError | Faltava sys.stdout.reconfigure(encoding=utf-8) | Adicionado no topo do script |

---

## 4. Lacunas Identificadas (a investigar)

- [ ] **Reconciliação de `PENDING_`**: como e quando atualizar `account_id` e `shard` após a primeira partida (ex: Gustav na PAS) — hoje é manual
- [ ] **Validação de tags via API**: confirmar aliases antes de criar PlayerAccounts — hoje dependemos de comparação manual
- [ ] **Times D2/D3 desconhecidos**: se o admin não tem os nomes antes do evento, o roster fica vazio — como sinalizar isso para o usuário?
- [ ] **Múltiplos championships simultâneos**: comportamento do Dashboard testado (PAS + PEC), mas pode ter edge cases adicionais
- [ ] **Pricing inter-championships**: como o `tier_weight` deve variar entre PAS e PEC? Atualmente ambos a 1.0
- [ ] **Encerramento de um championship completo**: quando todas as stages ficam `locked`, o championship some da seção ativa — comportamento correto?
- [ ] **Jogador extra (5o integrante)**: hoje removemos do roster manualmente; no futuro, campo `is_substitute` em Roster para filtrar no lineup builder sem remover do DB
- [ ] **Historico de aliases**: nomes mudam entre campeonatos (sniipZEKO -> ZEKO, MAXXXXXXXXX- -> MAXXX); nao ha registro de que sao o mesmo jogador alem do account_id
- [ ] **Validacao de roster vs fonte oficial**: hoje comparamos manualmente com Wasdefy; no futuro, endpoint que compara roster DB com lista de inscricao do torneio
- [x] **Reconciliacao de PENDING_ apos D2**: fluxo documentado e executado com sucesso no PEC D2 (23/32 automatico, 6 manual, 3 intencional)
- [ ] **Erro de import `skipped` misterioso**: `18ad5b28` foi skipped na primeira rodada e só foi pego na segunda — investigar se é race condition ou match incompleto
- [ ] **Shard discovery automático**: ao criar championship, chamar API para detectar shard automaticamente em vez de exigir input manual
- [ ] **Checklist pre-event automatizado**: script que valida antes do lineup abrir: todos os jogadores têm account cadastrado? todos os times têm logo? tournament_id retorna matches?
- [ ] **Substituições**: não há fluxo formalizado para substituições mid-event — hoje é UPDATE manual em `player_account` + `is_available=False` no roster

---

## 5. Proposta de Automação (rascunho)

> A ser detalhada após término das playoffs.

### Arquivo de configuração (championship YAML)

Um único arquivo preenchido pelo admin antes do evento. Exemplo de estrutura:

```yaml
championship:
  name: "PEC: Spring Playoffs"
  short_name: "PEC1"
  shard: "pc-tournament"
  tournament_id: "eu-pecs26"
  tier_weight: 1.0
  price_min: 12
  price_max: 35
  newcomer_cost: 15

stages:
  - day: 1
    date: "2026-04-17"
    teams:
      - tag: "NMSS"
        name: "Team Nemesis"
        players: ["DIFX", "Mellman", "Staed", "SoseD"]
      # ...

  - day: 2
    date: "2026-04-18"
    promoted_from_day: 1   # N piores do dia anterior
    promoted_count: 8
    teams:                  # times que entram direto
      - tag: "YO"
        name: "YOOO"
        players: ["vjeemzz", "pw9d", "TwitchTV_mykLe", "K4pii"]
```

### Subcomandos planejados

```bash
manage_championship.py setup    --file champ.yaml          # Fase A + B + C (validação)
manage_championship.py import   --file champ.yaml --day 1  # Fase D
manage_championship.py advance  --file champ.yaml --day 1  # Fase E (identifica rebaixados, confirma)
manage_championship.py open     --file champ.yaml --day 2  # Abre próxima stage
manage_championship.py validate --file champ.yaml          # Checklist pré-abertura
```

---

## 6. A finalizar após as Playoffs

- [ ] Completar lacunas da seção 4 com o que aprendermos nos dias seguintes
- [ ] Validar a estrutura do YAML com um caso real completo (PEC D2 e D3)
- [x] Documentar o fluxo PAS (shard correto, estrutura de stages, horários BRT/UTC)
- [ ] Decidir nível de automação: script único vs painel admin no frontend
- [ ] Registrar quaisquer novos bugs ou comportamentos inesperados
- [ ] Documentar o fluxo completo de D2/D3 PAS após conclusão das playoffs

---

## 7. Melhorias estruturais implementadas (19/04/2026)

Cinco melhorias aplicadas após os primeiros dias das Playoffs 1 (PAS + PEC):

| Melhoria | Arquivo | O que resolve |
|---|---|---|
| `GET /admin/championships/detect-shard` | `app/routers/admin/championships.py` | Shard errado no setup |
| `known_ids` do banco no startup | `scripts/pubg/import_pec_day.py` | UniqueViolation ao re-executar |
| `validate_event.py` | `scripts/pubg/validate_event.py` | Visibilidade do estado antes de abrir lineup |
| `fix_sequences.py` | `scripts/fix_sequences.py` | IntegrityError após inserts em lote |
| `POST reprocess-all-matches` | `app/routers/import_.py` | Reprocessar sem precisar de Claude |

**Uso do validate_event (obrigatório antes de abrir qualquer lineup):**
```bash
python scripts/pubg/validate_event.py --stage-id X --tournament-id eu-pecs26
```
Saída: lista jogadores PENDING_, times sem logo, times sem teamUtils, pricing_distribution errado, lineup_close_at ausente, shard divergente.

---

## 8. Ordem de Operações Recomendada (checklist pré-evento)

Baseado nos erros que cometemos, esta é a ordem correta de operações antes de qualquer dia de torneio:

```
[ ] 1. Usar GET /admin/championships/detect-shard?tournament_id=X para confirmar shard
[ ] 2. Criar championship e stages com shard correto
[ ] 3. Criar Persons + PlayerAccounts + Rosters para TODOS os jogadores do dia
       - Shard steam: resolver account_id via API ANTES do evento (ver seção 9)
       - Shard pc-tournament: usar PENDING_<nome> e resolver após 1a partida
[ ] 4. Verificar logos: arquivo existe? nome = tag.lower().png?
[ ] 5. TEAM_NAME_TO_TAG atualizado em teamUtils.js?
[ ] 6. Commitar e fazer push de logos e código
[ ] 7. Setar lineup_close_at na Stage (20h BRT = 23h UTC)
[ ] 8. Rodar: python scripts/pubg/validate_event.py --stage-id X --tournament-id Y
       → deve retornar zero problemas antes de abrir
[ ] 9. Abrir lineup (force_status = 'open')
--- DURANTE O EVENTO ---
[ ] 10. Acompanhar matches via GET /tournaments/{id} polling (ou watch script)
[ ] 11. Importar matches (force_reprocess=False); verificar ok=64 skip=0
[ ] 12. Se skip > 0: identificar players na API, inserir player_accounts
        → POST /admin/stages/{id}/reprocess-all-matches (sem precisar de script manual)
[ ] 13. Após último match: fechar stage (force_status = 'locked')
[ ] 14. Confirmar que scoring_job rodou (verificar total_points nos lineups)
[ ] 15. Se scoring não rodou: POST /admin/stages/{id}/score-day + rescore
--- TRANSIÇÃO PARA O PRÓXIMO DIA ---
[ ] 16. Identificar times rebaixados
[ ] 17. Copiar roster stage anterior → próxima stage para times rebaixados
[ ] 18. Checar accounts: todo jogador rebaixado tem account no shard correto?
[ ] 19. Marcar substitutos como is_available=False no roster do próximo dia
[ ] 20. POST /admin/pricing/stages/{id}/recalculate-pricing
[ ] 21. Setar lineup_open_at e lineup_close_at do próximo stage
[ ] 22. Abrir próximo stage
```

---

## 9. Qualificatórias Steam — fluxo diferente de pc-tournament

A partir dos próximos regionais (PAS 2, etc.), a fase de qualificatória usa shard `steam`.
Isso muda o fluxo de identidade de forma importante:

### Steam tem player lookup por nome (pc-tournament não tem)
```
GET https://api.pubg.com/shards/steam/players?filter[playerNames]=nome1,nome2,...
→ Retorna account_id de cada jogador pelo nome in-game
→ Máximo 10 nomes por request | rate limit: 10 req/min
→ 160 jogadores = 16 requests = ~2 minutos
```

**Consequência:** para qualificatórias steam, **não é necessário PENDING_**. É possível resolver todos os account_ids antes do evento, eliminando o skip=1 no import.

### Fluxo pré-evento para steam
```
1. Obter lista de times/jogadores (Wasdefy ou fonte oficial do torneio)
2. Chamar GET /shards/steam/players para cada batch de 10 nomes
3. Criar Person + PlayerAccount(steam) com account_id real (não PENDING_)
4. Criar Roster na stage
5. validate_event.py → deve retornar zero PENDING_
```

### Mesmo jogador em steam e pc-tournament
Um jogador que joga qualificatória (steam) e depois Playoffs (pc-tournament) terá **dois PlayerAccount** para o mesmo Person:
- `PlayerAccount(person_id=X, shard='steam', account_id='account.steam.xxx')`
- `PlayerAccount(person_id=X, shard='pc-tournament', account_id='account.pctournament.xxx')`

O sistema de identidade (`build_lookup`) já filtra por shard da stage — isso funciona corretamente sem mudança de modelo.

### Estrutura de championship para regionais semanais
```
PAS 2 - Open Qualify WEEK #1  (championship, shard=steam)
  ├── Stage 1 — Dia 1  (40+ times, ~160 jogadores)
  ├── Stage 2 — Dia 2  (40+ times, preço ajustado pelo D1)
  ├── Stage 3 — Dia 3  (40+ times, preço ajustado pelo D1+D2)
  └── Stage 4 — Final  (16 melhores times das stages 1-3, subconjunto do roster)

PAS 2 - Playoffs 1  (championship, shard=pc-tournament)
  └── ... como já operamos hoje
```

**Por que championship por semana (não um championship único com muitas stages)?**
- Shard diferente (steam vs pc-tournament) entre fases é incompatível no mesmo championship
- Precificação e lineup por semana = contexto isolado e correto
- Playoffs e Grand Final como championships separados = mapeamento direto com a realidade do torneio

**Pricing entre semanas:** funciona automaticamente via decay exponencial (150 dias). Semana 2 já considera performance da Semana 1 com peso menor. Não precisa configurar `carries_stats_from` explicitamente.

---

## 8. Padroes Descobertos no PEC D2/D3 (18/04/2026)

### Jogador Extra (5o integrante)

Times inscritos em torneios frequentemente tem 5 jogadores, sendo 1 reserva. O padrao correto:
- Os 4 titulares entram no **Roster** da stage (aparecem no lineup builder)
- O 5o jogador existe como **Person + PlayerAccount** no banco, mas **NAO entra no Roster**
- Se houver substituicao: adicionar ao Roster da stage corrente e remover o substituido

Identificacao: a fonte oficial (Wasdefy, site do torneio) lista os 5; identificar qual e o extra
por contexto (geralmente o ultimo listado, ou o que fica de fora das partidas).

### Pricing por Performance para Dias Seguintes

Para stages D2/D3 onde os jogadores tem historico do dia anterior:

Times sem historico (ex: D3 originais que nao jogaram D1/D2 no sistema) recebem custo neutro (15.0).

### Aliases Oficiais via PUBG API

Nomes de jogadores com traco  ou sufixos especiais costumam ser editados:
-  ->   
-  -> 
-  -> 
-  -> 

**Regra:** o nome retornado pela PUBG API no  dos participants e o nome oficial.
Sempre atualizar  e  para o valor da API apos o primeiro import.

### Correto Fluxo de Import quando Matches ja Existem no Tournament

O endpoint  retorna TODOS os matches do evento (D1+D2+D3 juntos).
Para importar apenas matches de um dia especifico, usar a funcao diretamente com os IDs filtrados:



O script  assume known_ids vazio e tenta importar tudo,
causando UniqueViolation se matches ja existem. Correcao futura: inicializar known_ids do banco.

### Sequencias PostgreSQL Dessincronizadas

Insercoes via psql direto (ou migrations com IDs explicitos) podem deixar sequences para tras.
Sintoma: .
Prevencao: rodar antes de qualquer insercao em lote via SQLAlchemy:


