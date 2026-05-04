Ótimo trabalho. Antes de fazer push, **três correções e confirmações**:

## Correção 1 — Não rodar alembic manualmente

Sua proposta de aplicar a migration manualmente em prod antes do push é **desnecessária e cria janela inconsistente**. O Dockerfile do projeto já roda `alembic upgrade head && uvicorn ...` no CMD (foi assim que a migration 0027 do Feedback aplicou sozinha na Sessão A).

A ordem correta é:
1. Push do código (5 commits para main)
2. Render detecta push → faz redeploy automático
3. No startup do novo container: alembic aplica 0028 → uvicorn sobe
4. Migration e código novo entram juntos, atomicamente

Pequena janela de ~30s durante a troca onde requests OAuth podem falhar com 500 — aceitável para o volume atual do XAMA. Documenta isso no resumo de deploy.

## Confirmação 2 — Verificar testes do Dockerfile mentalmente

Confirme lendo o Dockerfile atual:
- O CMD inclui `alembic upgrade head`?
- Se a migration falhar no startup, o container morre antes do uvicorn? (deve ser `&&`, não `;`)

Se algo divergir do esperado, reportar antes do push.

## Confirmação 3 — Smoke test pré-push

Antes do push, rodar localmente (não precisa apontar pra prod, qualquer DB serve, ou pular se não houver DB local):

```powershell
cd frontend
npm run build
```

Reportar:
- Build passa sem erros novos?
- Algum warning novo comparado ao build anterior (Sessão B)?

## Após confirmações

Se as 3 estiverem OK, fazer o push e me reportar:
- Hash do último commit empurrado
- Que o redeploy do Render foi disparado automaticamente

Eu (Birdo) vou acompanhar os logs do Render no painel e confirmar:
- Mensagem do alembic aplicando 0028
- Container subindo verde
- Smoke test do login Google em janela anônima
- Verificação no PostHog que a URL /auth/callback agora mostra ?code= e não ?token=

Não rodar alembic manualmente em hipótese alguma.