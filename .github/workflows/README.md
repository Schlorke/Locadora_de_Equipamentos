# Workflows do GitHub Actions

Três workflows, cada um com uma responsabilidade. Os antigos `test.yml`,
`ci-fallback.yml`, `ci-simple.yml` e os `*.disabled` foram aposentados: usavam
Node 20 (fora de `engines`) e `pnpm db:push`, e duplicavam o CI.

## `ci.yml` — Workspace validation (única fonte de CI)

Roda em push e pull request para `main` e `develop`. Node vem de `.node-version`
(24.21.0) e o pnpm vem de `packageManager`.

| Job            | O que prova                                                                                                                                                                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `architecture` | Gates `arch`, `tokens`, `lint:css`, nomes de teste, ratchet, hygiene, `test:gates`, `test:visual-tools`, `docs:validate` e `check:tokens`. Os limites de propagação dos tokens continuam explícitos nas expectations.                                |
| `tests`        | PostgreSQL 18 descartável, migrations com `prisma migrate deploy`, suítes unit/security/contract/identity/platform/mobile/web/HTTP API/integration, tipos e lint. O HTTP API exercita os motores legacy e Better Auth sem iniciar a raiz aposentada. |
| `builds`       | Build da API (`pnpm build:api`), build web (`pnpm build:web`) e bundles Android/iOS (`pnpm bundle:mobile`).                                                                                                                                          |
| `api-docker`   | Build de `apps/services/api/Dockerfile` com contexto no workspace; `GET /api/health` = 200 e usuário não-root no container local do job.                                                                                                             |

O antigo job de imagem do servidor da raiz foi aposentado com o host antigo. Os
jobs atuais não enviam imagens a um registry, não publicam aplicação e não
executam migrations em banco hospedado. O primeiro commit da história limpa usa
`HEAD` como base do ratchet somente quando não há pai nem SHA anterior; commits
seguintes usam a base de push/PR como descrito abaixo.

### Catracas e o guard

`pnpm arch` e `pnpm tokens` comparam a árvore com as baselines da própria
árvore. `tools/ratchet-guard.mjs` compara essas baselines com as do commit base
(no PR, o merge base com `origin/<base>`; no push, o commit anterior) e falha se
alguma contagem por arquivo e regra subir, se aparecer um par novo ou se uma
baseline ou regra da base sumir.

- Renomeação ou mudança de pasta:
  `node tools/ratchet-guard.mjs --rename <de> <para> --reason "<motivo>"` move a
  entrada e registra a transferência em `tools/ratchet-transfers.json`, sem
  aumentar o total.
- Cobertura nova (regra nova, padrão mais amplo, escopo novo): o guard roda as
  ferramentas atuais sobre uma extração do commit base e só aceita o que já
  existia no código base.
  `node tools/ratchet-guard.mjs --base <ref> --adopt-coverage` grava exatamente
  isso nas baselines.

`pnpm hygiene` (`tools/hygiene-check.mjs`) roda o knip com `knip.jsonc` (e de
novo sem os testes) e reprova arquivo, export ou dependência sem uso, o que só
um teste mantém vivo, variante `.native` órfã, CSS sem importador, tag JSDoc que
esconde export e saída de ferramenta fora do `.gitignore` ou versionada. O que
espera decisão fica em `tools/hygiene-baseline.json`, cada item com motivo; item
que não acontece mais reprova. O `ratchet-guard` barra item novo nessa linha de
base e exceção nova ou escopo a menos no `knip.jsonc` sem aprovação em
`tools/ratchet-transfers.json` (detalhes em `docs/features/ratchet-gates.md`).

## `cron-dispatch.yml` — crons da aplicação

Agendado e manual, sem instalar o projeto. Só chama as rotas quando o
repositório é `Schlorke/Locadora_de_Equipamentos` e a variável
`CRON_DISPATCH_ENABLED` vale exatamente `true`. A origem e a credencial vêm de
`CRON_BASE_URL` e `CRON_SECRET`; não há destino GB embutido. Mantenha o
dispatcher desligado até existir um destino próprio autorizado.

## `api-container.yml` — prova manual do container da API

Executado somente por `workflow_dispatch`. Usa PostgreSQL 18 descartável e
`apps/services/api/Dockerfile`; verifica health e usuário não-root. O teardown
`always()` tenta encerrar o container do próprio job. Não faz deploy.

## Rodar localmente

```bash
pnpm arch && pnpm tokens && pnpm check:tokens
pnpm ratchet:guard --base HEAD   # ou RATCHET_BASE_REF=<ref>; sem nada: origin/main, senão HEAD~1
pnpm hygiene
pnpm test:gates
```
