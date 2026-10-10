# Scripts do workspace

`pnpm db:generate` gera o cliente Prisma e não cria nem migra banco. Migrations
versionadas/revisadas são aplicadas em um alvo próprio e autorizado com
`pnpm exec prisma migrate deploy`. Não usar `db push`.

As leituras operacionais atuais são `pnpm tenant:check`,
`pnpm platform:preflight` e `pnpm tenant:slug-preflight`, cada uma com seu papel
e destino explícitos. Consulte
[manifesto de variáveis](../docs/operations/manifesto-variaveis.md) e
[integração de banco](../docs/guides/ai-database-integration.md). As operações
mantidas em `scripts/ops` exigem o runbook correspondente; não reutilizar
credenciais ou bancos da GB. Serviços hospedados serão definidos depois.

Os antigos scripts avulsos DB/RLS/Supabase e atalhos check:supabase,
diagnose:supabase, supabase:status e fix:rls foram retirados em F. O
[registro integral anterior](../docs/archive/wave135-pre-f/scripts-README.md.source)
preserva as receitas e exemplos antigos, sem torná-los comandos atuais.
