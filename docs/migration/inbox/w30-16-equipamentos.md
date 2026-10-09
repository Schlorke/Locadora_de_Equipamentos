# w30-16 — equipamentos

- **Índice:** 16
- **Escopo:** `packages/frontend/src/pages/equipamentos`
- **Estado:** intermediate

## O que mudou

- Nenhum import legado (`@/components`, `@/hooks`, `@/lib` ou relativo saindo
  para `components/` / `hooks/` na raiz) no slice. `EquipamentosPage.tsx` já
  importa de `../../../shared/ui` e `../../../entities/equipamento` (FSD válido:
  page → entities/shared).
- Nenhuma troca de import legado no corpo da page. Arquivos protegidos do
  carrossel 3D não tocados.
- Página universal (`EquipamentosPage.tsx`, sem `.web`, sem `next/*` /
  `react-dom` no módulo de produção). Criada tela fina mobile em
  `apps/clients/mobile/src/app/equipamentos.tsx`.
- Rota fina web `apps/clients/web/src/app/equipamentos/page.tsx` alinhada aos
  adaptadores da raiz: `AdminFilterCard`, `SmartPagination`, `CategoryBadge`
  (reexportados no `index.ts` público do slice + `@gb-locacoes/ui`), sem
  deep-import de `packages/`.
- Criado `contrato.migracao.test.ts` (não havia `*.test.ts` no slice; havia só
  `ui/EquipamentosPage.test.tsx`). Afirma o export público `EquipamentosPage` no
  `index.ts`.
- Vitest: passou (1/1). `arch-check`: pass após correção dos adapters.
  `token-check`: crash de ferramenta (fora do escopo).
- Resultado anexado ao final de `docs/migration/MIGRATION.md`.

## Anotações (sem troca)

- `index.ts` já reexportava helpers de `entities/equipamento`; agora também
  reexporta `AdminFilterCard` e `CategoryBadge` para o host web (padrão
  semelhante a `pages/sobre`).

## Exits

| Comando                                                                                                                      | Exit | Notas                                                         |
| ---------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------- |
| `pnpm exec vitest run --config vitest.platform.config.ts packages/frontend/src/pages/equipamentos/contrato.migracao.test.ts` | 0    | contrato                                                      |
| `node tools/arch-check.mjs`                                                                                                  | 0    | após wiring via entry público                                 |
| `node tools/token-check.mjs`                                                                                                 | 1    | crash `TypeError` em `tools/token-check.mjs` — fora do escopo |

## Pendências

- Migração do slice **não** declarada como concluída.
- `app/equipamentos/page.tsx` na raiz permanece (dono paralelo).
- Adaptadores mobile de filtro/paginação/badge ainda stubs (`null`).
