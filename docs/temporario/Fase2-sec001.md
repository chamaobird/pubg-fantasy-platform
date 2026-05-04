Relatório aprovado, com **um ajuste importante** e **algumas perguntas** antes de implementar.

## Ajuste crítico — não usar dict em memória

Sua proposta de guardar `{code: jwt}` em memória **vai falhar em produção** por três motivos:

1. Render Free tier hiberna após 15 min sem tráfego — dict zera no wakeup
2. Se um dia o `WEB_CONCURRENCY` for >1, cada worker tem seu próprio dict (race conditions intermitentes)
3. Usuário com latência alta pode estourar TTL durante o redirect

**Use uma tabela no Postgres em vez disso.** Crie migration `0028_oauth_code` com:

```
oauth_code (
  code        VARCHAR(64) PRIMARY KEY,
  user_id     INTEGER NOT NULL,
  is_admin    BOOLEAN NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
```

Sem FK pra user nesse caso (mantém leve, e se o user for deletado o código simplesmente expira sozinho). Index implícito do PRIMARY KEY já basta.

## Perguntas antes de prosseguir

1. **Testes existentes:** há testes automatizados cobrindo o fluxo de OAuth ou auth em geral? Se sim, listar quais arquivos. Se não, registrar que o teste vai ser manual.

2. **Cleanup de códigos expirados:** prefiro estratégia simples — no próprio `POST /auth/exchange-code`, antes de buscar o código, rodar `DELETE FROM oauth_code WHERE expires_at < NOW()`. Cleanup oportunístico, sem cron job. Confirma que isso encaixa bem na arquitetura síncrona atual?

3. **TTL:** 90 segundos é razoável, mas vamos para **120 segundos**. Margem extra pra usuário com rede ruim e zero impacto de segurança.

## Especificação final da implementação

### Backend

**Migration `0028_oauth_code`:**
- Tabela conforme schema acima
- Reversível (down migration faz DROP TABLE)

**`app/models/oauth_code.py`:**
- Modelo SQLAlchemy seguindo padrão dos outros (síncrono, snake_case)

**`app/routers/auth.py` — função `google_callback`:**
- Em vez de redirect com `?token=`, gerar:
```python
  code = secrets.token_urlsafe(32)
  expires_at = datetime.now(timezone.utc) + timedelta(seconds=120)
  db.add(OAuthCode(code=code, user_id=user.id, is_admin=user.is_admin, expires_at=expires_at))
  db.commit()
  return RedirectResponse(f"{settings.FRONTEND_URL}/auth/callback?code={code}")
```

**Novo endpoint `POST /auth/exchange-code`:**
- Body: `{ "code": str }`
- Lógica:
  1. Cleanup oportunístico: `DELETE FROM oauth_code WHERE expires_at < NOW()`
  2. SELECT do código
  3. Se não existe ou expirou: 400 com mensagem genérica ("invalid or expired code") — sem distinguir os casos pra não dar pista a atacante
  4. Se existe e válido: gerar JWT com `create_access_token(user_id, is_admin)`, **DELETAR o código** (uso único), retornar `{ "access_token": str, "token_type": "bearer" }`
- Rate limit razoável (ex: 10/min por IP via slowapi, mesmo padrão do feedback endpoint)

### Frontend

**`src/pages/AuthCallback.jsx`:**
- Ler `code` em vez de `token` da query string
- POST para `/auth/exchange-code` com `{ code }`
- Resposta 200: salvar `access_token` em localStorage (`wf_token`), seguir fluxo atual de identify+navigate
- Resposta 400 (código inválido/expirado): mostrar mensagem amigável e botão "Tentar novamente" que redireciona pra `/`
- Tratamento de erro de rede: retry automático 1 vez antes de mostrar erro

### Critérios de aceite

- [ ] Migration `0028` aplica e reverte limpamente
- [ ] Login Google em produção funciona end-to-end (email novo + email já cadastrado)
- [ ] URL após callback NÃO contém JWT — só `?code=` opaco curto
- [ ] PostHog confirma que `Pageview` em `/auth/callback` mostra apenas `?code=...`, sem JWT
- [ ] Tentar usar mesmo `code` duas vezes retorna 400
- [ ] Esperar 121s antes de trocar retorna 400
- [ ] `localStorage.wf_token` continua sendo populado corretamente
- [ ] Login email/senha continua funcionando (não foi tocado)
- [ ] Build do Vite sem warnings novos

### Workflow

1. Antes de codificar, responder as 3 perguntas acima
2. Commits atômicos: migration → model → backend endpoint → frontend → docs
3. Atualizar `BACKLOG.md` movendo SEC-001 para 🟢, adicionar `SEC-002` (JWT longo sem revogação) e `SEC-003` (reset/verify tokens em URL)
4. Atualizar `CONTEXT.md` com nova rota `/auth/exchange-code` e fluxo OAuth atualizado
5. Atualizar `PROMPT_RETOMADA.md`

Pode começar pelas 3 perguntas e aguardar resposta antes de implementar.