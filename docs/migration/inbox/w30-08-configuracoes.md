# w30-08-configuracoes

## Índice

8

## Escopo

`packages/frontend/src/pages/configuracoes`

## Estado

intermediate

## O que mudou

- Nenhum arquivo de produção alterado nesta rodada (nem no slice, nem no host).
- Imports legados `@/lib/utils` em `ui/HeroCarouselPreview.web.tsx` e
  `ui/SettingsNavigationBar.web.tsx`: alvo `lib/utils.ts` ainda existe na raiz —
  regra impede reescrita.
- Host web `/admin/settings`
  (`apps/clients/web/src/app/admin/settings/page.tsx`) já é fino e importa
  `AdminConfiguracoesPage` de `@gb-locacoes/frontend/pages/configuracoes` — sem
  ajuste.
- Tela mobile fina **não** criada: export público vem de módulos `.web.tsx` (e
  importam `next/image`).
- `contrato.migracao.test.ts` **não** criado: o slice já possui
  `model/use-settings.test.ts` (além de `*.web.test.tsx`).
- Resultado anexado ao final de `docs/migration/MIGRATION.md`
  (`## w30-08-configuracoes`).

## Anotações (sem troca)

- Outros aliases `@/app/api/admin/settings/actions` e
  `@/schemas/settings.schema` estão fora do escopo de legado (`@/components`,
  `@/hooks`, `@/lib`) e não foram tocados.
- Não há imports relativos saindo para `components/` ou `hooks/` na raiz.
- `index.ts` exporta símbolos a partir de `./ui/*.web` e `./model/use-settings`;
  sem `export *`.
- Arquivos protegidos do carrossel 3D não tocados.

## Exits

| Comando                      | Exit | Notas                                            |
| ---------------------------- | ---- | ------------------------------------------------ |
| `node tools/arch-check.mjs`  | n/a  | sem edição de produção em `packages/` ou `apps/` |
| `node tools/token-check.mjs` | n/a  | sem edição de produção em `packages/` ou `apps/` |
| vitest contrato              | n/a  | teste de contrato não criado (já há `*.test.ts`) |

Migração do slice **não** declarada como concluída.
