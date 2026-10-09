# w30-15 — widgets/cartao-admin

- **Índice:** 15
- **Escopo:** `packages/frontend/src/widgets/cartao-admin`
- **Estado:** intermediate

## O que mudou

- Nenhum import legado (`@/components`, `@/hooks`, `@/lib` ou relativo saindo
  para `components/`/`hooks/` na raiz) encontrado no slice; nada a reescrever.
  Imports atuais usam `@gb-locacoes/ui`, `clsx`, `tailwind-merge` e `react`.
- Slice é **widget**, não page universal — tela fina mobile em
  `apps/clients/mobile/src/app` não se aplica; não criada.
- Criado `contrato.migracao.test.ts` (não havia `*.test.ts` no slice; só
  `ui/Cartao.test.tsx`).

## Exits / observações

- Index público já exporta `AdminCard` e `AdminCardProps` de `./ui/Cartao`.
- Host web (`apps/clients/web/src/app`): sem rota fina — widget consumido por
  pages, não é page universal.
- Resultado anexado ao final de `docs/migration/MIGRATION.md`
  (`## w30-15-cartao-admin`).
- Não houve edição de arquivo de produção em `packages/` ou `apps/`;
  `arch-check` / `token-check` não executados.
- Migração do slice **não** declarada concluída.
