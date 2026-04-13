# PROMPT DE RETOMADA — XAMA Fantasy
> Cole este prompt no início da próxima sessão junto com CONTEXT.md, CHANGELOG.md e FRONTEND.md

---

Olá! Vamos retomar o desenvolvimento do XAMA Fantasy.

**Contexto:** Sou desenvolvedor solo do XAMA Fantasy, uma plataforma de fantasy sports para esports de PUBG. Stack: FastAPI + PostgreSQL (Render) + React 18 + Vite. Repositório: `chamaobird/pubg-fantasy-platform`. Deploy automático no Render.

**Estado atual:**
- Migrations aplicadas até `0012`
- PAS1 Playoffs 1 populado no banco: championship id=7, stages 15/16/17
- Stage 15 (Dia 1): lineup_status=**preview** — visível mas sem montagem de lineup
- Stage 16 e 17: lineup_status=closed
- 64 jogadores com display_name corrigido no formato TAG_PlayerName
- Dashboard mostra card "EM PREVIEW" com botão "VER LOBBY" para stages em preview

**Objetivo desta sessão:**
Quarta 15/04 — preparar abertura real do Playoffs 1 Dia 1:
1. Confirmar preços dos invited (TGLTN=35 ok, CowBoi e outros — verificar via admin panel)
2. Confirmar roster final com o lineup oficial divulgado
3. Mudar stage 15 para `open`: `UPDATE stage SET lineup_status = 'open' WHERE id = 15;`

**Backlog UX para atacar quando operacional estiver ok:**
1. Championships.jsx — badge "EM PREVIEW" para stages em preview (atualmente mostra "EM BREVE")
2. LineupBuilder — aumentar tipografia da tabela + replicar colunas da aba Stats
3. Logos dos times no LineupBuilder — confirmar paths
4. Ordenação por time no PlayerStatsPage e LineupBuilder

**Arquivos para anexar:** CONTEXT.md, CHANGELOG.md, FRONTEND.md
