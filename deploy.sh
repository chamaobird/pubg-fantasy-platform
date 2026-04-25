#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Build, commit, push e deploy completo
#
# Uso:
#   ./deploy.sh "mensagem do commit"
#
# O que faz:
#   1. Build do frontend (vite build)
#   2. git add + commit + push
#   3. Aciona deploy manual no Render (backend + frontend)
#      via deploy hooks (só necessário se auto-deploy estiver desligado)
#
# Configuração dos deploy hooks (primeira vez):
#   No Render: Dashboard → serviço → Settings → Deploy Hook → copiar URL
#   Cole as URLs nas variáveis abaixo OU crie um arquivo .env.deploy:
#     RENDER_HOOK_BACKEND=https://api.render.com/deploy/srv-xxx?key=yyy
#     RENDER_HOOK_FRONTEND=https://api.render.com/deploy/srv-xxx?key=yyy
# =============================================================================

set -e

# ── Cores ──────────────��───────────────────────────���───────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $1"; }
info() { echo -e "${BLUE}→${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }

# ── Argumentos ─────────────────────────────────────────────────────────────
COMMIT_MSG="${1:-}"
if [ -z "$COMMIT_MSG" ]; then
  echo -e "${RED}Uso:${NC} ./deploy.sh \"mensagem do commit\""
  exit 1
fi

# ── Carrega deploy hooks (opcional) ────────────────────────────────────────
if [ -f ".env.deploy" ]; then
  source .env.deploy
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

echo ""
echo "════════════════════���══════════════════"
echo "  DEPLOY — XAMA Fantasy Platform"
echo "═══════════════════════════════════════"
echo ""

# ── 1. Build do frontend ────────────────────────────────��──────────────────
info "Buildando frontend..."
cd "$REPO_ROOT/frontend"
npm run build > /dev/null 2>&1 && ok "Frontend buildado" || fail "Falha no build do frontend"
cd "$REPO_ROOT"

# ── 2. Git: staging, commit, push ─────────────────────────────────────────
info "Verificando mudanças..."
if git diff --quiet && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
  warn "Nenhuma mudança para commitar — só fazendo push"
else
  info "Adicionando arquivos..."
  # Adiciona tudo exceto arquivos sensíveis
  git add -A
  git reset HEAD .env .env.* .env.deploy 2>/dev/null || true

  info "Commitando: \"$COMMIT_MSG\""
  git commit -m "$COMMIT_MSG

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>" || warn "Nada novo para commitar"
fi

info "Fazendo push..."
git push origin main && ok "Push concluído" || fail "Falha no push"

# ── 3. Aciona deploy manual no Render (se hooks configurados) ─────────────
if [ -n "$RENDER_HOOK_BACKEND" ] || [ -n "$RENDER_HOOK_FRONTEND" ]; then
  echo ""
  info "Acionando deploys no Render..."

  if [ -n "$RENDER_HOOK_BACKEND" ]; then
    curl -s "$RENDER_HOOK_BACKEND" > /dev/null && ok "Deploy backend acionado"
  fi

  if [ -n "$RENDER_HOOK_FRONTEND" ]; then
    curl -s "$RENDER_HOOK_FRONTEND" > /dev/null && ok "Deploy frontend acionado"
  fi
else
  echo ""
  warn "Deploy hooks não configurados — usando auto-deploy do Render (push já foi feito)"
  warn "Para configurar hooks: veja instruções no topo deste arquivo"
fi

# ── 4. URLs de monitoramento ───────────────────────────────────────────────
echo ""
echo "══════════════════════════��════════════"
ok "Deploy em andamento!"
echo ""
echo "  Backend:  https://pubg-fantasy-platform.onrender.com"
echo "  Frontend: https://pubg-fantasy-frontend.onrender.com"
echo "  Render:   https://dashboard.render.com"
echo "═══════════════════════════════════════"
echo ""
