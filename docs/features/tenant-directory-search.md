# Diretório público de locadoras (busca e opt-in)

> **Status**: Critical **Last updated**: 2026-09-30

---

## 1. Purpose

Permitir que um visitante do apex (`<raiz>`) encontre uma locadora pelo nome sem
expor dados de contato nem listar quem não quis aparecer. É o backend do Lote 7a
da ADR `docs/architecture/adr-tenant-hosts.md` (teste T13). A UI de busca fica
no Lote 7c, com design ainda por aprovar (decisão U3).

## 2. Scope

**In scope**

- `GET /api/public/tenants?q=` (busca anônima).
- Opt-in `Organization.directoryListed` (padrão `false`).
- Rate limit persistente por IP em `platform_rate_limits` e limpeza no cron de
  outbox.

**Out of scope**

- Tela ou endpoint para a locadora ligar `directoryListed` (hoje só pelo banco).
- Busca que ignore acentos.
- UI do diretório e da landing do apex (Lote 7c).

## 3. Entry Points

- API: `app/api/public/tenants/route.ts`.
- Substituto em coexistência:
  `apps/services/api/src/app/api/public/tenants/route.ts`, composto por
  `backend/http/directory-search.ts`; o legado continua ativo.
- Backend: `packages/backend/src/modules/directory/{search,rate-limit}.ts`,
  exportados por `@gb-locacoes/backend/directory`.
- Contrato: `DirectorySearchQuerySchema`, `DirectorySearchItemSchema` e
  `DirectorySearchResponseSchema` em `packages/contracts/src/directory.ts`.
- Cron: `app/api/cron/outbox/route.ts` (limpeza das janelas vencidas).

## 4. Core Flow

1. `parseDirectorySearchParams` aceita um único `q` com 3 a 80 caracteres; `q`
   repetido ou qualquer outro parâmetro dá 400 `INVALID_QUERY`, antes do banco e
   sem consumir a janela.
2. `consumeDirectorySearchRateLimit` conta a busca por IP
   (`clientIpFromHeaders`, que prefere o `edge.clientIp` da borda validada): 30
   por minuto. Acima disso, 429 `RATE_LIMITED` com `Retry-After`.
3. `searchDirectory` filtra `directoryListed = true` e `status = ACTIVE`, busca
   `name` com `contains` e `mode: 'insensitive'` (com `%`, `_` e `\` escapados
   por `escapeLikePattern`), ordena por nome e slug e devolve no máximo 10.
4. Cada item passa pelo schema estrito do contrato; slug reservado e nome vazio
   são descartados.

## 5. Components and Files

- `packages/backend/src/modules/directory/search.ts`
- `packages/backend/src/modules/directory/security-env.ts` (critério de produção
  e segredo; a fachada `lib/rate-limit.ts` reexporta o segredo)
- `packages/backend/src/modules/identity/client-ip.ts` (IP confiável e /64)
- `packages/backend/src/modules/directory/rate-limit.ts` (porta
  `RateLimitCounter`, adaptador `prismaRateLimitCounter`,
  `purgeExpiredPlatformRateLimits`)
- `app/api/public/tenants/route.ts`
- `prisma/migrations/202609260006_platform_directory_rate_limit`
- `tools/tenant-models.json` (`PlatformRateLimit` em `globalModels`)

## 6. Data and State

- `organizations.directoryListed` com índice `(directoryListed, status)`.
- `platform_rate_limits` (`key` PK, `count`, `expiresAt` com índice), global.
  Chave `<rota>:<hmac>:<índice da janela>`, só `[a-z0-9:-]`; HMAC-SHA256 com
  `PLATFORM_RATE_LIMIT_SECRET` e separação de domínio entre IP e conta.
- Consumo por um único `INSERT ... ON CONFLICT DO UPDATE`, atômico entre
  instâncias; janelas fixas alinhadas ao relógio.
- Resposta 200: só `slug`, nome, cidade e UF. CNPJ, CEP, telefone, WhatsApp,
  e-mail e logo nunca saem.

## 7. Constraints and Edge Cases

- O Prisma não escapa curingas no `LIKE`; sem `escapeLikePattern`, `q=%%%`
  listaria todas as locadoras.
- Sem IP confiável (fora da borda e sem `TRUSTED_PROXY_HOPS` ou `VERCEL`), todas
  as buscas caem num balde único `unknown` (decisão pendente: aceitar ou
  responder 503).
- Sem `PLATFORM_RATE_LIMIT_SECRET` (ou com menos de 32 caracteres), em produção
  pelo critério `isPlatformProduction` (ambiente resolvido por
  `resolvePlatformEnv`, com falha fechada se inválido), o limitador lança
  `PlatformEnvError` antes de contar e a busca responde 500; o erro é registrado
  uma vez, sem o valor (entrada 214 de `docs/issues/known-issues.md`). Preview
  da Vercel não é produção apenas por ter `NODE_ENV=production`. Fora de
  produção, chave local por processo quando não configurada. A mesma chave
  configurada é necessária entre hosts para compartilhar o limite, inclusive nos
  testes.
- Na virada da janela fixa, um cliente pode fazer até o dobro do limite.
- O limite de 30 por minuto não vem da ADR; confirmar com o Lote 7c.

## 8. Error Handling

| Situação                     | Resposta                                                  |
| ---------------------------- | --------------------------------------------------------- |
| `q` ausente, curto, repetido | 400 `INVALID_QUERY`, `no-store`                           |
| Limite excedido              | 429 `RATE_LIMITED`, `Retry-After`, `no-store`             |
| Sucesso                      | 200 `{ results }`, `public, max-age=60` (só no navegador) |
| Falha do banco               | 500 `{ error }`, `no-store`                               |

## 9. Performance and Accessibility

- Uma consulta com `take: 10` e índice `(directoryListed, status)`.
- A limpeza das janelas roda no cron de outbox com folga de 60 s; uma falha só é
  registrada e não segura a outbox (`rateLimitsPurged` na resposta do cron).

## 10. Tests and Validation

- `tests/security/directory.test.ts` (T13): matriz de parâmetros, forma exata da
  consulta, descarte de campos extras e de slug reservado, 400 sem tocar no
  banco; no banco descartável, no máximo 10, só ACTIVE e listadas, nenhum dado
  de contato, curingas como literais e 429 persistente entre instâncias.
- Mutações verificadas pelo lote (restauradas byte a byte): sem escape do LIKE,
  sem filtro de opt-in ou de ACTIVE, `take: 50`, segredo por processo e remoção
  do modelo em `tenant-models.json`.
- Comando: `pnpm test:security` com `TEST_DATABASE_URL` descartável e
  `TEST_DATABASE_DISPOSABLE=true`.
- Extração: `tests/unit/public-directory-api.test.ts` aplica os casos
  caracterizados aos dois handlers; `tests/api-host/directory.http.test.ts`
  compara DTOs/status/headers/métodos e prova o contador compartilhado por dois
  processos HTTP contra PostgreSQL descartável. Execução e limites em
  [API compartilhada](shared-api-host.md).

## 11. Related Docs

- `docs/architecture/adr-tenant-hosts.md` (Modelo de dados, Migração B; T13)
- `docs/features/tenant-request-resolution.md`
- `docs/issues/known-issues.md` (entradas 154 e 176)

## 12. Change Log

- 2026-09-26: busca do diretório, opt-in e rate limit persistente (Lote 7a, onda
  3, commit `be859915`).
- 2026-09-26 (onda 4, sem commit): segredo do limitador obrigatório em produção.

---

_Template version: 2026-01-20_
