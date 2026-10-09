# w30-07-categorias

## Índice

7

## Escopo

`packages/frontend/src/pages/categorias`

## Estado

intermediate

## O que mudou

- Nenhum import de produção alterado: os alvos `@/lib/category-design`,
  `@/lib/constants/all-icons`, `@/lib/utils`, `@/lib/icon-utils` e
  `@/lib/utils/category-helpers` ainda existem na raiz (`lib/`), então a regra
  impede reescrita.
- Tela mobile fina **não** criada: o export público (`AdminCategoriesPage`,
  diálogos) vem de módulos `.web.tsx`.
- Criado `contrato.migracao.test.ts` (não havia `*.test.ts` no slice; os testes
  existentes são `*.web.test.tsx` e cobrem invariantes de UI, não o contrato do
  index).

## Anotações (sem troca)

- Imports legados `@/lib/*` permanecem de propósito enquanto os arquivos na raiz
  existirem.
- `index.ts` reexporta `useEmojiRecents` / `useIconRecents` de
  `../../widgets/personalizar-icone` (page → widget / possível violação FSD de
  reexport cross-slice); não alterado neste worker.
- Não há imports relativos saindo para `components/` ou `hooks/` na raiz.

## Exits

| Comando                                                                                                                    | Exit | Notas                                            |
| -------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------ |
| `pnpm exec vitest run --config vitest.platform.config.ts packages/frontend/src/pages/categorias/contrato.migracao.test.ts` | 0    | só o contrato novo                               |
| `node tools/arch-check.mjs`                                                                                                | n/a  | sem edição de produção em `packages/` ou `apps/` |
| `node tools/token-check.mjs`                                                                                               | n/a  | sem edição de produção em `packages/` ou `apps/` |

Migração do slice **não** declarada como concluída.
