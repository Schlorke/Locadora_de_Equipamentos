# w30-17 — equipamentos-admin

- **Índice:** 17
- **Escopo:** `packages/frontend/src/pages/equipamentos-admin`
- **Estado:** intermediate

## O que mudou

1. **Imports legados:** varredura de `@/components`, `@/hooks`, `@/lib` e
   relativos para `components/`/`hooks/` na raiz.
   - `@/lib/utils`, `@/lib/utils/category-helpers` e `@/lib/category-design`
     ainda existem em `lib/` — **não reescritos** (regra: não trocar alvo
     existente).
   - Sem imports `@/components` / `@/hooks` neste slice.
   - Relativos para `widgets/`, `entities/` e `shared/` já estão em FSD; sem
     troca.
2. **Mobile fino:** páginas exportadas (`AdminEquipmentsPage`,
   `NovoEquipamentoPage`, `EquipmentDetailsPage`, `EditarEquipamentoPage`, etc.)
   vêm de módulos `*.web` com `next/*` — **não criar** tela em
   `apps/clients/mobile`.
3. **Teste de contrato:** criado `contrato.migracao.test.ts` (não havia
   `*.test.ts` no slice; só `*.test.tsx` de módulos). Afirma export público
   `AdminEquipmentsPage` via `index.ts`.

## Exits / pendências

- Imports `@/lib/*` ainda dependem da raiz `lib/` (migração futura para
  shared/entity quando o alvo legado for removido).
- Shells web em `apps/clients/web/src/app/admin/equipamentos` (+ `novo`, `[id]`,
  `[id]/editar`) já importam `@gb-locacoes/frontend/pages/equipamentos-admin` —
  **sem ajuste** nesta rodada.
- Resultado anexado em `docs/migration/MIGRATION.md`
  (`## w30-17-equipamentos-admin`).
- Slice permanece web-only; universalização mobile fica fora deste passo.
- Migração do slice **não** está concluída.
