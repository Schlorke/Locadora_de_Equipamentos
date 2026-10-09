# w30-24 — locacoes

- **Índice:** 24
- **Escopo:** `packages/frontend/src/pages/locacoes`
- **Estado:** intermediate

## O que mudou

- Imports legados (`@/components`, `@/hooks`, `@/lib`, relativos para
  `components/`/`hooks/` na raiz): nenhum encontrado nos fontes de produção
  (`index.ts`, `model/carga.ts`, `model/tipos.ts`, `ui/LocacoesPage.web.tsx`,
  `ui/Tabela.web.tsx`, `ui/Dialogo.web.tsx`, `ui/formatar.tsx`). Imports já
  apontam para widgets FSD (`widgets/cabecalho-admin`, `widgets/cartao-admin`,
  `widgets/calendario`), `@gb-locacoes/ui` e módulos internos do slice.
- Nenhuma troca de import realizada.
- Arquivos protegidos do carrossel 3D / service worker: não tocados.
- Página **não** universal: export público `AdminRentalsPage` vem de
  `./ui/LocacoesPage.web` — tela fina mobile **não** criada (regra: se for
  `.web`, não criar mobile).
- `contrato.migracao.test.ts` **não** criado: o slice já possui
  `model/carga.test.ts`, `model/tipos.test.ts` e `ui/formatar.test.ts`
  (`*.test.ts`) — não duplicar.
- Sem edição de arquivo de produção em `packages/` ou `apps/` nesta rodada →
  `arch-check` / `token-check` não executados.
- Vitest do slice não reexecutado (nenhum teste novo).

## Exits / notas

- Nenhum rewrite de import necessário.
- Sem violação FSD a anotar neste slice (imports de page → widgets são
  permitidos).
- Host web verificado: `apps/clients/web/src/app/admin/rentals/page.tsx` já
  importa `AdminRentalsPage` de `@gb-locacoes/frontend/pages/locacoes` — sem
  ajuste.
- Resultado anexado em `docs/migration/MIGRATION.md` (`## w30-24-locacoes`).
- Migração do slice **não** declarada como concluída.
