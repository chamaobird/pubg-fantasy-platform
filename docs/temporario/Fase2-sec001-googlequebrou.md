Login Google quebrou em produção com erro 500. Traceback completo:

```
sqlalchemy.exc.DataError: (psycopg2.errors.InvalidTextRepresentation) invalid input syntax for type integer: "ee1ac850-f41b-487f-bd76-0a663c1b6b5a"
LINE 1: ...S ('LbiQ7GFdaqW1j11BIZMlOgPghtwKd6S70K8dc-_7e7o', 'ee1ac850-...
[SQL: INSERT INTO oauth_code (code, user_id, is_admin, expires_at) VALUES (%(code)s, %(user_id)s, %(is_admin)s, %(expires_at)s) RETURNING oauth_code.created_at]
[parameters: {'code': '...', 'user_id': 'ee1ac850-f41b-487f-bd76-0a663c1b6b5a', 'is_admin': True, ...}]
```

## Causa raiz

A migration 0028 criou `oauth_code.user_id` como INTEGER, mas `User.id` no XAMA é UUID. Erro de schema na minha proposta original (e no meu plano de implementação que não verifiquei). A tabela está vazia (ninguém logou Google ainda) — corrigível sem perda de dados.

## Investigação primeiro (read-only)

Antes de gerar a correção, confirme:

1. **User.id** é qual tipo exato? UUID nativo do Postgres? String? Verifica em `app/models/user.py`.
2. Outras tabelas no projeto que têm FK pra `User.id` — qual tipo de coluna usam? (Procurar por `ForeignKey("user.id")` ou similar). Quero garantir consistência.
3. O modelo `OAuthCode` em `app/models/oauth_code.py` declarou `user_id` como qual tipo Python/SQLAlchemy?

Reporte isso primeiro.

## Plano de correção (após confirmar a investigação)

**Migration 0029 — fix oauth_code.user_id type:**

Como a tabela `oauth_code` está vazia em produção, a migration mais simples é:
```python
def upgrade():
    op.drop_column('oauth_code', 'user_id')
    op.add_column('oauth_code', sa.Column('user_id', <TIPO_CORRETO>, nullable=False))
    # Não precisa de FK — código expira sozinho

def downgrade():
    op.drop_column('oauth_code', 'user_id')
    op.add_column('oauth_code', sa.Column('user_id', sa.Integer(), nullable=False))
```

**Modelo `OAuthCode`:**
- Atualizar `user_id` para o tipo correto correspondente.

**Não tocar em `app/routers/auth.py`** — o código que faz `OAuthCode(..., user_id=user.id, ...)` já está correto, ele só estava sendo bloqueado pelo tipo errado da coluna.

## Critérios de aceite

- [ ] Migration 0029 aplica e reverte limpamente
- [ ] Tipo de `user_id` em `oauth_code` consistente com outras FKs pra User
- [ ] Login Google funciona end-to-end em produção
- [ ] Mesmo `code` reutilizado retorna 400
- [ ] PostHog mostra `?code=` sem JWT na URL

## Workflow

1. Investigação read-only e reporte
2. Aguardar minha confirmação antes de implementar (Birdo)
3. Após aprovar: criar migration + atualizar model + commit + push
4. Acompanhar logs do Render para confirmar `Running upgrade 0028 -> 0029`
5. Smoke test do login Google

Não pule a investigação. Quero confirmar o tipo correto antes de gerar a migration.