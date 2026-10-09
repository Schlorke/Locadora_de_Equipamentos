# w30-10 — cookies

- **Índice:** 10
- **Escopo:** `packages/frontend/src/pages/cookies`
- **Estado:** intermediate

## O que mudou

- Nenhum import legado (`@/components`, `@/hooks`, `@/lib` ou relativo saindo
  para `components/` / `hooks/` na raiz) no slice. `CookiesPage.tsx` já importa
  de `../../../shared/ui` e `../../../widgets/contato-empresa` (FSD válido).
- Nenhuma troca de import realizada.
- Página universal (`CookiesPage.tsx`, sem `.web`, sem `next/*` / `react-dom` no
  módulo de produção); tela fina mobile já existia em
  `apps/clients/mobile/src/app/cookies.tsx` — não criada de novo.
- Criado `contrato.migracao.test.ts` (não havia `*.test.ts` no slice; só
  `ui/CookiesPage.test.tsx`). Afirma o export público `CookiesPage` no
  `index.ts`.
- Vitest:
  `pnpm exec vitest run --config vitest.platform.config.ts packages/frontend/src/pages/cookies/contrato.migracao.test.ts`
  — passou (1/1).
- `arch-check` / `token-check` não executados (nenhum arquivo de produção em
  `packages/` ou `apps/` editado).

## Exits / pendências

- Migração do slice não declarada como concluída.
- Conteúdo visual/comportamental da página permanece como está (fora do escopo
  de reescrita de imports).
- Host web (`apps/clients/web`) fora deste worker.
