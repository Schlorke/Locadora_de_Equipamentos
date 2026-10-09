# w30-26 — pages/logistica

- **Índice:** 26
- **Escopo:** `packages/frontend/src/pages/logistica`
- **Estado:** intermediate

## O que mudou

- Nenhum arquivo de produção alterado no slice nem no host web.
- Import legado encontrado: `@/lib/utils` (`cn`) em `ui/GanttView.web.tsx`. Alvo
  `lib/utils.ts` ainda existe na raiz — regra impede reescrita. Em
  `packages/frontend` / `packages/ui` não há arquivo `utils` único com export de
  `cn` para substituir.
- Demais imports relativos (`../../../widgets/*`, `../model/*`) são FSD válidos
  (page → widget / model interno); não são legados de `components/` ou `hooks/`
  na raiz.
- Página web-only: export público `AdminLogisticsPage` vem de
  `ui/LogisticaPage.web.tsx` — **não** criada tela fina em
  `apps/clients/mobile`.
- Já existem `*.test.ts` no slice (`model/carga.test.ts` e vários `*.test.tsx`)
  — `contrato.migracao.test.ts` **não** criado (evitar duplicata).
- Rota fina web revisada: `apps/clients/web/src/app/admin/logistics/page.tsx` já
  importa `AdminLogisticsPage` de `@gb-locacoes/frontend/pages/logistica` e só
  renderiza o export — sem ajuste necessário.

## Exits / observações

- Pendência: migrar `cn` quando `lib/utils.ts` sair da raiz ou houver substituto
  único exportado por slice/UI.
- Sem edição em `packages/` ou `apps/`; `arch-check` / `token-check` não
  executados.
- Migração do slice **não** declarada concluída.
