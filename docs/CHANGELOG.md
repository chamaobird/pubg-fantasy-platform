# CHANGELOG — XAMA Fantasy

## [Unreleased] — novo schema em desenvolvimento

## [1.x] — fase de aprendizado (Jan-Abr 2026)
### Aprendizados chave
- Torneios oficiais (PGS) usam shard pc-tournament; scrims/PAS usam steam
- Nomes de jogadores no steam podem mudar entre semanas — necessidade de resolucao de identidade
- Match UUID e unico globalmente no DB — nao pode existir em dois torneios simultaneamente
- Controle de abertura/fechamento de lineup precisa ser automatizado com override manual
- Pricing precisa ser configurado por campeonato antes de abrir lineup para usuarios
- Um mesmo jogador real pode ter multiplas contas e aliases ao longo do tempo

### Principais fixes aplicados
- fix: import match por torneio (nao pular se ja existe em outro torneio)
- fix: reprocess-match-stats aceita shard como parametro
- feat: endpoint para mover match entre torneios
- fix: historical.py — match existence check scoped por tournament_id
- feat: shard parameter support em reprocess-match-stats
