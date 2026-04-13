# PROMPT DE RETOMADA — XAMA Fantasy
> Cole este prompt no início da próxima sessão junto com CONTEXT.md, CHANGELOG.md e FRONTEND.md

---

Olá! Vamos retomar o desenvolvimento do XAMA Fantasy.

**Contexto:** Sou desenvolvedor solo do XAMA Fantasy, uma plataforma de fantasy sports para esports de PUBG. Stack: FastAPI + PostgreSQL (Render) + React 18 + Vite. Repositório: `chamaobird/pubg-fantasy-platform`. Deploy automático no Render.

**Estado atual:**
- Migrations aplicadas até `0013` (próxima: `0014`, `down_revision = "0013"`)
- PAS1 Playoffs 1: championship id=7, stages 15/16/17
- Stage 15 (Dia 1): lineup_status=**preview** → abrir com `open` em 15/04
- UX polish completo: badges preview, colunas LineupBuilder, sort por time, preços 2 casas, logos, fundo hex, scrollbar tema, modal de pontuação
- Skill `frontend-design` ativa em `/mnt/skills/public/frontend-design` — usar em todo trabalho de UI

**Tarefas imediatas (15/04):**
1. Confirmar/ajustar preços: TGLTN=35, CowBoi=24.34, Kickstart=22.22, hwinn=13.24
2. Confirmar roster oficial
3. `UPDATE stage SET lineup_status = 'open' WHERE id = 15;`
4. Após 1ª partida (17/04): validar Steam names via `scripts/pubg/manage_player_accounts.py`
5. Corrigir comentário `app/services/scoring.py` linha ~14: `×1.25` → `×1.30`

**Próxima sessão de desenvolvimento — Mobile Fase 1:**
1. Navbar: ordem fixa, ativo = destaque visual apenas (sem reordenação)
2. `overflow-x: hidden` no body + `max-width: 100%` nos containers
3. Verificar `<meta name="viewport">` no `index.html`
- Ver BACKLOG.md #MOB-01 a #MOB-07 para plano completo

**Arquivos para anexar:** CONTEXT.md, CHANGELOG.md, FRONTEND.md
