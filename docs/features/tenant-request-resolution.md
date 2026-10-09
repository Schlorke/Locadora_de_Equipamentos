# Resolução de locadora por requisição (backend)

> **Status**: Critical **Last updated**: 2026-09-26

---

## 1. Purpose

Garantir que toda API pública e privada do backend legado descubra a locadora de
uma forma só, sem aceitar escolha contraditória: pelo host (borda validada do
proxy do host web) ou, fora de host de locadora, pelo `tenantSlug` explícito do
contrato atual (mobile e hosts antigos). Complementa
`docs/features/tenant-hosts-web.md` (o lado do proxy).

## 2. Scope

**In scope**

- Contexto de borda (`readPlatformEdgeContext`) e sua validação.
- `resolvePublicRequestTenant` e `publicTenantNotFound` em `lib/tenant.ts`.
- Candidatas de locadora no principal privado (`resolvePrincipal`) e composição
  compartilhada de requisição (`createTenantPrincipalResolver`).
- Origem esperada nas mutações (`lib/security/mutation-origin.ts`) e o guard de
  mesma origem das mutações com cookie (`same-origin-mutation.ts`, onda 4).
- Rotas públicas novas: detalhe de equipamento, cartão público da locadora e
  vínculo com a locadora do host.
- Política de cache no host de locadora.

**Out of scope**

- Seletor de locadora do painel (ver `docs/features/organization-selection.md`).
- Diretório com busca e rate limit persistente (Lote 7a).
- Contrato uniforme de erro com `code` em todos os 404/409 (decisão pendente).

## 3. Entry Points

- `packages/backend/src/modules/identity/platform-edge.ts`
  (`readPlatformEdgeContext`, exportado por `@gb-locacoes/backend/identity`).
- `packages/backend/src/modules/identity/tenant-principal.ts`
  (`resolvePrincipal` com candidatas).
- `packages/backend/src/modules/identity/same-origin-mutation.ts`
  (`isSameOriginMutation` e `rejectCrossOriginMutation`, exportados por
  `@gb-locacoes/backend/identity`).
- `lib/tenant.ts`: `resolvePublicTenant`, `resolvePublicRequestTenant`,
  `publicTenantNotFound`, `publicCacheHeaders` e `resolveTenantPrincipal`.
- Desde 2026-09-30, a regra pública fica em
  `packages/backend/src/modules/identity/public-tenant.ts`; `lib/tenant.ts`
  preserva sua composição legada. O serviço `apps/services/api` injeta o mesmo
  lookup e usa a mesma transação do catálogo, sem importar `lib/`.
- A política de sessão fica em `identity/application-session.ts`, com leitores
  injetados pela fachada `lib/application-session.ts`; lifecycle Better Auth e
  opções/callbacks NextAuth ficam em `identity/runtime.ts` e `legacy-auth.ts`. O
  guard privado continua em `lib/tenant.ts`, com CSRF como primeira instrução.
  Nenhuma rota privada foi instalada no serviço neste corte preparatório.
- `packages/backend/src/modules/directory/{index,card}.ts`
  (`readPublicTenantCard`).
- Rotas que usam o resolvedor no início do handler: `categories`, `equipments`,
  `equipamentos/search`, `equipments/[id]/availability`, `settings/public`,
  `contact` e `quotes`.
- Rotas novas: `GET /api/equipments/[id]`, `GET /api/public/tenants/[slug]` e
  `GET /api/auth/organizations/current`.

## 4. Core Flow

1. `readPlatformEdgeContext(request, env)` devolve
   `{ hostKind, tenantSlug?, origin, clientIp }` ou `null`:
   - sem `x-platform-edge-auth`, devolve `null` sem ler o ambiente;
   - o segredo é comparado com `PLATFORM_EDGE_SECRET` e
     `PLATFORM_EDGE_SECRET_PREVIOUS`, sempre os dois, com `timingSafeEqual`
     sobre SHA-256 (não vaza o comprimento);
   - a origem é reclassificada com `classifyHost` e precisa bater em classe,
     slug e origem canônica; só `tenant`, `app` e `apex` formam contexto;
   - em `app`/`apex`, qualquer `tenant-slug` invalida a borda; `client-ip` é
     validado;
   - ambiente inválido devolve `null` e registra um único log, sem segredo.
2. `resolvePublicRequestTenant(request, { bodySlug, pathSlug, trim, requiredCode })`
   junta os valores de `tenantSlug` da query (`getAll`), do corpo, do caminho e
   da borda de locadora:
   - valores distintos → 400
     `{ error: 'Seleção de locadora conflitante', code: 'TENANT_CONFLICT' }`,
     `no-store`, antes de qualquer leitura;
   - nenhum valor → 409 `{ error: 'Selecione uma locadora' }` (com
     `code: 'TENANT_REQUIRED'` só em `settings/public`, opção `requiredCode`);
   - inválido, reservado, inexistente ou suspenso → 404 neutro
     `{ error: 'Locadora não encontrada' }`, `no-store`, idêntico em todas as
     rotas.
3. Rotas privadas: `resolveTenantPrincipal` acrescenta a locadora do host (borda
   `tenant`) como candidata junto de `x-tenant-id` e do cookie de seleção. Mais
   de um id distinto → 400 `Conflicting tenant selection` antes de buscar
   membership. Locadora do host inexistente ou suspensa → o mesmo 404 neutro.
4. Mutações: `isTrustedMutationOrigin` (`lib/security/mutation-origin.ts`)
   delega, desde a onda 5, ao guard de `same-origin-mutation.ts`: a origem
   esperada é a da borda validada; sem borda, `WEB_PUBLIC_ORIGIN`; sem ela, a da
   própria requisição (`WEB_PUBLIC_ORIGIN` inválida recusa navegador). `contact`
   e `POST /api/quotes` continuam recusando com 403 um `Origin` diferente da
   borda, e `POST /api/quotes` e o alias `POST /api/orcamentos` chamam
   `rejectCrossOriginMutation` como primeira instrução (onda 5).
5. Mutações com cookie da área do cliente (onda 4, entrada 190 de
   `docs/issues/known-issues.md`): logo depois do gate `resolveTenantPrincipal`,
   `rejectCrossOriginMutation(request)` responde 403
   `{ error: 'Origem não permitida' }` com `no-store` quando, com borda
   validada, o `Origin` difere da origem da borda (inclusive `null`) ou o
   `Sec-Fetch-Site` não é `same-origin` nem `none`. GET, HEAD e OPTIONS passam.
   Todo `{slug}.<raiz>` é o mesmo site, então o `SameSite` do cookie não impede
   um script de `bravo` de mandar o cookie de `alfa`. Rotas: POST de
   `cart/sync`, `cart/merge` e `addresses`; PATCH e DELETE de `addresses/[id]` e
   `client/notifications/[id]`; POST de `client/notifications/mark-all-read`,
   `client/rentals/[id]/extend`, `request-extension` e `request-pickup`; DELETE
   de `client/rentals/[id]` e `quotes/[id]`; PUT de `user/profile`; POST de
   `contracts/sign` e `integrations/melhor-envio/calculate`.
6. Guard central (onda 5, entrada 196 de `docs/issues/known-issues.md`): o guard
   é a primeira instrução de `resolveTenantPrincipal`, antes da sessão, o que
   cobre `requireTenantPermission` e os middlewares de `requireAdmin` (as
   mutações de `/api/admin/**` no host `app`). Sem borda validada, uma mutação
   de navegador precisa vir de `WEB_PUBLIC_ORIGIN` ou da própria origem; sem
   `Origin` e sem `Sec-Fetch-Site` (app nativo, servidor-servidor) segue como
   antes. Quem só enxerga cabeçalhos (`next/headers`) passa `method: null` e
   `url: null`: sem `Origin` a requisição é leitura (especificação Fetch), com
   `Origin` vale a regra de mutação, e sem URL a comparação é com o authority do
   `Host`. `register`, `forgot-password` e `reset-password` também chamam o
   guard como primeira instrução.

## 5. Components and Files

- `packages/backend/src/modules/identity/{platform-edge,tenant-principal,index}.ts`
- `packages/backend/src/modules/directory/{index,card}.ts`
- `lib/tenant.ts`, `lib/security/mutation-origin.ts`,
  `packages/backend/src/modules/identity/same-origin-mutation.ts`
- `app/api/equipments/[id]/route.ts`, `app/api/public/tenants/[slug]/route.ts`,
  `app/api/auth/organizations/current/route.ts`
- Testes:
  `tests/security/{platform-edge,tenant-request,tenant-not-found,tenant-principal}.test.ts`

## 6. Data and State

- **Cartão público** (`GET /api/public/tenants/[slug]`): `slug`, `name`, `city`,
  `state` e `logoUrl` (só `https`; logo lido em `withTenantTransaction`). A
  saída passa pelo `PublicTenantCardSchema` estrito de
  `@gb-locacoes/contracts/directory`: nunca sai CNPJ, telefone, e-mail, CEP ou
  endereço.
- **Detalhe de equipamento** (`GET /api/equipments/[id]`): `select` explícito,
  filtro por `tenantId` em `withTenantTransaction`; equipamento de outra
  locadora dá 404.
- **Vínculo com a locadora do host** (`GET /api/auth/organizations/current`):
  - 200 `{ membership: TenantContext }` só com a locadora do host (não lista as
    outras);
  - 404 `NO_MEMBERSHIP` sem vínculo; 403 com vínculo suspenso ou revogado; 401
    sem sessão; todos com `private, no-store` e `Vary: Cookie, Host`;
  - fora de host de locadora (app, apex, sem borda ou borda forjada): sempre 409
    `{ error, code: 'TENANT_REQUIRED' }` com `private, no-store` e
    `Vary: Cookie, Host`, resolvido só pelo host (a requisição sem a query), sem
    consultar o banco e com qualquer `tenantSlug` na query (onda 4);
  - no host de locadora, a query só pode repetir a locadora do host: outra dá
    400 `TENANT_CONFLICT`; locadora do host inexistente ou suspensa dá o 404
    neutro. Esses dois mantêm os cabeçalhos canônicos (`no-store`), iguais aos
    das outras rotas; o 404 é conferido byte a byte em
    `tenant-not-found.test.ts`.
  - Extração incremental em 2026-10-01: os adapters legado e serviço delegam a
    preparação do host a `createPublicTenantResolver` e a consulta do vínculo a
    `readCurrentOrganizationMembership`, ambos em backend/identity. Preparar o
    host não autoriza a consulta: a sessão é obrigatória depois das recusas de
    host/query. A consulta composta mantém `tenantId_userId` e a transação com
    `app.tenant_id`. A preferência e o papel global não participam. Provas no
    corte 11 de [API compartilhada](shared-api-host.md).
- **Cache**: no host de locadora, `public, max-age=60` com `Vary: Host`, sem
  `s-maxage` (`publicCacheHeaders`); fora dele, a política atual da rota.
  `GET /api/quotes` (privada) responde `private, no-store` com
  `Vary: Cookie, x-tenant-id`.

## 7. Constraints and Edge Cases

- Sem borda o comportamento é o de antes, exceto em entrada contraditória ou
  vazia:
  - query e corpo com locadoras diferentes, ou `tenantSlug` repetido com valores
    distintos: 400 também sem borda;
  - em `availability`, slug só de espaços: 409 (antes 404);
  - slugs reservados ou fora da política D15 (1 caractere, `--`, 64
    caracteres): 404.
- `resolvePublicTenant` devolve `{ tenantId, slug }` sem `name`; o cartão lê o
  nome por conta própria.
- O 404 neutro não tem `code` no corpo; `TENANT_NOT_FOUND` existe só como
  `PublicRequestTenant.code`. Pôr `code` nos 404/409 exige mudar
  `tests/unit/catalog-http.test.ts` e o contrato legado (decisão pendente).
- A checagem de `Origin` em `POST /api/quotes` e `/api/contact` só vale com
  borda (decisão pendente sobre estendê-la).
- `clientIpFromHeaders` (`lib/rate-limit.ts`) usa o `edge.clientIp` da borda
  validada por `readPlatformEdgeContext`; com borda validada sem IP, devolve
  `null` e nunca lê `x-real-ip` nem `X-Forwarded-For` (onda 4). Sem borda, cai
  em `TRUSTED_PROXY_HOPS` ou `VERCEL=1` (onda 3, Lote 7a). A regra vale para
  todos os limitadores e, desde a onda 3, também para o IP da auditoria
  (`lib/audit-logger.ts`).
- Rotas novas da onda 3 que seguem esta resolução: `GET /api/public/tenants`
  (diretório, ver `docs/features/tenant-directory-search.md`) e
  `POST /api/client/enroll` (vínculo; exige borda `tenant`, ver
  `docs/features/tenant-client-enrollment.md`).

## 8. Error Handling

| Situação                                          | Resposta                                            |
| ------------------------------------------------- | --------------------------------------------------- |
| Locadora conflitante (host, query, corpo)         | 400 `TENANT_CONFLICT`, `no-store`                   |
| Nenhuma locadora                                  | 409 com o corpo atual de cada rota                  |
| Slug inválido, reservado, inexistente ou suspenso | 404 neutro `{ error: 'Locadora não encontrada' }`   |
| Candidatas distintas no principal privado         | 400 `Conflicting tenant selection`                  |
| `Origin` diferente da borda em mutação            | 403                                                 |
| Mutação com cookie vinda de outra origem (borda)  | 403 `{ error: 'Origem não permitida' }`, `no-store` |
| `/current` fora de host de locadora               | 409 `TENANT_REQUIRED` com `code`, `private`, `Vary` |
| Falha do banco                                    | envelope 500 do handler                             |

## 9. Performance and Accessibility

- Uma consulta por slug para resolver a locadora (risco R10 da ADR: cache de 60
  s no perfil e regra de firewall ficam para depois).
- O resolvedor roda antes de qualquer leitura ou escrita de dados de negócio.

## 10. Tests and Validation

- `tests/security/platform-edge.test.ts` (31 casos).
- `tests/security/tenant-request.test.ts` (T7): versão sem banco com dublê que
  falha em qualquer transação e versão com banco que conta `quotes` e
  `outbox_events` das duas locadoras antes e depois; borda forjada,
  `x-tenant-id` e cookie de B no host A, cartão sem PII e cache.
- `tests/security/tenant-not-found.test.ts` (T8): status, cabeçalhos e corpo
  byte a byte iguais em 10 rotas mais 3 só-host, para locadora desconhecida,
  suspensa, reservada e inválida.
- `tests/security/tenant-principal.test.ts`: candidatas host/header/cookie.
- Onda 4: `tenant-request.test.ts` usa `bravo` (válida e não reservada) no teste
  de borda forjada, com controles positivos, e prova que um backend de produção
  sem `WEB_API_ORIGIN` ainda aplica o host; a matriz de `/current` fora de host
  de locadora (sem borda, app, apex e borda forjada, com e sem `tenantSlug`)
  confere 409 sem nenhuma consulta. `same-origin-mutation.test.ts` (16 handlers)
  e `same-origin-mutation.integration.test.ts` (banco real) provam o guard.
- Onda 5: `admin-same-origin.test.ts` (mutações reais de `/api/admin/**` no host
  `app` com a origem de uma locadora irmã: 403 sem sessão e sem banco),
  `account-flows-guard.test.ts` (fluxos anônimos de conta, nos dois modos) e a
  passagem CSRF de `route-auth-inventory.test.ts`.
- Comando: `pnpm test:security` (na árvore da onda 4 em 2026-09-26: 549 testes
  passaram, 18 pulados; não recontado na onda 5) com `TEST_DATABASE_URL`
  descartável e `TEST_DATABASE_DISPOSABLE=true`.

## 11. Related Docs

- `docs/architecture/adr-tenant-hosts.md` (seções 4.5 e 4.6)
- `docs/architecture/multiempresa.md`
- `docs/features/tenant-hosts-web.md`
- `docs/features/organization-selection.md`
- `docs/features/tenant-slug-policy.md`
- `docs/features/tenant-directory-search.md`
- `docs/features/tenant-client-enrollment.md`

## 12. Change Log

- 2026-09-26: Lote 2 (borda validada, resolução pública por requisição,
  candidatas no principal, rotas públicas novas e cache no host de locadora), no
  commit `da19f601`.
- 2026-09-26 (onda 3, commit `be859915`): `clientIpFromHeaders` com
  `edge.clientIp` primeiro; busca do diretório e vínculo do cliente.
- 2026-09-26 (onda 4, commit `4b02f52f`): guard de mesma origem nas mutações com
  cookie, contrato de `/current` fora de host de locadora, IP da borda sem
  fallback e teste de borda forjada com locadora não reservada.
- 2026-09-29 (onda 5, sem commit): guard de mesma origem central em
  `resolveTenantPrincipal` (inclusive `/api/admin/**` e `requireAdmin`), regra
  sem borda (`WEB_PUBLIC_ORIGIN` ou a própria origem), fluxos anônimos de conta
  e `POST /api/quotes`/`/api/orcamentos` com o guard (entrada 196).
- 2026-10-01 (corte 12, sem commit): `createTenantPrincipalResolver` compartilha
  a composição privada entre legado e serviço, com as mesmas dependências reais
  e precedência de recusa. O GET de motoristas usa o vínculo atual e RLS.
  Caracterização em `tenant-principal-request.test.ts` e paridade HTTP nos dois
  modos; o inventário segue a closure e reprova composição ou guard forjados.

---

_Template version: 2026-01-20_
