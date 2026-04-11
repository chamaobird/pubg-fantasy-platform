# BACKLOG — XAMA Fantasy

## 🟡 Próximas tarefas (priorizadas)

### UX — Landing/Auth
- [ ] #UX-01 Background temático voltado para fantasy league (não só PUBG raw)
- [ ] #UX-02 Formulário de auth centralizado flutuante (não colado à direita)
- [ ] #UX-03 Título explícito dentro do card (ENTRAR / CADASTRAR)
- [ ] #UX-04 Campo de confirmação de senha no cadastro
- [ ] #UX-06 Stats da landing (262+ jogadores etc.) — repensar copy e posicionamento

### UX — Dashboard
- [ ] #UX-07 Usuário sem username aparece como "JOGADOR" — usar prefixo do email como fallback
- [ ] #UX-08 Adicionar datas dos eventos (início e fim para encerrados, próximos dias para futuros)
- [ ] #UX-09 Nos stages encerrados com resultados, exibir nº de dias e nº de partidas
- [ ] #UX-10 Badge short_name (PGS3GF etc.) muito proeminente — remover ou tornar mais sutil

### UX — Championships
- [ ] #UX-11 Logo do campeonato no lugar do badge PUB ID
- [ ] #UX-12 Datas e nº de partidas por stage
- [ ] #UX-13 Ordenar stages do mais recente para o mais antigo

### Infra — pendente domínio
- [ ] #120 Desabilitar click tracking do Resend (disponível após domínio verificado) — já tem domínio, executar
- [ ] #121 BIMI record DNS para ícone do remetente no email (opcional, cosmético)

### Pricing — Bloco C
- [ ] #101 Job de polling de partidas ao vivo
- [ ] #103 Suporte a upload de jogadores via planilha CSV

### Auth
- [ ] #013b Google OAuth em produção — aguardando propagação DNS ✅ RESOLVIDO — verificar se ainda pendente

## 🟢 Concluído

### Sessão de UX + Auth (10/04/2026)
- [x] BUG-01 Mensagens de erro em inglês no formulário → traduzidas para PT-BR
- [x] BUG-02 Sem caminho para reenvio de verificação → link "Reenviar verificação" no erro
- [x] BUG-03 Google OAuth "Not Found" em produção → corrigido via BACKEND_URL + redirect flow
- [x] BUG-04 Sem fluxo de recuperação de senha → forgot/reset password completo implementado
- [x] BUG-05 Botão "Salvar Username" desabilitado para usuários Google → corrigido
- [x] BUG-06 Campo email vazio para usuários Google → corrigido via has_password no UserResponse
- [x] UX-05 Links "Já tem conta? Entrar" e "Não tem conta? Cadastre-se" → implementados
- [x] UX-14 Validação de username duplicado no perfil → mensagem de erro no save
- [x] UX-15 Tipografia pequena no Perfil → aumentada para padrão das outras páginas
- [x] UX-16 Hint "Aparece no leaderboard..." com contraste muito baixo → aumentado
- [x] Email verification link apontava para frontend → corrigido para backend
- [x] Templates de email on-brand → fundo escuro, identidade XAMA completa
- [x] Domínio chamaobird.xyz verificado no Resend → emails para qualquer destinatário
- [x] DMARC configurado no DNS do chamaobird.xyz
- [x] Migration 0009 — password_reset_token + password_reset_expires_at
- [x] AuthCallback.jsx criado para receber token do Google OAuth
- [x] ResetPasswordPage.jsx criado

### Fase 0–9 + Blocos A e B (ver histórico anterior)
- [x] Fases 1–9 completas — ver CONTEXT.md para detalhes
- [x] Bloco A — Populate PGS 2026
- [x] Bloco B — Pricing refatorado
