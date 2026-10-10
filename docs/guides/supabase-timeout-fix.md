# Diagnosticar indisponibilidade do PostgreSQL

Este procedimento trata a conexão do runtime atual. Não escolhe Supabase como
provedor, ativa um health check agendado ou muda infraestrutura. A antiga
receita que atribuía todo P1001 ao plano Free, indicava upgrade e configurava
cron global está preservada no
[arquivo histórico](../archive/wave135-pre-f/guides/supabase-timeout-fix.md.source).

## Delimitar o erro

1. Registre horário, host API e operação afetada, sem URL de banco, senha, token
   ou dados pessoais. Diferencie erro de conexão, timeout de consulta, limite de
   pool e recusa de isolamento/autorização; o DTO público não deve expor o
   detalhe interno do banco.
2. Confirme o alvo e o papel autorizado pelo
   [manifesto de variáveis](../operations/manifesto-variaveis.md). Não troque
   automaticamente para superuser, dono das tabelas ou banco da GB.
3. Confira o runtime em `packages/backend/src/runtime/database.ts`. Ele lê
   `DATABASE_URL`, cria o pool preguiçosamente e o reutiliza por processo.
   `:6543/` seleciona max 2, `statement_timeout: 0`; fora desse padrão, max 1.
   `connectionTimeoutMillis` é 10000 e `idleTimeoutMillis` é 30000. Esses
   valores descrevem a implementação; não são uma recomendação de alterar
   timeouts ou uma prova de compatibilidade com qualquer pooler.

## Verificar o serviço e o isolamento

O endpoint `/api/health` do host API compõe
`packages/backend/src/http/health.ts` com o runtime e consulta `SELECT 1`.
200/`healthy`/`connected` comprova somente essa consulta; 503 é uma falha a
investigar. Não use uma recusa de sessão ou tenant como indicação de banco fora.

Com o papel runtime próprio e as variáveis explícitas, as leituras
`pnpm tenant:check` e `pnpm tenant:check --platform` verificam as fronteiras
descritas em [ai-database-integration.md](ai-database-integration.md). O
datasource da CLI em `prisma.config.ts` lê `DATABASE_URL`; configurar
`DIRECT_URL` sozinha não muda o alvo de migrations. Estado de migrations e
reparação do schema são separados do readiness do endpoint.

## Reiniciar somente processos próprios

Após corrigir o ambiente do alvo autorizado, encerre somente os filhos que você
iniciou e inicie novamente o host correspondente. `pnpm dev` inicia web e API
pelo workspace; não inicia uma aplicação da raiz aposentada. Se uma saída gerada
do host exigir limpeza, confira o caminho absoluto e a ausência de links antes,
conforme [troubleshooting](../getting-started/troubleshooting.md). A antiga
`.next` da raiz foi retirada em F; as saídas atuais pertencem aos hosts.

## Sem reparo ou agenda automática

O antigo `scripts/diagnose-connection.js` e o `vercel.json` da raiz foram
retirados em F. `apps/services/api/vercel.json` declara somente late-fees,
expire-quotes e outbox; não há cron de keep-alive de `/api/health` nessa fonte.
Não recrie a agenda, faça deploy, aplique grants/RLS avulsos ou execute reset
para obter um diagnóstico verde. Mudança de provedor, plano, rede ou produção
exige a etapa operacional própria e o runbook revisado.
