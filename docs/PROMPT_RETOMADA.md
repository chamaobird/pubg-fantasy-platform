# PROMPT DE RETOMADA — XAMA Fantasy
> Cole este prompt no início da próxima sessão e anexe CONTEXT.md, CHANGELOG.md e BACKLOG.md como arquivos

---

Olá! Vamos retomar o desenvolvimento do XAMA Fantasy.

**Contexto:** Sou desenvolvedor solo do XAMA Fantasy, uma plataforma de fantasy sports para esports de PUBG. Stack: FastAPI + PostgreSQL (Render) + React 18 + Vite. Repositório: `chamaobird/pubg-fantasy-platform`. Deploy automático no Render via push para `main`.

**Branch ativo:** `main`

**Estado atual (30/04/2026):**
- Migrations aplicadas até `0029` em prod (0028 oauth_code + 0029 hotfix user_id type)
- Próxima migration: `0030`, `down_revision = "0029"`
- Sessões A, B e SEC-001 concluídas: PostHog + feedback + limpeza de débitos + OAuth seguro
- PAS1 Playoffs 2 ativos: championships 12+13, stages 30+33 reprecificadas
- Stages 31, 32, 34, 35: ainda sem roster importado

**Próxima sessão: Sessão C — Onboarding e estado vazio do Dashboard**
> Ver plano detalhado em `docs/XAMA_PLANO_SESSOES.md` → Sessão C
> Pré-requisito: confirmar que Sessão A está coletando dados (PostHog) antes de iniciar C

**Pendências operacionais (BACKLOG 🟠):**
- **hwinn**: rodar queries SQL de investigação de pricing e reportar resultado
- **#PAS-13**: validar Steam names via `manage_player_accounts.py`
- **#PAS-14**: atualizar PlayerAccount id=308 (Gustav) com account_id real

**Backlog de segurança:**
- ~~SEC-001~~: resolvido (30/04/2026)
- **SEC-002**: JWT 7 dias sem revogação (ver BACKLOG)
- **SEC-003**: tokens de reset/verify em query string (ver BACKLOG)

**Rotina Claude Code:**
```powershell
cd C:\Users\lgpas\PROJECTS\pubg-fantasy-platform
claude
# ao fim da sessão:
rtk gain
```

**Arquivos para anexar:** CONTEXT.md, CHANGELOG.md, BACKLOG.md
