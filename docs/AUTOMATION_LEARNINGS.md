# Learnings — Automação de Championships
> Documento de trabalho. Iniciado em 17/04/2026 durante PEC Spring Playoffs 1 + PAS Playoffs 1.
> **Status:** em progresso — será finalizado ao término das playoffs.

---

## Contexto

Primeira vez que operamos dois championships simultâneos com shards diferentes:
- **PAS Playoffs 1** — shard `steam`, torneio regional, stages 15/16/17
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
- Torneios regionais (PAS, PAS Americas, PAS EMEA): `steam`
- Torneios esports oficiais (PGS, PEC, PGC): `pc-tournament`
- Confirmar via endpoint: `GET /tournaments/{tournament_id}` → `data.relationships.matches.data[0]` → fetch match → campo `data.attributes.shardId`

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

**Crítico:**
- Um match pode aparecer na API antes de estar finalizado — o import pode retornar `pts=0` e status `skipped` → re-rodar após o término resolve
- A PUBG API acumula todos os matches do torneio no mesmo `tournament_id` — o script filtra por `known_ids` para não reimportar
- Partidas com `force_reprocess=False` são ignoradas se já importadas — usar `True` apenas para correções

**Encoding (Windows):**
- Caracteres especiais em strings de print (`→`, `──`) causam `UnicodeEncodeError` no Windows cp1252
- Solução: evitar caracteres fora do ASCII em scripts Python destinados a execução local

---

### Fase E — Transição entre Dias (fim de cada dia)

**O que fazer:**
1. Verificar se todos os matches foram importados
2. Identificar os N times rebaixados (piores por pontuação total)
3. Adicionar esses times ao roster da próxima stage (persons já existem)
4. Rodar pricing na próxima stage
5. Abrir a próxima stage (`lineup_status = 'open'`)

**Crítico:**
- Pricing usa `MIN_VALID_MATCHES = 5` — jogadores com menos de 5 partidas históricas viram newcomers (custo fixo)
- Com exatamente 5 partidas (1 dia de PEC), o algoritmo já consegue precificar
- O algoritmo usa **todas** as partidas dos últimos 150 dias com decay exponencial — histórico PGS afeta o preço mesmo em stages PEC
- Times newcomers (sem histórico algum) = `newcomer_cost` fixo — correto, pois não há base para avaliação
- Após abertura do D2, o D1 deve aparecer em Resultados automaticamente (corrigido no frontend)

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
| `pricing_distribution = "'linear'"` | SQL com aspas duplas aninhadas | UPDATE direto, validação futura |
| 48 jogadores não resolvidos no D1 | Roster de times TWIS/S8UL não estava na stage 21 | Adicionar ao roster antes do import |
| Logos PEC não aparecendo | Arquivos não commitados no git | git add + push |
| Tags exibidas como nome completo | `PlayerStatsPage` tinha `formatTeamTag` local sem lookup | Centralizar em `teamUtils.js` |
| PEC D1 sumindo do Dashboard quando D2 abriu | `pureLockedStages` excluía todos os locked em `activeChampGroups` | Excluir só locked sem `open` irmão |
| PEC D1 mostrando "EM JOGO" após D2 abrir | `hasLive` não verificava presença de `open` | Adicionar `!hasOpen` à condição |
| Logo PAS virou PASshort nos tournaments | TournamentHeader alterado junto com Dashboard | Reverter — short só no Dashboard/Championships |

---

## 4. Lacunas Identificadas (a investigar)

- [ ] **Reconciliação de `PENDING_`**: como e quando atualizar `account_id` e `shard` após a primeira partida (ex: Gustav na PAS)
- [ ] **Validação de tags via API**: confirmar aliases antes de criar PlayerAccounts
- [ ] **Times D2/D3 desconhecidos**: se o admin não tem os nomes antes do evento, o roster fica vazio — como sinalizar isso para o usuário?
- [ ] **Múltiplos championships simultâneos**: comportamento do Dashboard testado (PAS + PEC), mas pode ter edge cases adicionais
- [ ] **Pricing inter-championships**: como o `tier_weight` deve variar entre PAS (regional) e PEC (esports)? Atualmente ambos a 1.0
- [ ] **Encerramento de um championship completo**: quando todas as stages ficam `locked`, o championship some da seção ativa — comportamento correto?
- [ ] **Erro de import `skipped` misterioso**: `18ad5b28` foi skipped na primeira rodada e só foi pego na segunda — investigar se é race condition ou match incompleto

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
- [ ] Documentar o fluxo PAS (diferenças de shard, estrutura de stages)
- [ ] Decidir nível de automação: script único vs painel admin no frontend
- [ ] Registrar quaisquer novos bugs ou comportamentos inesperados
