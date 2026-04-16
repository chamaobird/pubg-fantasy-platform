# PROMPT DE RETOMADA — XAMA Fantasy
> Cole este prompt no início da próxima sessão e anexe CONTEXT.md, CHANGELOG.md e BACKLOG.md como arquivos

---

Olá! Vamos retomar o desenvolvimento do XAMA Fantasy.

**Contexto:** Sou desenvolvedor solo do XAMA Fantasy, uma plataforma de fantasy sports para esports de PUBG. Stack: FastAPI + PostgreSQL (Render) + React 18 + Vite. Repositório: `chamaobird/pubg-fantasy-platform`. Deploy automático no Render.

**Estado atual:**
- Migrations aplicadas até `0015` (próxima: `0016`, `down_revision = "0015"`)
- PAS1 Playoffs 1: championship id=7, stages 15/16/17
- Stage 15 (Dia 1): lineup_status=**open** ✅
- Roster atualizado: Gustav (FLC), hwinn (WOLF), Sayfoo removido
- Leaderboard: acumulado por campeonato, tiebreaker survival_secs+captain_pts, dropdown por fase
- Google OAuth: usuários sem username redirecionados para `/setup-username`
- Skill `frontend-design` ativa em `/mnt/skills/public/frontend-design` — usar em todo trabalho de UI

**Tarefas pendentes:**
1. Ajustar preço do hwinn via AdminPricingPanel (~13.24 — confirmar)
2. Após 1ª partida (17/04): validar Steam names via `manage_player_accounts.py`
3. Após 1ª partida (17/04): atualizar PlayerAccount id=308 (Gustav) com account_id e shard reais
4. Corrigir comentário `app/services/scoring.py` linha ~14: `×1.25` → `×1.30`

**Rotina Claude Code:**
```powershell
cd C:\Users\lgpas\PROJECTS\pubg-fantasy-platform
claude
# ao fim da sessão:
rtk gain
```

**Dicas Claude Code:**
- Limite de caracteres por prompt — dividir em partes (max ~3 arquivos por vez)
- Fornecer arquivos JSX como upload aqui no Claude.ai em vez de Get-Content

**Arquivos para anexar:** CONTEXT.md, CHANGELOG.md, BACKLOG.md
