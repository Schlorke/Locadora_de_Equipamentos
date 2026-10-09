# w30-25 — pages/login

- **Índice:** 25
- **Escopo:** `packages/frontend/src/pages/login`
- **Estado:** intermediate

## O que mudou

- Nenhum import legado (`@/components`, `@/hooks`, `@/lib` ou relativo saindo
  para `components/`/`hooks/` na raiz) encontrado no slice; nada a reescrever.
- Página universal (`LoginPage.tsx`, sem `.web`, sem `next/*` / `react-dom` no
  módulo de produção); tela fina mobile já existia em
  `apps/clients/mobile/src/app/login.tsx` — não criada de novo.
- Criado `contrato.migracao.test.ts` (não havia `*.test.ts` no slice; só
  `LoginPage.test.tsx`). Teste passou com `vitest.platform.config.ts`.
- Host web revisado: `apps/clients/web/src/app/login/page.tsx` já importa
  `LoginPage` de `@gb-locacoes/frontend/pages/login` — sem ajuste.
- Anexo em `docs/migration/MIGRATION.md` (seção `w30-25-login`).

## Exits / observações

- Imports atuais apontam para `features/entrar` e `shared/ui` via caminhos
  relativos FSD válidos (page → feature / shared).
- Adapters next-auth (`signIn`/`getSession`/sociais) permanecem em
  `app/login/page.tsx` na raiz (dono paralelo conhecido).
- Não houve edição de arquivo de produção em `packages/` ou `apps/`;
  `arch-check` / `token-check` não executados.
- Migração do slice **não** declarada concluída.
