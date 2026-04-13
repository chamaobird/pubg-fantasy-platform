# PROMPT DE RETOMADA — XAMA Fantasy
> Cole este prompt no início da próxima sessão junto com CONTEXT.md, CHANGELOG.md e FRONTEND.md

---

Olá! Vamos retomar o desenvolvimento do XAMA Fantasy.

**Contexto:** Sou desenvolvedor solo do XAMA Fantasy, uma plataforma de fantasy sports para esports de PUBG. Stack: FastAPI + PostgreSQL (Render) + React 18 + Vite. Repositório: `chamaobird/pubg-fantasy-platform`. Deploy automático no Render.

**Estado atual:**
- Migrations aplicadas até `0013` (próxima: `0014`, `down_revision = "0013"`)
- PAS1 Playoffs 1 no banco: championship id=7, stages 15/16/17
- Stage 15 (Dia 1): lineup_status=**preview** — abrir com `open` em 15/04 após confirmar roster
- Stage 16 e 17: lineup_status=closed
- Todas as stages com `start_date` e `end_date` populados
- Dashboard redesenhado: hierarquia de cards, logos reais, datas com fuso local, ordenação cronológica

**Tarefas imediatas (15/04):**
1. Confirmar/ajustar preços dos invited: TGLTN=35 ok, CowBoi=24.34, Kickstart=22.22, hwinn — verificar
2. Confirmar roster oficial divulgado
3. Abrir stage 15: `UPDATE stage SET lineup_status = 'open' WHERE id = 15;`
4. Após 1ª partida (17/04): validar Steam names via `scripts/pubg/manage_player_accounts.py`

**Backlog UX:**
1. Championships.jsx — badge "EM PREVIEW" para stages em preview (mostra "EM BREVE" atualmente)
2. LineupBuilder — aumentar tipografia da tabela + replicar colunas da aba Stats
3. Logos dos times no LineupBuilder — confirmar paths
4. Ordenação por time no PlayerStatsPage e LineupBuilder

**Arquivos para anexar:** CONTEXT.md, CHANGELOG.md, FRONTEND.md
