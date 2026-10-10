# Site público por estado (S13)

> **Status**: Critical  
> **Last updated**: 2026-10-07

---

## 1. Purpose

A vitrine de cada locadora (`{slug}.<raiz>`) acompanha a assinatura e a
publicação. Locadora em pausa comercial não vende pelo site, mas o cliente final
continua falando com ela e usando a área do cliente; locadora que nunca publicou
o site, em configuração ou arquivada fica com o mesmo 404 neutro de uma locadora
desconhecida na vitrine. A área do cliente é separada da vitrine: segue a linha
"Área do cliente final" da B.5 e não depende da publicação, então a locadora
`FULL` ou `RESTRICTED` com o site desligado continua atendendo os clientes que
já tem. Fonte: `docs/architecture/adr-saas-subscription.md` (B.5, linhas "Site
público" e "Área do cliente final"; B.10, linha "Público"; D1; D23; lote S13) e
`docs/architecture/adr-tenant-hosts.md` (D10, D12 e "SEO").

## 2. Scope

**In scope**

- Regra única do modo do site em `packages/domain/src/assinatura/site.ts`
  (`decidirModoDoSite`) e da área do cliente em
  `packages/domain/src/assinatura/area-do-cliente.ts` (`decidirAreaDoCliente`).
- Resolvedor público do backend (`createPublicTenantResolver`), composto pelo
  host API atual em `apps/services/api/src/host/runtime.ts`. Na onda 130 também
  havia o adapter antigo `app/api`, retirado em F. O host web atual continua
  separado e lê o cartão da API para decidir suas páginas.
- Código estável `SITE_PAUSED` e cabeçalhos do contrato em
  `packages/contracts/src/subscription.ts`.
- Host web: página de pausa com 503 real, `noindex`, `robots.txt` e
  `sitemap.xml` por estado, numa moldura neutra (marca da locadora, aviso e
  rodapé mínimo), sem cabeçalho, rodapé nem WhatsApp da vitrine (onda 132,
  achado 142). No ar e indexável, o `sitemap.xml` tem as páginas fixas, as
  legais publicadas, os equipamentos disponíveis e as categorias com equipamento
  disponível, com frequência, prioridade e data como o sitemap da raiz legada
  (onda 135, A7).
- Consumidores do catálogo e do orçamento no web e no Expo: mensagem neutra do
  503, sem quebrar.

**Out of scope**

- Despublicação (`DELETE /api/admin/site/publish`): exige modelo de dados que a
  ADR não define (preservar a primeira publicação). Pendência.
- Busca do diretório (`GET /api/public/tenants?q=`): lista organizações `ACTIVE`
  com `directoryListed`, sem olhar publicação nem acesso. Pendência fora deste
  lote.
- O que o cliente pode fazer dentro da área (leitura, pagar cobrança existente,
  escrita em `RESTRICTED`): continua no principal e na admissão da assinatura
  (S8, `entitlements/request-access.ts`), que também responde 403
  `TENANT_ARCHIVED` nas rotas privadas.
- O vínculo (`enroll`) não confere o acesso no serviço de clientes
  (`modules/customers/enroll.ts`, só `status`); a resolução da locadora já fecha
  SETUP e ARCHIVED com a fiscalização `on`.
- Cache ISR por locadora (Lote 9 da ADR de hosts).

## 3. Entry Points

- Domínio: `packages/domain/src/assinatura/site.ts` e `area-do-cliente.ts`.
- Backend: `packages/backend/src/modules/identity/public-tenant.ts`, composto em
  `apps/services/api/src/host/runtime.ts` (consulta tipada por
  `PublicOrganization`). A fachada antiga `lib/tenant.ts` foi retirada em F.
- Rotas da vitrine (503 em pausa): `/api/categories`, `/api/equipments`,
  `/api/equipments/{id}`, `/api/equipments/{id}/availability`,
  `/api/equipamentos/search`, `POST /api/quotes`, `POST /api/orcamentos`,
  `POST /api/contact`, no host API atual.
- Identidade (respondem em pausa): `/api/public/tenants/{slug}` e
  `/api/settings/public`.
- Cartão no escopo da área do cliente:
  `/api/public/tenants/{slug}?scope=client-area` (superfície `card` do
  resolvedor), usado pelo layout da locadora no host web.
- Área do cliente (`decidirAreaDoCliente`): `/api/auth/organizations/current` e
  `POST /api/client/enroll`, nas duas resoluções (só o host e o `tenantSlug`
  repetido no corpo ou na query); as rotas privadas seguem o principal.
- Host web: `apps/clients/web/src/proxy.ts`,
  `apps/clients/web/src/host/routing/{platform-proxy,site-mode}.ts`,
  `apps/clients/web/src/host/server/{site-state,public-api}.ts` e
  `apps/clients/web/src/app/(public)/[locadora]/{layout.tsx,robots.txt,sitemap.xml}`
  e
  `apps/clients/web/src/app/(public)/[locadora]/(vitrine)/{layout.tsx,site-pausado}`
  (as páginas da vitrine moram no grupo `(vitrine)`; entrada e área do cliente
  continuam em `(auth)` e `(account)`).
- Frontend: `packages/frontend/src/pages/site-pausado` e
  `packages/frontend/src/widgets/site-pausado` (`AvisoSitePausado` e
  `MolduraSitePausado`).
- Moldura: `apps/clients/web/src/host/providers/TenantSiteProviders.tsx` escolhe
  `chrome="none"` do `ClientLayoutShell` quando o segmento renderizado abaixo do
  layout `[locadora]` é `site-pausado` (`useSelectedLayoutSegments`, que segue o
  rewrite do proxy e não o caminho visível); nas demais rotas, a moldura da
  vitrine.

## 4. Core Flow

1. O resolvedor lê `status`, `access`, `sitePublishedAt` e `siteIndexable` da
   organização pelo slug e chama `decidirModoDoSite` com a fiscalização
   (`PLATFORM_SUBSCRIPTION_ENFORCEMENT`).
2. Bloqueio administrativo (`status` diferente de `ACTIVE`) ou site não
   publicado: `OFF`, em qualquer fiscalização. Com a fiscalização `on`: `FULL` →
   `LIVE`, `RESTRICTED` → `PAUSED`, `SETUP` e `ARCHIVED` → `OFF`. Com `off` e
   `shadow` o acesso conta como `FULL` (nunca pausa); `shadow` registra
   `[site-shadow]` quando `on` decidiria diferente.
3. Indexável só em `LIVE` com `siteIndexable` (falso até a 1ª fatura paga).
4. A área do cliente sai de `decidirAreaDoCliente`: bloqueio administrativo →
   não, em qualquer fiscalização; com `on`, `FULL` e `RESTRICTED` → sim, `SETUP`
   e `ARCHIVED` → não; com `off` e `shadow` o acesso conta como `FULL`. Não
   depende da publicação. Site no ar ou em pausa sempre tem área do cliente.
   `shadow` registra também a área que `on` fecharia (`clientArea` no
   `[site-shadow]`).
5. Cada rota escolhe a superfície: `storefront` (padrão: `PAUSED` → 503
   `SITE_PAUSED`; `OFF` → 404 do D10), `identity` (`LIVE` e `PAUSED` respondem;
   `OFF` → 404), `client-area` (responde enquanto existe a área do cliente, com
   o site em qualquer modo; sem ela, o 404 do D10) ou `card` (o cartão:
   `identity`, ou `client-area` com `?scope=client-area`).
6. O cartão público leva o modo nos cabeçalhos `x-site-mode` (`LIVE`|`PAUSED`, e
   `OFF` só no escopo da área do cliente) e `x-site-indexable` (`true`|`false`);
   fora do ar (`PAUSED` ou `OFF`), `Cache-Control: no-store`.
7. O proxy do host web, nas páginas da vitrine (fora da entrada, da área do
   cliente e dos arquivos de SEO), lê o cartão no backend: `PAUSED` → rewrite
   para `/{slug}/site-pausado` com HTTP 503, `Retry-After: 3600`,
   `Cache-Control: no-store` e `X-Robots-Tag: noindex`; 404 (sem vitrine) →
   rewrite para o caminho interno `/_`, o mesmo para toda locadora sem vitrine
   (o layout dá o 404 neutro sem consultar), também nas páginas que esperam a
   sessão (`/orcamento`); `LIVE` não indexável → `X-Robots-Tag: noindex`. Sem
   resposta do cartão, segue o rewrite comum e os layouts decidem.
8. O layout `[locadora]` (pai da vitrine e da área do cliente) lê o cartão no
   escopo da área do cliente: sem ele, o 404 neutro; com ele, os providers e
   `noindex` quando o site não é indexável (inclusive `OFF`). O layout
   `(vitrine)` dá o 404 neutro quando o site está `OFF` (a mesma leitura,
   deduplicada na requisição). A página `/site-pausado` só existe em `PAUSED`
   (senão 404).
9. Na pausa, o `TenantSiteProviders` monta o shell sem moldura (segmento
   `site-pausado`) e a página traz a dela: marca (logo do cartão ou sigla) e
   nome da locadora no topo, o aviso com o contato e a área do cliente, e um
   rodapé com nome, cidade/UF, copyright e os links legais (Privacidade e Termos
   só quando publicados, Cookies sempre, Devolução quando publicada). Nenhum
   link para catálogo, orçamento, carrinho, busca ou categorias, que
   respondem 503.
10. Páginas legais (`/termos`, `/privacidade`, `/politica-devolucao`,
    `/cookies`) continuam no ar na pausa (decisão do dono de 2026-10-06, item 4;
    onda 134): o proxy as deixa passar (`pausedSiteServes`) com HTTP 200,
    `X-Robots-Tag: noindex` e `Cache-Control: no-store`
    (`PAUSED_LEGAL_PAGE_HEADERS`); o `TenantSiteProviders` tira a moldura da
    vitrine e cada página entra na moldura neutra pela prop `moldura`
    (`ComMolduraDaPausa`), com os mesmos links legais. Documento não publicado
    continua 404. O resto da vitrine segue no 503 `SITE_PAUSED`; `robots.txt`
    não muda e o `sitemap.xml` lista só as legais publicadas (mais Cookies).

## 5. Components and Files

- `packages/domain/src/assinatura/site.ts` e `site.test.ts`.
- `packages/contracts/src/subscription.ts`: `SITE_PAUSED_CODE`,
  `SITE_PAUSED_MESSAGE`, `SITE_PAUSED_RETRY_AFTER_SECONDS`,
  `SITE_PAUSED_HEADERS`, `SITE_MODE_HEADER`, `SITE_INDEXABLE_HEADER`.
- `packages/backend/src/modules/identity/public-tenant.ts`:
  `createPublicTenantResolver(findOrganization, { enforcement, observe })`,
  `publicSitePaused`, `publicSiteHeaders`.
- `packages/backend/src/http/{tenant-card,public-settings}.ts` e
  `apps/services/api/src/app/api/{public/tenants/[slug],settings/public,client/enroll}/route.ts`:
  superfície declarada do host API. Os adapters antigos da raiz foram retirados
  em F; regras e contratos do backend continuam únicos.
- `packages/frontend/src/widgets/site-pausado` (`AvisoSitePausado`, contato em
  `model/contato.ts`; `MolduraSitePausado`, a moldura neutra) e
  `packages/frontend/src/pages/site-pausado` (`SitePausadoPage`: moldura e
  aviso), só com `@gb-locacoes/ui` (`Avatar`, `Card`, `Button`) e classes de
  token.
- `packages/frontend/src/app/providers/ClientLayoutShell.web.tsx`: `chrome`
  `none` (sem cabeçalho, rodapé, WhatsApp, extras públicos nem a reserva do
  cabeçalho fixo).

## 6. Data and State

- `organizations.status`, `access`, `sitePublishedAt` e `siteIndexable` (B.3).
  Nenhuma coluna, migration ou grant novo.
- A migration `202610030104_organization_lifecycle` acrescentou `access` com
  padrão `FULL` (as linhas existentes ficaram `FULL`; o padrão passou a `SETUP`
  depois), `siteIndexable` com padrão `true` e preencheu
  `sitePublishedAt = createdAt` para toda organização `ACTIVE`. Toda locadora
  viva no momento da migration continua `LIVE` e indexável.
- `tools/platform-provision-tenant.mjs` chama o mesmo caso de uso do onboarding
  (`modules/onboarding/provisioning.ts`), que cria a organização com
  `sitePublishedAt = null`, `siteIndexable = false` e acesso `FULL` (teste) ou
  `SETUP`: o site fica `OFF` até a publicação explícita do dono (B.8, onda 115).
- Organização com `status = SUSPENDED` no momento da migration não recebeu
  `sitePublishedAt`; se o bloqueio for revogado, o site fica `OFF` até nova
  publicação (decisão pendente), mas a entrada e a área do cliente voltam a
  atender (acesso `FULL` ou `RESTRICTED`).

## 7. Constraints and Edge Cases

- A publicação não depende da fiscalização: sem `sitePublishedAt` é `OFF` também
  com `off`.
- Valor inválido de `PLATFORM_SUBSCRIPTION_ENFORCEMENT` (inclusive vazio) aplica
  `on` no site (falha fechada para o estado comercial real; a admissão do S8
  responde 503 nesse caso).
- Fato ausente ou `access` fora do contrato não abre o site: `sitePublishedAt`
  ausente é `OFF`; `access` inválido conta como `ARCHIVED` com a fiscalização
  `on`.
- `RESTRICTED` nunca publicado é `OFF` (não há o que pausar); a área do cliente
  continua.
- O cartão com `?scope=client-area` revela, para `FULL` e `RESTRICTED` não
  publicadas, o mesmo que a página `/entrar` já mostra: que a locadora existe,
  com nome, cidade, UF e logo. Sem o parâmetro, o cartão continua o 404 do D10.
- Carrinho: o carrinho da vitrine é a página de pausa; a sincronização privada
  (`/api/cart/**`) segue o S8 (escrita em `RESTRICTED` → 402).
- Páginas legais (`/termos`, `/privacidade`, `/cookies`, `/politica-devolucao`)
  seguem no ar na pausa (passo 10; onda 134), fora dos buscadores e sem cache: a
  pausa pode acabar a qualquer momento. A rota do documento
  (`/api/settings/public/legal-documents/{kind}`) é da superfície `identity`.
- O proxy deixou de ser só parsing (D2 da ADR de hosts): faz uma leitura do
  cartão por página da vitrine e entrega o 503 da pausa e o 404 da vitrine
  desligada. Registrar na ADR (decisão pendente).
- `/orcamento` monta o conteúdo só depois da sessão (`PrivateAreaGate`); um
  `notFound()` do layout `(vitrine)` nele não chegaria ao HTML do servidor (o
  status ficaria 200). Por isso o 404 da vitrine desligada sai do proxy; o
  layout `(vitrine)` é a mesma decisão quando a leitura do proxy falha.
- `/orcamento` espera a sessão no shell (`SESSION_BOUND_PREFIXES`): com o site
  em pausa, o HTML do servidor traz o 503 e o `noindex`, e o aviso monta depois
  da hidratação (vem no payload RSC).
- A página de pausa tem a moldura neutra própria (onda 132); a vitrine no ar
  segue com a moldura de sempre, agora só com os dados da própria locadora
  (`docs/features/identidade-da-vitrine.md`, T12). A entrada e a área do cliente
  continuam com a moldura da vitrine também na pausa (os links de catálogo levam
  à página de pausa).
- Links legais no rodapé da pausa só para o que a página legal mostra: o
  documento publicado (`legalDocuments` da leitura pública) e a Política de
  Cookies, que é da plataforma (`linksLegaisDaPausa`).
- `robots.txt` e `sitemap.xml` são Route Handlers públicos declarados no
  inventário de autorização (`tests/security/route-auth-inventory.test.ts`) com
  as referências exatas que podem alcançar (gateway server-only e contratos).

## 8. Error Handling

- 503 da vitrine:
  `{ "error": "Este site está temporariamente indisponível.", "code": "SITE_PAUSED" }`,
  com `Retry-After: 3600`, `Cache-Control: no-store` e `X-Robots-Tag: noindex`;
  nenhum acesso ao banco da locadora.
- 404 do D10 idêntico byte a byte para `OFF` e locadora desconhecida nas APIs
  públicas e em `robots.txt`/`sitemap.xml`; nas páginas da vitrine, a mesma
  resposta (o proxy leva as duas ao caminho interno `/_`); na entrada e na área
  do cliente sem área (desconhecida, bloqueada, SETUP ou ARCHIVED com `on`),
  status, cabeçalhos e HTML visível iguais (o payload RSC do Next ecoa o
  segmento `[locadora]`).
- O frontend mostra a mensagem do backend (`HttpError.message`) no catálogo, no
  detalhe (503 → mensagem do backend em vez da genérica), no envio de orçamento
  e no contato, no web e no Expo.

## 9. Performance and Accessibility

- O proxy faz um `GET` do cartão (prazo de 3 s, `no-store`) por página da
  vitrine; área do cliente, APIs, `robots.txt` e `sitemap.xml` não consultam.
  Sem cache próprio: a decisão é sempre a atual.
- Página de pausa: um `<header>` (marca), um único `<main>`, um `<footer>`;
  título com `role="heading"` nível 1, links `tel:`, WhatsApp (nova aba,
  `noopener`) e `mailto:`, botão da área do cliente; sem o JavaScript da vitrine
  (cabeçalho, carrinho, busca, WhatsApp flutuante, ScrollReveal).

## 10. Tests and Validation

- Domínio: `packages/domain/src/assinatura/site.test.ts` e
  `area-do-cliente.test.ts` (matriz, fiscalização, bloqueio e "site no ar ou em
  pausa implica área do cliente").
- Contrato: `packages/contracts/src/subscription.test.ts`.
- Resolvedor: `packages/backend/src/modules/identity/public-tenant.test.ts`.
- API canônica: `tests/security/public-site-state.test.ts` (503, 404 do D10 byte
  a byte, identidade, área do cliente com o site desligado, as duas resoluções
  do vínculo com `tenantSlug` no corpo e na query, cartão com escopo, `off`).
- Host web: `host/server/site-state.test.ts`, `host/routing/site-mode.test.ts`,
  `host/routing/platform-proxy.site-mode.test.ts`, `proxy.test.ts`,
  `host/server/public-api.test.ts` e os testes de `layout`, `(vitrine)/layout`,
  `site-pausado`, `robots.txt`, `sitemap.xml` e do detalhe em
  `apps/clients/web/src/app/(public)/[locadora]`.
- Moldura (achado 142): `MolduraSitePausado.web.test.tsx`,
  `SitePausadoPage.web.test.tsx`, `ClientLayoutShell.casca.web.test.tsx`
  (`chrome="none"`), `host/providers/TenantSiteProviders.test.tsx` (pausa
  reescrita em qualquer caminho visível) e o teste da página `site-pausado` do
  host (só os links de contato e da área do cliente).
- Frontend: `widgets/site-pausado/**`, `pages/site-pausado/**`,
  `use-public-equipment.test.tsx`, `use-equipment-catalog.site-paused.test.tsx`
  e `quote-api.test.ts`.
- Fixtures publicam as organizações de teste pelo papel restrito de plataforma
  (`tests/helpers/public-site.ts`), como a migration 0104 fez com as vivas.
- Histórico da prova HTTP: na onda 130, builds de produção dos três adapters
  então existentes com fiscalização `on` (resultados na onda 130 de
  `shared-api-host.md`); moldura neutra com 503 no build de produção do host web
  (onda 132); páginas legais em pausa no build de produção do host web sobre os
  dois backends então existentes
  (`tests/api-host/storefront-legal-paused.http.test.ts`, onda 134 histórica:
  `/termos` e `/cookies` 200 com `noindex` e `no-store` na moldura, documento
  não publicado 404, vitrine 503 com `Retry-After`, locadora desligada igual à
  desconhecida).
- Páginas legais em pausa (onda 134): `host/routing/site-mode.test.ts`,
  `platform-proxy.site-mode.test.ts`, `TenantSiteProviders.test.tsx`, os
  `page.test.tsx` de `termos`, `privacidade`, `politica-devolucao`, `cookies` e
  `site-pausado`, `pausa.test.ts`, `sitemap.xml/route.test.ts`,
  `widgets/site-pausado/model/links-legais.test.ts` e o cenário visual
  `vitrine/termos-pausado`.

## 11. Related Docs

- `docs/architecture/adr-saas-subscription.md`
- `docs/architecture/adr-tenant-hosts.md`
- `docs/features/tenant-hosts-web.md`
- `docs/features/tenant-request-resolution.md`
- `docs/features/onboarding-locadora.md`
- `docs/features/limites-plano.md`

## 12. Change Log

- 2026-10-06: criação (onda 130, achado 136): regra de domínio, resolvedor nos
  dois hosts, `SITE_PAUSED`, página de pausa com 503, `robots.txt` e
  `sitemap.xml` por estado.
- 2026-10-06: segunda rodada do achado 136: área do cliente pela linha da B.5
  (`decidirAreaDoCliente`) nos dois hosts e no host web; entrada e área do
  cliente de locadora `FULL` ou `RESTRICTED` não publicada deixaram de dar 404;
  cartão com `?scope=client-area`; layout `(vitrine)`; 404 da vitrine desligada
  pelo proxy.
- 2026-10-06: onda 132, achado 142: moldura neutra da pausa (marca, aviso e
  rodapé mínimo, sem navegação da vitrine) pelo segmento renderizado; vitrine
  sem os padrões da GB (achado 143, `identidade-da-vitrine.md`).
- 2026-10-06: onda 132, segunda rodada do achado 143: a vitrine no ar perdeu os
  fatos da GB que o modelo de site afirmava para qualquer locadora (região,
  construtoras clientes, anos de mercado, números e nota fixa). A moldura da
  pausa não mudou.
- 2026-10-07: onda 134 (lote vitrine-conteúdo): páginas legais no ar na pausa
  (200, `noindex`, `no-store`, moldura neutra com links legais); `sitemap.xml`
  só com as legais publicadas.

---

_Template version: 2026-01-20_
