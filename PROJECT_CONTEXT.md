# 🎮 PUBG Fantasy Platform - Contexto Completo do Projeto

## 📌 Visão Geral
Plataforma de Fantasy League para campeonatos PUBG, similar ao modelo Twire.
- **Stack:** FastAPI + PostgreSQL + SQLAlchemy + Alembic
- **Deploy:** Render.com (free tier)
- **Repo:** https://github.com/chamaobird/pubg-fantasy-platform
- **API Live:** https://pubg-fantasy-platform.onrender.com
- **Swagger:** https://pubg-fantasy-platform.onrender.com/docs

---

## 🎯 TAREFA IMEDIATA

**O QUE PRECISA SER FEITO AGORA:**

1. Copiar TODOS os arquivos da pasta `C:\Users\[username]\Downloads\Warzone fantasy final\` para este projeto
2. Fazer git add, commit e push com a mensagem: `feat: add Alembic migrations + championships + Twire scoring`
3. Aguardar o Render fazer deploy automaticamente
4. Verificar se os novos endpoints aparecem no Swagger

**ARQUIVOS QUE PRECISAM SER ADICIONADOS:**
- alembic.ini (na raiz)
- alembic/env.py
- alembic/script.py.mako
- alembic/versions/0001_initial_schema.py
- alembic/versions/0002_fantasy_leagues_and_teams.py
- alembic/versions/0003_matches_and_scoring.py
- app/services/scoring.py (NOVO)
- app/routers/championships.py (NOVO)
- Dockerfile (SUBSTITUIR o existente)
- requirements.txt (SUBSTITUIR o existente)
- .gitignore (adicionar se não existir)

---

## 🏗️ Estrutura do Projeto

pubg-fantasy-platform/
├── app/
│ ├── core/
│ │ └── security.py # Hash senha (SHA256+bcrypt)
│ ├── routers/
│ │ ├── auth.py # ✅ Registro e login JWT
│ │ ├── players.py # ✅ CRUD jogadores
│ │ ├── tournaments.py # ✅ CRUD torneios
│ │ ├── admin.py # ⏳ Sync PUBG API (pendente)
│ │ └── championships.py # ⏳ Endpoints ligas (pendente)
│ ├── services/
│ │ ├── pubg_api.py # ⏳ Cliente PUBG (pendente)
│ │ └── scoring.py # ⏳ Sistema Twire (pendente)
│ ├── models.py # ✅ SQLAlchemy models
│ ├── database.py # ✅ Conexão PostgreSQL
│ ├── config.py # ✅ Env vars
│ ├── dependencies.py # ✅ JWT auth
│ └── main.py # ✅ FastAPI app
├── alembic/ # ⏳ Tudo pendente upload
├── scripts/
│ └── seed_data.py # ⏳ Seed dados (pendente)
├── Dockerfile # ⏳ Atualizar
└── requirements.txt # ⏳ Atualizar


**Legenda:** ✅ Funcionando | ⏳ Criado mas não está no GitHub

---

## 🧬 Modelos de Dados (SQLAlchemy)

**Tabelas existentes:**
1. `users` - id, email, username, hashed_password, is_active, **is_admin**, created_at
2. `tournaments` - id, name, **pubg_id**, **region**, start_date, end_date, status, max_teams
3. `teams` - id, name, tournament_id
4. `players` - id, name, **pubg_id**, **region**, team_id, fantasy_cost, position, **avg_kills**, **avg_damage**, **avg_placement**, **matches_played**, **raw_stats**, **last_synced_at**
5. `fantasy_leagues` - id, name, tournament_id, max_fantasy_teams, budget_per_team
6. `fantasy_teams` - id, name, owner_id, league_id, total_points

**Tabelas a serem criadas pelas migrations:**
7. `matches` - id, pubg_match_id, tournament_id, map_name, played_at, duration_secs
8. `match_player_stats` - id, match_id, player_id, kills, assists, damage_dealt, placement, survival_secs, headshots, knocks, fantasy_points
9. `player_scores` - id, player_id, league_id, total_points, total_kills, total_assists, total_damage, matches_scored
10. `fantasy_team_players` - fantasy_team_id, player_id, slot (1=capitão, 2-4=titulares)

---

## 🎲 Sistema de Pontuação Twire (IMPORTANTE!)

**Fórmula oficial usada no código:**

fantasy_points = (kills × 2) + (damage × 0.01) + chicken_dinner_bonus + early_death_penalty

Detalhes:

Kills: ×2 pontos cada

Dano: ×0.01 por ponto de dano (= 1 pt por 100 dano)

Chicken Dinner: +5 pts SE placement == 1

Early Death: -3 pts SE survival_secs < 600 (10 min)

Capitão: ×1.3 multiplicador sobre TODOS os pontos

⚠️ Assists, headshots, knockdowns NÃO dão pontos (modelo oficial Twire)

**Exemplo real:**
- Jogador: 5 kills, 300 dano, 1º lugar, 20 min vivo
- Cálculo: (5×2) + (300×0.01) + 5 + 0 = 18 pts
- Se for capitão (slot 1): 18 × 1.3 = 23.4 pts

**Fonte:** https://pubgesports.com/en/news/5305 (PCS7 Twire)

---

## 🔐 Autenticação

**JWT:**
- Expira em 30 min (configurável)
- Gerado no `/users/login`
- Usado em endpoints protegidos via header: `Authorization: Bearer {token}`

**Senhas:**
- Hash: SHA256 pré-hash + bcrypt (evita erro de senha > 72 bytes)
- Implementado em: `app/core/security.py`

**Permissões:**
- Endpoints `/admin/*` requerem `is_admin=True`
- Criar fantasy teams requer JWT válido
- Ver rankings é público

---

## 🌐 PUBG API (para referência futura)

**Base URL:** https://api.pubg.com
**Shard usado:** pc-tournament

**Headers obrigatórios:**

Authorization: Bearer {PUBG_API_KEY}
Accept: application/vnd.api+json


**Rate Limit:** 10 requests/minuto (código já tem sleep(6) entre chamadas)

**Endpoints implementados:**
- `GET /shards/pc-tournament/tournaments` - Lista torneios
- `GET /shards/pc-tournament/tournaments/{id}` - Detalhes + matches
- `GET /shards/pc-tournament/matches/{id}` - Stats da partida

---

## 🚀 Deploy no Render

**Configuração:**
- Auto-deploy quando push no branch `main`
- Build: via Dockerfile
- Startup: `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT`

**Environment Variables (já configuradas no Render):**

DATABASE_URL=postgresql://... (auto)
SECRET_KEY=sua-chave
PUBG_API_KEY=sua-chave-pubg
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30


**Após push, acompanhar:**
1. Events → ver "Deploy started"
2. Logs → procurar por:
   - `Running upgrade -> 0001, initial schema`
   - `Running upgrade 0001 -> 0002`
   - `Running upgrade 0002 -> 0003`
   - `Your service is live 🎉`

---

## 📝 Estado Atual

**✅ O que está funcionando:**
- API no ar: https://pubg-fantasy-platform.onrender.com
- Endpoints: `/users/register`, `/users/login`, `/players`, `/tournaments`
- Banco PostgreSQL conectado
- JWT auth funcionando
- Swagger UI ativo

**❌ O que falta (será resolvido com o upload):**
- Sistema de championships (12 endpoints novos)
- Sistema de scoring Twire
- Migrations do Alembic (3 arquivos)
- Endpoints admin (sync com PUBG API)

---

## 🎯 Próximos Passos Após Upload

1. ✅ Upload dos arquivos (VOCÊ ESTÁ AQUI)
2. ⏳ Verificar deploy no Render (5-10 min)
3. ⏳ Testar no Swagger: `/championships/scoring-rules`
4. ⏳ Criar admin user: `UPDATE users SET is_admin=true WHERE email='seu@email.com'`
5. ⏳ Testar sync: `POST /admin/sync-tournaments` (requer PUBG_API_KEY configurada)

---

## 🐛 Problemas Conhecidos e Soluções

**Problema:** Senha > 72 bytes dá erro
**Solução:** Já implementado pré-hash SHA256 em security.py

**Problema:** Render demora na primeira request
**Solução:** Normal (free tier spin down), ~50s

**Problema:** PUBG API não retorna torneios
**Solução:** Usar `scripts/seed_data.py` para dados de teste

---

## 💬 Convenções de Código

**Commits:** Use Conventional Commits

feat: nova funcionalidade
fix: correção de bug
docs: documentação
refactor: refatoração


**Naming:**
- Models: PascalCase (`FantasyTeam`)
- Funções: snake_case (`calculate_fantasy_cost`)
- Constantes: UPPER_SNAKE_CASE (`POINTS_PER_KILL`)

**Type hints:** Sempre usar quando possível
**Docstrings:** Formato Google para funções complexas

---

## ⚙️ Comandos Úteis (para referência futura)

```bash
# Desenvolvimento local
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload

# Nova migration
alembic revision --autogenerate -m "description"

# Rollback
alembic downgrade -1

# Seed dados de teste
python scripts/seed_data.py

# Git
git add .
git commit -m "feat: description"
git push origin main

📚 Documentação de Referência
PUBG API: https://documentation.pubg.com

FastAPI: https://fastapi.tiangolo.com

Alembic: https://alembic.sqlalchemy.org

Twire Model: https://pubgesports.com/en/news/5305

SQLAlchemy: https://docs.sqlalchemy.org/en/20/

🎨 Estrutura de Endpoints (após upload)
Públicos:

GET /championships/scoring-rules

GET /championships/leagues

GET /championships/leagues/{id}

GET /championships/leagues/{id}/ranking

Autenticados (JWT):

GET /championships/my-teams

POST /championships/leagues/{id}/teams

POST /championships/leagues/{id}/teams/{tid}/players

DELETE /championships/leagues/{id}/teams/{tid}/players/{pid}

Admin (JWT + is_admin=True):

POST /admin/sync-tournaments

POST /admin/sync-players

POST /admin/recalculate-costs

POST /championships/leagues (criar liga)

POST /championships/leagues/{id}/matches/sync

🔍 Para Debug
Ver logs Render:
Dashboard → pubg-fantasy-platform → Logs

Testar localmente:
http://localhost:8000/docs

Verificar migrations aplicadas:

SELECT * FROM alembic_version;

Promover user a admin:
UPDATE users SET is_admin=true WHERE email='seu@email.com';


***