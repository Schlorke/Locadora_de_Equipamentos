# Diagnóstico de banco com assistência da IA

O alvo deve ser um PostgreSQL próprio e explicitamente autorizado. A escolha de
provedor cloud, banco hospedado e operação de produção permanece posterior ao
fechamento local da onda 135. Nenhuma conexão herdada da GB é um alvo de teste.

## Preparar o diagnóstico

1. Identifique o banco, o papel e o alcance da leitura antes de executar um
   comando. Entregue credenciais por ambiente; não cole URLs, tokens, dados
   pessoais ou resultados integrais na conversa ou nos logs.
2. Consulte [o manifesto de variáveis](../operations/manifesto-variaveis.md) e
   [a política de isolamento](../architecture/adr-tenant-hosts.md).
3. Gere o client com `pnpm db:generate` quando necessário. Esse comando usa
   `tools/generate-prisma-client.mjs` e não aplica migrations nem cria dados.

## Leituras existentes

| Comando                        | Alvo explícito                  | O que verifica                                                                       |
| ------------------------------ | ------------------------------- | ------------------------------------------------------------------------------------ |
| `pnpm tenant:check`            | `TENANT_RUNTIME_DATABASE_URL`   | Papel runtime, classificação de tabelas e policies/RLS por locadora                  |
| `pnpm tenant:check --platform` | `PLATFORM_RUNTIME_DATABASE_URL` | Fronteira e permissões do papel runtime da plataforma                                |
| `pnpm platform:preflight`      | `PLATFORM_RUNTIME_DATABASE_URL` | Assinaturas, owner, referências de integração, conta de pagamento e slugs reservados |
| `pnpm tenant:slug-preflight`   | `DATABASE_URL`                  | Slugs inválidos ou reservados, em transação somente leitura                          |

As implementações estão em `tools/tenant-database-check.mjs`,
`tools/platform-preflight.mjs` e `tools/tenant-slug-preflight.mjs`. Falha de
conexão ou violação produz exit 1; não é um diagnóstico verde nem motivo para
trocar policies. Resultados podem conter identificadores: compartilhe somente o
recorte necessário e redigido. Essas leituras não provam desempenho geral,
ausência de dados cruzados em cada handler ou prontidão de produção.

## Alterações de schema e dados

O datasource de `prisma.config.ts` lê `DATABASE_URL`; `DIRECT_URL` isolada não
troca esse destino. Migrations revisadas/versionadas são aplicadas com
`pnpm exec prisma migrate deploy` somente ao alvo autorizado. `db push`, reset,
seed, reparo de RLS e grants não são passos de diagnóstico. Consulte
[setup/deploy](../getting-started/deployment.md) e o
[runbook de corte](../operations/runbook-corte-raiz-legada.md) para a etapa
operacional correspondente. O banco das suítes deve ser descartável e próprio,
conforme [testing.md](testing.md).

## Receita anterior preservada

Os antigos `scripts/check-supabase-performance.js` e
`scripts/supabase-diagnostics.js`, com seus atalhos `check:supabase`,
`diagnose:supabase` e `supabase:status`, foram retirados em F. As receitas de
SQL avulso, conexão automática da IA e agenda de monitoramento daquele guia não
foram portadas como operação atual. Seus bytes anteriores estão no
[arquivo histórico](../archive/wave135-pre-f/guides/ai-database-integration.md.source),
para consulta, sem execução. Storage Supabase no backend é uma responsabilidade
separada; sua existência não seleciona o provedor do PostgreSQL.
