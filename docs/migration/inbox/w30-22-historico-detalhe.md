# w30-22 — pages/historico-detalhe

- **Índice:** 22
- **Escopo:** `packages/frontend/src/pages/historico-detalhe`
- **Estado:** intermediate

## O que mudou

- Nenhum import legado (`@/components`, `@/hooks`, `@/lib` ou relativo saindo
  para `components/`/`hooks/` na raiz) elegível a reescrita no slice.
- Observado import relativo `../../../../../../lib/utils` em
  `ui/HistoricoDetalhePage.web.tsx` (símbolos `parseAdjustmentBlocks`,
  `ADJUSTMENT_CATEGORY_LABELS`). Alvo `lib/utils.ts` **ainda existe** (reexporta
  de `entities/orcamento`); regra: não reescrever. Anotado que o index público
  de `entities/orcamento` já exporta os mesmos símbolos — candidato futuro, fora
  da regra “só se alvo não existe”.
- Slice é page **web-only** (`HistoricoDetalhePage.web.tsx`,
  `AcoesLocacao.web.tsx`, `LinhaDoTempo.web.tsx` + `next/*` / `next-auth`); tela
  fina mobile **não** criada.
- Criado `contrato.migracao.test.ts` (não havia `*.test.ts` no slice; só
  `*.web.test.tsx`). Afirma export público `RentalDetailsPage` no `index.ts`.

## Exits / observações

- Imports FSD já presentes e mantidos: `../../../features/selo-area-cliente`,
  `../../../features/bloco-preco`, `../../../entities/configuracao` (page →
  feature/entity válidos).
- `RentalTimeline` / `LinhaDoTempo.web` não está no index público (só uso
  interno); `RentalActions` e `RentalDetailsPage` sim.
- Não houve edição de arquivo de produção em `packages/` ou `apps/` (rota fina
  web já correta); `arch-check` / `token-check` não executados.
- Resultado anexado ao final de `docs/migration/MIGRATION.md` (seção
  `w30-22-historico-detalhe`).
- Migração do slice **não** declarada concluída.
