Vamos atacar o **SEC-001** do BACKLOG: refatorar o OAuth callback para não expor JWT na URL.

A direção escolhida é a **Opção C — código opaco temporário + troca via POST**. Mas antes de implementar, preciso de uma fase de investigação read-only.

## Contexto do problema

Capturado nos eventos do PostHog ontem: o JWT está aparecendo em URLs como `/auth/callback?token=eyJhbGc...`. Isso vaza em:
- PostHog events (já confirmado)
- Browser history
- Render request logs
- Referer headers para qualquer request cross-origin
- Session replays (PostHog grava DOM)

## Fase 1 — Investigação (NÃO modificar nada)

Reporte os seguintes pontos:

1. **Tempo de expiração atual do JWT**
   - Onde está configurado? (variável de ambiente, constante, settings.py?)
   - Qual o valor atual (em minutos/horas)?
   - É o mesmo para Google OAuth e login email/senha?

2. **Onde o JWT é exposto na URL hoje**
   - Endpoint do Google OAuth callback no backend (qual arquivo, qual rota)
   - Trecho exato onde o redirect com `?token=...` é construído
   - Login email/senha: o JWT também trafega via URL em algum momento? (signup, reset password, verify email, etc.)
   - Reset password e email verification também usam tokens em query string? (vale verificar e reportar)

3. **Como o frontend consome o JWT hoje**
   - Em `auth/callback`, qual componente lê o `token` da URL?
   - Como salva (localStorage com key `wf_token`, conforme CONTEXT)?
   - Como o restante do app autentica requests (Authorization header via axios interceptor)?

4. **Estado atual da rota /auth/callback**
   - Há alguma proteção contra replay (token único, nonce, state)?
   - O que acontece se a URL for visitada duas vezes com o mesmo token?

5. **Schema de Auth no backend**
   - Há alguma tabela/modelo de `auth_code`, `oauth_session`, `pending_auth`, ou similar?
   - Há tabela de refresh_token?

6. **Deps de segurança**
   - O backend tem alguma lib de geração de tokens seguros instalada? (`secrets` do stdlib basta, mas vale checar se há algo já em uso)

NÃO implemente nada ainda. Apenas reporte. Com esses dados, o Birdo decide os parâmetros finais (tempo de expiração do código opaco, tabela vs. cache em memória, escopo da refatoração: só Google OAuth ou também email verification/password reset).