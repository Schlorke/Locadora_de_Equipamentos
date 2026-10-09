# Conteúdo institucional e textos legais da vitrine

> **Status**: Critical  
> **Last updated**: 2026-10-07

---

## 1. Purpose

Cada locadora informa no painel o conteúdo institucional que o modelo de site
mostra (anos de mercado, frota, clientes, projetos, cidades, construtoras
clientes, história, linha do tempo, destaques do rodapé, local no mapa, Merchant
Center e nota de avaliações com fonte), os compromissos comerciais que assume e
os próprios textos legais (Termos, Privacidade e Devolução). Sem o dado, o bloco
não aparece. Decisões do dono de 2026-10-06 (ADR
`docs/architecture/adr-saas-subscription.md`, B.18, itens 2, 3 e 4; U5 da ADR
`docs/architecture/adr-tenant-hosts.md`) e de 2026-10-07 (D-A a D-F e P-1, no
mesmo bloco da B.18).

Estado em 2026-10-07 (onda 134, sem commit): **parte A** pronta (contrato,
banco, backend, rotas nos dois hosts, exceção D-D, dados e script da GB,
entidades do frontend e travas) e **parte B** pronta (vitrine web e app, páginas
legais, pausa e painel web e nativo). Seguem pendentes, fora da onda: a nota da
GB com fonte (D-A) e a frota da GB (D-B), que o dono preenche no painel; exigir
Termos e Privacidade para publicar sites novos (D-C, parte 2); versões dos
textos e aceite registrado no orçamento (D-F); frete por locadora (P-1).

## 2. Scope

**In scope (onda 134)**

- `settings.siteContent` (JSON validado) e os três documentos legais em
  `settings`, com a data de cada publicação.
- Leitura pública aditiva: `GET /api/settings/public` com `siteContent` (leitura
  tolerante por chave) e `legalDocuments` (`{ terms, privacy, returnPolicy }`,
  pelas datas da publicação, sem ler os textos).
- `GET /api/settings/public/legal-documents/{terms|privacy|return-policy}` nos
  dois hosts (superfície `identity`: no ar e em pausa responde; desligado dá o
  404 do D10).
- `GET/PUT/DELETE /api/admin/settings/legal-documents/{kind}` nos dois hosts
  (`SETTINGS` READ/WRITE, mesma origem, teto de 256 kB, auditoria).
- `siteContent` no `GET/PUT /api/admin/settings` (objeto inteiro; ausente no
  corpo, o gravado fica).
- Exceção D-D na admissão do S8: em RESTRICTED só o `PUT` e o `DELETE` dos
  textos legais passam (`STOREFRONT_LEGAL_DOCUMENT`).
- Dados da GB (`tools/gb-site-content.mjs`) e o script de corte
  (`tools/gb-site-settings.mjs`; runbook `docs/operations/gb-site-settings.md`).
- Frontend: `entities/configuracao` (números, compromissos, local da loja,
  JSON-LD com `geo`, `hasMap`, `openingHours` e o catálogo de ofertas pelas
  categorias da locadora) e a fatia `entities/documento-legal` (leitura,
  documento lido no servidor, avisos, sintaxe leve do editor e nós do
  `DocumentContent`).
- Vitrine web e app (parte B): hero (subtítulo e selos de anos e frota), "Por
  que escolher" (construtoras e anos), Sobre (números, história, Nossa Jornada,
  selos e selo do Google), contato (números, horário, CNPJ, serviços, selos e
  cartão "Onde estamos" com o mapa), contato da home, detalhe do equipamento
  (topo, incluído, nota com fonte e "Por que escolher"), rodapé (destaques e
  links legais publicados) e JSON-LD (FAQ e serviço de andaimes só com a
  certificação declarada).
- Páginas legais web e app pelo documento da locadora: no host web o documento é
  lido no servidor (404 sem documento); na raiz legada e no app, pelo hook.
  Orçamento: aceite dos Termos só com os Termos publicados (D-C, parte 1).
- Pausa (S13): `/termos`, `/privacidade`, `/politica-devolucao` e `/cookies`
  continuam no ar (200, `noindex`, `no-store`), na moldura neutra da locadora,
  com os links dos documentos publicados; `sitemap.xml` só com as legais
  publicadas.
- Painel web e nativo: Horário de Funcionamento, Conteúdo do Site, "O que você
  garante" (os 11 compromissos com as frases exatas que cada um publica) e
  Textos Legais (editor por seção, publicar e despublicar com confirmação,
  avisos de Termos e Privacidade ausentes).
- T12 com o domínio na varredura, os números fixos em texto corrido e o frete
  (P-1); trava das frases de compromisso.

**Out of scope**

- Política de Cookies (texto da plataforma).
- Frete por locadora (P-1), versões dos textos e aceite no orçamento (D-F),
  exigir Termos e Privacidade para publicar sites novos (D-C, parte 2): lotes
  próprios.
- Captura visual da Sobre no harness (limite aceito): o host web importa o
  `Equipment3DCarousel` direto, sem `next/dynamic`
  (`apps/clients/web/src/app/(public)/[locadora]/(vitrine)/sobre/page.tsx`), e o
  harness nunca responde os chunks de three.js, então o `load` não dispara. O
  carrossel não é alterado (componente crítico, `AGENTS.md` §5.1). A prova da
  Sobre é a marcação de `55763c1e`
  (`tests/unit/__fixtures__/vitrine-gb/sobre.markup.html`, igual byte a byte em
  `tests/unit/gb-site-content.textos.test.tsx`): textos, elementos e classes,
  sem o estilo computado nem o carrossel (trocado por `null` na prova).
- Regravar a linha de base de `painel/configuracoes` (limite aceito): ela foi
  gravada sem a moldura administrativa que o host web passou a montar (entrada
  295 de `docs/issues/known-issues.md`, outro lote) e já diverge por ela. Os
  quatro estados novos (`secao-horario`, `secao-conteudo`, `secao-compromissos`
  e `secao-textos-legais`, a 390 e a 1440) entram em
  `tests/visual/approved-changes.json`, com o motivo B10, como capturas inteiras
  aprovadas (`element` e `property` `*`, de "captura ausente" para "captura
  presente"). Como a linha de base não tem esses estados, o comparador
  (`tools/visual-baseline/compare.mjs`) registra uma só diferença por estado e
  não compara nenhum elemento dele: o conteúdo das quatro seções fica sem
  referência visual, e uma mudança dentro delas passa no gate até o painel ser
  regravado e essas aprovações saírem. Por elemento entram só as diferenças dos
  estados que já existiam (`base`, `toast-salvo`, `foco-teclado-telefone` e
  `secao-redes-sociais`), vindas dos botões novos da barra de seções.

## 3. Entry Points

- Contrato: `packages/contracts/src/settings.ts` (`SiteContentSchema`,
  `parsePublicSiteContent`, `SITE_CONTENT_KEYS`, `SITE_CONTENT_COMMITMENTS`,
  `PublicLegalAvailabilitySchema`) e
  `packages/contracts/src/storefront-legal.ts` (subpath
  `@gb-locacoes/contracts/storefront-legal`; o teto em bytes UTF-8 é contado sem
  `TextEncoder`, porque o contrato também roda no app).
- Backend: `packages/backend/src/modules/catalog/public.ts`
  (`getPublicSettings`, `getPublicLegalDocument`), `public-settings.ts`
  (`publicSiteContent`, `publicLegalAvailability`), `admin-settings.ts`
  (`getLegalDocument`, `saveLegalDocument`, `removeLegalDocument`,
  `storefrontLegalDigest`) e `packages/backend/src/http/storefront-legal.ts`
  (`createPublicStorefrontLegalHandler`, `createAdminStorefrontLegalHandlers`).
- Composição: raiz legada em `lib/catalog.ts` e
  `app/api/admin/settings/actions.ts`; serviço em
  `apps/services/api/src/host/runtime.ts` e `host/branding.ts`. Rotas:
  `app/api/settings/public/legal-documents/[kind]/route.ts`,
  `app/api/admin/settings/legal-documents/[kind]/route.ts` e as duas iguais em
  `apps/services/api/src/app/api/`.
- Admissão: `packages/backend/src/modules/entitlements/request-access.ts`.
- Entidades:
  `packages/frontend/src/entities/configuracao/model/{numeros,compromissos,local-da-loja,local-business}.ts`
  (`compromissos.ts` é a única fonte das frases de compromisso; o painel lê
  `frasesPorCompromisso`), `entities/configuracao/api/use-public-settings.ts` e
  `entities/documento-legal/{api/use-documento-legal.ts,model/aviso.ts,model/texto-do-painel.ts,model/nos-do-documento.ts}`.
- Vitrine: `widgets/hero/ui/Hero.web.tsx` (`subtituloDoHero`),
  `pages/home/model/hero-settings.ts`,
  `widgets/por-que-escolher/model/beneficios.ts`,
  `pages/sobre/ui/SobrePage.web.tsx`, `pages/contato/model/use-contact-page.ts`
  e `ui/ContatoPage.{web,native}.tsx`, `widgets/contato-home`,
  `features/mapa-loja/ui/Mapa.web.tsx`,
  `pages/equipamento-detalhe/model/avaliacoes.ts` e
  `ui/EquipamentoDetalhePage.{web,native}.tsx`,
  `widgets/rodape/ui/Footer.web.tsx`, `widgets/seo-schemas`,
  `widgets/dados-estruturados`.
- Páginas legais e orçamento:
  `pages/{termos,privacidade,politica-devolucao,cookies}/ui/*.{web,native}.tsx`,
  `pages/orcamento/model/termos-do-orcamento.ts`, `use-quote-page.ts` e
  `ui/OrcamentoPage.{web,native}.tsx`.
- Pausa: `widgets/site-pausado` (`ComMolduraDaPausa`, `MolduraSitePausado`,
  `linksLegaisDaPausa`); host web em
  `apps/clients/web/src/host/routing/{site-mode.ts,platform-proxy.ts}`
  (`pausedSiteServes`, `PAUSED_LEGAL_PAGE_HEADERS`),
  `host/providers/TenantSiteProviders.tsx` (sem a moldura da vitrine nas legais
  em pausa) e
  `app/(public)/[locadora]/(vitrine)/{pausa.ts,termos,privacidade,politica-devolucao,cookies,site-pausado}`.
- Leitura no servidor do host web:
  `apps/clients/web/src/host/server/public-api.ts` (`getPublicLegalDocument`:
  `null` só no 404, qualquer outra falha lança; `getPublicCategoryNames`) e
  `sitemap.xml/route.ts`.
- Painel:
  `pages/configuracoes/model/{horario,conteudo-do-site,textos-legais,use-textos-legais,use-settings-data}.ts(x)`,
  `api/textos-legais.ts` e
  `ui/{HorarioDeFuncionamento,ConteudoDoSite,Compromissos,TextosLegais}.{web,native}.tsx`.

## 4. Core Flow

1. O dono preenche o painel: horário, conteúdo e compromissos no
   `PUT /api/admin/settings` (cada seção reenvia as outras como estavam salvas);
   cada texto legal no `PUT /api/admin/settings/legal-documents/{kind}`, gravado
   com a data da publicação e uma linha em `audit_logs` na mesma transação.
2. A vitrine lê `siteContent` e a disponibilidade dos documentos na leitura
   pública. No host web as páginas legais leem o documento no servidor e o
   entregam à página; na raiz legada e no app, o hook lê a rota própria.
3. Sem dado, omissão; sem documento, 404 no host web, aviso na raiz legada e no
   app e link fora do rodapé e do `sitemap.xml`.
4. Na pausa, o proxy deixa passar só as legais: 200 com `X-Robots-Tag: noindex`
   e `Cache-Control: no-store`, sem cabeçalho, rodapé e WhatsApp da vitrine,
   dentro da moldura neutra da locadora; o resto segue no 503 `SITE_PAUSED`.

## 5. Components and Files

- Testes do contrato: `packages/contracts/src/settings.site-content.test.ts`,
  `settings.site-content.leitura.test.ts`, `settings.publica.test.ts`,
  `storefront-legal.test.ts`.
- Testes do backend:
  `packages/backend/src/modules/catalog/public-settings.test.ts`,
  `admin-settings.storefront-legal.test.ts`,
  `packages/backend/src/http/storefront-legal.test.ts`.
- Entidades:
  `entities/configuracao/model/{numeros,compromissos,local-da-loja}.test.ts`,
  `local-business.test.ts`, `api/use-public-settings.test.ts` e os testes de
  `entities/documento-legal`.
- Vitrine e páginas: os testes colocados de cada fatia citada no §3 (web e
  `.native`),
  `apps/clients/web/src/app/(public)/[locadora]/(vitrine)/**/page.test.tsx`,
  `pausa.test.ts`, `sitemap.xml/route.test.ts`,
  `host/routing/{site-mode,platform-proxy.site-mode,route-table.tenant-api-allowlist}.test.ts`,
  `host/providers/TenantSiteProviders.test.tsx` e
  `host/server/public-api.test.ts`.
- Painel: `pages/configuracoes/model/*.test.ts(x)`, `api/textos-legais.test.ts`
  e
  `ui/{Compromissos,HorarioDeFuncionamento,TextosLegais,ConfiguracoesPage}.web.test.tsx`
  e `ConfiguracoesPage.native.test.tsx`.

## 6. Data and State

- Colunas em `settings` (migration `202610060201_settings_site_content_legal`):
  `siteContent` (`jsonb`, padrão `{}`), `termsDocument`/`termsPublishedAt`,
  `privacyDocument`/`privacyPublishedAt` e
  `returnPolicyDocument`/`returnPolicyPublishedAt`. Herdam a RLS FORCE e os
  grants da tabela; nenhuma tabela, política ou papel novo.
- CHECK: `siteContent` objeto e até 65.536 bytes; documento objeto, até 262.144
  bytes e sempre junto da data (os dois nulos ou os dois preenchidos). Tamanho
  por `octet_length(::text)`, determinístico.
- Auditoria: `STOREFRONT_LEGAL_PUBLISHED` e `STOREFRONT_LEGAL_UNPUBLISHED`
  (`entity` `Setting`), com `kind`, sha256 e tamanho do JSON canônico do
  documento e as datas; nunca o texto. Cada publicação substitui a anterior
  (guardar versões é a D-F); o painel avisa antes de publicar e de despublicar.
- Painel: "Última atualização" de documento novo vem com a data do dia por
  extenso; o documento já publicado mantém a data dele, com o botão "Usar a data
  de hoje".

## 7. Constraints and Edge Cases

- Escrita estrita, leitura tolerante: o `PUT` recusa chave desconhecida, valor
  fora do limite ou caractere de controle; a leitura descarta só a chave
  inválida (registrada só pelo nome) e ignora a desconhecida, inclusive dentro
  dos objetos e em cada compromisso. O painel abre o que a leitura tolerante
  aceita (um local da loja inválido gravado antes não volta ao formulário).
- Caractere de controle, nos textos do conteúdo e dos documentos legais: C0
  (U+0000–U+001F, inclusive quebra de linha e tabulação), DEL e C1
  (U+007F–U+009F), os separadores de linha e de parágrafo (U+2028, U+2029) e os
  controles de direção, embutidos (U+202A–U+202E) e isolamentos (U+2066–U+2069).
  A recusa vale em qualquer posição, inclusive na primeira e na última; só o que
  o `.trim()` trata como espaço (tabulação, quebras de linha, U+2028 e U+2029)
  sai das pontas antes da checagem, e o texto é gravado aparado. O texto comum
  vizinho de cada faixa passa (por exemplo U+00A0, U+2027, U+202F, U+2065 e
  U+206A).
- Compromissos desligados por padrão (D-E; CDC art. 30). Um elemento ligado a
  mais de um compromisso só aparece com todos (regra E). As frases ficam só em
  `entities/configuracao/model/compromissos.ts`; a lista de trechos que a trava
  procura fora dele mora em `tests/helpers/frases-vigiadas.ts` (só os testes a
  leem), com as variantes antigas que não podem voltar.
- Números: hero e Sobre mostram os selos de anos e frota só com o dado; o
  subtítulo do hero com anos vem do número, nunca do `aboutUsText`. A frota da
  GB fica de fora até o dono preencher (D-B).
- Nota de avaliações só com nome e link `https` da fonte (linha com o link
  `nofollow`); nunca vai para o JSON-LD (D-A).
- Contato (web): o subtítulo do cartão "Telefone" diz "Atendimento de segunda a
  sexta" só com os cinco dias úteis abertos e "WhatsApp disponível" só com o
  WhatsApp da locadora (vazio ou só espaços não conta); sem nenhum dos dois, o
  cartão fica sem subtítulo. O app não tem esse subtítulo (como em `55763c1e`):
  os canais ficam no `ContactInfoCard`.
- Mapa: sem local da loja, nem o cartão nem o aviso da chave do Maps aparecem. A
  moldura do cartão "Onde estamos" do contato (borda, 400 px e 450 px a partir
  do `md`, a da produção) mora no mapa (`moldura="cartao"` do
  `GoogleStoreLocator`), sem exceção do gate de tokens na página.
- Termos no app: a introdução publicada aparece antes das seções, como na web e
  na Privacidade e na Devolução do app.
- JSON-LD: a nota com fonte não muda nada no `LocalBusiness` (sem
  `aggregateRating` nem `review`); o `StructuredData` monta o negócio por lista
  fechada de campos e não publica uma nota nem que o negócio a traga (D-A).
- Painel: o aviso de publicar e retirar concorda com o nome do texto ("Termos e
  Condições de Uso publicados", "Política de Privacidade publicada").
- Texto legal só em blocos (parágrafo, lista, destaque inicial do item), sem
  HTML nem link; o documento tem `version: 1` e a leitura separa a versão não
  suportada (o app pede atualização) do documento inválido.
- Orçamento: com Termos publicados, o aceite é obrigatório e o diálogo mostra o
  documento da locadora; sem Termos, o pedido segue sem a caixa (o painel
  avisa); com a leitura em andamento, em falha ou numa versão desconhecida, o
  envio fica bloqueado com o motivo, para nunca enviar sem o aceite de Termos
  que existem.
- Sem linha de configurações, publicar responde 409 `SETTINGS_NOT_CONFIGURED`
  (não cria linha com os padrões do Prisma, que trazem o título SEO da GB).

## 8. Error Handling

- Rota pública: tipo inválido 404 `LEGAL_DOCUMENT_UNKNOWN` antes de qualquer
  leitura; documento fora do contrato no banco vira 404 (registrado sem o
  texto); falha 500 sem detalhe.
- Host web: só o 404 vira `notFound()`; 5xx, backend fora, versão desconhecida
  ou documento fora do contrato lançam (página de erro, nunca um 404 falso). A
  leitura das categorias para o JSON-LD é opcional: falha fica sem catálogo.
- Painel: 413 acima de 256 kB, 415 sem JSON, 400 `LEGAL_DOCUMENT_INVALID`, 409
  `SETTINGS_NOT_CONFIGURED`, 404 ao despublicar o que não existe; tudo com
  `Cache-Control: no-store`. O editor mostra a mensagem em pt-BR de cada caso.

## 9. Performance and Accessibility

- A leitura geral não lê os textos legais (só as datas): o
  `GET /api/settings/public` não fica mais pesado.
- O host web entrega as legais já com o texto no HTML do servidor; o índice das
  seções vem do documento.
- Links legais da pausa num `nav` com `aria-label="Documentos legais"`; avisos
  do painel e do orçamento com `role="alert"`.

## 10. Tests and Validation

- Contrato, backend, frontend e painel: `pnpm test:platform`; host web:
  `pnpm test:web`; app: `pnpm test:mobile`.
- Banco: `tests/unit/settings-site-content-legal-columns.test.ts` (CHECK) e
  `tests/unit/storefront-legal-rls.test.ts` (papel restrito, RLS FORCE), no
  banco descartável (`TEST_DATABASE_URL`, `TEST_DATABASE_DISPOSABLE=true`).
- Admissão D-D: `tests/unit/subscription-request-access.test.ts`.
- HTTP nos dois hosts: `tests/api-host/storefront-legal.http.test.ts`,
  `tests/api-host/storefront-legal-paused.http.test.ts` (host web em pausa com
  fiscalização `on`: legais 200 `noindex` `no-store` na moldura, o resto 503),
  extensões de `public-catalog.http.test.ts` e `branding.http.test.ts`
  (`pnpm test:api` no perfil do CI, nos dois motores);
  `tests/security/public-site-state.test.ts`.
- Rotas: `tests/security/route-auth-inventory.test.ts`.
- GB: `tests/unit/gb-site-content.test.ts`,
  `tests/unit/gb-site-settings.test.ts` (uma vez por campo: depois do corte, o
  `--apply` de novo não desfaz o que o dono mudou no painel),
  `tests/unit/gb-legal-documents.parity.test.ts`,
  `tests/unit/gb-site-content.textos.test.tsx` (hero, "Por que escolher",
  contato, detalhe e Sobre com os dados da GB iguais aos goldens de `55763c1e`,
  menos D-A e D-B; a Sobre igual byte a byte à marcação; e a GB no corte, sem a
  frota, igual aos goldens menos só os números e os selos de frota) e
  `tests/unit/gb-site-content.painel.test.ts` (o que o script grava abre no
  painel e volta igual).
- Páginas legais: `tests/unit/paginas-legais.characterization.test.tsx` (as
  páginas web com os documentos da GB iguais ao HTML do B0) e os
  `*.native.test.tsx` das três páginas (árvore nativa igual à do B0).
- Travas: `tests/unit/t12-sem-dados-da-gb.test.ts` (sem pendências U5) e
  `tests/unit/compromissos-do-modelo.test.ts` (sem pendências).
- Visual: `vitrine/termos-pausado` (linha de base gravada) e as seções novas de
  `painel/configuracoes` (estados `secao-horario`, `secao-conteudo`,
  `secao-compromissos` e `secao-textos-legais` em
  `tests/visual/support/scenarios.ts`, aprovados como capturas inteiras, sem
  linha de base para comparar até o painel ser regravado; por elemento, só os
  botões novos da barra nos estados antigos; ver Out of scope). A Sobre fica
  fora da captura (ver Out of scope). Fixture com o conteúdo e os documentos da
  GB exatamente como o script grava, sem a frota
  (`tests/visual/support/fixtures.mjs`): o selo de frota do hero e o número de
  frota do contato saem, com as diferenças aprovadas com o motivo D-B em
  `tests/visual/approved-changes.json`.
- JSON-LD sem nota (D-A): `entities/configuracao/model/local-business.test.ts` e
  `widgets/dados-estruturados/ui/StructuredData.web.test.tsx` (com a nota com
  fonte).

## 11. Related Docs

- `docs/features/identidade-da-vitrine.md`
- `docs/features/seo-e-medicao-da-vitrine.md`
- `docs/features/site-por-estado.md`
- `docs/features/termos-page.md`
- `docs/features/equipment-3d-carousel.md`
- `docs/operations/gb-site-settings.md`
- `docs/architecture/adr-saas-subscription.md` (B.5, B.18)
- `docs/architecture/adr-tenant-hosts.md` (U5)

## 12. Change Log

- 2026-10-07: criação (onda 134, lote vitrine-conteúdo, parte A).
- 2026-10-07: parte B (vitrine web e app, páginas legais pelo documento,
  orçamento sem Termos, legais no ar na pausa, painel web e nativo).
- 2026-10-07: segunda rodada (script da GB uma vez por campo; linha de base
  visual da GB sem frota, aprovada como D-B; introdução dos Termos no app;
  JSON-LD sem nota provado com a nota presente; concordância dos avisos do
  painel; moldura do mapa do contato no mapa, sem exceção de tokens).
- 2026-10-08: onda 135 (lote A, A11): o `siteContent` ganhou as chaves de
  medição e verificação (`googleAnalyticsId`, `googleAdsId`,
  `googleSiteVerification`, `facebookDomainVerification`), editadas na seção
  "SEO & Meta Tags" do painel e lidas chave a chave como as demais; restaurar o
  "Conteúdo do Site" não as apaga. Ver
  `docs/features/seo-e-medicao-da-vitrine.md`.
- 2026-10-07: terceira rodada (cada caractere de controle proibido provado no
  contrato, inclusive U+2029 e U+2066–U+2069, no meio e nas pontas do texto, com
  os vizinhos U+2065 e U+206A aceitos; subtítulo do telefone na web com cada dia
  útil fechado ou sem dado, sem horário e sem WhatsApp, e no app as faixas do
  horário sem a promessa; limites da Sobre e do painel no visual registrados com
  a causa, e os quatro estados novos do painel como capturas inteiras aprovadas,
  sem referência visual).

---

_Template version: 2026-01-20_
