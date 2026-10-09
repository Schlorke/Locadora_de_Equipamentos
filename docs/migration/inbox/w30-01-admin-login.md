# w30-01 — admin-login

- **Índice:** 1
- **Escopo:** `packages/frontend/src/pages/admin-login`
- **Estado:** intermediate

## O que mudou

- Nenhum import legado (`@/components`, `@/hooks`, `@/lib` ou relativo saindo
  para a raiz) encontrado no slice; nada reescrito.
- Página universal (`AdminLoginPage` sem `.web`, sem `next/*` / `react-dom` no
  módulo de produção). Tela fina mobile já existia em
  `apps/clients/mobile/src/app/admin-login.tsx` — não criada de novo.
- Criado `contrato.migracao.test.ts` (não havia `*.test.ts` no slice; só
  `AdminLoginPage.test.tsx`): lê o `index.ts` e afirma export público
  `AdminLoginPage`.
- Sem edição de arquivo de produção em `packages/` ou `apps/` → `arch-check` /
  `token-check` não executados.

## Exits

- Vitest:
  `pnpm exec vitest run --config vitest.platform.config.ts packages/frontend/src/pages/admin-login/contrato.migracao.test.ts`
  → **1 passed** (exit 0).

## Não concluído

Migração do slice não declarada como concluída; apenas contrato de índice e
verificação de imports/mobile.
