# Hosts da plataforma no host web

> **Status**: Critical **Last updated**: 2026-10-09

---

## 1. Purpose

Servir cada locadora no próprio subdomínio (`{slug}.<raiz>`), o painel da equipe
em `app.<raiz>` e a plataforma no apex (`<raiz>`), com a locadora vinda somente
do cabeçalho Host. Decisão de produto registrada em
`docs/architecture/adr-tenant-hosts.md`; isolamento em
`docs/architecture/multiempresa.md`.

## 2. Scope

**In scope**

- Proxy puro do host web (`apps/clients/web/src/proxy.ts`): decisão por host,
  contexto de borda para o backend, allowlist de APIs e 404 neutro.
- Árvore de rotas por host, providers por grupo e gateway server-only que
  substitui o Prisma nas páginas do host web.
- Modo host do frontend compartilhado (`packages/frontend`): slug fixo, hrefs
  sem `?tenantSlug=`, caminho visível sem o prefixo interno e portão da área
  privada por tela.

**Out of scope** (lotes seguintes do plano da ADR)

- SEO por host: `robots.txt`, `sitemap.xml`, `manifest.json` e JSON-LD sem os
  padrões da GB (Lote 5).
- Identidade multi-host, vínculo com locadora e `RuntimeBootstrap` usando
  `/api/auth/organizations/current` (Lote 6, entregue na onda 3: ver
  `docs/features/tenant-client-enrollment.md`).
- Diretório e rate limit persistente (Lote 7a, entregue na onda 3: ver
  `docs/features/tenant-directory-search.md`; UI no Lote 7c), deep link do app
  (Lote 7b), staging (Lote 8), ISR (Lote 9), limpeza da compatibilidade
  (Lote 10) e domínios próprios (Lote 11).

## 3. Entry Points

- Proxy: `apps/clients/web/src/proxy.ts` → `host/routing/platform-proxy.ts` →
  `host/routing/decide.ts`; tabelas em `host/routing/route-table.ts`.
- Rotas: `apps/clients/web/src/app/(public)/[locadora]/**`,
  `(platform)/plataforma/**`, `(auth)`, `(admin)` e `(labs)` do host `app`, e
  `apps/clients/web/src/app/not-found.tsx` neutro. O host `app.<raiz>` é um
  domínio do painel, não o antigo diretório `app/` da raiz, retirado em F.
- Providers:
  `apps/clients/web/src/host/providers/{TenantSiteProviders,AppHostProviders,PlatformProviders}.tsx`.
- Gateway: `apps/clients/web/src/host/server/public-api.ts` (`server-only`).
- Configuração: `apps/clients/web/next.config.mjs`.
- Frontend: `packages/frontend/src/app/providers/public-tenant-routing.ts`,
  `packages/frontend/src/shared/lib/navigation/` e `PrivateAreaGate`
  (`@gb-locacoes/frontend/app`).
- Contrato: `@gb-locacoes/contracts/platform` (`classifyHost`,
  `resolvePlatformEnv`, `resolveWebPlatformEnv`, origens e
  `PLATFORM_EDGE_HEADERS`). O web lê o ambiente só por `resolveWebPlatformEnv`
  (`apps/clients/web/src/proxy.ts` e
  `apps/clients/web/src/host/server/public-api.ts`), que exige `WEB_API_ORIGIN`
  em produção; o backend usa `resolvePlatformEnv`, que não depende dela (entrada
  188 de `docs/issues/known-issues.md`).

## 4. Core Flow

O proxy não acessa banco nem faz `fetch`:
`decide(env, classifyHost(Host), { pathname, search, method })`. Todo
`x-platform-*` recebido do cliente é removido em qualquer decisão.

| Host                  | Páginas                                                                                                                                                                                                   | `/api/*`                                                                                                                                                                                                                                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `{slug}.<raiz>`       | Reescrita para `/{slug}{caminho}`. `/admin` → 308 para `app.<raiz>/admin?locadora=slug`. `?tenantSlug` igual ao host → 308 sem o parâmetro; diferente → 404 neutro.                                       | Só `TENANT_API_ALLOWLIST` e, fora do modo legacy, `TENANT_ACCOUNT_API`; `TENANT_API_DENYLIST` vence as duas. `tenantSlug` divergente na query → 400 `TENANT_CONFLICT` (mesmo corpo do backend). O proxy injeta `tenantSlug` nos GETs públicos e remove o cookie `selected-tenant-id` do `Cookie` repassado; `x-tenant-id` segue. |
| `app.<raiz>`          | Painel, login da equipe (`/login`, onda 4) e telas de identidade. Labs avaliado antes do painel (só com `PLATFORM_LABS_ENABLED=true` e fora de produção). `/` → 307 `/admin`; `robots.txt` bloqueia tudo. | Todo `/api/*` vai ao backend com borda `app`, sem slug de locadora.                                                                                                                                                                                                                                                              |
| `<raiz>` (apex)       | Reescrita para `/plataforma{caminho}`. `?tenantSlug` válido → 308 para o subdomínio. `.well-known` → `/plataforma/well-known/*`.                                                                          | Só `/api/public/tenants` e `/api/public/tenants/{slug}`.                                                                                                                                                                                                                                                                         |
| `www.<raiz>`          | 308 para o apex.                                                                                                                                                                                          | 308 para o apex.                                                                                                                                                                                                                                                                                                                 |
| Reservado ou inválido | 404 neutro com `noindex`.                                                                                                                                                                                 | 404 neutro.                                                                                                                                                                                                                                                                                                                      |
| Qualquer host         | —                                                                                                                                                                                                         | `/api/test-login`, `/api/fix-storage`, `/api/supabase-setup`, `/api/cron/**`, `/api/webhooks/**` e `/api/internal/**` → 404.                                                                                                                                                                                                     |

Detalhes:

1. A decisão usa o caminho canônico: cada segmento é decodificado uma vez; `.`,
   `..`, `/` ou `\` codificados e NUL são recusados (`/api/%74est-login` não
   passa).
2. O repasse ao backend (`WEB_API_ORIGIN`) leva a borda: `x-platform-edge-auth`
   (segredo), `host-kind`, `tenant-slug`, `origin` recalculados e `client-ip`
   (de `x-real-ip`). O backend revalida tudo (ver
   `docs/features/tenant-request-resolution.md`).
3. Falha fechada: ambiente da plataforma (`resolveWebPlatformEnv`: em produção
   exige `WEB_API_ORIGIN`, só a origem, em https) ou `NEXT_PUBLIC_AUTH_MODE`
   inválidos → 503 em páginas e APIs, com um log sem valor de segredo; sem
   `PLATFORM_EDGE_SECRET` ou sem `WEB_API_ORIGIN`, nenhuma API é repassada.
4. Matcher literal, sem exclusão por extensão; exclusões explícitas:
   `_next/static/`, `_next/image`, `_vercel/`, `fonts/`, `models/` e
   `email-templates/`.
5. Em `AUTH_MODE=legacy`, `TENANT_ACCOUNT_PATHS` (entrada, cadastro,
   recuperação, callback, `/vincular` e área do cliente) respondem 404 no proxy;
   os layouts `(auth)` e `(account)` também chamam `notFound()`.

## 5. Components and Files

- `apps/clients/web/src/proxy.ts`
- `apps/clients/web/src/host/routing/{decide,platform-proxy,route-table,public-entries.generated}.ts`
- `apps/clients/web/src/host/providers/*.tsx`,
  `apps/clients/web/src/host/auth/*`,
  `apps/clients/web/src/host/ui/NotFoundContent.tsx`
- `apps/clients/web/src/host/server/public-api.ts`
- `apps/clients/web/next.config.mjs`
- `tools/generate-public-entries.mjs`, `tools/modernization-inventory.mjs`
  (`--web-routes`, rotas por host)
- `packages/frontend/src/app/providers/{public-tenant-routing.ts,RuntimeBootstrap.tsx}`
- `packages/frontend/src/app/providers/{AdminLayoutShell,AccountLayoutShell}.web.tsx`
  (molduras do painel e da área do cliente, montadas pelos layouts `(admin)` e
  `(account)`; onda 120 e onda 135, A5)
- `packages/frontend/src/shared/lib/navigation/{visible-pathname.tsx,use-visible-pathname.web.ts,href-resolver.tsx}`

## 6. Data and State

- **Rotas visíveis**: 48 URLs distintas em 53 páginas (inventário da onda 4,
  2026-09-26): 23 no host de locadora, 28 no host `app` (inclui o login da
  equipe, `/login`) e 2 no apex (`/`, que chama `notFound()` até existir design,
  e `/api-docs`). `/recuperar-senha`, `/reset-password` e `/auth/callback`
  existem nos hosts de locadora e `app`.
- **Layout raiz** só com documento, fontes e CSS, sem providers e sem
  `Suspense`; a árvore `[locadora]` também não tem `Suspense` acima da página. É
  isso que faz o `notFound()` sair com status 404 de verdade.
- **Providers por grupo**:
  - `TenantSiteProviders`: `usePublicTenantRouting({ mode: 'host', ... })` e
    `internalRoutePrefix`, com o mesmo `ClientLayoutShell` e o
    `ScrollRevealInit` via `dynamic` com `ssr: false`.
  - `AppHostProviders`: modo legado com armazenamento nulo (sem locadora
    pública), mantendo o `Suspense` de antes. Um layout por grupo (`(auth)`,
    `(admin)`, `(labs)`): ao passar de `/admin/login` para `/admin/*` o provider
    remonta e refaz `getSession`. A prop `chrome` escolhe a moldura do
    `ClientLayoutShell`: o layout `(auth)` passa `chrome="platform"` (casca da
    plataforma, onda 5); o padrão é a vitrine.
  - `PlatformProviders`: sem o shell da vitrine.
- **Gateway** (`public-api.ts`): `fetch` em `WEB_API_ORIGIN` (lida por
  `resolveWebPlatformEnv`) com `tenantSlug` explícito e `no-store`. Cartão e
  detalhe: 404 vira `null`; falha do backend, cartão de outro slug ou resposta
  fora do contrato (`PublicTenantCardSchema` estrito) lança erro. Configurações
  ausentes ou com falha caem nos padrões. As páginas `(public)/page.tsx` e
  `equipamentos/[id]` não usam mais Prisma (`WORKSPACE-ESCAPE` do arch-check
  caiu de 3 para 0).
- **`apps/clients/web/next.config.mjs`**: desde a onda 58, os arquivos públicos
  são servidos pelo próprio web. `predev`/`prebuild` sincronizam a fonte
  canônica `public/` para uma pasta real em `apps/clients/web/public`; não há
  links nem cópia de regras de negócio. `beforeFiles`, `afterFiles` e `fallback`
  vazios: somente o proxy encaminha `/api` a `WEB_API_ORIGIN`. Trocar a API não
  muda modelos, fontes ou imagens. `robots.txt`, `sitemap.xml` e `manifest.json`
  conservam a política de metadata por host. `www` → apex via `has host` (o
  destino mantém a porta). `X-Robots-Tag: noindex` no host `app` e fora de
  produção. `@gb-locacoes/contracts` em `transpilePackages`.
  `createNextConfig(env)` tem paridade testada com `resolvePlatformEnv`.
- **Modo host do frontend**:
  - `usePublicTenantRouting({ mode: 'host', pathname, tenantSlug })`: slug fixo,
    `resolveHref` identidade, sem leitura ou gravação de storage e
    `internalRoutePrefix` igual a `/{slug}`. O modo legado (sem `mode`) não
    mudou.
  - `useVisiblePathname` remove o segmento inteiro `/{slug}` e é o único leitor
    de `usePathname` em `packages/frontend` (`no-restricted-imports` como erro).
    A determinação depende de os segmentos de primeiro nível serem
    `reservedSubdomains`; `vincular` entrou em
    `packages/contracts/src/platform.json` no lote S0 (onda 3).
  - `HrefResolverProvider`/`useHrefResolver` repetem o `resolveHref` já entregue
    ao `NavigationProvider` do `@gb-locacoes/ui`, que só expõe
    `useResolvedHref(href)` (decisão pendente sobre levar o hook para a ui).
  - `PrivateAreaGate`: no web envolve o conteúdo da rota dentro do
    `ClientLayoutShell` (o cabeçalho continua montado); no mobile,
    `<Stack screenLayout={gatedScreen}>` decide por tela. No web, toda rota da
    área ou com `awaitSession` espera o escopo do carrinho em qualquer
    transição; a exceção da tela que continua aberta é só do mobile (onda 4,
    entrada 193). O "Entrar" do portão leva a `/login` com `callbackUrl` igual
    ao caminho visível mais a query, validado por `safeInternalCallback` (onda
    5, entrada 198). O carrinho de cada escopo (locadora e usuário) fica salvo
    entre as trocas; a troca só esvazia a memória (onda 5, entrada 197).

## 7. Constraints and Edge Cases

- Slugs têm 2 caracteres ou mais (D15): em desenvolvimento, `a.localhost` é host
  inválido.
- API do host de locadora (onda 4, entrada 189 de
  `docs/issues/known-issues.md`):
  - `TENANT_API_ALLOWLIST`: o que a vitrine chama, cada entrada com chamador
    real; de `/api/auth` só `/api/auth/session` (NextAuth, modo legacy).
  - `TENANT_ACCOUNT_API`, por modo e vazia no legacy: `get-session`,
    `sign-in/email`, `sign-in/social`, `callback/*/oauth-proxy` e `sign-out` só
    no `basePath` do Better Auth do modo (`/api/auth` em `better-auth`,
    `/api/auth/v2` em `better-auth-v2`, onde `/api/auth/*` é o NextAuth), mais
    `register`, `forgot-password`, `reset-password`, `verify-email` e
    `organizations/current`.
  - `TENANT_API_DENYLIST` vence qualquer padrão: sessões, perfil, e-mail, senha,
    exclusão, contas OAuth e tokens, callback do provedor,
    `oauth-proxy-callback`, `expo-authorization-proxy`, `organizations` e
    `organizations/selection`. Isso tudo fica só no host `app`.
  - `route-table.tenant-api-allowlist.test.ts` deriva os chamadores (literais
    `/api`, métodos `authClient.*` por basePath e `getSession` do next-auth) e
    exige chamador ou entrada `INFRA` com motivo; `PUBLIC_TENANT_QUERY_ROUTES`
    precisa estar contida na allowlist. O detalhe público `/api/equipments/*`
    voltou na onda 74: a slice compartilhada agora possui consumidor próprio.
    GET/HEAD sem seleção recebem o slug do host na query; outra locadora
    gera 400. O padrão casa um segmento, sem liberar subrotas privadas/admin.
    `/api/contracts/sign` e `/api/payments/boleto/*/pdf` continuam fora por
    falta de chamador e voltam junto com a tela que as chamar.
  - `PANEL_ONLY`: `/api/admin/equipments`, `/api/admin/categories`,
    `/api/admin/notifications/sync` e `/api/upload`.
- Login da equipe no host `app` (onda 4): `/login` usa o `LoginPage` do produto
  com `hostAuth` e `allowSignUp={false}`; o retorno fica preso a `/admin/**` por
  `resolvePanelCallback`. `/admin/login` redireciona para `/login`
  (`ADMIN_LOGIN_REDIRECT`) com o callback, e `/admin` decide pela sessão.
- `/auth/callback` no host `app` volta ao `/login` da equipe quando não há
  sessão; o destino padrão de um cliente autenticado (`/area-cliente`) continua
  sem página no host `app` (Lote 6).
- Casca da plataforma no host `app` (onda 5, lote D2): `/login`,
  `/recuperar-senha`, `/reset-password`, `/auth/callback` e `/admin/login` (que
  só redireciona) ficam no layout `(auth)`, que monta
  `AppHostProviders chrome="platform"`: no topo só uma barra com o nome
  provisório da plataforma (`PLATFORM.displayName`, widget
  `widgets/casca-plataforma`), sem cabeçalho, rodapé e WhatsApp da vitrine,
  cujos links davam 404 ali. As rotas passam `shell="platform"` ao
  `LoginPage`/`LoginPageFallback`, ao `RecuperarSenhaPage` e ao
  `ResetPasswordPage`: sai o deslocamento que compensava o cabeçalho da vitrine,
  o selo "GB" vira o nome da plataforma e o rodapé do login vira "Locadora -
  Sistema de Acesso". Não há segunda cópia das telas; no host de locadora nada
  muda (as mesmas telas com `shell` padrão, `storefront`). Rodapé e selo são
  decisão pendente (`docs/architecture/modernization.md`, seção "Onda 5").
- `/api-docs` no apex renderiza sem cabeçalho e rodapé.
- `robots.txt` e `sitemap.xml` do host de locadora são rotas da árvore
  `[locadora]`, por estado do site (S13; `docs/features/site-por-estado.md`).
  Desde a onda 135 (A7), o `sitemap.xml` tem a frequência, a prioridade e a data
  de cada URL do antigo `app/sitemap.ts` da raiz legada, retirado em F, e as
  categorias com equipamento disponível (`/equipamentos?categoria=<slug>`, com a
  data de alteração da categoria); o equipamento sai sem `lastmod`, porque a
  leitura pública do catálogo não traz a data de alteração dele. O
  `manifest.json` do host e os arquivos do apex continuam 404 (Lote 7c).
- Os seis widgets que ainda importavam `usePathname` (`cabecalho/Cabecalho`,
  `Busca`, `AreaCliente`, `menu-admin/BarraLateral`, `BarraLateralMobile` e
  `cabecalho-admin-barra/BarraMobile`) passaram a usar `useVisiblePathname` na
  onda 3 (entrada 185 de `docs/issues/known-issues.md`). O bloco de exceção em
  aviso do `eslint.config.js` saiu na onda 4: a regra é erro em todo o
  `packages/frontend`.
- `images.localPatterns` (risco R9) não foi aplicado. Desde a onda 135 (A3,
  E11), `apps/clients/web/next.config.mjs` tem
  `images: { unoptimized: true, remotePatterns }` como a raiz legada: as fotos
  do Supabase Storage saem direto da origem. Antes, o next/image apontava a foto
  para `/_next/image` e o otimizador respondia 400 ("url" parameter is not
  allowed), provado em `next start` com uma URL do Supabase. O hostname do
  Supabase vem de `NEXT_PUBLIC_SUPABASE_URL` (o mesmo nome do backend), além de
  `via.placeholder.com`, `images.unsplash.com` e `picsum.photos` da raiz.
- CSP por host (onda 135, A11; R4): o host de locadora responde com
  `Content-Security-Policy` só de origem de script (allowlist do Google para a
  tag da locadora, o mapa e os selos; `'unsafe-inline'`, sem nonce, pela D4);
  `app.`, `www.` e o apex ficam sem ela. Ver
  `docs/features/seo-e-medicao-da-vitrine.md`.
- A sobrescrita de cabeçalhos no rewrite externo foi provada em `next start`,
  não na Vercel (risco R1, Lote 8).

## 8. Error Handling

- Locadora desconhecida, suspensa, reservada ou inválida: o mesmo 404 neutro,
  com `noindex`.
- Ambiente inválido: 503 e um log sem valor de segredo.
- `tenantSlug` conflitante na query de `/api/*`: 400 `TENANT_CONFLICT`, igual ao
  backend.

## 9. Performance and Accessibility

- Renderização dinâmica até o ISR do Lote 9 (risco R7).
- O `ScrollRevealInit` ficou na mesma posição (`publicExtras` do
  `ClientLayoutShell`, `dynamic` com `ssr: false`) e só passou a ler o caminho
  por `useVisiblePathname`. Sem `Suspense` no layout raiz, o conteúdo chega
  junto com o shell. Na fotografia inicial desta extração, o teste visual do
  primeiro modelo 3D sem zoom ainda não tinha sido executado. O registro A10
  posterior fica em `docs/features/equipment-3d-carousel.md`; a prova da
  primeira etapa está em `docs/guides/wave135-base-validation.md`. Não inferir
  uma nova prova de pixels ou aparelho a partir desta revisão pós-F.
- `aria-busy` no botão "Solicitar Orçamento" enquanto o clique espera a sessão.

## 10. Tests and Validation

Os hosts workspace `apps/clients/web` e `apps/services/api` permanecem no clone
pós-F; o antigo host Next da raiz saiu. Os comandos T5/T6 e jornadas abaixo usam
esses dois processos atuais, a antiga raiz `app/` foi retirada em F e não é um
processo desse teste. Banco de ensaio deve ser local descartável, migrado, com
processos próprios encerrados antes do drop. A publicação `978ceb` preserva a
fonte de pré-exclusão; F foi aplicado somente no clone, e sua validação final
continua pendente.

- `pnpm test:web` (`vitest.web.config.ts`): no commit `da19f601`, 109 testes
  passaram e 7 foram pulados (o e2e sem `TENANT_HOSTS_E2E=1`). Inclui
  `decide.test.ts` (60 casos com `NextRequest` real e o `config` real),
  `next-config.test.ts` (18), `public-entries.test.ts` (4),
  `decide.visible-routes.test.ts` (8),
  `route-table.tenant-api-allowlist.test.ts` (4), `architecture.test.ts`
  (T15, 7) e `public-api.test.ts` (8). Os dois testes de rotas foram renomeados
  na onda 3 (antes `visible-routes.test.ts` e `tenant-api-allowlist.test.ts`)
  para aninhar sob o arquivo testado.
- Na árvore da onda 3, `decide.visible-routes.test.ts` ainda não conhecia
  `/vincular`; a lista foi corrigida antes do commit `be859915`.
- Na árvore da onda 4 (2026-09-26): 145 passaram e 7 foram pulados. Entraram
  `apps/clients/web/src/proxy.test.ts` (o proxy web real com `vi.stubEnv`), os
  `page.test.tsx` do login da equipe, de `/admin/login`, de `/admin` e das duas
  páginas `reset-password`, e o teste de `decide.visible-routes.test.ts` que
  extrai do código os destinos reais de login e painel e prova que cada um abre
  uma página do host `app`. `tests/security/tenant-auth-api.test.ts` (em
  `pnpm test:security`) percorre todos os endpoints da instância real do Better
  Auth nos dois basePath.
- Onda 5 (sem contagem consolidada):
  `apps/clients/web/src/app/(auth)/layout.test.tsx` e
  `apps/clients/web/src/app/(auth)/recuperar-senha/page.test.tsx` (casca da
  plataforma no host `app`), casos novos nos testes das páginas de conta e das
  rotas, `ClientLayoutShell.casca.web.test.tsx` e os `*.casca.native.test.tsx`
  das três páginas. `decide.visible-routes.test.ts` lê o destino do "Entrar" em
  `const SIGN_IN_PATH` do `RuntimeBootstrap` e continua exigindo que `/login`
  seja página do host `app`.
- E2E T5/T6 contra servidores no ar, sem a raiz legada (onda 135, B7): a API
  compartilhada compilada (`pnpm build:api`, servidor standalone com `cwd` em
  `apps/services/api`) e o host web em `next start -H localhost` (o hostname
  `localhost` mantém internos os rewrites do Next 16), com o mesmo
  `PLATFORM_EDGE_SECRET`, `PLATFORM_ENV=development`,
  `PLATFORM_ROOT_DOMAIN=localhost`, `PLATFORM_PUBLIC_PORT=<porta do web>` nos
  dois e `WEB_API_ORIGIN=<origem da API>` só no web:
  `TENANT_HOSTS_E2E=1 TENANT_HOSTS_E2E_ORIGIN=http://localhost:<porta do web> TEST_DATABASE_URL=<url do banco descartável> TEST_DATABASE_DISPOSABLE=true pnpm exec vitest run --config vitest.web.config.ts tests/e2e/tenant-hosts.spec.ts`.
  O spec cria e apaga as próprias locadoras. O T6 foi rodado com papel
  superuser/`BYPASSRLS`: o isolamento provado vem dos filtros `tenantId` e da
  borda, não do RLS.
- Jornadas J1–J7 no navegador (onda 135, B7; Chromium do Playwright),
  `tests/e2e/journeys.spec.ts`: o spec sobe sozinho a API compilada e o web em
  `next start -H localhost` (portas livres do sistema), com dublês de loopback
  do Resend, do Siteverify e da faixa do HIBP, e derruba os dois no fim. J1
  vitrine em `{slug}.localhost` (início, catálogo e detalhe); J2 painel com
  ADMIN; J3 FINANCIAL levado ao financeiro e OPERATOR fora das configurações; J4
  cliente na área do cliente (só `better-auth`); J5 isolamento entre locadoras;
  J6 sair e voltar; J7 `/comecar`: desligado no `legacy` ("Fale com a gente") e,
  no `better-auth`, o assistente inteiro (conta, link real de confirmação,
  empresa, endereço, plano, termos e criação) com o checklist do dono. O web
  precisa do build do mesmo modo: `NEXT_PUBLIC_AUTH_MODE=<modo> pnpm build:web`,
  depois
  `JOURNEYS_E2E=1 JOURNEYS_AUTH_MODE=<modo> TEST_DATABASE_URL=<url> TEST_DATABASE_DISPOSABLE=true pnpm exec vitest run --config vitest.web.config.ts tests/e2e/journeys.spec.ts`.
  A locadora criada pelo J7 (provisionamento real) fica no banco descartável da
  rodada, que é apagado depois.
- Desenvolvimento local: web e API compartilhada (`apps/services/api`; a raiz
  legada não é mais necessária, onda 135) com o mesmo `PLATFORM_EDGE_SECRET`;
  `PLATFORM_ENV=development`, `PLATFORM_ROOT_DOMAIN=localhost` e
  `PLATFORM_PUBLIC_PORT=<porta do web>` nos dois; `WEB_API_ORIGIN` só no web;
  hosts `{slug}.localhost`, `app.localhost` e `localhost`.
- Entradas de `public/`: `node tools/generate-public-entries.mjs` (use `--check`
  para só conferir).
- `pnpm build:web` valida o proxy e a árvore do host web. O resultado da
  primeira etapa publicada em `978ceb` está em
  `docs/guides/wave135-base-validation.md`; o fechamento da fonte final pós-F
  depende da rodada própria, não apenas de compilar ou preparar este texto.
- Teste 1 do carrossel 3D em navegador real (onda 135, A10): registro em
  `docs/features/equipment-3d-carousel.md`, "Registro da modernização".

## 11. Related Docs

- `docs/architecture/adr-tenant-hosts.md`
- `docs/architecture/multiempresa.md`
- `docs/architecture/adr-web-route-groups.md` (substituída nesta parte)
- `docs/features/tenant-request-resolution.md`
- `docs/features/tenant-slug-policy.md`
- `docs/features/organization-selection.md`
- `docs/features/equipment-3d-carousel.md`

## 12. Change Log

- 2026-09-26: Lotes 4a e 4b (proxy, árvore por host, providers por grupo,
  gateway server-only e modo host do frontend), no commit `da19f601`.
- 2026-09-26 (onda 3, commit `be859915`): página `/vincular` no host de
  locadora, `RuntimeBootstrap` em modo host com `/current`, widgets com
  `useVisiblePathname` e testes de rotas renomeados.
- 2026-09-26 (onda 4, commit `4b02f52f`): login da equipe em `app.<raiz>/login`,
  API de conta mínima no host de locadora (`TENANT_ACCOUNT_API` e
  `TENANT_API_DENYLIST`), `resolveWebPlatformEnv` no proxy e no gateway, testes
  de `apps/clients/web/src/proxy.ts` e fim da exceção de `usePathname` no
  ESLint.
- 2026-09-29 (onda 5, sem commit): casca da plataforma nas páginas de conta do
  host `app` (`chrome="platform"` e prop `shell`), `TENANT_ACCOUNT_API` só no
  `basePath` do modo, "Entrar" da área privada com `callbackUrl` e carrinho
  salvo preservado na troca de escopo (entradas 189, 197 e 198).
- 2026-10-08 (onda 135, lote A, sem commit): imagens remotas como a raiz (A3),
  `generateMetadata` por página da vitrine com os dados da locadora (A4), tag do
  Google e verificação por locadora com CSP por host, e Vercel Analytics e Speed
  Insights no layout raiz (A11).
- 2026-10-08 (onda 135, lote A, parte 2, sem commit): moldura da área do cliente
  no layout `(account)` (`AccountLayoutShell` da camada app do frontend, com o
  menu, as notificações e a saída do antigo `app/area-cliente/layout.tsx` da
  raiz, depois retirado em F; A5); portão do painel com o papel do vínculo
  (FINANCIAL só no financeiro, configurações só para ADMIN) e `loading.tsx` de
  orçamentos, detalhe do orçamento, categorias e e-mail (A6); `sitemap.xml` com
  categorias, frequência, prioridade e data como a raiz (A7); Teste 1 do
  carrossel 3D em navegador real (A10).

---

_Template version: 2026-01-20_
