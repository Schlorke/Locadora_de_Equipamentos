# Comandos pnpm para os hosts e o diagnóstico de banco

O `package.json` da raiz coordena o workspace. A raiz aposentada não é um
terceiro host: `pnpm dev` inicia API e web, e `pnpm build` executa os dois
builds de produção. Os scripts dos pacotes donos são a referência para cada
comando; instalar uma dependência na raiz não substitui sua declaração no dono.

## Preparação e validação local

```powershell
pnpm install --frozen-lockfile
pnpm db:generate
pnpm typecheck
pnpm lint
pnpm arch
```

Instalação usa o lock versionado; geração do client não altera schema ou dados.
`pnpm build:web` e `pnpm build:api` produzem os hosts respectivos. Execute as
suítes adequadas à mudança conforme [testing.md](testing.md), com ambiente
neutralizado e banco próprio descartável quando exigido. Não presuma que os
comandos acima certificam F/P2, sessão, navegador, integrações ou produção.

## Banco: preparar alvo e papel antes do comando

As leituras mantidas são `pnpm tenant:check`, `pnpm tenant:check --platform`,
`pnpm platform:preflight` e `pnpm tenant:slug-preflight`. Elas usam,
respectivamente, `TENANT_RUNTIME_DATABASE_URL`, `PLATFORM_RUNTIME_DATABASE_URL`
e `DATABASE_URL`; os detalhes e limites estão no
[guia de diagnóstico](ai-database-integration.md). Não imprima o ambiente.
Migração é operação separada: `pnpm exec prisma migrate deploy` somente para um
alvo explicitamente autorizado, com papel apropriado. Seed/reset e reparos de
grants/RLS não são atalhos de instalação.

## Comandos retirados e registro histórico

`check:supabase`, `diagnose:supabase`, `supabase:status` e os antigos
`scripts/check-supabase-performance.js`/`scripts/supabase-diagnostics.js` foram
retirados em F. Não acrescente esses scripts ou dependências para recriar a
antiga integração automática de IA com o banco. O resumo anterior, inclusive
exemplos de output e comandos Supabase, foi preservado sem alteração no
[arquivo histórico](../archive/wave135-pre-f/guides/pnpm-integration-summary.md.source).
Escolha de serviço externo e implantação permanecem etapas posteriores.
