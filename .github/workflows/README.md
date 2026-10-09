# Workflows do GitHub Actions

Dois workflows, cada um com uma responsabilidade. Os antigos `test.yml`,
`ci-fallback.yml`, `ci-simple.yml` e os `*.disabled` foram aposentados: usavam
Node 20 (fora de `engines`) e `pnpm db:push`, e duplicavam o CI.

## `ci.yml` — Workspace validation (única fonte de CI)

Roda em push e pull request para `main` e `develop`. Node vem de `.node-version`
(24.21.0) e o pnpm vem de `packageManager`.

| Job            | O que prova                                                                                                                                                                                                                                                                                                                                                                   |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `architecture` | `pnpm arch`, `pnpm tokens`, `pnpm lint:css`, `pnpm check:test-names`, `pnpm ratchet:guard` (baselines ancoradas no commit base), `pnpm hygiene` (arquivos, exports e dependências sem uso pelo knip, e saídas de ferramenta), `pnpm test:gates`, `pnpm test:visual-tools`, `pnpm docs:validate` e `pnpm check:tokens` (bate com `tools/token-propagation-expectations.json`). |
| `tests`        | PostgreSQL descartável com `prisma migrate deploy`; `test:unit`, `test:security`, `test:contract`, `test:identity`, `test:platform`, `test:mobile`, `test:web`, `test:integration`, `type-check`, `typecheck` e `lint`.                                                                                                                                                       |
| `builds`       | Build do host da raiz (`next build`), do host web de destino (`pnpm build:web`) e bundle dos dois alvos nativos (`pnpm bundle:mobile`).                                                                                                                                                                                                                                       |
| `docker`       | `docker build` do `Dockerfile` e `GET /api/health` = 200 no container, que roda como usuário não-root.                                                                                                                                                                                                                                                                        |

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

Agendado (e manual). Chama as rotas de cron com `CRON_SECRET`, sem instalar o
projeto.

## Rodar localmente

```bash
pnpm arch && pnpm tokens && pnpm check:tokens
pnpm ratchet:guard --base HEAD   # ou RATCHET_BASE_REF=<ref>; sem nada: origin/main, senão HEAD~1
pnpm hygiene
pnpm test:gates
```
