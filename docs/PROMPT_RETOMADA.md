# PROMPT DE RETOMADA — XAMA Fantasy
> Cole este prompt no início da próxima sessão e anexe CONTEXT.md, CHANGELOG.md e BACKLOG.md como arquivos

---

Olá! Vamos retomar o desenvolvimento do XAMA Fantasy.

**Contexto:** Sou desenvolvedor solo do XAMA Fantasy, uma plataforma de fantasy sports para esports de PUBG. Stack: FastAPI + PostgreSQL (Render) + React 18 + Vite. Repositório: `chamaobird/pubg-fantasy-platform`. Deploy automático no Render.

**Estado atual:**
- Migrations aplicadas até `0013` (próxima: `0014`, `down_revision = "0013"`)
- PAS1 Playoffs 1: championship id=7, stages 15/16/17
- Stage 15 (Dia 1): lineup_status=**open** (aberto em 15/04)
- Debt técnico UI concluído: tokens CSS (Categoria A), fontFamily Rajdhani removido de 17 arquivos
- Skill `frontend-design` ativa em `/mnt/skills/public/frontend-design` — usar em todo trabalho de UI

**Tarefas operacionais pendentes:**
1. Confirmar preços invited: TGLTN=35, CowBoi=24.34, Kickstart=22.22, hwinn=13.24
2. Confirmar roster oficial e corrigir display_names se necessário
3. Após 1ª partida (17/04): validar Steam names via `scripts/pubg/manage_player_accounts.py`
4. Corrigir comentário `app/services/scoring.py` linha ~14: `×1.25` → `×1.30`

**Dica — Claude Code:**
- O terminal tem limite de caracteres por prompt
- Dividir instruções grandes em partes menores (max ~3 arquivos por vez)
- Fornecer arquivos JSX como upload aqui no Claude.ai em vez de Get-Content

**Arquivos para anexar:** CONTEXT.md, CHANGELOG.md, BACKLOG.md
