# w30-29 — pages/orcamento

- **Índice:** 29
- **Escopo:** `packages/frontend/src/pages/orcamento`
- **Estado:** intermediate

## O que mudou

- Import legado `@/lib/utils` (`formatCurrency` em `ui/OrcamentoPage.web.tsx`):
  **não reescrito** — o alvo `lib/utils.ts` ainda existe na raiz.
- Relativos para `lib/utils/validation` (`formatAddress` em
  `ConfirmarEndereco.web.tsx` / `SelecionarEndereco.web.tsx`): fora do critério
  de reescrita (não são `@/components|hooks|lib` nem saída relativa para
  `components/`/`hooks/` na raiz); alvos ainda existem.
- Slice 100% `.web` + imports `next/*` — **não** criada tela fina em
  `apps/clients/mobile`.
- Criado `contrato.migracao.test.ts` (não havia `*.test.ts` no slice; só
  `*.test.tsx`).

## Exits / observações

- Índice público exporta `QuotePageWrapper` e `QuoteForm` a partir de módulos
  `.web`.
- Rota fina web `apps/clients/web/src/app/orcamento/page.tsx` já importa
  `QuotePageWrapper` do index público — **sem ajuste**.
- Há caminhos relativos longos para `lib/` na raiz (validação de endereço) —
  permanecem até migração dedicada de shared/lib.
- `formatCurrency` também existe em `packages/frontend/src/shared/lib`, mas a
  regra impede trocar enquanto `@/lib/utils` resolver.
- Não houve edição de arquivo de produção em `packages/` ou `apps/`;
  `arch-check` / `token-check` não executados.
- Resultado anexado ao final de `docs/migration/MIGRATION.md`
  (`## w30-29-orcamento`).
- Migração do slice **não** declarada concluída.
