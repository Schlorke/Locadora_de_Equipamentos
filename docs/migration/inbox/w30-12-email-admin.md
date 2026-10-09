# w30-12 — email-admin

| Campo  | Valor                                     |
| ------ | ----------------------------------------- |
| Índice | 12                                        |
| Escopo | `packages/frontend/src/pages/email-admin` |
| Estado | intermediate                              |

## O que mudou

- Imports legados encontrados em `ui/email-message-list.tsx`,
  `ui/email-viewer.tsx` e `ui/email-folder-list.web.tsx`: `@/lib/utils` (`cn`) e
  `@/lib/sanitize` (`sanitizeHtml`).
- **Não reescritos**: os alvos `lib/utils.ts` e `lib/sanitize.ts` ainda existem
  na raiz do repositório (regra: não reescrever se o alvo ainda existe). Não há
  cópia única em `packages/frontend` / `packages/ui` com o mesmo basename para
  migrar via index público.
- Página **não universal**: export público vem de `./ui/EmailAdminPage.web`;
  `model/carga.web.ts` importa `next/navigation`; `email-folder-list.web.tsx`
  usa `react-dom`. **Não** criada tela fina em `apps/clients/mobile`.
- Sem `*.test.ts` no slice (havia só `ui/EmailAdminPage.web.test.tsx`): criado
  `contrato.migracao.test.ts` afirmando o export público `AdminEmailPage` no
  `index.ts`.

## Exits

| Comando                                                                                                                     | Exit                                                         |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `pnpm exec vitest run --config vitest.platform.config.ts packages/frontend/src/pages/email-admin/contrato.migracao.test.ts` | 0                                                            |
| `node tools/arch-check.mjs`                                                                                                 | nao_aplicavel (sem edição de produção em packages/ ou apps/) |
| `node tools/token-check.mjs`                                                                                                | nao_aplicavel (sem edição de produção em packages/ ou apps/) |

## Host web

- `apps/clients/web/src/app/admin/email/page.tsx` já importa `AdminEmailPage` de
  `@gb-locacoes/frontend/pages/email-admin` — **sem ajuste**.
- Resultado anexado ao final de `docs/migration/MIGRATION.md`
  (`## w30-12-email-admin`).

## Exits / pendências

- Imports `@/lib/utils` e `@/lib/sanitize` permanecem até os alvos raiz saírem
  ou haver substituto único exportado por slice/UI.
- Migração do slice **não** declarada como concluída.
