# PROMPT DE RETOMADA — XAMA Fantasy
> Cole este prompt no início da próxima sessão e anexe CONTEXT.md, CHANGELOG.md e BACKLOG.md como arquivos

---

Olá! Vamos retomar o desenvolvimento do XAMA Fantasy.

**Contexto:** Sou desenvolvedor solo do XAMA Fantasy, uma plataforma de fantasy sports para esports de PUBG. Stack: FastAPI + PostgreSQL (Render) + React 18 + Vite. Repositório: `chamaobird/pubg-fantasy-platform`. Deploy automático no Render via push para `main`.

**Branch ativo:** `feature/landing-refresh`

**Estado atual (29/04/2026):**
- Migrations aplicadas até `0025` (próxima: `0026`, `down_revision = "0025"`)
- PAS1 Playoffs 2 ativos: championships 12+13, stages 30+33 reprecificadas
- Stages 31, 32, 34, 35: ainda sem roster importado
- **Branch `feature/landing-refresh`**: refresh visual da LandingPage concluído e commitado — aguardando revisão humana e merge para `main`

**Próximos passos imediatos:**
1. Revisar visualmente a landing no dev server (`cd frontend && npm run dev`)
2. Se aprovada, fazer merge de `feature/landing-refresh` → `main` (deploy automático no Render)
3. Importar roster dos times para stages 31, 32, 34, 35 (PAS Playoffs 2)
4. Fix pré-existente: `LeagueDetail.jsx:152` — duplicate `style` attribute (está no BACKLOG)

**Backlog técnico urgente:**
- Fix: `LeagueDetail.jsx:152` — `<div style={ST} style={{ marginBottom: 0 }}>` → `style={{ ...ST, marginBottom: 0 }}`
- Corrigir comentário `app/services/scoring.py` ~linha 14: capitão `×1.25` → `×1.30`
- `TeamLogo.jsx`: remover alias `flcn → flc` (display_names já corrigidos no banco)

**Rotina Claude Code:**
```powershell
cd C:\Users\lgpas\PROJECTS\pubg-fantasy-platform
claude
# ao fim da sessão:
rtk gain
```

**Arquivos para anexar:** CONTEXT.md, CHANGELOG.md, BACKLOG.md
