# w30-21 — pages/historico

- **Índice:** 21
- **Escopo:** `packages/frontend/src/pages/historico`
- **Estado:** intermediate

## O que mudou

- Nenhum import legado (`@/components`, `@/hooks`, `@/lib` ou relativo saindo
  para `components/`/`hooks/` na raiz) encontrado no slice; nada a reescrever.
- Slice é page **web-only** (`HistoricoPage.web.tsx` + `next/*` / `next-auth`);
  tela fina mobile **não** criada (regra: se for `.web`, não criar mobile).
- Criado `contrato.migracao.test.ts` (não havia `*.test.ts` no slice; só
  `HistoricoPage.web.test.tsx`). Afirma export público `HistoricoPage` no
  `index.ts`.
- Host web `apps/clients/web/src/app/area-cliente/historico/page.tsx` já
  importava `@gb-locacoes/frontend/pages/historico` — **sem alteração**.
- Resultado anexado em `docs/migration/MIGRATION.md` (`## w30-21-historico`).

## Exits / observações

- Import relativo `../../../features/selo-area-cliente` (page → feature) é
  válido em FSD; mantido.
- Demais imports já usam `@gb-locacoes/ui` ou libs externas.
- Não houve edição de arquivo de produção em `packages/` ou `apps/`;
  `arch-check` / `token-check` não executados.
- Migração do slice **não** declarada concluída.
