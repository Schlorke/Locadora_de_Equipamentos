# Identidade da locadora na vitrine (T12)

> **Status**: Critical  
> **Last updated**: 2026-10-07

---

## 1. Purpose

Cada vitrine (`{slug}.<raiz>`) mostra só os dados da própria locadora. Até a
onda 131 o frontend completava cabeçalho, rodapé, contato, WhatsApp, JSON-LD,
SEO e as telas de acesso com os dados reais da GB Locações quando a locadora não
os tinha. Uma locadora de outro dono exibia o nome, o CNPJ, o endereço, os
horários, as redes e o WhatsApp da GB (achado 143; T12 da
`docs/architecture/adr-tenant-hosts.md`, Lote 5). O modelo de site também
afirmava, para qualquer locadora, fatos da GB: a região de Porto Alegre, a lista
de construtoras clientes, os anos de mercado, os números de frota, clientes e
projetos, e uma nota de avaliação fixa. A regra agora é esta: os dados vêm do
cartão público e das configurações públicas da locadora, e o que falta fica de
fora. Nunca entra dado de outra locadora.

## 2. Scope

**In scope**

- Identidade pública (`IdentidadePublica`: nome, cidade, UF e logo do cartão), a
  sigla da marca (`siglaDaLocadora`, a mesma regra dos e-mails) e o aviso de
  copyright (`copyrightDaLocadora`: "© 2024 <nome>. Todos os direitos
  reservados."; o ano é o texto do modelo de site, o mesmo de antes). Ficam em
  `model/marca.ts`, funções puras sem `'use client'`. A página de pausa é Server
  Component e chama a sigla no servidor. O contexto e os hooks ficam em
  `model/identidade-publica.tsx`.
- Cabeçalho, rodapé, WhatsApp flutuante, seção "Por que escolher", hero, contato
  da home e página de contato, página Sobre, mapa, telas de entrar, login,
  cadastro, recuperar senha e redefinir senha (web e app), detalhe do
  equipamento, orçamento pelo WhatsApp, JSON-LD (LocalBusiness, Product, trilha,
  SEOSchemas) e SEO do equipamento. Recuperar e redefinir senha mostravam a
  sigla fixa "GB" na casca da vitrine (achado 146, onda 133); agora usam a sigla
  do cartão (`useMarcaDoAcesso`), como entrar, login e cadastro, e sem locadora
  identificada a marca fica vazia.
- Horário de funcionamento e identificação legal (achado 147, onda 133; Decreto
  7.962/2013, art. 2º, I e II). A leitura pública das configurações
  (`GET /api/settings/public`, nos dois hosts) traz também `businessHours` (o
  horário das configurações, só os dias com hora `HH:MM` válida ou fechados) e
  `legalIdentity` (`legalName`, o nome empresarial da organização, e `cnpj`, o
  primeiro CNPJ válido da organização, formatado; nunca CPF nem o documento
  cru). Contrato em `packages/contracts/src/settings.ts`
  (`PublicBusinessHoursSchema`, `PublicLegalIdentitySchema`,
  `PUBLIC_SETTINGS_FIELDS`); regra em
  `packages/backend/src/modules/catalog/public-settings.ts`. É a leitura da
  própria vitrine, separada do cartão do diretório, que continua sem CNPJ. Mesma
  superfície do contato (`identity`: no ar e em pausa respondem; desligado dá o
  404 do D10) e o mesmo cache de antes (nenhum).
  - Rodapé: "Seg-Sex: 8h às 18h", "Sáb: 8h às 12h" (só os dias abertos) e a
    linha do CNPJ, no bloco do relógio, como na produção. Só com CNPJ, o bloco
    aparece sem horário.
  - Contato da home: cartão "Horário de Funcionamento" com "Segunda a Sexta: 8h
    às 18h", "Sábado: 8h às 12h" e a linha do CNPJ. Sem horário aberto, o cartão
    fica de fora (o CNPJ continua no rodapé).
  - Página de contato: cartão "Horário de Funcionamento" com a primeira faixa no
    destaque e as demais, inclusive os dias fechados, no subtítulo ("Sábado: 8h
    às 12h • Domingo: Fechado"), como na produção, sem CNPJ.
  - Linha do CNPJ: "CNPJ: 00.000.000/0000-00"; com nome empresarial diferente do
    nome do cartão, "<nome empresarial> · CNPJ: …".
  - Dias seguidos com o mesmo horário formam uma faixa ("Segunda a Sexta",
    "Segunda e Terça", "Seg-Sex"); dia sem dado quebra a faixa e fica de fora.
- Prévia "Como aparece no Google" do painel (achado 146): saíram as cinco
  estrelas e a nota com a contagem de avaliações fixas, que não vinham de
  avaliações da locadora selecionada.
- Fatos da empresa no modelo de site (segunda rodada do achado 143):
  - Região de atendimento: vem da cidade e da UF do cartão. O texto é
    "Entregamos em toda região de <cidade>…", "Entrega em <cidade> e região",
    "Entrega no mesmo dia para região metropolitana de <cidade>", e o JSON-LD do
    produto usa `addressRegion` com a UF. Sem cidade ou UF, o texto fica neutro
    e o JSON-LD só traz o país.
  - Saíram, por não terem fonte por locadora: o cartão das construtoras clientes
    e o dos anos de mercado ("Por que escolher"); o "Há 10 anos" do subtítulo do
    hero; os selos de frota e de anos do hero e da prévia no painel; o "Mais de
    10 anos" do detalhe; os números de anos, projetos e frota do topo do
    contato; na página Sobre, os números, a história e a linha do tempo da GB e
    o selo do Google com o nome dela.
  - Saiu a nota fixa de avaliações ("4.8 (127 avaliações)" no detalhe web e no
    app, e o `aggregateRating` 4.8/124 do JSON-LD do produto). Ela não vinha de
    avaliações reais.
- WhatsApp do orçamento: no web, o número é lido ao montar o formulário
  (`useWhatsAppCarregado`) e o clique abre a janela sem esperar a rede. Um
  `window.open` depois de um `await` é descartado pelo bloqueador de pop-ups. No
  app, o número é lido no clique (`useWhatsAppNoClique`; o `Linking` não tem
  bloqueador).
- Painel: o formulário de configurações abre sem os padrões da GB. Antes, o
  formulário de qualquer locadora nascia com o contato da GB, e salvar gravava
  esses dados nela. As prévias usam o nome da locadora selecionada, e os
  exemplos (texto "Sobre nós", dica do ISS) não citam o município da GB. A marca
  do painel e dos laboratórios usa o nome provisório da plataforma
  (`PLATFORM.displayName`).
- Script de corte das configurações da GB (`tools/gb-site-settings.mjs`, runbook
  `docs/operations/gb-site-settings.md`). O `--apply` só grava na organização
  com o CNPJ da GB.

**Out of scope (pendências registradas)**

- Conteúdo institucional, compromissos comerciais, textos legais (U5), o
  formulário do horário no painel e o horário e o CNPJ no app saíram desta lista
  na onda 134 (ver `docs/features/conteudo-da-vitrine.md`). Ficam de fora da
  onda: a nota de avaliações da GB com fonte (D-A) e a frota da GB (D-B), que o
  dono preenche no painel.
- Frete do orçamento (P-1): rótulo "Transportadora GB" e CEP de origem da GB
  para qualquer locadora; fica para o lote "frete por locadora". O T12 vigia os
  dois (pendências declaradas em `packages/domain/src/orcamento/frete.ts` e
  `pages/orcamento/model/use-quote-page.ts`).

## 3. Entry Points

- Identidade:
  `packages/frontend/src/entities/organizacao/model/identidade-publica.tsx`
  (`IdentidadePublicaProvider`, `useIdentidadePublica`, `useMarcaDoAcesso`) e
  `model/marca.ts` (`siglaDaLocadora`, `copyrightDaLocadora`).
- Horário e CNPJ: `packages/frontend/src/entities/configuracao/model/`
  `horario-de-funcionamento.ts` (`faixasDoHorario`, `linhaDaFaixa`) e
  `identificacao-legal.ts` (`linhaLegal`); `usePublicSettings` valida os dois
  campos com os schemas do contrato e devolve `null` fora dele.
- Backend: `packages/backend/src/modules/catalog/public.ts`
  (`getPublicSettings`, configurações e organização na mesma transação da
  locadora) e `public-settings.ts` (`publicBusinessHours`,
  `publicLegalIdentity`), compostos atualmente por
  `apps/services/api/src/host/runtime.ts`. A fachada antiga `lib/catalog.ts` foi
  retirada em F; o host web lê essa API pelo seu adapter servidor.
- Host web: `apps/clients/web/src/app/(public)/[locadora]/layout.tsx` (cartão do
  escopo da área do cliente) → `host/providers/TenantSiteProviders.tsx` →
  `AppProviders` (`publicTenantIdentity`).
- SEO/JSON-LD do host:
  `apps/clients/web/src/app/(public)/[locadora]/(vitrine)/loja.ts`
  (`getLojaDaVitrine`: cartão e origem canônica `https://{slug}.<raiz>`),
  `(vitrine)/page.tsx` e `(vitrine)/equipamentos/[id]/page.tsx`.

## 4. Core Flow

1. O layout `[locadora]` lê o cartão (nome, cidade, UF, logo) e o passa ao
   `TenantSiteProviders`, que o entrega ao `AppProviders`.
2. Os widgets leem a identidade (`useIdentidadePublica`) e as configurações
   públicas (`usePublicSettings`). Cada bloco aparece só com o dado presente, e
   os textos de região usam a cidade do cartão.
3. Sem identidade informada (por exemplo no cliente móvel ou painel), o hook
   devolve `null` e nada de marca aparece. Na etapa original a raiz antiga
   `app/` também não fornecia essa identidade; foi retirada em F. Ele não
   consulta a API, porque o proxy do host de locadora nega o cartão ao navegador
   (allowlist do Lote 4b). Passar a identidade também no cliente móvel era
   pendência daquela etapa e continua exigindo seu consumidor real; restaurar a
   raiz antiga não é tarefa.
4. JSON-LD e SEO usam o nome, a cidade, a UF e a origem canônica da própria
   locadora. Sem origem (ambiente sem raiz), os caminhos saem relativos.

## 5. Components and Files

- `widgets/cabecalho`, `widgets/rodape`, `widgets/whatsapp-flutuante`,
  `widgets/por-que-escolher` (`model/beneficios.ts`), `widgets/hero`,
  `widgets/contato-home`, `widgets/dados-estruturados`, `widgets/seo-schemas`,
  `widgets/avaliacoes-google`, `features/mapa-loja`.
- `entities/configuracao/model/local-business.ts`
  (`getLocalBusinessData(settings, identidade)` → `null` sem nome),
  `entities/equipamento/model/seo.ts` (`EquipmentSeoStore`, com `state` para a
  UF de entrega), `entities/orcamento/model/whatsapp-data.ts` (`storeName`, link
  na origem do site).
- `pages/entrar`, `pages/login`, `pages/cadastro`, `pages/equipamento-detalhe`
  (`model/regiao.ts`), `pages/orcamento` (`model/whatsapp-da-locadora.ts`),
  `pages/configuracoes`, `pages/contato`, `pages/sobre`, `pages/playground`
  (laboratório com os mesmos benefícios, sem locadora).

## 6. Data and State

- Cartão público: `organizations.name`, `city`, `state` e o logo das
  configurações (`GET /api/public/tenants/{slug}`).
- Configurações públicas: `companyPhone`, `whatsappNumber`, `contactEmail`,
  `marketingEmail`, `companyAddress`, `companyIconUrl`, `aboutUsText`,
  `socialLinks`, `heroCarousel`, `waveAnimation`, `businessHours` e
  `legalIdentity` (`GET /api/settings/public`; os dois últimos desde a onda
  133).
- Identificação legal: `organizations.legalName` e o CNPJ de
  `organizations.documentNormalized` (cadastro da plataforma) ou, sem ele,
  `organizations.document` (legado), lidos na transação da locadora.
- Nenhuma coluna nem migration nova; o contrato público ganhou os dois campos
  (aditivo).

## 7. Constraints and Edge Cases

- Sem nome no cartão: sem sigla nem nome no cabeçalho e no rodapé, o copyright
  vira "Todos os direitos reservados." e o JSON-LD fica sem LocalBusiness.
- Sem cidade no cartão: os textos de região ficam neutros ("Entregamos em toda a
  região…", "Entrega na região"). Sem UF, a entrega do JSON-LD fica só no país.
- Sem WhatsApp, o botão flutuante não aparece e o orçamento pelo WhatsApp avisa
  "WhatsApp indisponível". Com as configurações ainda carregando, o clique pede
  para tentar de novo.
- Telefone e WhatsApp são opcionais. O cartão "Telefone" da página de contato
  (`pages/contato/model/use-contact-page.ts`) e o botão de telefone do CTA de
  "Por que escolher" e da Sobre mostram só os números informados (vazio ou só
  espaços não conta), com o separador "|" só entre os dois. Sem nenhum, o
  elemento sai, como o bloco de telefone do rodapé e do `ContactInfoCard`.
  Enquanto as configurações carregam, ele fica no lugar, sem número nem
  separador. Com os dois (a GB), a marcação é a de `55763c1e`. O app recebe o
  mesmo modelo e mostra os canais no `ContactInfoCard`, um botão por número.
- Hero e cabeçalho seguem a mesma regra (2026-10-07). O hero recebe o telefone e
  o WhatsApp já no SSR: `buildHeroInitialSettings`
  (`pages/home/model/hero-settings.ts`) leva os dois números da leitura pública
  (`GET /api/settings/public`, aparados; ausente, vazio), e a rota da home do
  host web (`apps/clients/web/src/app/(public)/[locadora]/(vitrine)/page.tsx`)
  os passa. Antes, com o recorte inicial o hero não consultava a API e ficava
  sem os números em toda locadora, inclusive a GB: no desktop, o ícone e um "|"
  sozinho; no celular, um link vazio. No hero, sem nenhum número o bloco do
  telefone sai e a região de entrega fica; carregando, o hero inteiro fica no
  fundo silencioso. No cabeçalho (barra do topo), sem nenhum número (inclusive
  sem locadora, como no laboratório `/catalog`) o bloco sai; carregando, fica no
  lugar só com o ícone. Com os dois (a GB), hero e cabeçalho têm a marcação da
  produção (`main` `eb4c0098`, `components/hero.tsx` e `components/header.tsx`),
  byte a byte. No celular, hero e cabeçalho mostram um número só: o WhatsApp,
  como na produção; sem WhatsApp, o telefone (no hero, o espaço do celular
  recebe o telefone; no cabeçalho, o link do telefone perde o `hidden sm:inline`
  e fica com a classe do link do WhatsApp). Antes, uma locadora só com telefone
  via no celular só o ícone, sem número. No registro de2026-10-08, a home antiga
  (`app/page.tsx`, retirada em F) também passava `companyPhone` e
  `whatsappNumber`, que lia do banco, a `buildHeroInitialSettings`. A fonte
  atual da home web é a rota da vitrine qualificada acima, com o mesmo contrato.
  As prévias do painel (`HeaderFooterPreview` e `HeroCarouselPreview` no web,
  `SettingsPreviews` no app) e o laboratório `pages/playground` ainda têm o "|"
  fixo (pendências registradas).
- Rede social sem URL: o ícone fica sem link, como o LinkedIn já ficava.
- Página Sobre sem texto "Sobre nós": sem o parágrafo; sem nome, "Sobre nós". A
  seção do selo do Google só aparece com o selo e o nome da própria locadora (o
  host web não passa o selo, porque não há Merchant ID por locadora).
- Sem `businessHours` válido: nenhum horário (nunca um padrão). Organização sem
  CNPJ válido (vazio, CPF, dígito errado): sem linha do CNPJ. Locadora sem
  configurações continua com o 409 `SETTINGS_NOT_CONFIGURED`, e a vitrine fica
  sem horário e sem CNPJ.
- O padrão `seoTitle` do banco (`prisma/schema.prisma`, migration da linha de
  base) ainda é "GB Locações - Equipamentos para Construção", e o padrão de ISS
  é 2,5%, a alíquota de Porto Alegre. Os dois ficam fora do frontend e são
  pendências registradas.

## 8. Error Handling

- Cartão ou configurações indisponíveis: omissão neutra, sem quebrar a página.

## 9. Performance and Accessibility

- No host de locadora a identidade vem do servidor, sem consulta extra no
  navegador. O `alt` do logo é o nome da locadora.
- O tempo do evento `scrollRevealReady` (2,7 s na primeira visita) não mudou com
  a saída dos selos do hero. O carrossel 3D sincroniza o primeiro modelo com ele
  (`docs/features/equipment-3d-carousel.md`).

## 10. Tests and Validation

- T12: `tests/unit/t12-sem-dados-da-gb.test.ts`. Varre `packages/frontend/src`,
  `packages/ui/src`, `apps/clients/web/src`, `apps/clients/mobile/src` e, desde
  a onda 134, `packages/domain/src`, fora de testes e fixtures. Na onda 134 o
  rótulo do modelo ("Anos de Experiência", `${anos} Anos de Experiência`) deixou
  de acusar, e só o número fixo acusa ("10+ Anos de Experiência", "+200
  Equipamentos", "500+ Clientes"); o frete simulado ("Transportadora GB" e o CEP
  de origem da GB) passou a acusar, com as pendências P-1 declaradas. Procura a
  identificação da GB e os fatos que o modelo afirmava: cidade, construtoras,
  anos de mercado, números da empresa, nota fixa e a UF no JSON-LD. Desde a
  parte B da onda 134 não há pendência U5 (os textos legais vêm do documento de
  cada locadora); só o frete (P-1) e a lista gerada de `public/` ficam
  declarados e conferidos.
- Renderizado para uma locadora que não é a GB (Curitiba/PR): "Por que escolher"
  (`PorQueEscolher.web.test.tsx`, `model/beneficios.test.ts`), hero
  (`Hero.web.test.tsx`), detalhe web e app
  (`EquipamentoDetalhePage.web.test.tsx`,
  `EquipmentDetailScreen.native.test.tsx`, `model/regiao.test.ts`), Sobre
  (`SobrePage.web.test.tsx`), contato (`ContatoPage.test.tsx`) e JSON-LD
  (`StructuredData.web.test.tsx`, `seo.test.ts`).
- T12 (onda 133, achado 146): também pega a sigla "GB" como marca (texto ou
  literal `'GB'`, fora de uma lista de unidades como `'MB', 'GB'`) e a nota ou a
  contagem fixa de avaliações.
- Recuperar e redefinir senha para outra locadora ("Locadora Nova" → "LN"), sem
  locadora (marca vazia) e na casca da plataforma:
  `RecuperarSenhaPage.test.tsx`, `ResetPasswordPage.test.tsx` e os
  `.casca.native.test.tsx`. Prévia SEO sem nota:
  `SettingsPreviews.web.test.tsx`.
- Horário e CNPJ: contrato (`settings.publica.test.ts`), regra e composição no
  backend (`public-settings.test.ts`), rota legada
  (`tests/unit/catalog-http.test.ts`), os dois hosts sobre PostgreSQL com RLS
  (`tests/api-host/public-catalog.http.test.ts`: a alfa recebe os dela; a bravo,
  nenhum e nada da alfa; legado e serviço com o mesmo corpo), hook
  (`use-public-settings.test.ts`), formatação
  (`horario-de-funcionamento.test.ts`, `identificacao-legal.test.ts`), rodapé,
  contato da home e página de contato.
- WhatsApp: `use-quote-form.whatsapp.test.tsx` simula o bloqueador de pop-ups
  (abre só durante o clique).
- Telefone e WhatsApp opcionais: `ContatoPage.test.tsx` (web: os dois, só um,
  nenhum e carregando), `ContatoPage.telefone.native.test.tsx` (app: o modelo
  que a tela recebe e o `ContactInfoCard` nativo real),
  `PorQueEscolher.web.test.tsx` e `SobrePage.web.test.tsx`; a GB igual aos
  goldens em `tests/unit/gb-site-content.textos.test.tsx`. Hero e cabeçalho:
  `Hero.telefone.web.test.tsx` e `Cabecalho.telefone.web.test.tsx` (os dois
  números com a marcação da produção, só um, nenhum, só espaços, um número
  visível no celular sempre que houver algum e, no cabeçalho, carregando),
  `model/hero-settings.test.ts` (o recorte do SSR leva os números) e
  `page.test.tsx` da home do host web (a rota os passa; locadora sem WhatsApp
  recebe só o telefone).
- Script: `tests/unit/gb-site-settings.test.ts`, no banco descartável com um
  papel restrito. Inclui a trava do `--apply` em outra locadora e na GB sem
  CNPJ. A trava confere o CNPJ que a vitrine mostra (o normalizado do cadastro
  da plataforma antes do legado), comparada com `publicLegalIdentity`: trava
  verde implica o CNPJ da GB no site.
- Linha de base visual: as mudanças aprovadas estão em
  `tests/visual/approved-changes.json`, uma entrada por captura e por elemento,
  com o motivo. Na onda 133, a locadora da linha de base passou a ter horário e
  CNPJ nas configurações públicas (`tests/visual/support/fixtures.mjs`), e as
  aprovações da onda 132 para o horário e o CNPJ que saíam do rodapé e do
  contato da vitrine deixaram de ser necessárias e saíram. Ficam as duas do
  laboratório `/catalog` do host app, que não tem locadora (sem horário nem
  CNPJ). Desde o lote dos números no hero, também as dez do bloco do telefone do
  cabeçalho do `/catalog`, que sai sem locadora.

## 11. Related Docs

- `docs/architecture/adr-tenant-hosts.md` (T12, Lote 5, U5)
- `docs/features/site-por-estado.md`
- `docs/operations/gb-site-settings.md`

## 12. Change Log

- 2026-10-06: criação (onda 132, achado 143).
- 2026-10-06: segunda rodada do achado 143. Saíram os fatos da GB que o modelo
  de site afirmava para qualquer locadora; a região de atendimento passou a vir
  do cartão; saiu a nota de avaliações fixa; a página Sobre ficou neutra; o
  copyright voltou a ter o ano do modelo; o WhatsApp do orçamento abre no
  próprio clique no web; e o script de corte ganhou a trava do CNPJ.
- 2026-10-06: onda 133 (achados 146 e 147). Recuperar e redefinir senha com a
  sigla da própria locadora; prévia SEO sem nota fixa; T12 com a sigla e a
  contagem de avaliações; horário de funcionamento e CNPJ de volta ao rodapé, ao
  contato da home e à página de contato, pela leitura pública das configurações
  da própria locadora.
- 2026-10-07: onda 134, parte A (lote vitrine-conteúdo): campos de conteúdo
  institucional e textos legais por locadora (ver
  `docs/features/conteudo-da-vitrine.md`); T12 com o domínio, os números fixos
  em texto corrido e o frete (P-1); trava das frases de compromisso.
- 2026-10-07: onda 134, parte B (lote vitrine-conteúdo): vitrine web e app com o
  conteúdo institucional e os compromissos da própria locadora; páginas legais e
  orçamento pelo documento da locadora; legais no ar na pausa; painel com
  horário, conteúdo, compromissos e textos legais; T12 sem pendências U5, com o
  frete vigiado.
- 2026-10-06: segunda rodada da onda 133 (achado 147). A trava do script de
  corte passou a conferir o mesmo documento que a vitrine mostra (o normalizado
  antes do legado; antes conferia o legado primeiro e tirava qualquer caractere
  que não fosse dígito); comentários do script e runbook sem a pendência do
  horário, que a vitrine já lê.
- 2026-10-07: telefone e WhatsApp opcionais no contato (web e app), no CTA de
  "Por que escolher" e na Sobre: só os números informados, o "|" só entre os
  dois e, sem nenhum, o elemento sai. Antes sobrava "(11) 1234-5678 | " sem
  WhatsApp, " | (41) …" sem telefone e " | " sem os dois.
- 2026-10-07: números no hero e regra do separador no hero e no cabeçalho. O SSR
  da home leva o telefone e o WhatsApp da locadora ao hero, que voltou a mostrar
  os números como na produção (antes, o ícone e um "|" sozinho em toda
  locadora); hero e cabeçalho mostram só os números presentes, com o "|" só
  entre os dois, e o bloco sai sem nenhum. Linha de base visual: dez aprovações
  por elemento do cabeçalho do `/catalog` sem locadora (o bloco saiu, a 1440 e a
  390); na home, só o texto dos links do hero muda (o comparador não compara
  texto).
- 2026-10-07: reparo dos números no hero. No celular, sem WhatsApp, hero e
  cabeçalho mostram o telefone (antes, só o ícone); com o WhatsApp, só ele, como
  na produção. A linha de base visual não muda (a fixture tem os dois números),
  e o histórico de `tests/visual/README.md` ganhou a linha do lote.

---

_Template version: 2026-01-20_
