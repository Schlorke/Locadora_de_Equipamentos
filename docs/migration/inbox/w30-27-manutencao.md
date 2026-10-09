# w30-27 — pages/manutencao

| Campo  | Valor                                    |
| ------ | ---------------------------------------- |
| Índice | 27                                       |
| Escopo | `packages/frontend/src/pages/manutencao` |
| Estado | intermediate                             |

## O que mudou

- Nenhum import legado (`@/components`, `@/hooks`, `@/lib` ou relativo saindo
  para `components/`/`hooks/` na raiz) no slice (15 arquivos `.ts`/`.tsx`
  varridos, 0 ocorrências). Nada a reescrever.
- Imports atuais já usam `@gb-locacoes/ui` e índices públicos de widgets
  (`cabecalho-admin`, `cartao-admin`, `calendario`) via `../../../widgets/...` —
  alinhado ao FSD page → widget.
- Página **não universal**: export público em `index.ts` é
  `AdminMaintenancePage` a partir de `./ui/ManutencaoPage.web`. **Não** criada
  tela fina em `apps/clients/mobile`.
- Já existem `*.test.ts` no slice (`model/carga.test.ts`, `model/tipos.test.ts`,
  `ui/formatar.test.ts`). **Não** criado `contrato.migracao.test.ts` (evita
  duplicar cobertura de contrato).
- Host web: `apps/clients/web/src/app/admin/maintenance/page.tsx` já é shell
  fino (`AdminMaintenancePage` de `@gb-locacoes/frontend/pages/manutencao`) —
  **sem alteração**.
- Resultado anexado em `docs/migration/MIGRATION.md` (`## w30-27-manutencao`).

## Exits

| Comando                      | Exit                                                         |
| ---------------------------- | ------------------------------------------------------------ |
| `node tools/arch-check.mjs`  | nao_aplicavel (sem edição de produção em packages/ ou apps/) |
| `node tools/token-check.mjs` | nao_aplicavel (sem edição de produção em packages/ ou apps/) |
| vitest contrato              | nao_aplicavel (já havia `*.test.ts`; contrato não criado)    |

## Observações / pendências

- `app/` da raiz continua dono paralelo de `/admin/maintenance`.
- Migração do slice **não** declarada como concluída.
