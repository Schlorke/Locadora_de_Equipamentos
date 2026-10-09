# w30-18 — equipamentos-scroll

- **Índice:** 18
- **Escopo:** `packages/frontend/src/pages/equipamentos-scroll`
- **Estado:** intermediate

## O que mudou

- Nenhum import legado (`@/components`, `@/hooks`, `@/lib`, nem relativo para
  `components/`/`hooks/` na raiz). O único import de produção aponta para o
  index público do widget `home-cliente` (`EquipmentInfiniteScroll`), já
  conforme FSD.
- Página é `.web` (`EquipamentosScrollPage.web.tsx`); não foi criada tela fina
  em `apps/clients/mobile`.
- Host web fino já existia em
  `apps/clients/web/src/app/equipamentos-scroll/page.tsx` importando
  `@gb-locacoes/frontend/pages/equipamentos-scroll` — nenhuma alteração
  necessária.
- Criado `contrato.migracao.test.ts` (não havia `*.test.ts` no slice; já existia
  apenas `EquipamentosScrollPage.web.test.tsx`).
- Teste de contrato executado com `vitest.platform.config.ts` — passou.
- Resultado anexado ao final de `docs/migration/MIGRATION.md`
  (`## w30-18-equipamentos-scroll`).
- Nenhum arquivo de produção em `packages/` ou `apps/` foi editado; `arch-check`
  / `token-check` não aplicáveis neste passo.

## Exits

- Slice permanece `.web`-only (sem variante universal).
- Host mobile ainda sem rota espelhada (intencional para página `.web`).
- Migração do slice **não** declarada como concluída.
