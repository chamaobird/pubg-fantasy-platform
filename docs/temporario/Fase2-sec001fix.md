Aprovado. Pode implementar a correção:

## Implementação

**Migration 0029 — fix oauth_code.user_id type:**

```python
def upgrade():
    op.drop_column('oauth_code', 'user_id')
    op.add_column('oauth_code', sa.Column('user_id', sa.String(36), nullable=False))

def downgrade():
    op.drop_column('oauth_code', 'user_id')
    op.add_column('oauth_code', sa.Column('user_id', sa.Integer(), nullable=False))
```

**Modelo `app/models/oauth_code.py`:**
- Trocar `user_id = Column(Integer, ...)` por `user_id = Column(String(36), nullable=False)`
- Mesmo padrão usado em `feedback.py`, `achievement.py`, `league.py`

**NÃO mexer em `app/routers/auth.py`** — código já correto.

## Workflow

1. Implementar migration + model
2. Build local pra confirmar import limpo:
```powershell
   cd frontend ; npm run build
```
3. Commits atômicos: migration → model → docs
4. Push direto pra main (mesma confiança da SEC-001)
5. Acompanhar logs do Render — esperar `Running upgrade 0028 -> 0029`
6. Atualizar BACKLOG.md adicionando nota no SEC-001 sobre o hotfix
7. Reportar quando estiver verde em prod

Após o deploy verde, o Birdo faz os 3 testes manuais (login Google + reuso do code + verificação no PostHog).