# SEO, medição e verificação da vitrine por locadora

> **Status**: Critical **Last updated**: 2026-10-08

---

## 1. Purpose

Cada vitrine (`{slug}.<raiz>`) leva o SEO, a medição e a verificação da própria
locadora, nunca os da GB nem os de outra locadora (T12 da ADR
`docs/architecture/adr-tenant-hosts.md`). A raiz legada fazia isso só para a GB:
título, descrição, canonical e Open Graph fixos em `app/layout.tsx` e em oito
`metadata.ts`, a tag do Google (GA4 `G-…` e Google Ads `AW-…`) com os IDs da GB
no código e as metas de verificação do Search Console e da Meta pelo ambiente.

Onda 135 (lote A; E12 e C14 do plano de aposentadoria da raiz; decisão do dono
D4 de 2026-10-08): o host web monta tudo isso por locadora, com os dados dela,
antes de a raiz sair. O Vercel Analytics e o Speed Insights são da plataforma
(por projeto, sem dado de locadora) e voltam no layout raiz do host web.

## 2. Scope

**In scope**

- `generateMetadata` em cada página do grupo `(vitrine)`: home, catálogo, sobre,
  contato, orçamento, termos, privacidade, cookies e política de devolução (o
  detalhe do equipamento já tinha o dele).
- Título e descrição SEO do painel (`seoTitle`/`seoDescription`) na leitura
  pública `GET /api/settings/public`, aditivos, pela mesma fábrica nos dois
  hosts (`createPublicCatalog().getPublicSettings`).
- Medição e verificação por locadora no `siteContent`: `googleAnalyticsId`,
  `googleAdsId`, `googleSiteVerification` e `facebookDomainVerification`,
  editados na seção "SEO & Meta Tags" do painel (web e app).
- Tag do Google (gtag.js) e metas de verificação no layout `[locadora]` do host
  web, só com os identificadores válidos da locadora, num modelo fixo.
- CSP por host: o host de locadora responde com `Content-Security-Policy`
  restringindo a origem dos scripts a uma allowlist (R4 da ADR).
- Vercel Analytics e Speed Insights no layout raiz do host web.

**Out of scope**

- Script livre da locadora (`customJs`): nunca é injetado (R4).
- O antigo campo "Google Analytics ID" de "Configurações Personalizadas"
  (`analyticsTrackingId`): continua no painel e fora da leitura pública; nada o
  lê em runtime.
- FAQ JSON-LD da GB (`SEOSchemas` da raiz): conteúdo da GB, fica de fora.
- Nonce na CSP: exigiria ler os cabeçalhos na árvore `[locadora]` (proibido pela
  D4 da ADR); a CSP usa `'unsafe-inline'` e barra script de outra origem.
- Imagem Open Graph dedicada por locadora (usa o logo do cartão, quando houver).

## 3. Entry Points

- Rotas: `apps/clients/web/src/app/(public)/[locadora]/(vitrine)/*/page.tsx`
  (`generateMetadata`), `(vitrine)/seo.ts` (metadados do Next),
  `(public)/[locadora]/layout.tsx` (verificação e tag do Google),
  `apps/clients/web/src/app/layout.tsx` (Vercel Analytics e Speed Insights).
- CSP e imagens: `apps/clients/web/next.config.mjs`
  (`tenantContentSecurityPolicy`, `readImageRemotePatterns`).
- Frontend:
  `packages/frontend/src/entities/configuracao/model/seo-da-vitrine.ts` e
  `medicao.ts` (pela entrada `@gb-locacoes/frontend/app`); painel em
  `pages/configuracoes/ui/MedicaoEVerificacao.{web,native}.tsx`.
- API: `GET /api/settings/public` (os dois hosts).

## 4. Core Flow

1. O painel grava a medição no `siteContent` (`PUT /api/admin/settings`, escrita
   estrita do contrato) e o SEO em `seoTitle`/`seoDescription`.
2. A leitura pública devolve `seoTitle`/`seoDescription` normalizados (`null`
   quando vazios) e o `siteContent` lido chave a chave (inválida sai).
3. Cada página da vitrine chama `metadataDaVitrine(slug, página)`: título,
   descrição, canonical e Open Graph na origem canônica da locadora
   (`https://{slug}.<raiz>`). A home usa o título e a descrição do painel (a
   descrição cai no "Sobre nós"); as demais, o título da página com o nome do
   cartão.
4. O layout `[locadora]` lê a medição (`medicaoDaLocadora`), põe as metas de
   verificação no `generateMetadata` e, com GA4 ou Google Ads, a tag do Google
   (`tagDoGoogle`: gtag.js com o `AW-` na URL, como a raiz, e um `config` por
   ID).
5. O `next.config.mjs` responde a CSP no host de locadora (`app.`, `www.` e o
   apex ficam sem ela).

## 5. Components and Files

- `packages/contracts/src/settings.ts`: `PUBLIC_SETTINGS_FIELDS` (16 campos),
  `SITE_MEASUREMENT_FORMATS`, `SITE_MEASUREMENT_KEYS`.
- `packages/backend/src/modules/catalog/public.ts` e `public-settings.ts`
  (`publicSeoText`).
- `prisma/migrations/202610080101_settings_seo_title_neutral_default`: o padrão
  da coluna `seoTitle` passou de "GB Locações - Equipamentos para Construção"
  para vazio.
- `apps/clients/web/src/host/server/public-api.ts` (`PublicSettings.seoTitle`/
  `seoDescription`).
- `tools/gb-site-content.mjs`: GA4 e Google Ads da GB (código da produção
  `eb4c0098`, `app/layout.tsx:191,193`).

## 6. Data and State

- `settings.seoTitle`, `settings.seoDescription` (colunas existentes).
- `settings.siteContent` (JSONB, onda 134) com as quatro chaves novas.
- Nenhuma tabela, política, grant ou papel novo.

## 7. Constraints and Edge Cases

- Formatos (contrato): GA4 `^G-[A-Z0-9]{4,16}$`; Google Ads `^AW-\d{6,15}$`;
  Search Console `^[A-Za-z0-9_-]{20,100}$`; Meta `^[a-z0-9]{20,64}$`. Nenhum
  admite aspas, espaço, `<`, `/` ou `;`. O painel aceita a meta inteira colada e
  extrai o `content`.
- A tag do Google revalida os IDs antes de montar o script.
- Sem GA4 nem Ads: nenhuma tag (a verificação sozinha não carrega o gtag.js).
- Sem origem (ambiente sem raiz): sem canonical nem `og:url`; logo só com URL
  absoluta `http(s)`.
- A indexação (`robots`) continua do layout `[locadora]` (site não indexável,
  pausa, OFF); as páginas não a reabrem.
- CSP de produção: `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'` + as
  origens do Google (tag, Ads, mapa, selos); `worker-src 'self' blob:`;
  `object-src 'none'`; `base-uri 'self'`. Em desenvolvimento, mais
  `'unsafe-eval'` e `https://va.vercel-scripts.com`.
- Linha criada antes da migration com o título padrão antigo: só a da GB (a
  produção é de uma locadora). Em ambiente de ensaio com locadoras provisionadas
  antes da migration, conferir `settings."seoTitle"` dessas linhas.

## 8. Error Handling

- Leitura pública indisponível: as páginas usam o nome do cartão; o layout fica
  sem tag e sem metas.
- ID ou código inválido no painel: erro no campo, nada é salvo (a seção de SEO
  não descarta valor em silêncio).

## 9. Performance and Accessibility

- A tag do Google carrega `afterInteractive`; o Vercel Analytics e o Speed
  Insights, sob demanda (`next/dynamic`), como na raiz.
- As leituras do cartão e das configurações são deduplicadas por requisição
  (`cache` do React).

## 10. Tests and Validation

- Contrato: `packages/contracts/src/settings.publica.test.ts`,
  `settings.site-content.test.ts`, `settings.site-content.leitura.test.ts`.
- Backend: `packages/backend/src/modules/catalog/public-settings.test.ts`;
  banco: `tests/unit/settings-seo-title-default.test.ts`.
- Frontend: `entities/configuracao/model/seo-da-vitrine.test.ts`,
  `medicao.test.ts`, `pages/configuracoes/model/conteudo-do-site.test.ts`,
  `use-settings-data.api.web.test.tsx`, `ConfiguracoesPage.native.test.tsx`.
- Host web: `(vitrine)/seo.test.ts`, `(vitrine)/page.test.tsx`,
  `[locadora]/layout.test.tsx`, `app/layout.test.tsx`,
  `host/routing/next-config.test.ts` (CSP e imagens),
  `host/server/public-api.test.ts`.
- Continuidade A4 (2026-10-08): `seo.test.ts` chama os exports reais
  `generateMetadata` das nove páginas, com `params` assíncronos e duas locadoras
  em paralelo. Confere título, descrição, canonical, Open Graph, Twitter e logo;
  logos relativos, protocol-relative e data URI ficam fora. SEO e home passaram
  29/29 em Node 24.21.0. Onze mutações reprovaram: remoção de oito exports,
  cartão fixo, origem fixa e logo relativo publicado. Fontes restaurados por
  bytes/hash. Essa prova exercita o contrato de função; não substitui SSR,
  navegador nem os gates consolidados da onda.
- GB: `tests/unit/gb-site-settings.test.ts`, `gb-site-content.test.ts`.
- Navegador (`next start`, backend simulado, Google bloqueado; o decodificador
  Draco servido do `three` local): metas, tag com os IDs da locadora e a mesma
  página com e sem a CSP na home (carrossel 3D com Draco em worker `blob:` e
  WebAssembly), sobre, catálogo e detalhe. A única violação registrada é a sonda
  de JIT do Zod 4 (`Function("")`, `script-src eval`), que cai no modo sem JIT
  sem efeito na página; `z.config({ jitless: true })` no cliente a removeria.

## 11. Related Docs

- `docs/features/conteudo-da-vitrine.md`
- `docs/features/identidade-da-vitrine.md`
- `docs/features/tenant-hosts-web.md`
- `docs/operations/gb-site-settings.md`
- `docs/guides/google-indexing-seo.md`
- `docs/architecture/adr-tenant-hosts.md` (T12, R4)

## 12. Change Log

- 2026-10-08: criação (onda 135, lote A: A4 e A11).
- 2026-10-08: prova A4 dos exports de cada página e sensibilidade por mutação,
  após a auditoria mostrar que oito exports podiam ser removidos sem falhar.

---

_Template version: 2026-01-20_
