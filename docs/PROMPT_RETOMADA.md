# PROMPT DE RETOMADA — XAMA Fantasy
> Cole este prompt no início da próxima sessão junto com CONTEXT.md, CHANGELOG.md e FRONTEND.md

---

Olá! Vamos retomar o desenvolvimento do XAMA Fantasy.

**Contexto:** Sou desenvolvedor solo do XAMA Fantasy, uma plataforma de fantasy sports para esports de PUBG. Stack: FastAPI + PostgreSQL (Render) + React 18 + Vite. Repositório: `chamaobird/pubg-fantasy-platform`. Deploy automático no Render.

**Estado atual:**
- Migrations aplicadas até `0011`
- PAS1 Playoffs 1 populado no banco: championship id=7, stages 15/16/17, 64 rosters no Dia 1
- lineup_status=closed em todas as stages — ainda não aberto para montagem
- Background atmosférico (grade hexagonal + gradiente laranja) aplicado nas páginas internas
- Scripts: scripts/pubg/populate_pas1_playoffs.py e manage_player_accounts.py

**Objetivo desta sessão:**
Preparar a abertura do lineup do Playoffs 1 - Dia 1 (17/04). Tarefas:
1. Ajustar preços manualmente dos times invited (TGLTN, CowBoi, Kickstart e outros estão com preço calculado pelo PGS — precisam ser fixados em 33 para high tier)
2. Mudar lineup_status da stage 15 para 'open' quando estiver pronto
3. Confirmar roster final com base no lineup oficial divulgado na quarta

**Arquivos para anexar:** CONTEXT.md, CHANGELOG.md, FRONTEND.md
