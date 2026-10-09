# w30-19 — financeiro

- **Índice:** 19
- **Escopo:** `packages/frontend/src/pages/financeiro`
- **Estado:** intermediate

## O que mudou

- Nenhum import `@/components`, `@/hooks` ou `@/lib`, nem relativo saindo para
  `components/`/`hooks/` na raiz.
- Há imports relativos que saem do monorepo para `lib/` na raiz
  (`lib/utils/formatting`, `lib/utils`, `lib/utils/validation`) em
  `FinanceiroPage.web.tsx`, `Filtro.web.tsx`, `Tabela.web.tsx`,
  `Detalhe.web.tsx` e `detalhe.web.ts`. **Não reescritos**: os alvos ainda
  existem; não há basename único correspondente em `packages/frontend` ou
  `packages/ui` com export público de slice.
- Página é `.web` (`FinanceiroPage.web.tsx` + modelos com `next/navigation`);
  não foi criada tela fina em `apps/clients/mobile`.
- Já existem `*.test.ts` no slice (`model/carga.web.test.ts`,
  `model/detalhe.web.test.ts`, `model/tipos.test.ts` e vários `*.test.tsx`);
  **não** criado `contrato.migracao.test.ts` (evitar duplicata).
- Nenhum arquivo de produção em `packages/` ou `apps/` editado; `arch-check` /
  `token-check` não aplicáveis neste passo.
- Host web fino já consome o index público:
  `apps/clients/web/src/app/admin/financeiro/page.tsx` →
  `AdminFinanceiroPageWrapper` (confirmado na revalidação; sem ajuste
  necessário).
- Resultado anexado em `docs/migration/MIGRATION.md` (`## w30-19-financeiro`).

## Exits

- Dependência residual de `lib/` na raiz (formatting / utils / validation) até
  haver módulo canônico nos packages.
- Slice permanece `.web`-only (sem variante universal / mobile).
- Migração do slice **não** declarada como concluída.
