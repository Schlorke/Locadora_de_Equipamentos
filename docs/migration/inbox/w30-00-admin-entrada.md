# w30-00 — admin-entrada

| Campo  | Valor                                       |
| ------ | ------------------------------------------- |
| Índice | 0                                           |
| Escopo | `packages/frontend/src/pages/admin-entrada` |
| Estado | intermediate                                |

## O que mudou

- Imports legados (`@/components`, `@/hooks`, `@/lib` ou relativos saindo para
  `components/`/`hooks/` na raiz): nenhum encontrado em `index.ts` nem em
  `ui/AdminIndexPage.tsx`. Nada a reescrever.
- Página universal (`AdminIndexPage` sem `.web`, sem `next/*` / `react-dom` no
  módulo): tela fina mobile já existe em
  `apps/clients/mobile/src/app/admin-entrada.tsx` (importa
  `@gb-locacoes/frontend/pages/admin-entrada`). Não criada de novo.
- Sem `*.test.ts` no slice (só havia `ui/AdminIndexPage.test.tsx`): criado
  `contrato.migracao.test.ts` afirmando export público `AdminIndexPage` no
  `index.ts`.

## Exits

| Comando                                                                                                                       | Exit                                                         |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `pnpm exec vitest run --config vitest.platform.config.ts packages/frontend/src/pages/admin-entrada/contrato.migracao.test.ts` | 0                                                            |
| `node tools/arch-check.mjs`                                                                                                   | nao_aplicavel (sem edição de produção em packages/ ou apps/) |
| `node tools/token-check.mjs`                                                                                                  | nao_aplicavel (sem edição de produção em packages/ ou apps/) |

## Notas FSD / bloqueios parciais

- Nenhuma troca de import foi omitida por violação FSD; não havia candidatos
  legados.
- Não declarar migração concluída: fatia permanece intermediate (contrato de
  teste adicionado; produção intacta).
