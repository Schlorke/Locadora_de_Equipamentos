# w30-06 — catalog

- **Índice:** 6
- **Escopo:** `packages/frontend/src/pages/catalog`
- **Estado:** intermediate

## O que mudou

- Nenhum import legado (`@/components`, `@/hooks`, `@/lib` ou relativo saindo
  para `components/` / `hooks/` na raiz) encontrado no slice; `CatalogPage.tsx`
  já importa de `shared/ui`.
- Nenhuma troca de import realizada.
- Página universal (`CatalogPage.tsx`, sem `.web`, sem `next/*` / `react-dom` no
  módulo); tela fina mobile já existia em
  `apps/clients/mobile/src/app/catalog.tsx` — não criada de novo.
- Criado `contrato.migracao.test.ts` (não havia `*.test.ts` / `*.test.tsx` no
  slice). Afirma o export público `CatalogPage` no `index.ts`.
- Vitest:
  `pnpm exec vitest run --config vitest.platform.config.ts packages/frontend/src/pages/catalog/contrato.migracao.test.ts`
  — passou (1/1).
- `arch-check` / `token-check` não executados (nenhum arquivo de produção em
  `packages/` ou `apps/` editado).

## Exits / pendências

- Migração do slice não declarada como concluída.
- Host web (`apps/clients/web`) fora deste worker.
- `ui/CatalogPage.tsx` parece ter JSX incompleto na seção `Label` (mapa sem
  abertura); fora do escopo de imports — não corrigido neste worker.
