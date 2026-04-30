# PROMPT DE RETOMADA — XAMA Fantasy
> Cole este prompt no início da próxima sessão e anexe CONTEXT.md, CHANGELOG.md e BACKLOG.md como arquivos

---

Olá! Vamos retomar o desenvolvimento do XAMA Fantasy.

**Contexto:** Sou desenvolvedor solo do XAMA Fantasy, uma plataforma de fantasy sports para esports de PUBG. Stack: FastAPI + PostgreSQL (Render) + React 18 + Vite. Repositório: `chamaobird/pubg-fantasy-platform`. Deploy automático no Render via push para `main`.

**Branch ativo:** `main`

**Estado atual (30/04/2026):**
- Migrations aplicadas até `0027` (próxima: `0028`, `down_revision = "0027"`)
- Sessão A concluída e deployada: PostHog analytics + session replay + widget de feedback in-app
- PAS1 Playoffs 2 ativos: championships 12+13, stages 30+33 reprecificadas
- Stages 31, 32, 34, 35: ainda sem roster importado

**Próxima sessão: Sessão B — Limpeza de débitos rápidos do BACKLOG**
> Ver plano detalhado em `docs/XAMA_PLANO_SESSOES.md` → Sessão B

**Backlog técnico urgente (Sessão B):**
- Fix: `LeagueDetail.jsx:152` — `<div style={ST} style={{ marginBottom: 0 }}>` → `style={{ ...ST, marginBottom: 0 }}`
- Corrigir comentário `app/services/scoring.py` ~linha 14: capitão `×1.25` → `×1.30`
- `TeamLogo.jsx`: remover alias `flcn → flc` (display_names já corrigidos no banco)
- **SEC-001**: Refatorar OAuth callback para não expor JWT na URL (ver BACKLOG)
- Sort por team name em `PlayerStatsPage.jsx` e `LineupBuilder.jsx`

**Rotina Claude Code:**
```powershell
cd C:\Users\lgpas\PROJECTS\pubg-fantasy-platform
claude
# ao fim da sessão:
rtk gain
```

**Arquivos para anexar:** CONTEXT.md, CHANGELOG.md, BACKLOG.md
