# w30-14 — pages/entrar

- **Índice:** 14
- **Escopo:** `packages/frontend/src/pages/entrar`
- **Estado:** intermediate

## O que mudou

- Nenhum import legado (`@/components`, `@/hooks`, `@/lib` ou relativo saindo
  para `components/`/`hooks/` na raiz) encontrado no slice; nada a reescrever.
- Página universal (`EntrarPage.tsx`, sem `.web`, sem `next/*` / `react-dom` no
  módulo de produção); tela fina mobile já existia em
  `apps/clients/mobile/src/app/entrar.tsx` — não criada de novo.
- Criado `contrato.migracao.test.ts` (não havia `*.test.ts` no slice; só
  `EntrarPage.test.tsx`).

## Exits / observações

- Imports atuais apontam para `features/entrar` e `shared/ui` via caminhos
  relativos FSD válidos (page → feature / shared).
- Não houve edição de arquivo de produção em `packages/` ou `apps/`;
  `arch-check` / `token-check` não executados.
- Migração do slice **não** declarada concluída.
