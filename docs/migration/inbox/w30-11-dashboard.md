# w30-11 — dashboard

- **Índice:** 11
- **Escopo:** `packages/frontend/src/pages/dashboard`
- **Estado:** intermediate

## O que mudou

- Nenhum import legado (`@/components`, `@/hooks`, `@/lib` ou relativo saindo
  para `components/` / `hooks/` na raiz) no slice. Produção já usa
  `@gb-locacoes/ui`, `../model/*`, `./` locais e
  `../../../widgets/graficos-financeiros` (page → widget, FSD válido).
- Nenhuma troca de import realizada.
- Slice **não** é page universal: export público `AdminDashboard` vem de
  `ui/DashboardPage.web.tsx`; módulos de UI importam `next/link` e
  `next/dynamic`. Por isso **não** foi criada tela fina em
  `apps/clients/mobile`.
- Já existem `*.test.ts` no slice (`model/carga.test.ts`, `model/tipos.test.ts`)
  — `contrato.migracao.test.ts` **não** criado (evita duplicar contrato).
- `arch-check` / `token-check` / vitest não executados (nenhum arquivo de
  produção ou teste novo editado/criado).

## Exits / pendências

- Migração do slice não declarada como concluída.
- UI permanece `.web` + Next; eventual variante universal/mobile fica fora deste
  passo.
- Host web (`apps/clients/web/src/app/admin/dashboard/page.tsx`) já consome
  `@gb-locacoes/frontend/pages/dashboard` — fora do escopo de edição deste
  worker.
- Conteúdo visual/comportamental da página permanece como está.
