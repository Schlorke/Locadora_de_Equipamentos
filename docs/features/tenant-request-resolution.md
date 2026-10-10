# Resolução de locadora por requisição (backend)

> **Status**: Critical **Last updated**: 2026-10-09 (ponteiros pós-F; histórico
> preservado)

---

## 1. Purpose

Garantir que as APIs de `apps/services/api`, sobre a política compartilhada de
`packages/backend`, descubram a locadora de uma forma só, sem aceitar escolha
contraditória: pelo host (borda validada do proxy do host web) ou, fora de host
de locadora, pelo `tenantSlug` explícito do contrato atual (mobile e hosts
antigos). Complementa `docs/features/tenant-hosts-web.md` (o lado do proxy).

## 2. Scope

**In scope**

- Contexto de borda (`readPlatformEdgeContext`) e sua validação.
- `createPublicTenantResolver` e `publicTenantNotFound` em backend/identity, com
  `resolvePublicRequestTenant` composto no host API.
- Candidatas de locadora no principal privado (`resolvePrincipal`) e composição
  compartilhada de requisição (`createTenantPrincipalResolver`).
- Origem esperada nas mutações (`apps/services/api/src/host/mutation-origin.ts`)
  e o guard de mesma origem das mutações com cookie (`same-origin-mutation.ts`).
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
- `packages/backend/src/modules/identity/public-tenant.ts`:
  `createPublicTenantResolver`, `publicTenantNotFound` e `publicCacheHeaders`.
  `apps/services/api/src/host/runtime.ts` injeta o lookup de Organization e
  compõe `resolvePublicTenant`, `resolvePublicRequestTenant` e
  `resolveCurrentOrganizationTenant`; catálogo usa transação tenant.
- `packages/backend/src/modules/identity/tenant-request-principal.ts` compõe
  CSRF, sessão, candidatas, membership, origem explícita e admissão da
  assinatura. `apps/services/api/src/host/private-identity.ts` injeta o leitor
  de sessão, Prisma e resolução pública; `host/permissions.ts` compõe a
  permissão específica da rota.
- A política de sessão está em `identity/application-session.ts`; os leitores
  NextAuth/Better Auth são injetados por
  `apps/services/api/src/host/session.ts`. Lifecycle e callbacks permanecem em
  `identity/runtime.ts` e `legacy-auth.ts`. Em modo `better-auth`, ausência ou
  erro de sessão não reativa JWT legacy.
- Histórico do corte preparatório de 2026-09-30: `lib/tenant.ts` e
  `lib/application-session.ts` eram fachadas da raiz e ainda não havia rotas
  privadas no serviço. Essas fachadas foram aposentadas no checkout pós-F;
  aquele limite não descreve a API atual.
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
2. `resolvePublicRequestTenant(request, { bodySlug, pathSlug, trim, requiredCode, surface })`
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
4. Mutações: `isTrustedMutationOrigin`
   (`apps/services/api/src/host/mutation-origin.ts`) delega, desde a onda 5, ao
   guard de `same-origin-mutation.ts`: a origem esperada é a da borda validada;
   sem borda, `WEB_PUBLIC_ORIGIN`; sem ela, a da própria requisição
   (`WEB_PUBLIC_ORIGIN` inválida recusa navegador). `contact` e
   `POST /api/quotes` continuam recusando com 403 um `Origin` diferente da
   borda, e `POST /api/quotes` e o alias `POST /api/orcamentos` chamam
   `rejectCrossOriginMutation` como primeira instrução (onda 5).
5. Mutações com cookie da área do cliente (onda 4, entrada 190 de
   `docs/issues/known-issues.md`): logo depois do gate `resolveTenantPrincipal`,
   `rejectCrossOriginMutation(request)` responde 403
   `{ error: 'Origem não permitida' }` com `no-store` quando, com borda
   validada, o `Origin` difere da origem da borda (inclusive `null`) ou o
   `Sec-Fetch-Site` não é `same-origin` nem `none`. GET, HEAD e OPTIONS passam
   por esse guard de mutação; leituras privadas com Origin explícito seguem
   também o guard complementar do item 7. Todo `{slug}.<raiz>` é o mesmo site,
   então o `SameSite` do cookie não impede um script de `bravo` de mandar o
   cookie de `alfa`. Rotas: POST de `cart/sync`, `cart/merge` e `addresses`;
   PATCH e DELETE de `addresses/[id]` e `client/notifications/[id]`; POST de
   `client/notifications/mark-all-read`, `client/rentals/[id]/extend`,
   `request-extension` e `request-pickup`; DELETE de `client/rentals/[id]` e
   `quotes/[id]`; PUT de `user/profile`; POST de `contracts/sign` e
   `integrations/melhor-envio/calculate`.
6. Guard central (onda 5, entrada 196 de `docs/issues/known-issues.md`): o guard
   é a primeira instrução de `resolveTenantPrincipal`, antes da sessão, o que
   cobre `requireTenantPermission` e as checagens de papel dos handlers de
   `apps/services/api/src/app/api/admin`. `requireAdmin` era o middleware
   histórico, aposentado no checkout pós-F. Sem borda validada, uma mutação de
   navegador precisa vir de `WEB_PUBLIC_ORIGIN` ou da própria origem; sem
   `Origin` e sem `Sec-Fetch-Site` (app nativo, servidor-servidor) segue como
   antes. Quem só enxerga cabeçalhos (`next/headers`) passa `method: null` e
   `url: null`: sem `Origin` a requisição é leitura (especificação Fetch), com
   `Origin` vale a regra de mutação, e sem URL a comparação é com o authority do
   `Host`. `register`, `forgot-password` e `reset-password` também chamam o
   guard como primeira instrução.

7. Leituras privadas: o mesmo principal chama `rejectExplicitCrossOrigin` após
   validar membership e antes da admissão da assinatura/dados. `Origin` de outra
   origem ou o valor literal `null` mantém o 403 no-store central; sem Origin
   segue. Em `/api/auth/organizations/current`, a rota aplica esse guard após
   host e sessão, antes do vínculo; as recusas 409/404 de host e 401 mantêm
   precedência.

## 5. Components and Files

- `packages/backend/src/modules/identity/{platform-edge,tenant-principal,index}.ts`
- `packages/backend/src/modules/directory/{index,card}.ts`
- `packages/backend/src/modules/identity/{public-tenant,tenant-request-principal,application-session,same-origin-mutation,client-ip}.ts`
- `apps/services/api/src/host/{runtime,private-identity,permissions,session,mutation-origin,rate-limit}.ts`
- `apps/services/api/src/app/api/equipments/[id]/route.ts`,
  `apps/services/api/src/app/api/public/tenants/[slug]/route.ts`,
  `apps/services/api/src/app/api/auth/organizations/current/route.ts`
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
  - Registro da extração incremental em 2026-10-01: os adapters legado e serviço
    delegavam a preparação do host a `createPublicTenantResolver` e a consulta
    do vínculo a `readCurrentOrganizationMembership`, ambos em backend/identity.
    Preparar o host não autoriza a consulta: a sessão é obrigatória depois das
    recusas de host/query. A consulta composta mantém `tenantId_userId` e a
    transação com `app.tenant_id`. A preferência e o papel global não
    participam. Provas no corte 11 de [API compartilhada](shared-api-host.md).
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
- `resolvePublicTenant` devolve `{ tenantId, slug, site }` sem `name`; o cartão
  lê o nome por conta própria. `site` traz modo/indexação, não identidade
  privada.
- O resolvedor atual também respeita a superfície pública S13: `storefront`
  (padrão), `identity` e `client-area`; `card` escolhe identidade ou
  `?scope=client-area`. Vitrine PAUSED responde 503 `SITE_PAUSED`, e OFF
  conserva o 404 neutro; identidade/área do cliente seguem suas regras próprias
  de disponibilidade. Ver `docs/features/site-por-estado.md`. O lookup composto
  lê status, access, sitePublishedAt e siteIndexable; retirar esses fatos
  alteraria o contrato, não apenas o endereço do helper.
- O 404 neutro não tem `code` no corpo; `TENANT_NOT_FOUND` existe só como
  `PublicRequestTenant.code`. Pôr `code` nos 404/409 exige mudar
  `tests/unit/catalog-http.test.ts` e o contrato legado (decisão pendente).
- `POST /api/quotes` e seu alias `/api/orcamentos` aplicam o guard central antes
  de rate limit, corpo e sessão, inclusive sem borda validada. O contato
  conserva a diferença existente: chama `isTrustedMutationOrigin` somente quando
  `tenant.edge` está presente, depois da resolução pública. Estender essa
  checagem a contact sem borda exigiria mudança funcional própria.
- `clientIpFromHeaders` (`packages/backend/src/modules/identity/client-ip.ts`)
  usa o `edge.clientIp` da borda validada por `readPlatformEdgeContext`; com
  borda validada sem IP, devolve `null` e nunca lê `x-real-ip` nem
  `X-Forwarded-For` (onda 4). Sem borda, cai em `TRUSTED_PROXY_HOPS` ou
  `VERCEL=1` (onda 3, Lote 7a). A regra vale para todos os limitadores e, desde
  a onda 3, também para o IP da auditoria (a fachada `lib/audit-logger.ts` era o
  consumidor histórico, aposentado no checkout pós-F).
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
| Mutação com cookie vinda de outra origem          | 403 `{ error: 'Origem não permitida' }`, `no-store` |
| `/current` fora de host de locadora               | 409 `TENANT_REQUIRED` com `code`, `private`, `Vary` |
| Falha do banco                                    | envelope 500 do handler                             |

## 9. Performance and Accessibility

- Uma consulta por slug para resolver a locadora (risco R10 da ADR: cache de 60
  s no perfil e regra de firewall ficam para depois).
- O resolvedor roda antes de qualquer leitura ou escrita de dados de negócio.

## 10. Tests and Validation

Os números e referências aos dois hosts abaixo registram as ondas indicadas,
antes de F; não são uma execução nova no checkout sem raiz. A matriz da onda 135
e seus limites ficam em `docs/guides/wave135-base-validation.md`.

- `tests/security/platform-edge.test.ts` (31 casos no checkpoint original).
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
