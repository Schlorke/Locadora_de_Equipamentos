# w30-28 — pages/notificacoes

- **Índice:** 28
- **Escopo:** `packages/frontend/src/pages/notificacoes`
- **Estado:** intermediate

## O que mudou

- Varredura de imports legados (`@/components`, `@/hooks`, `@/lib`, relativos
  para `components/` ou `hooks/` na raiz): nenhum encontrado; imports já apontam
  para FSD (`features/notificacoes`, `features/selo-area-cliente`, `shared/lib`,
  `@gb-locacoes/ui`) e `next/link`.
- Página é **web-only** (`NotificacoesPage.web.tsx` + `next/link`): não criada
  tela fina em `apps/clients/mobile`.
- Criado `contrato.migracao.test.ts` (não havia `*.test.ts` no slice; já existia
  `NotificacoesPage.web.test.tsx` com outro foco).
- Host web `apps/clients/web/src/app/area-cliente/notificacoes/page.tsx` já
  importa `@gb-locacoes/frontend/pages/notificacoes` — **sem ajuste**.
- Resultado anexado ao final de `docs/migration/MIGRATION.md`
  (`w30-28-notificacoes`).
- Nenhum arquivo de produção em `packages/` ou `apps/` foi editado nesta rodada
  → `arch-check` / `token-check` não executados.

## Exits

- Imports legados: nenhum a reescrever.
- Rota fina web: ok (já existia).
- Mobile: não aplicável (export `.web`).
- Contrato de migração: adicionado; `vitest` (platform config) no arquivo — 1
  passed.
- Migração do slice **não** declarada como concluída.
