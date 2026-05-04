SEC-001 validada em produção com sucesso. Os 3 testes passaram:

1. Login Google end-to-end → URL mostra ?code= opaco (verificado: code=62RnOcMwrcnXuH83zWWyMz3kEb0jZE2P9Lujt0wgtWl)
2. Reuso do mesmo code → tela de erro amigável "Falha na autenticação" + botão Tentar novamente
3. PostHog confirma URLs apenas com ?code= em login_completed, Identify e Pageview

Migrations 0028 + 0029 aplicadas em produção. Total de 8 commits da feature + 3 commits do hotfix de tipo.

Ações finais para fechar:

1. Commit final em main: "docs: SEC-001 validada em produção — 3 testes passaram"

2. Atualizar BACKLOG.md:
   - Mover SEC-001 para a seção 🟢 Concluído com data 30/04/2026 e nota:
     "Implementação Opção C (código opaco + POST /auth/exchange-code). Migrations 0028 (criação) + 0029 (hotfix tipo UUID). 3 testes em prod passaram. Hotfix necessário porque a coluna user_id foi inicialmente declarada como INTEGER quando todas as outras FKs do projeto usam String(36) para o User.id em UUID. Lição registrada: ao propor schemas com FK, sempre verificar tipo da coluna referenciada antes de implementar."
   - Manter SEC-002 (JWT 7d sem revogação) e SEC-003 (reset/verify tokens em URL) na seção 🟠 ou 🟡 conforme priorização atual

3. Atualizar CONTEXT.md:
   - Adicionar nota na seção de Auth: "Google OAuth usa fluxo de código opaco temporário (TTL 120s, uso único, persistido em tabela oauth_code). Endpoint POST /auth/exchange-code troca código por JWT. Email/senha continua retornando JWT direto no JSON."
   - Atualizar cadeia de migrations até 0029
   - Próxima migration será 0030

4. Atualizar PROMPT_RETOMADA.md:
   - SEC-001 fechado
   - Próxima sessão prevista: aguardar dados do PostHog (mínimo 5 dias) e iniciar Sessão C (onboarding)
   - Janela de espera é boa para ataques pontuais ao backlog 🟡 se houver tempo