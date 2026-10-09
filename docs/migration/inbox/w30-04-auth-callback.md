# w30-04 — pages/auth-callback

- **Índice:** 4
- **Escopo:** `packages/frontend/src/pages/auth-callback`
- **Estado:** intermediate

## O que mudou

- Nenhum import legado (`@/components`, `@/hooks`, `@/lib` ou relativo para a
  raiz) encontrado no slice; nada a reescrever.
- Página universal (`AuthCallbackPage.tsx` sem `.web`, sem `next/*` /
  `react-dom` no módulo da página). Tela fina mobile já existia em
  `apps/clients/mobile/src/app/auth-callback.tsx` — não criada de novo.
- Criado `contrato.migracao.test.ts` (não havia `*.test.ts` no slice; havia
  apenas `AuthCallbackPage.test.tsx`).

## Exits / observações

- `index.ts` reexporta `resolveAuthCallbackRedirect` de `features/entrar` (page
  → feature: permitido FSD).
- Teste de contrato afirma export público `AuthCallbackPage` /
  `AuthCallbackLoading`.
- Sem edição de arquivo de produção em `packages/` ou `apps/` nesta rodada →
  `arch-check` / `token-check` não executados.
- Migração do slice **não** declarada como concluída.
