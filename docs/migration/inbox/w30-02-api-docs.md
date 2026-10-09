# w30-02 — api-docs

- **Índice:** 2
- **Escopo:** `packages/frontend/src/pages/api-docs`
- **Estado:** intermediate

## O que mudou

- Nenhum import legado (`@/components`, `@/hooks`, `@/lib` ou relativo saindo
  para a raiz) encontrado no slice; `ApiDocsPage.tsx` já importa de `shared/ui`.
- Nenhuma troca de import realizada (nada a migrar sem violar regras).
- Página universal (`ApiDocsPage.tsx`, sem `next/*` / `react-dom` no módulo de
  produção); tela fina mobile já existia em
  `apps/clients/mobile/src/app/api-docs.tsx` — não criada de novo.
- Criado `contrato.migracao.test.ts` (não havia `*.test.ts` no slice; só
  `ApiDocsPage.test.tsx`). Afirma o export público `ApiDocsPage` no `index.ts`.
- Vitest:
  `pnpm exec vitest run --config vitest.platform.config.ts packages/frontend/src/pages/api-docs/contrato.migracao.test.ts`
  — passou (1/1).
- `arch-check` / `token-check` não executados (nenhum arquivo de produção em
  `packages/` ou `apps/` editado).

## Exits / pendências

- Migração do slice não declarada como concluída.
- Conteúdo visual/comportamental da página permanece como está (fora do escopo
  de reescrita de imports).
- Host web (`apps/clients/web`) fora deste worker.
