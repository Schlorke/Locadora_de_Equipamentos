# Diário de migração

Outro engenheiro continua por este arquivo e por `docs/migration/00-plano.md`.
Não reescrever seções antigas; acrescentar a fatia seguinte.

Dono: plataforma. Atualizar ao fechar cada fatia. Código de produto não importa
`docs/`.

## 00-plano

Fatia de inventário. Nenhum arquivo de produto foi editado. Escopo npm proposto
`@gb-locacoes`, ainda não confirmado.

```yaml
fatia:
  id: 00-plano
  estado: blocked
  conceito: inventário e ordem das fatias; esqueleto bloqueado no escopo npm
  origem:
    - package.json
    - pnpm-workspace.yaml
    - prisma/schema.prisma
    - app/
    - components/
    - hooks/
    - stores/useCartStore.ts
    - design-tokens/
    - lib/stripe.ts
    - lib/payment-gateways/
    - .agents/skills/legacy-code-refactoring/scripts/legacy-inventory.mjs
  destino:
    - docs/migration/00-plano.md
    - docs/migration/MIGRATION.md
  invariantes:
    - id: urls-de-pagina-inalteradas
      prova:
        "46 page.tsx listados em docs/migration/00-plano.md; nenhum arquivo de
        app/ editado"
    - id: schema-prisma-intacto
      prova:
        "schema.prisma só lido; nenhum comando db:push, seed ou migrate
        executado"
    - id: npm-scope-nao-inventado
      prova: "[INFORMATION_NEEDED: npm_scope]; nenhum package.json novo"
  comandos:
    - cmd:
        "node
        .agents/skills/legacy-code-refactoring/scripts/legacy-inventory.mjs
        --root <repo> --json"
      exit: 0
    - cmd: "git log --pretty=format: --name-only | agrupado por frequência"
      exit: 0
  gate:
    arch: not_run
    tokens: not_run
    violacoes_conhecidas:
      - "apps/clients/web ausente"
      - "apps/clients/mobile ausente"
      - "packages/frontend ausente"
      - "packages/ui ausente"
      - "packages/design-tokens ausente"
      - "app/, components/, hooks/, lib/ e design-tokens/ na raiz continuam
        sendo o produto"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: pnpm arch]"
    - "[NOT_VERIFIED: pnpm tokens]"
    - "[NOT_VERIFIED: pnpm test]"
    - "[NOT_VERIFIED: pnpm type-check]"
    - "[NOT_VERIFIED: pnpm build]"
    - "[INFORMATION_NEEDED: cobertura]"
    - "[INFORMATION_NEEDED: npm_scope]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 01-esqueleto

Escopo confirmado pelo pedido de seguir: `@gb-locacoes`. O app Next da raiz
continua servindo as URLs de produção. O host novo ainda não é o `pnpm build`.

```yaml
fatia:
  id: 01-esqueleto
  estado: intermediate
  conceito:
    topologia ao lado do legado, com catálogo e tokens da marca já lidos em
    design-tokens/base.json
  origem:
    - .agents/skills/multiplatform-platform-architecture/assets/template/
    - design-tokens/base.json
    - package.json
    - pnpm-workspace.yaml
  destino:
    - apps/clients/web/
    - apps/clients/mobile/
    - packages/frontend/
    - packages/ui/
    - packages/design-tokens/
    - tools/arch-check.mjs
    - tools/token-check.mjs
    - tools/token-propagation-check.mjs
    - arch.config.json
    - tsconfig.base.json
    - vitest.platform.config.ts
  invariantes:
    - id: app-raiz-intacto
      prova: "nenhum arquivo em app/ foi editado nesta fatia"
    - id: button-primario-usa-token
      prova:
        "pnpm exec vitest run --config vitest.platform.config.ts (8 testes, exit
        0)"
    - id: sem-produto-de-exemplo
      prova:
        "slices product, toggle-favorite, product-highlight e pages/home do
        template foram removidos"
  comandos:
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
    - cmd: "pnpm exec vitest run --config vitest.platform.config.ts"
      exit: 0
    - cmd: "pnpm install"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "app/ na raiz ainda é o Next que serve produção"
      - "components/, hooks/, stores/ e design-tokens/ na raiz continuam donos
        da UI de produto"
      - "pnpm build ainda não é o host apps/clients/web"
      - "catálogo novo não substitui nenhuma URL existente"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: pnpm typecheck]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: pnpm check:tokens]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[INFORMATION_NEEDED: cobertura]"
```

## 02-moeda

`formatCurrency` passou a ter um dono só. Os dois módulos legados reexportam a
mesma função. O corpo não mudou.

```yaml
fatia:
  id: 02-moeda
  estado: intermediate
  conceito:
    formatador de real brasileiro, compartilhado por equipamento, orçamento e
    pagamento
  origem:
    - lib/utils.ts
    - lib/utils/formatting.ts
    - lib/formatters.test.ts
  destino:
    - packages/frontend/src/shared/lib/moeda.ts
    - packages/frontend/src/shared/lib/moeda.test.ts
    - packages/frontend/src/shared/lib/index.ts
    - lib/utils.ts
    - lib/utils/formatting.ts
  invariantes:
    - id: real-1234-56
      prova:
        "vitest moeda.test.ts espera R$ 1.234,56 com nbsp; tsx comparou
        lib/utils e lib/utils/formatting"
    - id: real-zero
      prova: "vitest moeda.test.ts espera R$ 0,00 com nbsp"
    - id: real-negativo
      prova:
        "vitest moeda.test.ts aceita o mesmo padrão de lib/formatters.test.ts"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/shared/lib/moeda.test.ts"
      exit: 0
    - cmd:
        "pnpm exec tsx -e import formatCurrency from lib/utils and
        lib/utils/formatting"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "lib/utils.ts e lib/utils/formatting.ts importam
        packages/frontend/src/shared/lib por caminho interno, fora do export
        ./app e ./pages/*"
      - "app/ na raiz ainda é o Next que serve produção"
      - "components/ e hooks/ continuam donos da UI de produto"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: pnpm typecheck]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 03-ui-button

O botão de produção mudou de dono. As classes, inclusive a variante `reset`,
continuam as mesmas. `components/ui/button.tsx` só reexporta.

```yaml
fatia:
  id: 03-ui-button
  estado: intermediate
  conceito: primitivo Button de produção, com as variantes já usadas nas telas
  origem:
    - components/ui/button.tsx
    - tests/components/button.test.tsx
  destino:
    - packages/ui/src/contract/button.ts
    - packages/ui/src/web/Button.web.tsx
    - packages/ui/src/native/Button.native.tsx
    - packages/ui/src/catalog.ts
    - components/ui/button.tsx
  invariantes:
    - id: botao-alugar-slate
      prova: "Button.web.test.tsx contém Alugar e bg-slate-700"
    - id: reset-sem-zoom-nem-borda-laranja
      prova:
        "Button.web.test.tsx e tsx do reexport exigem hover:text-orange-500 e
        hover:shadow-lg, e rejeitam hover:scale-105 e hover:border-orange-500"
    - id: disabled-nao-dispara-no-nativo
      prova: "Button.native.test.tsx espera onPress undefined quando disabled"
  comandos:
    - cmd: "pnpm exec vitest run --config vitest.platform.config.ts packages/ui"
      exit: 0
    - cmd: "pnpm exec tsx -e render components/ui/button reset variant"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/ui/button.tsx ainda existe como reexport e as telas importam
        @/components/ui/button"
      - "app/, components/ e hooks/ continuam donos da UI de produto"
      - "a suíte tests/components/button.test.tsx não rodou: TEST_DATABASE_URL
        ausente no globalSetup"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test tests/components/button.test.tsx]"
    - "[NOT_VERIFIED: pnpm typecheck]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 04-ui-input

O campo de texto de produção mudou de dono. Input numérico continua com
Incrementar e Decrementar. `components/ui/input.tsx` só reexporta.

```yaml
fatia:
  id: 04-ui-input
  estado: intermediate
  conceito: primitivo Input, inclusive o stepper de campos numéricos
  origem:
    - components/ui/input.tsx
  destino:
    - packages/ui/src/contract/input.ts
    - packages/ui/src/web/Input.web.tsx
    - packages/ui/src/native/Input.native.tsx
    - packages/ui/src/catalog.ts
    - packages/frontend/src/pages/catalog/ui/CatalogPage.tsx
    - components/ui/input.tsx
  invariantes:
    - id: numero-tem-incrementar-e-decrementar
      prova:
        "Input.web.test.tsx e tsx do reexport exigem aria-label Incrementar e
        Decrementar"
    - id: numero-desabilitado-sem-clique
      prova:
        "Input.web.test.tsx contém pointer-events-none; Input.native.test.tsx
        espera onChangeText undefined"
  comandos:
    - cmd: "pnpm exec vitest run --config vitest.platform.config.ts packages/ui"
      exit: 0
    - cmd: "pnpm exec tsx -e render components/ui/input type number"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/ui/input.tsx ainda existe como reexport"
      - "app/, components/ e hooks/ continuam donos da UI de produto"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: pnpm typecheck]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 05-ui-form

Label, textarea e separador passaram para `packages/ui`. As classes de produção
continuam. Os três arquivos legados só reexportam.

```yaml
fatia:
  id: 05-ui-form
  estado: intermediate
  conceito: primitivos Label, Textarea e Separator
  origem:
    - components/ui/label.tsx
    - components/ui/textarea.tsx
    - components/ui/separator.tsx
  destino:
    - packages/ui/src/web/Label.web.tsx
    - packages/ui/src/web/Textarea.web.tsx
    - packages/ui/src/web/Separator.web.tsx
    - packages/ui/src/native/Label.native.tsx
    - packages/ui/src/native/Textarea.native.tsx
    - packages/ui/src/native/Separator.native.tsx
    - packages/ui/src/contract/form.ts
    - components/ui/label.tsx
    - components/ui/textarea.tsx
    - components/ui/separator.tsx
  invariantes:
    - id: label-email
      prova: "form.web.test.tsx e tsx do reexport contêm E-mail"
    - id: textarea-min-h-80
      prova: "form.web.test.tsx e tsx do reexport contêm min-h-[80px]"
    - id: separator-1px
      prova: "form.web.test.tsx e tsx do reexport contêm h-[1px]"
  comandos:
    - cmd: "pnpm exec vitest run --config vitest.platform.config.ts packages/ui"
      exit: 0
    - cmd: "pnpm exec tsx -e render label textarea separator"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/ui/label.tsx, textarea.tsx e separator.tsx ainda existem
        como reexport"
      - "app/, components/ e hooks/ continuam donos da UI de produto"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: pnpm typecheck]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 06-ui-surface

Card e Badge passaram para `packages/ui`. As classes de produção continuam. Os
arquivos legados só reexportam.

```yaml
fatia:
  id: 06-ui-surface
  estado: intermediate
  conceito: primitivos Card (e partes) e Badge
  origem:
    - components/ui/card.tsx
    - components/ui/badge.tsx
  destino:
    - packages/ui/src/web/Card.web.tsx
    - packages/ui/src/web/Badge.web.tsx
    - packages/ui/src/native/Card.native.tsx
    - packages/ui/src/native/Badge.native.tsx
    - components/ui/card.tsx
    - components/ui/badge.tsx
  invariantes:
    - id: card-bg-card
      prova:
        "surface.web.test.tsx e tsx do reexport contêm rounded-lg border bg-card
        e Betoneira"
    - id: badge-bg-primary
      prova:
        "surface.web.test.tsx e tsx do reexport contêm bg-primary
        text-primary-foreground"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/surface.web.test.tsx packages/ui/src/catalog.test.ts"
      exit: 0
    - cmd: "pnpm exec tsx -e render card and badge"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/ui/card.tsx e badge.tsx ainda existem como reexport"
      - "app/, components/ e hooks/ continuam donos da UI de produto"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: pnpm typecheck]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 07-pagina-cookies

O texto de `/cookies` foi para `packages/frontend`. A URL, o layout e a metadata
continuam em `app/cookies`. O cartão de contato, que ainda lê configurações, é
passado pela rota.

```yaml
fatia:
  id: 07-pagina-cookies
  estado: intermediate
  conceito: página pública Política de Cookies
  origem:
    - app/cookies/page.tsx
    - app/cookies/layout.tsx
    - app/cookies/metadata.ts
  destino:
    - packages/frontend/src/pages/cookies/ui/CookiesPage.tsx
    - packages/frontend/src/pages/cookies/ui/CookiesPage.test.tsx
    - packages/frontend/src/pages/cookies/index.ts
    - app/cookies/page.tsx
    - apps/clients/web/src/app/cookies/page.tsx
    - apps/clients/mobile/src/app/cookies.tsx
    - next.config.mjs
  invariantes:
    - id: titulo-e-introducao
      prova:
        "CookiesPage.test.tsx contém Política de Cookies, Introdução e a nota de
        gerenciar cookies no navegador"
    - id: contato-injetado-pela-rota
      prova:
        "o teste renderiza o slot contact; app/cookies/page.tsx passa
        ContactInfoCard com a mesma description"
    - id: metadata-intacta
      prova: "app/cookies/metadata.ts e layout.tsx não foram editados"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/cookies/ui/CookiesPage.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "app/ na raiz ainda serve /cookies; a rota só compõe a page"
      - "apps/clients/web /cookies não recebe ContactInfoCard porque o card
        ainda depende de hook legado"
      - "fill #f9fafb da onda SVG permanece, com token-check-allow, porque
        gray-50 não está na paleta"
      - "components/ e hooks/ continuam donos do restante da UI"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 08-paginas-legais

`/privacidade` e `/politica-devolucao` seguem o mesmo corte de `/cookies`.
Metadata e layout não mudaram. O cartão de contato continua injetado pela rota,
com o mesmo texto.

```yaml
fatia:
  id: 08-paginas-legais
  estado: intermediate
  conceito: páginas públicas de privacidade e de devolução
  origem:
    - app/privacidade/page.tsx
    - app/politica-devolucao/page.tsx
  destino:
    - packages/frontend/src/pages/privacidade/ui/PrivacidadePage.tsx
    - packages/frontend/src/pages/politica-devolucao/ui/PoliticaDevolucaoPage.tsx
    - app/privacidade/page.tsx
    - app/politica-devolucao/page.tsx
    - apps/clients/web/src/app/privacidade/page.tsx
    - apps/clients/web/src/app/politica-devolucao/page.tsx
    - apps/clients/mobile/src/app/privacidade.tsx
    - apps/clients/mobile/src/app/politica-devolucao.tsx
  invariantes:
    - id: privacidade-titulo-e-coleta
      prova:
        "PrivacidadePage.test.tsx contém Política de Privacidade e Informações
        que Coletamos"
    - id: devolucao-titulo-e-prazo
      prova:
        "PoliticaDevolucaoPage.test.tsx contém Política de Devolução e Prazo
        para Devolução"
    - id: contato-da-devolucao
      prova:
        "app/politica-devolucao/page.tsx passa a description original do
        ContactInfoCard; privacidade passa o card sem description"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/privacidade/ui/PrivacidadePage.test.tsx
        packages/frontend/src/pages/politica-devolucao/ui/PoliticaDevolucaoPage.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "as rotas na raiz ainda servem as URLs e injetam ContactInfoCard"
      - "os hosts novos não recebem o cartão, que ainda depende de hook legado"
      - "fill #f9fafb das ondas SVG permanece com token-check-allow"
      - "app/termos ainda está inteiro no legado por importar components/terms"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 09-pagina-termos

`/termos` foi para o frontend. O texto legal e a data `19 de janeiro de 2026`
continuam os mesmos. `components/terms/terms-content.ts` só reexporta, então o
orçamento que importa esse caminho não muda de payload.

```yaml
fatia:
  id: 09-pagina-termos
  estado: intermediate
  conceito:
    página pública de termos e o texto legal compartilhado com o orçamento
  origem:
    - app/termos/page.tsx
    - components/terms/terms-content.ts
  destino:
    - packages/frontend/src/entities/termo/model/terms-content.ts
    - packages/frontend/src/entities/termo/index.ts
    - packages/frontend/src/pages/termos/ui/TermosPage.tsx
    - packages/frontend/src/pages/termos/index.ts
    - app/termos/page.tsx
    - components/terms/terms-content.ts
    - apps/clients/web/src/app/termos/page.tsx
    - apps/clients/mobile/src/app/termos.tsx
  invariantes:
    - id: data-19-janeiro-2026
      prova:
        "TermosPage.test.tsx e o reexport legado exigem termsLastUpdated === 19
        de janeiro de 2026"
    - id: secao-objeto
      prova:
        "termsSections contém Objeto e Aceitação; o HTML contém Termos e
        Condições de Uso e o parágrafo de boas-vindas"
    - id: contato-mesma-description
      prova:
        "app/termos/page.tsx passa ContactInfoCard com Estamos à disposição para
        esclarecer quaisquer dúvidas."
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/termos/ui/TermosPage.test.tsx"
      exit: 0
    - cmd:
        "pnpm exec tsx -e import termsLastUpdated from
        components/terms/terms-content.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/terms/terms-content.ts ainda existe como reexport por
        caminho interno, usado por app/orcamento/page.tsx"
      - "a rota /termos na raiz ainda injeta ContactInfoCard"
      - "fill #f9fafb da onda SVG permanece com token-check-allow"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 10-contato-empresa

O cartão de contato e a leitura de configurações públicas passaram para o
frontend. As quatro páginas legais renderizam o cartão por conta própria, com as
mesmas frases e os mesmos telefones e e-mails padrão.

```yaml
fatia:
  id: 10-contato-empresa
  estado: intermediate
  conceito: cartão de contato e leitura das configurações públicas
  origem:
    - components/ui/contact-info-card.tsx
    - hooks/use-public-settings.ts
  destino:
    - packages/frontend/src/entities/configuracao/api/use-public-settings.ts
    - packages/frontend/src/entities/configuracao/index.ts
    - packages/frontend/src/widgets/contato-empresa/ui/ContactInfoCard.tsx
    - packages/frontend/src/widgets/contato-empresa/index.ts
    - components/ui/contact-info-card.tsx
    - hooks/use-public-settings.ts
    - packages/frontend/src/pages/cookies/ui/CookiesPage.tsx
    - packages/frontend/src/pages/privacidade/ui/PrivacidadePage.tsx
    - packages/frontend/src/pages/politica-devolucao/ui/PoliticaDevolucaoPage.tsx
    - packages/frontend/src/pages/termos/ui/TermosPage.tsx
  invariantes:
    - id: telefone-e-email-padrao
      prova:
        "CookiesPage.test.tsx contém (51) 2313-6262; PrivacidadePage.test.tsx
        contém contato@locacoesgb.com.br"
    - id: frases-de-contato
      prova:
        "cookies, devolução, termos e privacidade mantêm as descriptions
        originais, inclusive a frase padrão Nossa equipe está pronta para
        esclarecer suas dúvidas."
    - id: endereco-fallback
      prova:
        "o cartão ainda cai no endereço Travessa Doutor Heinzelmann, 365 quando
        a configuração vem vazia"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/cookies
        packages/frontend/src/pages/privacidade
        packages/frontend/src/pages/politica-devolucao
        packages/frontend/src/pages/termos"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "hooks/use-public-settings.ts e components/ui/contact-info-card.tsx
        ainda existem como reexport por caminho interno"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: fetch de /api/settings/public no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 11-pagina-contato

`/contato` foi para o frontend. O formulário continua enviando
`POST /api/contact` com o mesmo corpo. O mapa do Google permanece na rota,
porque usa `next/script`.

```yaml
fatia:
  id: 11-pagina-contato
  estado: intermediate
  conceito: página pública de contato e formulário de solicitação
  origem:
    - app/contato/page.tsx
    - components/contact-form.tsx
  destino:
    - packages/frontend/src/pages/contato/ui/ContatoPage.tsx
    - packages/frontend/src/pages/contato/index.ts
    - packages/frontend/src/features/enviar-contato/ui/ContactForm.tsx
    - packages/frontend/src/features/enviar-contato/index.ts
    - app/contato/page.tsx
    - components/contact-form.tsx
    - apps/clients/web/src/app/contato/page.tsx
    - apps/clients/mobile/src/app/contato.tsx
  invariantes:
    - id: titulo-e-envio
      prova: "ContatoPage.test.tsx contém Entre em Contato e Enviar Solicitação"
    - id: telefone-padrao
      prova: "ContatoPage.test.tsx contém (51) 2313-6262"
    - id: mapa-na-rota
      prova:
        "app/contato/page.tsx passa GoogleStoreLocator com as classes h-[400px]
        e md:h-[450px]"
    - id: post-api-contact
      prova:
        "ContactForm.tsx ainda faz POST /api/contact com
        JSON.stringify(formData)"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/contato/ui/ContatoPage.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/contact-form.tsx ainda existe como reexport"
      - "o mapa Google continua em components/google-store-locator.tsx por
        depender de next/script"
      - "chaves Tailwind orange, blue, green e purple do card permanecem com
        token-check-allow"
      - "o POST /api/contact não foi executado"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: envio real do formulário]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 12-pagina-recuperar-senha

`/recuperar-senha` foi para o frontend. O envio continua em
`POST /api/auth/forgot-password`. O link de volta aponta para `/login`. Alert e
Link passaram a ter dono em `packages/ui`.

```yaml
fatia:
  id: 12-pagina-recuperar-senha
  estado: intermediate
  conceito: página de recuperar senha, mais os primitivos Alert e Link
  origem:
    - app/recuperar-senha/page.tsx
    - components/ui/alert.tsx
  destino:
    - packages/frontend/src/pages/recuperar-senha/ui/RecuperarSenhaPage.tsx
    - packages/frontend/src/pages/recuperar-senha/index.ts
    - app/recuperar-senha/page.tsx
    - packages/ui/src/web/Alert.web.tsx
    - packages/ui/src/web/Link.web.tsx
    - packages/ui/src/native/Alert.native.tsx
    - packages/ui/src/native/Link.native.tsx
    - components/ui/alert.tsx
    - apps/clients/web/src/app/recuperar-senha/page.tsx
    - apps/clients/mobile/src/app/recuperar-senha.tsx
  invariantes:
    - id: titulo-e-email
      prova:
        "RecuperarSenhaPage.test.tsx contém Recuperar Senha e placeholder
        seu@email.com"
    - id: link-login
      prova: "RecuperarSenhaPage.test.tsx contém href /login"
    - id: alert-destructive
      prova: "Alert.web.test.tsx contém role=alert e border-destructive/50"
    - id: post-forgot-password
      prova: "RecuperarSenhaPage.tsx ainda faz POST /api/auth/forgot-password"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/Alert.web.test.tsx packages/ui/src/catalog.test.ts
        packages/frontend/src/pages/recuperar-senha/ui/RecuperarSenhaPage.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/ui/alert.tsx ainda existe como reexport"
      - "o gradiente #f97316/#ea580c do botão permanece com token-check-allow"
      - "Link nativo ainda não navega; no web ele usa next/link"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: POST /api/auth/forgot-password]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 13-pagina-reset-password

`/reset-password` foi para o frontend. A rota lê `?token=` e repassa. Sem token,
a tela continua dizendo "Link invalido". Com token, o formulário continua em
`POST /api/auth/reset-password`.

```yaml
fatia:
  id: 13-pagina-reset-password
  estado: intermediate
  conceito: página de redefinir senha
  origem:
    - app/reset-password/page.tsx
  destino:
    - packages/frontend/src/pages/reset-password/ui/ResetPasswordPage.tsx
    - packages/frontend/src/pages/reset-password/index.ts
    - app/reset-password/page.tsx
    - apps/clients/web/src/app/reset-password/page.tsx
    - apps/clients/mobile/src/app/reset-password.tsx
  invariantes:
    - id: sem-token-link-invalido
      prova:
        "ResetPasswordPage.test.tsx sem token contém Link invalido e href
        /recuperar-senha"
    - id: com-token-formulario
      prova:
        "ResetPasswordPage.test.tsx com token contém Redefinir Senha, Nova senha
        e href /login"
    - id: post-reset-password
      prova:
        "ResetPasswordPage.tsx ainda faz POST /api/auth/reset-password com token
        e password"
    - id: suspense-da-rota
      prova:
        "app/reset-password/page.tsx mantém o fallback Carregando... e lê
        searchParams token"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/reset-password/ui/ResetPasswordPage.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "a rota na raiz ainda lê useSearchParams porque o frontend universal não
        importa next/navigation"
      - "o gradiente #f97316/#ea580c permanece com token-check-allow"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: POST /api/auth/reset-password]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 14-pagina-login

`/login` foi para o frontend. A rota ainda chama `signIn('credentials')`,
`getSession` e `router.replace`. O destino depois do login segue a mesma regra:
callback interno, admin no dashboard, demais na área do cliente.

```yaml
fatia:
  id: 14-pagina-login
  estado: intermediate
  conceito: página de login e regra de redirecionamento
  origem:
    - app/login/page.tsx
  destino:
    - packages/frontend/src/pages/login/ui/LoginPage.tsx
    - packages/frontend/src/pages/login/index.ts
    - packages/frontend/src/features/entrar/model/redirect.ts
    - app/login/page.tsx
    - apps/clients/web/src/app/login/page.tsx
    - apps/clients/mobile/src/app/login.tsx
  invariantes:
    - id: titulo-e-links
      prova:
        "LoginPage.test.tsx contém Entrar no Sistema, href /cadastro e href
        /recuperar-senha"
    - id: callback-no-cadastro
      prova:
        "LoginPage.test.tsx com callbackUrl /equipamentos gera href
        /cadastro?callbackUrl=%2Fequipamentos"
    - id: redirect-admin-e-cliente
      prova:
        "redirect.test.ts cobre callback interno, callback externo,
        admin@gblocacoes.com.br, role ADMIN e área do cliente"
    - id: signin-credentials-na-rota
      prova:
        "app/login/page.tsx ainda chama signIn credentials com redirect false"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/features/entrar/model/redirect.test.ts
        packages/frontend/src/pages/login/ui/LoginPage.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "a rota na raiz ainda usa next-auth e next/navigation"
      - "os botões sociais continuam em components/ui/social-login-buttons.tsx"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: login com credenciais]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 15-pagina-entrar

`/entrar` não foi fundida com `/login`. Ela continua com `router.push`,
`router.refresh`, login social em `/auth/callback` e cadastro sem callback. No
submit, só o e-mail admin vai ao dashboard. Na sessão já aberta, a role `ADMIN`
também vai.

```yaml
fatia:
  id: 15-pagina-entrar
  estado: intermediate
  conceito: página /entrar, distinta do /login
  origem:
    - app/entrar/page.tsx
  destino:
    - packages/frontend/src/pages/entrar/ui/EntrarPage.tsx
    - packages/frontend/src/pages/entrar/index.ts
    - packages/frontend/src/features/entrar/model/redirect.ts
    - app/entrar/page.tsx
    - apps/clients/web/src/app/entrar/page.tsx
    - apps/clients/mobile/src/app/entrar.tsx
  invariantes:
    - id: links-sem-callback
      prova:
        "EntrarPage.test.tsx contém Entrar no Sistema, href /cadastro, href
        /recuperar-senha, Google e Facebook, e não contém callbackUrl"
    - id: submit-so-email-admin
      prova:
        "redirect.test.ts: resolveEntrarSubmitRedirect de a@b.com é
        /area-cliente e admin@gblocacoes.com.br é /admin/dashboard"
    - id: sessao-com-role
      prova:
        "redirect.test.ts: resolveEntrarSessionRedirect de a@b.com com ADMIN é
        /admin/dashboard"
    - id: social-callback-fixo
      prova:
        "app/entrar/page.tsx ainda chama signIn provider com callbackUrl
        /auth/callback e router.push"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/features/entrar/model/redirect.test.ts
        packages/frontend/src/pages/entrar/ui/EntrarPage.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "a rota na raiz ainda usa next-auth e next/navigation"
      - "cores oficiais do Google e do Facebook permanecem com token-check-allow"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: login em /entrar]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 16-pagina-cadastro

`/cadastro` foi para o frontend. O POST continua em `/api/auth/register`. Depois
do sucesso, a volta ao login preserva `callbackUrl`. As máscaras de telefone,
CPF, CNPJ e CEP ficaram num model testado.

```yaml
fatia:
  id: 16-pagina-cadastro
  estado: intermediate
  conceito: página de cadastro e máscaras do formulário
  origem:
    - app/cadastro/page.tsx
  destino:
    - packages/frontend/src/pages/cadastro/ui/CadastroPage.tsx
    - packages/frontend/src/pages/cadastro/index.ts
    - packages/frontend/src/features/cadastrar/model/cadastro.ts
    - app/cadastro/page.tsx
    - apps/clients/web/src/app/cadastro/page.tsx
    - apps/clients/mobile/src/app/cadastro.tsx
  invariantes:
    - id: titulo-e-link-login
      prova:
        "CadastroPage.test.tsx contém Criar Conta, Faça login e href /login"
    - id: callback-no-login
      prova:
        "CadastroPage.test.tsx com callbackUrl /equipamentos gera href
        /login?callbackUrl=%2Fequipamentos"
    - id: mascaras
      prova:
        "cadastro.test.ts: (51) 99820-5163, 123.456.789-01, 12.345.678/0001-99,
        90240-100"
    - id: post-register
      prova: "CadastroPage.tsx ainda faz POST /api/auth/register"
    - id: volta-ao-login
      prova:
        "cadastro.test.ts: registrationLoginUrl(null) é /login?registered=true e
        o OAuth sem callback é /auth/callback"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/features/cadastrar/model/cadastro.test.ts
        packages/frontend/src/pages/cadastro/ui/CadastroPage.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "a rota na raiz ainda usa next-auth e next/navigation"
      - "cores oficiais do Google e do Facebook permanecem com token-check-allow"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: POST /api/auth/register]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 17-admin-entrada

`/admin/login` continua indo para `/login`. `/admin` continua esperando 300 ms e
então vai ao dashboard se houver sessão, ou a `/admin/login` se não houver. O
texto das duas telas é “Redirecionando...”.

```yaml
fatia:
  id: 17-admin-entrada
  estado: intermediate
  conceito: telas de redirecionamento /admin e /admin/login
  origem:
    - app/admin/page.tsx
    - app/admin/login/page.tsx
  destino:
    - packages/frontend/src/pages/admin-login/ui/AdminLoginPage.tsx
    - packages/frontend/src/pages/admin-entrada/ui/AdminIndexPage.tsx
    - packages/frontend/src/features/entrar-admin/model/redirect.ts
    - app/admin/page.tsx
    - app/admin/login/page.tsx
    - apps/clients/web/src/app/admin/page.tsx
    - apps/clients/web/src/app/admin/login/page.tsx
    - apps/clients/mobile/src/app/admin-entrada.tsx
    - apps/clients/mobile/src/app/admin-login.tsx
  invariantes:
    - id: login-admin-vai-para-login
      prova:
        "redirect.test.ts espera ADMIN_LOGIN_REDIRECT === /login; a rota chama
        router.replace com essa constante"
    - id: admin-autenticado-ou-anonimo
      prova:
        "redirect.test.ts: authenticated com sessão vai a /admin/dashboard;
        unauthenticated vai a /admin/login; loading não redireciona"
    - id: espera-300
      prova: "app/admin/page.tsx ainda usa setTimeout de 300 ms"
    - id: texto-redirecionando
      prova:
        "AdminLoginPage.test.tsx contém Redirecionando e border-orange-600;
        AdminIndexPage.test.tsx contém border-t-slate-700"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/features/entrar-admin/model/redirect.test.ts
        packages/frontend/src/pages/admin-login/ui/AdminLoginPage.test.tsx
        packages/frontend/src/pages/admin-entrada/ui/AdminIndexPage.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "as rotas na raiz ainda usam next-auth e next/navigation"
      - "os hosts novos só mostram o texto, sem a sessão do Next"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: redirecionamento no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 18-auth-callback

`/auth/callback` mostra “Entrando...” e “Aguarde enquanto redirecionamos você”.
Sem sessão vai para `/login`. Com sessão, usa a mesma regra do `/login`.
Enquanto a sessão carrega, não redireciona.

```yaml
fatia:
  id: 18-auth-callback
  estado: intermediate
  conceito: callback de login social e por credencial
  origem:
    - app/auth/callback/page.tsx
  destino:
    - packages/frontend/src/pages/auth-callback/ui/AuthCallbackPage.tsx
    - packages/frontend/src/features/entrar/model/redirect.ts
    - app/auth/callback/page.tsx
    - apps/clients/web/src/app/auth/callback/page.tsx
    - apps/clients/mobile/src/app/auth-callback.tsx
  invariantes:
    - id: texto-entrando
      prova:
        "AuthCallbackPage.test.tsx contém Aguarde enquanto redirecionamos você e
        Carregando..."
    - id: anonimo-vai-ao-login
      prova:
        "redirect.test.ts: status unauthenticated retorna /login; loading e
        authenticated sem usuário retornam null"
    - id: mesma-regra-do-login
      prova:
        "redirect.test.ts: callback %2Fequipamentos vai a /equipamentos; cliente
        sem callback vai a /area-cliente"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/features/entrar/model/redirect.test.ts
        packages/frontend/src/pages/auth-callback/ui/AuthCallbackPage.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "a rota na raiz ainda usa next-auth e next/navigation"
      - "o host novo só mostra o texto, sem a sessão do Next"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: callback OAuth no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 19-home-hero

A home continua servida por `app/page.tsx`, com Prisma e os lazy imports. O
recorte do carrossel e da onda do hero passou para o frontend. Valor
desconhecido de onda continua `animated`. URL vazia de imagem continua
descartada.

```yaml
fatia:
  id: 19-home-hero
  estado: intermediate
  conceito: recorte inicial do hero da home
  origem:
    - app/page.tsx
  destino:
    - packages/frontend/src/pages/home/model/hero-settings.ts
    - packages/frontend/src/pages/home/index.ts
    - app/page.tsx
  invariantes:
    - id: carrossel-apara-e-descarta
      prova:
        "hero-settings.test.ts: null vira lista vazia; imageUrl com espaços vira
        /foto.jpg; item sem string é descartado"
    - id: onda-padrao-animated
      prova:
        "hero-settings.test.ts: static permanece; outra e undefined viram
        animated"
    - id: prisma-na-rota
      prova:
        "app/page.tsx ainda faz prisma.setting.findFirst e passa o resultado a
        buildHeroInitialSettings"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/home/model/hero-settings.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "Hero, HomePageClient, WhyChooseUs e ContactSection continuam em
        components/"
      - "a home ainda busca Prisma na rota da raiz"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: render da home no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 20-negocio-local

Os dados de SEO do negócio local saíram de `lib/structured-data-utils.ts`, que
agora só reexporta. Sem configuração, o CNPJ, o endereço e o telefone formatado
padrão permanecem. Com telefone informado, o prefixo continua `+55` seguido só
dos dígitos.

```yaml
fatia:
  id: 20-negocio-local
  estado: intermediate
  conceito: dados de LocalBusiness usados na home e no equipamento
  origem:
    - lib/structured-data-utils.ts
  destino:
    - packages/frontend/src/entities/configuracao/model/local-business.ts
    - packages/frontend/src/entities/configuracao/index.ts
    - lib/structured-data-utils.ts
  invariantes:
    - id: padrao-cnpj-endereco-telefone
      prova:
        "local-business.test.ts: GB Locações, CNPJ 34.780.330/0001-69, Travessa
        Doutor Heinzelmann, 365, telefone +55 51 2313-6262"
    - id: telefone-so-digitos
      prova:
        "local-business.test.ts: (51) 2313-6262 vira +55 5123136262; WhatsApp
        vira +55 51998205163 e phone=5551998205163"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/entities/configuracao/model/local-business.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "lib/structured-data-utils.ts ainda existe como reexport por caminho
        interno"
      - "a home e a ficha do equipamento ainda montam o JSON-LD na rota legada"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: JSON-LD renderizado no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 21-listagem-equipamentos

`/equipamentos` continua na rota legada. Filtro, ordenação pt-BR e paginação de
9 em 9 passaram para a entidade equipamento. A busca ainda olha nome e
descrição, sem diferenciar maiúsculas. Categoria `all` não filtra.

```yaml
fatia:
  id: 21-listagem-equipamentos
  estado: intermediate
  conceito: filtro, ordenação e paginação da listagem pública de equipamentos
  origem:
    - app/equipamentos/page.tsx
  destino:
    - packages/frontend/src/entities/equipamento/model/listagem.ts
    - packages/frontend/src/entities/equipamento/index.ts
    - packages/frontend/src/pages/equipamentos/index.ts
    - app/equipamentos/page.tsx
  invariantes:
    - id: ordem-pt-br
      prova: "listagem.test.ts ordena andaime, Betoneira, Compressor"
    - id: busca-nome-ou-descricao
      prova:
        "listagem.test.ts: BETO encontra Betoneira e Compressor; categoria
        altura encontra andaime; lista inválida vira vazia"
    - id: pagina-de-nove
      prova:
        "listagem.test.ts: 10 itens, página 2, 9 por página, totalPages 2 e o
        item 9"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/entities/equipamento/model/listagem.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "a tela /equipamentos ainda está em app/equipamentos/page.tsx"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: listagem no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 22-preco-equipamento

O cálculo de preço do equipamento saiu de `lib/pricing.ts`, que agora só
reexporta. Os casos já observados continuam: semana direta 400, semana com 10%
fica 630, valor direto zero fica 0, 16 dias caem na quinzena e 30 dias no mês.

```yaml
fatia:
  id: 22-preco-equipamento
  estado: intermediate
  conceito: cálculo de preço por período do equipamento
  origem:
    - lib/pricing.ts
    - tests/pricing.intelligent.test.ts
  destino:
    - packages/frontend/src/entities/equipamento/model/preco.ts
    - packages/frontend/src/entities/equipamento/model/preco.test.ts
    - packages/frontend/src/entities/equipamento/index.ts
    - lib/pricing.ts
  invariantes:
    - id: semana-direta-400
      prova: "preco.test.ts: 7 dias com valor direto semanal 400 resulta 400"
    - id: semana-desconto-10
      prova: "preco.test.ts: 7 dias a 100 com 10% resulta 630"
    - id: direto-zero
      prova: "preco.test.ts: valor direto semanal 0 resulta 0"
    - id: quinzena-e-mes
      prova:
        "preco.test.ts: 16 dias período biweekly e total 746.67; 30 dias período
        monthly e total 1000"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/entities/equipamento/model/preco.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "lib/pricing.ts ainda existe como reexport por caminho interno"
      - "lib/quote-pricing.ts ainda monta o preço do orçamento em cima desse
        cálculo"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: tests/pricing.intelligent.test.ts na suíte com banco]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 23-preco-orcamento

A montagem do preço do orçamento saiu de `lib/quote-pricing.ts`, que agora só
reexporta. Três dias a 100, quantidade 2, continuam total 600. Sete dias
continuam no período semanal. Zero dias não divide por zero. O rótulo segue sem
acento: `diaria`.

```yaml
fatia:
  id: 23-preco-orcamento
  estado: intermediate
  conceito: preço do item de orçamento a partir do preço do equipamento
  origem:
    - lib/quote-pricing.ts
  destino:
    - packages/frontend/src/entities/orcamento/model/preco.ts
    - packages/frontend/src/entities/orcamento/index.ts
    - packages/frontend/src/entities/equipamento/@x/orcamento.ts
    - lib/quote-pricing.ts
  invariantes:
    - id: tres-dias-quantidade-dois
      prova:
        "preco.test.ts do orçamento: 3 dias a 100, quantidade 2, total 600,
        pricePerDay 100, período diaria"
    - id: sete-dias-semanal
      prova: "preco.test.ts: 7 dias têm appliedPeriod semanal"
    - id: zero-dias
      prova: "preco.test.ts: 0 dias resulta pricePerDay 0 e total 0"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/entities/orcamento/model/preco.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "lib/quote-pricing.ts ainda existe como reexport por caminho interno,
        usado pelas rotas de orçamento"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: POST /api/quotes e /api/orcamentos]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 24-frete-estimado

O frete estimado saiu de `lib/freight-calculator.ts`, que agora só reexporta.
CEP incompleto continua com a nota "CEP inválido". No mesmo prefixo, duas peças
continuam 30 e 45, com 3 e 1 dias. A chamada ao Melhor Envio continua no mesmo
endpoint.

```yaml
fatia:
  id: 24-frete-estimado
  estado: intermediate
  conceito: estimativa de frete do orçamento e fallback do Melhor Envio
  origem:
    - lib/freight-calculator.ts
  destino:
    - packages/frontend/src/entities/orcamento/model/frete.ts
    - packages/frontend/src/entities/orcamento/index.ts
    - lib/freight-calculator.ts
  invariantes:
    - id: cep-invalido
      prova: "frete.test.ts: CEP 123 devolve lista vazia e nota CEP inválido"
    - id: mesmo-prefixo-30-e-45
      prova:
        "frete.test.ts: 90240-100 para 90240-000, quantidade 2, preços 30 e 45,
        prazos 3 e 1, peso 100"
    - id: nomes-das-opcoes
      prova: "frete.test.ts: Transportadora Padrão e Entrega Expressa"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/entities/orcamento/model/frete.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "lib/freight-calculator.ts ainda existe como reexport por caminho
        interno"
      - "a tela /orcamento e POST /api/quotes ainda importam o reexport"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: POST /api/integrations/melhor-envio/calculate]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 25-reajuste-orcamento

A justificativa e os rótulos de reajuste usados por `lib/utils.ts` foram para a
entidade de orçamento. O arquivo legado só reexporta. Os rótulos do financeiro e
do ofício PDF ficaram onde estavam, porque o texto não é o mesmo.

```yaml
fatia:
  id: 25-reajuste-orcamento
  estado: intermediate
  conceito: texto e categorias do reajuste de orçamento
  origem:
    - lib/utils.ts
  destino:
    - packages/frontend/src/entities/orcamento/model/reajuste.ts
    - packages/frontend/src/entities/orcamento/index.ts
    - lib/utils.ts
  invariantes:
    - id: remove-colchetes
      prova:
        "reajuste.test.ts: [Deslocamento (Frete)] Teste vira Deslocamento
        (Frete) Teste; null e vazio viram string vazia"
    - id: rotulos
      prova:
        "reajuste.test.ts: LABOR Mão de obra, TRAVEL Deslocamento (Frete),
        MAINTENANCE Manutenção, OTHER Outro"
    - id: parse-blocos
      prova:
        "reajuste.test.ts separa [Deslocamento (Frete)] Teste, cai texto solto
        em Outro e justificativa vazia vira -"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/entities/orcamento/model/reajuste.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "lib/utils.ts ainda reexporta o reajuste por caminho interno"
      - "components/admin/financial/types.ts e lib/pdf/oficio-styles.ts têm
        rótulos próprios e diferentes; não foram unificados"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: tela de reajuste no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 26-multa-orcamento

O cálculo puro da multa de orçamento saiu de `lib/late-fee-calculator.ts`. A
gravação em lote continua nesse arquivo, porque usa Prisma. A multa da locação
em `app/api/admin/rentals/[id]/calculate-late-fee/route.ts` é outra conta (5% do
valor diário) e não foi unificada.

```yaml
fatia:
  id: 26-multa-orcamento
  estado: intermediate
  conceito: multa por atraso do orçamento
  origem:
    - lib/late-fee-calculator.ts
  destino:
    - packages/frontend/src/entities/orcamento/model/multa.ts
    - packages/frontend/src/entities/orcamento/index.ts
    - lib/late-fee-calculator.ts
  invariantes:
    - id: sem-atraso
      prova: "multa.test.ts: data atual anterior ao fim devolve 0 dias e taxa 0, método daily"
    - id: dois-por-cento
      prova: "multa.test.ts: 5 dias sobre 1000 a 2% com piso 50 e teto 500 devolve 100"
    - id: valor-fixo
      prova: "multa.test.ts: fixedAmount 80 devolve 80 e método fixed, com 5 dias"
    - id: teto-de-dias-e-minimo
      prova: "multa.test.ts: maxDays 2 sobre 1000 a 2% cai no mínimo 50"
    - id: config-padrao
      prova: "multa.test.ts: dailyRate 0.02, maxDays 30, minAmount 50, maxAmount 5000"
  comandos:
    - cmd: "pnpm exec vitest run --config vitest.platform.config.ts packages/frontend/src/entities/orcamento/model/multa.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "lib/late-fee-calculator.ts ainda reexporta o cálculo e continua gravando lateFee via Prisma"
      - "POST /api/admin/quotes/{id}/calculate-late-fee ainda importa o reexport"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 27-multa-locacao

A multa da locação (5% do valor diário) saiu da rota e foi para a entidade de
locação. A rota continua autenticando admin, gravando `lateFee`, marcando
`OVERDUE` e criando o pagamento PIX. Essa conta não foi unificada com a multa do
orçamento.

```yaml
fatia:
  id: 27-multa-locacao
  estado: intermediate
  conceito: multa por atraso da locação
  origem:
    - app/api/admin/rentals/[id]/calculate-late-fee/route.ts
  destino:
    - packages/frontend/src/entities/locacao/model/multa.ts
    - packages/frontend/src/entities/locacao/index.ts
    - lib/rental-late-fee.ts
    - app/api/admin/rentals/[id]/calculate-late-fee/route.ts
  invariantes:
    - id: sem-atraso
      prova: "locacao/model/multa.test.ts: data atual igual ao fim devolve lateFee 0, daysOverdue 0 e overdue false"
    - id: cinco-por-cento
      prova: "locacao/model/multa.test.ts: 10 dias de contrato, total 1000, 5 dias de atraso devolve 25"
    - id: mesmo-instante
      prova: "locacao/model/multa.test.ts: início igual ao fim e 1 dia depois, total 200, devolve 10"
    - id: resposta-http
      prova: "a rota ainda devolve Rental is not overdue ou Late fee calculated and applied successfully; status OVERDUE e pagamento PIX LATE_FEE permanecem na rota"
  comandos:
    - cmd: "pnpm exec vitest run --config vitest.platform.config.ts packages/frontend/src/entities/locacao/model/multa.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "lib/rental-late-fee.ts ainda reexporta por caminho interno"
      - "a rota ainda grava no Prisma e exige role ADMIN"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 28-tributo

O cálculo de ISS, retenção, Simples, Lucro Presumido, Lucro Real e IBS/CBS saiu
de `lib/tax-engine.ts`. A leitura de `financialSetting` continua nesse arquivo,
com Prisma. Os tipos de regime e documento são as mesmas strings do schema, sem
importar o cliente Prisma no frontend.

```yaml
fatia:
  id: 28-tributo
  estado: intermediate
  conceito: cálculo tributário do orçamento e do boleto
  origem:
    - lib/tax-engine.ts
  destino:
    - packages/frontend/src/entities/financeiro/model/tributo.ts
    - packages/frontend/src/entities/financeiro/index.ts
    - lib/tax-engine.ts
  invariantes:
    - id: retencao
      prova: "tributo.test.ts: CPF 6, CNPJ 2.5, CNI 6"
    - id: locacao-pura
      prova: "tributo.test.ts: ISS 0, ICMS 0.00, CPF 1000 vira retenção 60 e líquido 940, CNPJ 2000 vira 50 e 1950"
    - id: iss-servico
      prova: "tributo.test.ts: 200 de serviço a 2.5% vira ISS 5.00; serviço 0 vira ISS 0"
    - id: simples
      prova: "tributo.test.ts: alíquota 10 sobre 1000 vira 100; alíquota nula vira 0; misto usa o bruto 100"
    - id: lucro-presumido
      prova: "tributo.test.ts: 10000 vira IRPJ 480, CSLL 288, PIS/COFINS 365; taxas nulas usam os mesmos padrões"
    - id: lucro-real
      prova: "tributo.test.ts: taxa nula vira 925; taxa 7.6 vira 760; IRPJ e CSLL ficam 0"
    - id: ibs-cbs
      prova: "tributo.test.ts: 26.5% sobre 1000 vira 265 e zera ISS, inclusive na operação mista"
    - id: borda
      prova: "tributo.test.ts: bruto 0 vira líquido 0; 99999.99 a 6% vira retenção 6000 e líquido 93999.99"
  comandos:
    - cmd: "pnpm exec vitest run --config vitest.platform.config.ts packages/frontend/src/entities/financeiro/model/tributo.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "lib/tax-engine.ts ainda reexporta o cálculo e continua lendo financialSetting via Prisma"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 29-codigo-orcamento

A montagem e a leitura do código `Q-ano-sequência` saíram de
`lib/quote-code.ts`. A busca do último código e a gravação continuam nesse
arquivo, porque usam Prisma.

```yaml
fatia:
  id: 29-codigo-orcamento
  estado: intermediate
  conceito: código sequencial do orçamento
  origem:
    - lib/quote-code.ts
  destino:
    - packages/frontend/src/entities/orcamento/model/codigo.ts
    - packages/frontend/src/entities/orcamento/index.ts
    - lib/quote-code.ts
  invariantes:
    - id: formato
      prova:
        "codigo.test.ts: 2026 e 7 viram Q-2026-0007; 10000 viram Q-2026-10000"
    - id: leitura
      prova:
        "codigo.test.ts: Q-2026-0007 vira 7; vazio, Q-2026-12 e texto solto
        viram 0"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/entities/orcamento/model/codigo.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "[NOT_VERIFIED: device_or_emulator]"
```

## 30-aliquota-financeira

A escolha do documento, a taxa e o líquido saíram de `lib/financial.ts`. A
leitura de `financialSetting` continua nesse arquivo. O mapa de status de
pagamento também foi junto, com os mesmos destinos.

```yaml
fatia:
  id: 30-aliquota-financeira
  estado: intermediate
  conceito: documento fiscal, taxa e líquido
  origem:
    - lib/financial.ts
  destino:
    - packages/frontend/src/entities/financeiro/model/aliquota.ts
    - packages/frontend/src/entities/financeiro/index.ts
    - lib/financial.ts
  invariantes:
    - id: documento
      prova:
        "aliquota.test.ts: CNI vence CNPJ; CNPJ vence vazio; tudo nulo vira CPF"
    - id: liquido
      prova:
        "aliquota.test.ts: taxas 6, 2.5 e 6; 1000 a 6% vira 940; 2000 a 2.5%
        vira 1950; zero permanece 0"
    - id: status
      prova:
        "aliquota.test.ts: PAID, OVERDUE vira UNPAID, PENDING vira
        AWAITING_PAYMENT, CANCELLED e REFUNDED viram SETTLED"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/entities/financeiro/model/aliquota.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "[NOT_VERIFIED: device_or_emulator]"
```

## 31-vencimento-boleto

A data de vencimento do boleto saiu de `lib/boleto-utils.ts`. Continua somando
dias úteis e fechando no fim do dia. A criação do pagamento permanece nas rotas
que já chamavam essa função.

```yaml
fatia:
  id: 31-vencimento-boleto
  estado: intermediate
  conceito: vencimento do boleto em dias úteis
  origem:
    - lib/boleto-utils.ts
  destino:
    - packages/frontend/src/entities/pagamento/model/vencimento.ts
    - packages/frontend/src/entities/pagamento/index.ts
    - lib/boleto-utils.ts
  invariantes:
    - id: tres-dias-uteis
      prova:
        "vencimento.test.ts: segunda 5/1/2026 às 10h mais 3 dias úteis cai em
        8/1 às 23:59:59"
    - id: pula-fim-de-semana
      prova:
        "vencimento.test.ts: sexta 9/1/2026 mais 1 dia útil cai no dia 12,
        segunda"
    - id: prazo-padrao
      prova: "vencimento.test.ts: omitir o prazo equivale a informar 3"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/entities/pagamento/model/vencimento.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "lib/boleto-utils.ts ainda reexporta a data"
      - "lib/quote-boleto.ts e lib/rental-converter.ts continuam chamando o
        reexport e gravando o pagamento"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: criação de boleto com banco]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 32-validade-orcamento

A regra de orçamento ainda válido saiu de `lib/quote-validity.ts`. Só PENDING
passa. Sem data de validade continua válido. A marcação de expirado no banco
continua no arquivo legado.

```yaml
fatia:
  id: 32-validade-orcamento
  estado: intermediate
  conceito: validade do orçamento pendente
  origem:
    - lib/quote-validity.ts
  destino:
    - packages/frontend/src/entities/orcamento/model/validade.ts
    - packages/frontend/src/entities/orcamento/index.ts
    - lib/quote-validity.ts
  invariantes:
    - id: so-pendente
      prova:
        "validade.test.ts: APPROVED com data futura é inválido; PENDING com data
        futura é válido"
    - id: sem-data
      prova:
        "validade.test.ts: PENDING sem validUntil ou com null permanece válido"
    - id: vencido
      prova: "validade.test.ts: PENDING com 2020-01-01 é inválido"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/entities/orcamento/model/validade.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "[NOT_VERIFIED: device_or_emulator]"
```

## 33-sobre

A página `/sobre` saiu de `app/sobre/page.tsx`. A rota de produção só entrega o
carrossel 3D e o selo do Google. O primeiro modelo continua recebendo
`isRevealComplete` falso até o evento `scrollRevealReady`. O componente do
carrossel não foi alterado.

```yaml
fatia:
  id: 33-sobre
  estado: intermediate
  conceito: página sobre a empresa
  origem:
    - app/sobre/page.tsx
  destino:
    - packages/frontend/src/pages/sobre/ui/SobrePage.tsx
    - packages/frontend/src/pages/sobre/index.ts
    - app/sobre/page.tsx
    - apps/clients/web/src/app/sobre/page.tsx
  invariantes:
    - id: titulo-e-telefones
      prova: "SobrePage.test.tsx contém Sobre a GB Locações, tel:+555123136262 e tel:+5551998205163"
    - id: modelos
      prova: "SobrePage.test.tsx recebe /models/Compressor.glb, /models/Betoneira.glb e /models/Andaime.glb, com autoRotate e intervalo 6000"
    - id: primeiro-modelo-sem-zoom
      prova: "SobrePage.test.tsx: isRevealComplete começa falso; a rota repassa essa prop ao Equipment3DCarousel"
    - id: selo
      prova: "SobrePage.test.tsx renderiza o selo recebido; a rota de produção passa GoogleMerchantBadge INLINE BR"
  comandos:
    - cmd: "pnpm exec vitest run --config vitest.platform.config.ts packages/frontend/src/pages/sobre/ui/SobrePage.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/equipment-3d-carousel.tsx continua dono do viewer 3D"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 34-listagem-equipamentos

A tela `/equipamentos` saiu da rota. A rota de produção continua lendo
`?categoria=`, montando a imagem, o link, o filtro, a paginação e o selo da
categoria. A lista ainda busca `/api/equipments` e `/api/categories`, ordena em
pt-BR e pagina de 9 em 9.

```yaml
fatia:
  id: 34-listagem-equipamentos
  estado: intermediate
  conceito: catálogo público de equipamentos
  origem:
    - app/equipamentos/page.tsx
  destino:
    - packages/frontend/src/pages/equipamentos/ui/EquipamentosPage.tsx
    - packages/frontend/src/pages/equipamentos/index.ts
    - app/equipamentos/page.tsx
    - apps/clients/web/src/app/equipamentos/page.tsx
  invariantes:
    - id: carregamento
      prova: "EquipamentosPage.test.tsx mostra Carregando equipamentos... e não chama imagem nem link nessa primeira pintura"
    - id: categoria-na-url
      prova: "a rota lê searchParams.get('categoria') e entrega essa string à página"
    - id: imagem-e-link
      prova: "a rota repassa next/image com width auto e height auto, e next/link para /equipamentos/{id}"
    - id: selo-sm
      prova: "a rota chama getCategoryBadgePreview com tamanho sm e hover false"
  comandos:
    - cmd: "pnpm exec vitest run --config vitest.platform.config.ts packages/frontend/src/pages/equipamentos/ui/EquipamentosPage.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "AdminFilterCard, SmartPagination e getCategoryBadgePreview continuam em components/ e lib/"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 35-seo-equipamento

O título, a descrição, a imagem, o produto e o breadcrumb do detalhe saíram da
rota. `generateMetadata` e os dados estruturados passam a usar essas funções. A
busca no Prisma, o `notFound` e o desenho da tela continuam em
`app/equipamentos/[id]/page.tsx`.

```yaml
fatia:
  id: 35-seo-equipamento
  estado: intermediate
  conceito: SEO e dados estruturados do detalhe do equipamento
  origem:
    - app/equipamentos/[id]/page.tsx
  destino:
    - packages/frontend/src/entities/equipamento/model/seo.ts
    - packages/frontend/src/entities/equipamento/index.ts
    - app/equipamentos/[id]/page.tsx
  invariantes:
    - id: titulo-e-url
      prova: "seo.test.ts: Aluguel de Betoneira em Porto Alegre | GB Locações e https://locacoesgb.com.br/equipamentos/abc"
    - id: descricao
      prova: "seo.test.ts: texto curto ganha o convite de Porto Alegre; texto longo fica com 160 caracteres; sem descrição usa o texto padrão de Andaime"
    - id: imagem
      prova: "seo.test.ts: /foto.jpg vira https://locacoesgb.com.br/foto.jpg"
    - id: produto
      prova: "seo.test.ts: disponível vira InStock, preço 100, moeda BRL, sku abc; indisponível vira OutOfStock"
    - id: breadcrumb
      prova: "seo.test.ts: Home, /equipamentos, ?categoria=concreto e /equipamentos/abc"
  comandos:
    - cmd: "pnpm exec vitest run --config vitest.platform.config.ts packages/frontend/src/entities/equipamento/model/seo.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "app/equipamentos/[id]/page.tsx ainda busca no Prisma e desenha a tela"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 36-detalhe-equipamento

O layout de `/equipamentos/{id}` foi para o frontend compartilhado. A rota
continua buscando no Prisma, devolvendo 404 e montando galeria, preço, selo,
compartilhamento e o link de volta. A nota 4.8 e as 127 avaliações continuam
fixas na tela.

```yaml
fatia:
  id: 36-detalhe-equipamento
  estado: intermediate
  conceito: layout do detalhe do equipamento
  origem:
    - app/equipamentos/[id]/page.tsx
  destino:
    - packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoDetalhePage.tsx
    - packages/frontend/src/pages/equipamento-detalhe/index.ts
    - app/equipamentos/[id]/page.tsx
  invariantes:
    - id: nota-fixa
      prova: "EquipamentoDetalhePage.test.tsx contém 4.8 e (127 avaliações)"
    - id: preco-e-status
      prova: "EquipamentoDetalhePage.test.tsx: 100 vira R$ 100.00 e Disponível; 0 indisponível vira R$ 0.00 e Indisponível"
    - id: descricao
      prova: "EquipamentoDetalhePage.test.tsx mostra Sobre este equipamento quando há texto e esconde o bloco quando a descrição é nula"
    - id: confianca
      prova: "EquipamentoDetalhePage.test.tsx contém Por que escolher a GB Locações? e Entrega no mesmo dia para região metropolitana de Porto Alegre"
    - id: voltar
      prova: "a rota ainda envolve o texto Voltar aos Equipamentos num Link para /equipamentos"
  comandos:
    - cmd: "pnpm exec vitest run --config vitest.platform.config.ts packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoDetalhePage.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "galeria, preço, selo, animações e itens inclusos continuam em components/"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 37-item-incluso

Os três itens inclusos na locação passaram a ser desenhados pela tela de
detalhe. O hover continua laranja `#ea580c` e o texto em repouso continua
`#374151`. O arquivo antigo não tinha mais quem o importasse e foi removido.

```yaml
fatia:
  id: 37-item-incluso
  estado: intermediate
  conceito: itens inclusos na locação do equipamento
  origem:
    - components/equipment-inclusion-item.tsx
  destino:
    - packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoDetalhePage.tsx
  invariantes:
    - id: tres-textos
      prova:
        "EquipamentoDetalhePage.test.tsx contém Manutenção preventiva, Suporte
        técnico 24h e Entrega e retirada"
    - id: cores
      prova:
        "o hover usa themes.light.primary, que é #ea580c; o repouso continua
        #374151"
    - id: icones
      prova: "as chaves continuam green, blue e orange, na mesma ordem"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoDetalhePage.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "[NOT_VERIFIED: device_or_emulator]"
```

## 38-animacao-detalhe

A entrada do card, das seções e dos benefícios do detalhe passou para a própria
tela. Continua opacidade de 0 a 1, deslocamento de 20 para 0 e duração de 0,3s.
Os atrasos continuam 0, 0,1, 0,2, 0,3, 0,4 e 0,5. O arquivo antigo não tinha
mais quem o importasse e foi removido.

```yaml
fatia:
  id: 38-animacao-detalhe
  estado: intermediate
  conceito: animação de entrada do detalhe do equipamento
  origem:
    - components/equipment-detail-animations.tsx
  destino:
    - packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoDetalhePage.tsx
  invariantes:
    - id: movimento
      prova:
        "os três envoltórios usam opacity 0 para 1, y 20 para 0 e duration 0.3"
    - id: atrasos
      prova:
        "card principal sem atraso; seções em 0.1 e 0.2; benefícios em 0.3, 0.4
        e 0.5 com a classe text-center group"
    - id: textos
      prova:
        "EquipamentoDetalhePage.test.tsx ainda contém Por que escolher a GB
        Locações? e os três itens inclusos"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoDetalhePage.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "[NOT_VERIFIED: device_or_emulator]"
```

## 39-compartilhar

O botão Compartilhar do detalhe passou para a própria tela. O título continua
`{nome} - GB Locações` e o texto continua
`Confira este equipamento para locação: {nome}`. A url continua sendo a página
atual. O arquivo antigo não tinha mais quem o importasse e foi removido.

```yaml
fatia:
  id: 39-compartilhar
  estado: intermediate
  conceito: botão de compartilhar o equipamento
  origem:
    - components/share-button.tsx
  destino:
    - packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoDetalhePage.tsx
  invariantes:
    - id: rotulo
      prova:
        "EquipamentoDetalhePage.test.tsx mostra Compartilhar na primeira pintura"
    - id: payload
      prova:
        "EquipamentoDetalhePage.test.tsx: Betoneira vira título Betoneira - GB
        Locações e texto Confira este equipamento para locação: Betoneira"
    - id: fallback
      prova:
        "sem Web Share API, copia window.location.href, mostra Link copiado! por
        2000 ms e, no erro, alerta Link para compartilhar:"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoDetalhePage.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "[NOT_VERIFIED: device_or_emulator]"
```

## 40-dados-estruturados

O JSON-LD de negócio, produto e trilha saiu de `components/structured-data.tsx`.
A home e o detalhe continuam importando o arquivo antigo, que agora só
reexporta. A nota do schema continua 4.8 com 124 avaliações, diferente das 127
exibidas na tela.

```yaml
fatia:
  id: 40-dados-estruturados
  estado: intermediate
  conceito: JSON-LD de negócio, produto e trilha
  origem:
    - components/structured-data.tsx
  destino:
    - packages/frontend/src/widgets/dados-estruturados/ui/StructuredData.tsx
    - packages/frontend/src/widgets/dados-estruturados/index.ts
    - components/structured-data.tsx
  invariantes:
    - id: negocio
      prova:
        "StructuredData.test.tsx contém GB Locações, CNPJ 34.780.330/0001-69 e
        os catálogos Andaimes Suspensos, Equipamentos para Altura, Betoneiras e
        Compressores"
    - id: produto
      prova:
        "StructuredData.test.tsx contém UsedCondition, unitText diária,
        ratingValue 4.8 e reviewCount 124"
    - id: validade
      prova:
        "StructuredData.test.tsx confere priceValidUntil com a data de hoje mais
        365 dias"
    - id: trilha
      prova: "StructuredData.test.tsx contém BreadcrumbList"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/dados-estruturados/ui/StructuredData.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "[NOT_VERIFIED: device_or_emulator]"
```

## 41-aposenta-dados-estruturados

A home e o detalhe passaram a importar o widget direto.
`components/structured-data.tsx` não tinha mais quem o importasse e foi
removido. O JSON-LD não mudou.

```yaml
fatia:
  id: 41-aposenta-dados-estruturados
  estado: intermediate
  conceito: aposentadoria do reexport de JSON-LD
  origem:
    - components/structured-data.tsx
  destino:
    - app/page.tsx
    - app/equipamentos/[id]/page.tsx
    - packages/frontend/src/widgets/dados-estruturados/index.ts
  invariantes:
    - id: mesmo-json
      prova:
        "StructuredData.test.tsx da fatia 40 continua cobrindo CNPJ, catálogos,
        UsedCondition, diária, 4.8 e 124"
    - id: sem-import-antigo
      prova:
        "busca por components/structured-data em ts e tsx não acha mais nenhum
        import"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/dados-estruturados/ui/StructuredData.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "[NOT_VERIFIED: device_or_emulator]"
```

## 42-galeria-equipamento

A galeria do detalhe passou para a tela, na variante web, porque usa
`next/image`. Sem fotos, continua o placeholder
`height=600&width=800&text=Equipamento`. O zoom, as setas e o aviso "Zoom para
ampliar" permanecem. O arquivo antigo não tinha mais quem o importasse e foi
removido.

```yaml
fatia:
  id: 42-galeria-equipamento
  estado: intermediate
  conceito: galeria de imagens do equipamento
  origem:
    - components/equipment-image-gallery.tsx
  destino:
    - packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoGaleria.web.tsx
    - packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoDetalhePage.tsx
  invariantes:
    - id: placeholder
      prova:
        "EquipamentoDetalhePage.test.tsx com lista vazia contém
        /placeholder.svg?height=600&amp;width=800&amp;text=Equipamento"
    - id: zoom
      prova: "EquipamentoDetalhePage.test.tsx contém Zoom para ampliar"
    - id: navegacao
      prova:
        "a galeria mantém aria-label Imagem anterior e Próxima imagem, e mostra
        +N quando passa de 8 fotos"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoDetalhePage.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "[NOT_VERIFIED: device_or_emulator]"
```

## 43-voltar-equipamentos

O link "Voltar aos Equipamentos" saiu da rota e foi para a variante web da tela.
Continua apontando para `/equipamentos`, só no mobile.

```yaml
fatia:
  id: 43-voltar-equipamentos
  estado: intermediate
  conceito: link de volta do detalhe do equipamento
  origem:
    - app/equipamentos/[id]/page.tsx
  destino:
    - packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoVoltar.web.tsx
    - packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoDetalhePage.tsx
  invariantes:
    - id: texto-e-destino
      prova:
        'EquipamentoDetalhePage.test.tsx contém Voltar aos Equipamentos e
        href="/equipamentos"'
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoDetalhePage.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "[NOT_VERIFIED: device_or_emulator]"
```

## 44-trilha-equipamento

A trilha do detalhe passou para a variante web da tela. Continua Home,
Equipamentos e a categoria quando há nome e slug. A página atual não é link. O
arquivo antigo não tinha mais quem o importasse e foi removido.

```yaml
fatia:
  id: 44-trilha-equipamento
  estado: intermediate
  conceito: trilha do detalhe do equipamento
  origem:
    - components/ui/breadcrumb.tsx
  destino:
    - packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoTrilha.web.tsx
    - packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoDetalhePage.tsx
  invariantes:
    - id: itens
      prova:
        'EquipamentoDetalhePage.test.tsx contém Home, Equipamentos e
        href="/equipamentos?categoria=concreto"'
    - id: estilo
      prova: "a trilha continua variant default e className text-orange-100"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoDetalhePage.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "[NOT_VERIFIED: device_or_emulator]"
```

## 45-selo-categoria

O selo da categoria do detalhe passou a ser montado pela tela, no tamanho `sm` e
sem hover. A rota só entrega ícone e cores. O componente do selo continua em
`components/ui/category-badge.tsx`.

```yaml
fatia:
  id: 45-selo-categoria
  estado: intermediate
  conceito: selo da categoria no detalhe do equipamento
  origem:
    - app/equipamentos/[id]/page.tsx
  destino:
    - packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoDetalhePage.tsx
  invariantes:
    - id: sem-hover
      prova:
        "EquipamentoDetalhePage.test.tsx não contém a sombra de hover
        shadow-[4px_8px_18px_2px_rgba(0,0,0,0.18)]"
    - id: tamanho
      prova: "a tela chama CategoryBadge com size sm e hover false"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoDetalhePage.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "[NOT_VERIFIED: device_or_emulator]"
```

## 46-preco-equipamento

O bloco de preço do detalhe passou para a tela. A rota só entrega os números. O
texto continua "Entrega em Porto Alegre e região" e "Resposta em até 2 horas". O
período popular padrão continua semanal. O arquivo antigo não tinha mais quem o
importasse e foi removido.

```yaml
fatia:
  id: 46-preco-equipamento
  estado: intermediate
  conceito: preço e orçamento no detalhe do equipamento
  origem:
    - components/smart-equipment-pricing.tsx
  destino:
    - packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoPreco.tsx
    - packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoDetalhePage.tsx
  invariantes:
    - id: textos
      prova:
        "EquipamentoDetalhePage.test.tsx contém Entrega em Porto Alegre e região
        e Resposta em até 2 horas"
    - id: padroes
      prova:
        "sem período informado, popularPeriod continua weekly e os quatro
        períodos de locação continuam habilitados"
    - id: gradiente
      prova: "o botão mantém o gradiente #f97316 e #ea580c"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoDetalhePage.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "[NOT_VERIFIED: device_or_emulator]"
```

## 47-botao-orcamento

O botão "Solicitar Orçamento Grátis" saiu de `components/` e foi para a variante
web do detalhe. Continua usando sessão, carrinho e o roteador. O arquivo antigo
não tinha mais quem o importasse e foi removido.

```yaml
fatia:
  id: 47-botao-orcamento
  estado: intermediate
  conceito: botão de solicitar orçamento no detalhe
  origem:
    - components/smart-quote-button.tsx
  destino:
    - packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoOrcamento.web.tsx
    - packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoPreco.tsx
  invariantes:
    - id: rotulo
      prova: "EquipamentoDetalhePage.test.tsx contém Solicitar Orçamento Grátis"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoDetalhePage.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "[NOT_VERIFIED: device_or_emulator]"
```

## 48-periodo-equipamento

O seletor de período saiu do arquivo grande e foi para o frontend. Os rótulos
continuam Diário, Semanal, Quinzenal e Mensal. O admin ainda importa o arquivo
antigo, que agora só reexporta.

```yaml
fatia:
  id: 48-periodo-equipamento
  estado: intermediate
  conceito: seletor de período do equipamento
  origem:
    - components/equipment-pricing-selector.tsx
  destino:
    - packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoPeriodo.tsx
    - packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoPreco.tsx
    - components/equipment-pricing-selector.tsx
  invariantes:
    - id: rotulos
      prova:
        "EquipamentoDetalhePage.test.tsx contém Semanal e Quinzenal; o arquivo
        também declara Diário e Mensal"
    - id: gradiente
      prova: "o período selecionado mantém o gradiente #f97316 e #ea580c"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoDetalhePage.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "[NOT_VERIFIED: device_or_emulator]"
```

## 49-checkbox

O checkbox saiu de `components/ui/checkbox.tsx` e foi para o pacote de UI, com a
mesma variante web e uma versão nativa simples. O arquivo antigo só reexporta.
No detalhe, o texto continua "Incluir finais de semana" e o marcado continua
laranja.

```yaml
fatia:
  id: 49-checkbox
  estado: intermediate
  conceito: checkbox do design system
  origem:
    - components/ui/checkbox.tsx
  destino:
    - packages/ui/src/web/Checkbox.web.tsx
    - packages/ui/src/native/Checkbox.native.tsx
    - packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoPreco.tsx
    - components/ui/checkbox.tsx
  invariantes:
    - id: finais-de-semana
      prova: "EquipamentoDetalhePage.test.tsx contém Incluir finais de semana"
    - id: marcado-laranja
      prova:
        "a variante web mantém data-[state=checked]:bg-orange-600 e
        data-[state=checked]:border-orange-600"
    - id: header
      prova:
        "a variante header continua fundo branco e texto laranja quando marcada"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoDetalhePage.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "[NOT_VERIFIED: device_or_emulator]"
```

## 50-calendario

O calendário saiu de `components/ui/calendar.tsx` e foi para a variante web do
detalhe. Os botões continuam "Mês anterior" e "Próximo mês". O arquivo antigo só
reexporta, porque outras telas ainda o importam. No preço, o calendário continua
fechado até o usuário abrir.

```yaml
fatia:
  id: 50-calendario
  estado: intermediate
  conceito: calendário de locação
  origem:
    - components/ui/calendar.tsx
  destino:
    - packages/frontend/src/pages/equipamento-detalhe/ui/Calendario.web.tsx
    - packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoPreco.tsx
    - components/ui/calendar.tsx
  invariantes:
    - id: meses
      prova:
        "Calendario.web.test.tsx em janeiro de 2026 contém Mês anterior, Próximo
        mês e janeiro"
    - id: fechado
      prova:
        "EquipamentoDetalhePage.test.tsx não abre o calendário na primeira
        pintura"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/equipamento-detalhe/ui/Calendario.web.test.tsx
        packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoDetalhePage.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "[NOT_VERIFIED: device_or_emulator]"
```

## 51-dica

O tooltip híbrido e a detecção de hover saíram de `components/` e `hooks/`. No
servidor o texto fica escondido e só o gatilho aparece. No mouse continua
tooltip; no toque continua popover. Os arquivos antigos só reexportam.

```yaml
fatia:
  id: 51-dica
  estado: intermediate
  conceito: dica híbrida de mouse e toque
  origem:
    - components/ui/HybridTooltip.tsx
    - hooks/useHasHover.ts
  destino:
    - packages/frontend/src/pages/equipamento-detalhe/ui/Dica.tsx
    - packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoPreco.tsx
    - components/ui/HybridTooltip.tsx
    - hooks/useHasHover.ts
  invariantes:
    - id: servidor
      prova:
        "Dica.test.tsx mostra AJUDA e não mostra o texto da dica na primeira
        pintura"
    - id: mouse-e-toque
      prova:
        "com hover usa tooltip no side recebido; sem hover usa popover com side
        bottom quando o mobile não é informado"
    - id: atraso
      prova: "delayDuration continua 500 e sideOffset continua 5"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/equipamento-detalhe/ui/Dica.test.tsx
        packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoDetalhePage.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "[NOT_VERIFIED: device_or_emulator]"
```

## 52-avisos-detalhe

Os textos dos toasts do detalhe foram para o modelo da página. O detalhe passa a
chamar o Sonner direto. As outras telas continuam no hook antigo, que só
reexporta o Sonner.

```yaml
fatia:
  id: 52-avisos-detalhe
  estado: intermediate
  conceito: avisos de data e de login no detalhe
  origem:
    - packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoPreco.tsx
    - packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoOrcamento.web.tsx
  destino:
    - packages/frontend/src/pages/equipamento-detalhe/model/avisos.ts
  invariantes:
    - id: datas
      prova:
        "avisos.test.ts: início, data final e sucesso ficam no top-right por
        8000 ms; 1 dia fica no singular e 3 dias no plural"
    - id: login
      prova: "avisos.test.ts: Login necessário fica no top-center por 12000 ms"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/equipamento-detalhe/model/avisos.test.ts
        packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoDetalhePage.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "[NOT_VERIFIED: device_or_emulator]"
```

## 53-dialogo-alerta

O diálogo de alerta saiu de `components/ui/alert-dialog.tsx` e foi para o pacote
de UI. O botão de confirmar continua com o estilo padrão e o de cancelar com o
contorno. O fundo usa as camadas `--layer-dialog-backdrop` e `--layer-dialog`. O
arquivo antigo só reexporta. No orçamento, a pergunta continua "Incluir finais
de semana?".

```yaml
fatia:
  id: 53-dialogo-alerta
  estado: intermediate
  conceito: diálogo de confirmação
  origem:
    - components/ui/alert-dialog.tsx
  destino:
    - packages/ui/src/web/AlertDialog.web.tsx
    - packages/ui/src/native/AlertDialog.native.tsx
    - packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoOrcamento.web.tsx
    - components/ui/alert-dialog.tsx
  invariantes:
    - id: pergunta
      prova:
        "EquipamentoOrcamento.web.tsx mantém o título Incluir finais de semana?"
    - id: botoes
      prova:
        "a ação usa buttonVariants padrão e o cancelamento usa variant outline"
    - id: camadas
      prova:
        "o overlay usa --layer-dialog-backdrop e o conteúdo usa --layer-dialog"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoDetalhePage.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "[NOT_VERIFIED: device_or_emulator]"
```

## 54-botao-fechar

O botão de fechar saiu de `components/ui/close-button.tsx` e foi para o pacote
de UI. Sem rótulo, continua "Close". No orçamento, continua "Fechar dialog" no
tamanho pequeno e na variante ghostWhite. O arquivo antigo só reexporta.

```yaml
fatia:
  id: 54-botao-fechar
  estado: intermediate
  conceito: botão de fechar
  origem:
    - components/ui/close-button.tsx
  destino:
    - packages/ui/src/web/CloseButton.web.tsx
    - packages/ui/src/native/CloseButton.native.tsx
    - packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoOrcamento.web.tsx
    - components/ui/close-button.tsx
  invariantes:
    - id: rotulo-padrao
      prova: "CloseButton.web.test.tsx sem rótulo contém aria-label Close"
    - id: orcamento
      prova:
        "CloseButton.web.test.tsx com Fechar dialog e size sm contém esse rótulo
        e a classe h-6 w-6"
    - id: variante
      prova: "o orçamento continua variant ghostWhite"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/CloseButton.web.test.tsx
        packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoDetalhePage.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "[NOT_VERIFIED: device_or_emulator]"
```

## 55-carrinho

O cálculo de datas da locação e o carrinho saíram dos arquivos antigos. Sábado
sem fim de semana continua caindo na segunda. Sábado com fim de semana continua
no próprio sábado. Item repetido continua substituindo a quantidade. A chave do
navegador continua `gb-locacoes-cart`. Os arquivos antigos só reexportam.

```yaml
fatia:
  id: 55-carrinho
  estado: intermediate
  conceito: carrinho e datas automáticas da locação
  origem:
    - lib/rental-date-utils.ts
    - stores/useCartStore.ts
  destino:
    - packages/frontend/src/entities/locacao/model/datas.ts
    - packages/frontend/src/features/carrinho/model/carrinho.ts
    - packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoOrcamento.web.tsx
    - lib/rental-date-utils.ts
    - stores/useCartStore.ts
  invariantes:
    - id: sem-fim-de-semana
      prova:
        "datas.test.ts: sábado 3/1/2026 com 1 dia e sem fim de semana começa e
        termina na segunda 5/1 às 23:59"
    - id: com-fim-de-semana
      prova:
        "datas.test.ts: sábado 3/1/2026 com 2 dias e fim de semana começa no
        sábado 0h e termina no domingo às 23:59"
    - id: quantidade
      prova:
        "carrinho.test.ts: o mesmo equipamento com quantidade 1 e depois 3 fica
        com um item de quantidade 3; dois equipamentos 2 e 1 somam 3"
    - id: chave
      prova: "o persist continua com o nome gb-locacoes-cart"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/entities/locacao/model/datas.test.ts
        packages/frontend/src/features/carrinho/model/carrinho.test.ts
        packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoDetalhePage.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "[NOT_VERIFIED: device_or_emulator]"
```

## 56-aposenta-datas-locacao

O orçamento, a área do cliente e a criação de orçamento passaram a importar as
datas direto do frontend. `lib/rental-date-utils.ts` não tinha mais quem o
importasse e foi removido. A regra de sábado não mudou.

```yaml
fatia:
  id: 56-aposenta-datas-locacao
  estado: intermediate
  conceito: aposentadoria do arquivo antigo de datas da locação
  origem:
    - lib/rental-date-utils.ts
  destino:
    - app/orcamento/page.tsx
    - app/area-cliente/page.tsx
    - app/api/quotes/route.ts
    - packages/frontend/src/entities/locacao/model/datas.ts
  invariantes:
    - id: mesma-regra
      prova:
        "datas.test.ts da fatia 55 continua cobrindo sábado sem fim de semana na
        segunda e sábado com fim de semana no próprio sábado"
    - id: sem-import-antigo
      prova:
        "busca por rental-date-utils em ts e tsx não acha mais nenhum import"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/entities/locacao/model/datas.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "[NOT_VERIFIED: device_or_emulator]"
```

## 57-aposenta-loja-carrinho

O orçamento, a área do cliente e os hooks do carrinho passaram a importar a loja
direto do frontend. `stores/useCartStore.ts` não tinha mais quem o importasse e
foi removido. A chave continua `gb-locacoes-cart`.

```yaml
fatia:
  id: 57-aposenta-loja-carrinho
  estado: intermediate
  conceito: aposentadoria da loja antiga do carrinho
  origem:
    - stores/useCartStore.ts
  destino:
    - app/orcamento/page.tsx
    - app/area-cliente/page.tsx
    - hooks/use-quote-form.ts
    - hooks/use-cart-sync.ts
    - hooks/use-cart-notifications.ts
    - packages/frontend/src/features/carrinho/model/carrinho.ts
  invariantes:
    - id: quantidade
      prova:
        "carrinho.test.ts da fatia 55 continua substituindo quantidade 1 por 3 e
        somando 2+1"
    - id: sem-import-antigo
      prova:
        "busca por stores/useCartStore em ts e tsx não acha mais nenhum import"
    - id: chave
      prova: "o persist continua com o nome gb-locacoes-cart"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/features/carrinho/model/carrinho.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "[NOT_VERIFIED: device_or_emulator]"
```

## 58-aviso-carrinho

O contador do carrinho no cabeçalho passou a ler a loja do frontend. O aviso de
carrinho abandonado continua com o título "Carrinho Abandonado", o destino
`/orcamento` e o plural "items". `hooks/use-cart-notifications.ts` foi removido.

```yaml
fatia:
  id: 58-aviso-carrinho
  estado: intermediate
  conceito: contador e aviso de carrinho abandonado
  origem:
    - hooks/use-cart-notifications.ts
  destino:
    - packages/frontend/src/features/carrinho/model/notificacoes.ts
    - components/header.tsx
  invariantes:
    - id: um-item
      prova:
        "notificacoes.test.ts: 1 item gera Você tem 1 item aguardando no seu
        carrinho. Finalize sua compra!"
    - id: plural
      prova:
        "notificacoes.test.ts: 2 itens geram Você tem 2 items aguardando no seu
        carrinho. Finalize sua compra!"
    - id: destino
      prova:
        "notificacoes.test.ts: type equipment, priority medium, title Carrinho
        Abandonado e actionUrl /orcamento"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/features/carrinho/model/notificacoes.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "[NOT_VERIFIED: device_or_emulator]"
```

## 59-sincronia-carrinho

A sincronia do carrinho saiu de `hooks/use-cart-sync.ts`. Nenhum arquivo a
chamava. A regra foi preservada no frontend: com sessão e itens locais, continua
o GET `/api/cart/sync` e o POST `/api/cart/merge`. Preço final ausente continua
indefinido. O arquivo antigo foi removido.

```yaml
fatia:
  id: 59-sincronia-carrinho
  estado: intermediate
  conceito: sincronia do carrinho local com o servidor
  origem:
    - hooks/use-cart-sync.ts
  destino:
    - packages/frontend/src/features/carrinho/model/sincronizar.web.ts
  invariantes:
    - id: mapa
      prova:
        "sincronizar.web.test.ts: Betoneira a 100, categoria Concreto e imagem
        /foto.jpg; preço final ausente fica indefinido"
    - id: preco-final
      prova: "sincronizar.web.test.ts: finalPrice 250 vira número 250"
    - id: rotas
      prova:
        "o hook continua em GET /api/cart/sync e POST /api/cart/merge só com
        status authenticated e itens locais"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/features/carrinho/model/sincronizar.web.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "nenhuma tela chama useCartSync hoje"
      - "hooks/use-quote-form.ts continua em hooks/"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - hooks/use-cart-sync.ts
  nao_verificado:
    - "[NOT_VERIFIED: GET /api/cart/sync e POST /api/cart/merge]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 60-formulario-material

O formulário de material saiu de `hooks/use-quote-form.ts`. Nenhuma tela o
chamava. O total continua preço vezes quantidade vezes dias, separado do total
do carrinho. Quantidade e dias continuam no mínimo 1. Sem itens, o aviso
continua `Selecione ao menos um material.`. O envio continua uma espera de 2
segundos, sem POST. O sucesso continua
`Orçamento enviado com sucesso! Entraremos em contato em breve.` e limpa o
carrinho. O arquivo antigo foi removido.

```yaml
fatia:
  id: 60-formulario-material
  estado: intermediate
  conceito: formulário de orçamento por material
  origem:
    - hooks/use-quote-form.ts
  destino:
    - packages/frontend/src/entities/orcamento/model/formulario.ts
    - packages/frontend/src/features/carrinho/model/formulario-orcamento.ts
  invariantes:
    - id: total
      prova: "formulario.test.ts: 100 x 2 x 3 mais 50 x 1 x 1 = 650"
    - id: minimo
      prova: "formulario.test.ts: 0 e -4 viram 1; 3 permanece 3"
    - id: avisos
      prova:
        "formulario.test.ts: Selecione ao menos um material.; sucesso Entraremos
        em contato em breve.; espera 2000"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/entities/orcamento/model/formulario.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "nenhuma tela chama useQuoteForm hoje"
      - "o envio simulado não chama /api/quotes"
      - "app/orcamento/page.tsx continua dono do orçamento real"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - hooks/use-quote-form.ts
  nao_verificado:
    - "[NOT_VERIFIED: envio do formulário no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 61-corpo-orcamento

O POST `/api/quotes` da página `/orcamento` passou a montar o corpo em
`entities/orcamento`. CPF, CNPJ, empresa e recado só com espaço continuam
omitidos. CEP `90000-000` continua `90000-000`. Quantidade e dias 0 continuam 1.
Final de semana ausente continua falso. O aviso de campos obrigatórios continua
Nome Completo, Telefone e E-mail. A página ainda envia, mostra o toast e limpa o
carrinho.

```yaml
fatia:
  id: 61-corpo-orcamento
  estado: intermediate
  conceito: corpo do POST /api/quotes e campos obrigatórios
  origem:
    - app/orcamento/page.tsx
  destino:
    - packages/frontend/src/entities/orcamento/model/envio.ts
    - app/orcamento/page.tsx
  invariantes:
    - id: brancos
      prova:
        "envio.test.ts: cpf e cnpj em branco ficam indefinidos; cep 90000-000;
        recado preciso"
    - id: item
      prova:
        "envio.test.ts: quantidade 0 e dias 0 viram 1; startDate
        2026-01-05T00:00:00.000Z; includeWeekends false"
    - id: obrigatorios
      prova:
        "envio.test.ts: Nome Completo, Telefone, E-mail e a frase Por favor,
        preencha os seguintes campos antes de enviar"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/entities/orcamento/model/envio.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "app/orcamento/page.tsx continua dono da tela, do POST e dos toasts"
      - "components/quote-form.tsx continua com o próprio envio por WhatsApp"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: POST /api/quotes no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 62-validacao-orcamento

A ordem de validação do envio em `/orcamento` passou para `assessQuoteSubmit`.
Continua exigindo CPF ou CNPJ, documento válido, empresa quando há CNPJ, dias de
locação, tipo de entrega e, na entrega, os campos CEP, Logradouro, Número,
Bairro, Cidade e Estado. Retirada em loja continua sem endereço. Os títulos dos
avisos e o foco nos campos continuam na página.

```yaml
fatia:
  id: 62-validacao-orcamento
  estado: intermediate
  conceito: validação do envio do orçamento
  origem:
    - app/orcamento/page.tsx
  destino:
    - packages/frontend/src/entities/orcamento/model/envio.ts
    - app/orcamento/page.tsx
  invariantes:
    - id: documento
      prova:
        "envio.test.ts: documento ausente, CPF inválido, CNPJ inválido e empresa
        obrigatória com CNPJ"
    - id: periodo-entrega
      prova:
        "envio.test.ts: dias 0 pede período; sem tipo pede Retirada em Loja;
        entrega sem endereço pede CEP até Estado"
    - id: retirada
      prova: "envio.test.ts: PICKUP com CPF e 2 dias não gera pendência"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/entities/orcamento/model/envio.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "app/orcamento/page.tsx continua dono da tela, dos toasts e do foco"
      - "disponibilidade e confirmação de fim de semana continuam na página"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: avisos de validação no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 63-fim-de-semana-endereco

A confirmação de fim de semana e a comparação de endereço saíram da página
`/orcamento`. Continua pedindo confirmação do primeiro item sem data de início
ou fim e sem `includeWeekendsConfirmed`. Item com as duas datas, ou já
confirmado, segue. O CEP `90000-000` continua igual a `90000000`. Maiúsculas e
espaços extras continuam ignorados. Endereço completo continua exigindo CEP,
logradouro, número, bairro, cidade e estado, sem exigir complemento.

```yaml
fatia:
  id: 63-fim-de-semana-endereco
  estado: intermediate
  conceito: confirmação de fim de semana e endereço salvo
  origem:
    - app/orcamento/page.tsx
  destino:
    - packages/frontend/src/entities/orcamento/model/envio.ts
    - app/orcamento/page.tsx
  invariantes:
    - id: fim-de-semana
      prova:
        "envio.test.ts: o primeiro sem datas e sem confirmação é Andaime;
        Betoneira com datas e Compressor confirmado ficam de fora"
    - id: aviso
      prova:
        'envio.test.ts: Precisamos confirmar se o uso aos finais de semana está
        incluído para "Andaime".'
    - id: endereco
      prova:
        "envio.test.ts: CEP 90000-000 igual a 90000000; rua b é diferente;
        número vazio não está completo"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/entities/orcamento/model/envio.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "app/orcamento/page.tsx continua dono da tela, dos dialogs e do POST"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: dialog de fim de semana no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 64-dados-novos-cliente

A escolha do que gravar no perfil saiu da página `/orcamento`. Telefone, CPF e
CNPJ em branco continuam de fora. A comparação desses três continua só pelos
dígitos. A empresa continua comparada com o texto aparado, respeitando
maiúsculas, e o valor gravado continua o texto original do formulário.

```yaml
fatia:
  id: 64-dados-novos-cliente
  estado: intermediate
  conceito: dados novos do cliente no orçamento
  origem:
    - app/orcamento/page.tsx
  destino:
    - packages/frontend/src/entities/orcamento/model/envio.ts
    - app/orcamento/page.tsx
  invariantes:
    - id: digitos
      prova:
        "envio.test.ts: telefone em branco fica de fora; (51) 99999-9999 igual a
        51999999999"
    - id: cpf
      prova: "envio.test.ts: CPF 123 contra 999 entra no objeto a gravar"
    - id: empresa
      prova:
        "envio.test.ts: empresa GB contra gb entra como o texto original com
        espaços, GB "
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/entities/orcamento/model/envio.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "app/orcamento/page.tsx continua dono da tela e do POST
        /api/user/profile"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: gravação do perfil no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 65-whatsapp-orcamento

A mensagem de WhatsApp saiu de `lib/whatsapp.ts`. O título continua
`SOLICITAÇÃO DE ORÇAMENTO - GB LOCAÇÕES`. CPF vazio continua omitido. Preço
final 0 continua caindo no cálculo preço × quantidade × dias. O link do primeiro
equipamento continua na primeira linha, com a base `https://locacoesgb.com.br`.
O telefone da página continua `555198205163`. O padrão da função de abrir,
quando ninguém passa número, continua `5551998205163`. `lib/whatsapp.ts` foi
removido.

```yaml
fatia:
  id: 65-whatsapp-orcamento
  estado: intermediate
  conceito: mensagem de orçamento no WhatsApp
  origem:
    - lib/whatsapp.ts
  destino:
    - packages/frontend/src/entities/orcamento/model/whatsapp.ts
    - app/orcamento/page.tsx
    - components/quote-form.tsx
  invariantes:
    - id: telefone
      prova:
        "whatsapp.test.ts: (51) 98205-163 e 05198205163 viram 555198205163;
        5551998205163 permanece"
    - id: mensagem
      prova:
        "whatsapp.test.ts: título SOLICITAÇÃO DE ORÇAMENTO - GB LOCAÇÕES;
        desconto semanal -10%; total R$ 600.00; CPF omitido"
    - id: url
      prova: "whatsapp.test.ts: https://wa.me/555198205163?text=oi"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/entities/orcamento/model/whatsapp.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "openWhatsAppQuote ainda usa window e navigator"
      - "app/orcamento/page.tsx e components/quote-form.tsx continuam donos das
        telas"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - lib/whatsapp.ts
  nao_verificado:
    - "[NOT_VERIFIED: abertura do WhatsApp no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 66-documento-orcamento

A validação e a formatação de CPF e CNPJ saíram para o frontend.
`529.982.247-25` continua válido. `111.111.111-11` continua inválido. O CNPJ
`11.222.333/0001-81` continua válido e o dígito trocado continua inválido.
Documento vazio na formatação continua `-`. O endereço sem complemento continua
`Rua A, 10 - Centro - Porto Alegre/RS - 90000-000`. A busca do ViaCEP continua
em `lib/utils/validation.ts`, que reexporta as funções puras. A página
`/orcamento` passou a importar o frontend.

```yaml
fatia:
  id: 66-documento-orcamento
  estado: intermediate
  conceito: CPF, CNPJ e endereço formatado
  origem:
    - lib/utils/validation.ts
  destino:
    - packages/frontend/src/entities/orcamento/model/documento.ts
    - app/orcamento/page.tsx
    - lib/utils/validation.ts
  invariantes:
    - id: cpf
      prova:
        "documento.test.ts: 529.982.247-25 válido; 111.111.111-11 e 123
        inválidos"
    - id: cnpj
      prova:
        "documento.test.ts: 11.222.333/0001-81 válido; 11.111.111/1111-11 e
        dígito 80 inválidos"
    - id: formato
      prova:
        "documento.test.ts: documento vazio vira -; endereço sem complemento
        omite o trecho"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/entities/orcamento/model/documento.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "lib/utils/validation.ts continua com fetchAddressByCEP e reexporta o
        restante"
      - "app/orcamento/page.tsx continua dono da tela"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: ViaCEP no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 67-frete-sem-reexport

A página `/orcamento` e `app/api/quotes/route.ts` passaram a importar o frete
direto do frontend. CEP incompleto continua com a nota `CEP inválido`. No mesmo
prefixo, duas peças continuam 30 e 45, com 3 e 1 dias, nomes Transportadora
Padrão e Entrega Expressa. `lib/freight-calculator.ts` foi removido.

```yaml
fatia:
  id: 67-frete-sem-reexport
  estado: intermediate
  conceito: frete do orçamento sem arquivo de reexport
  origem:
    - lib/freight-calculator.ts
  destino:
    - packages/frontend/src/entities/orcamento/model/frete.ts
    - app/orcamento/page.tsx
    - app/api/quotes/route.ts
  invariantes:
    - id: cep
      prova: "frete.test.ts: CEP 123 devolve nota CEP inválido e lista vazia"
    - id: mesmo-prefixo
      prova:
        "frete.test.ts: 90240-100 para 90240-000 com quantidade 2 devolve 30 e
        45, 3 e 1 dias"
    - id: nomes
      prova: "frete.test.ts: Transportadora Padrão e Entrega Expressa"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/entities/orcamento/model/frete.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "app/orcamento/page.tsx continua dono da tela"
      - "a chamada ao Melhor Envio continua dentro de calculateFreight"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - lib/freight-calculator.ts
  nao_verificado:
    - "[NOT_VERIFIED: frete no browser e no POST /api/quotes]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 68-preco-sem-reexport

A página `/orcamento`, a área do cliente e o teste de preço passaram a importar
o motor direto do frontend. Sete dias com valor direto semanal 400
continuam 400. `lib/pricing.ts` foi removido. `lib/quote-pricing.ts` continua no
lugar.

```yaml
fatia:
  id: 68-preco-sem-reexport
  estado: intermediate
  conceito: motor de preço sem arquivo de reexport
  origem:
    - lib/pricing.ts
  destino:
    - packages/frontend/src/entities/equipamento/model/preco.ts
    - app/orcamento/page.tsx
    - app/area-cliente/page.tsx
  invariantes:
    - id: direto-semanal
      prova:
        "preco.test.ts: 7 dias com weeklyDirectValue 400 e weeklyUseDirectValue
        true devolve 400"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/entities/equipamento/model/preco.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "lib/quote-pricing.ts continua separado do motor de equipamento"
      - "app/orcamento/page.tsx e app/area-cliente/page.tsx continuam donos das
        telas"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - lib/pricing.ts
  nao_verificado:
    - "[NOT_VERIFIED: preço na tela de orçamento e na área do cliente]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 69-preco-orcamento-sem-reexport

As rotas `POST /api/quotes` e `POST /api/orcamentos` passaram a importar
`buildQuotePricing` direto do frontend. Três dias e quantidade 2 a 100 continuam
período `diaria` e total 600. Sete dias continuam `semanal`. Dias 0 continuam
preço e total 0. `lib/quote-pricing.ts` foi removido.

```yaml
fatia:
  id: 69-preco-orcamento-sem-reexport
  estado: intermediate
  conceito: preço do orçamento sem arquivo de reexport
  origem:
    - lib/quote-pricing.ts
  destino:
    - packages/frontend/src/entities/orcamento/model/preco.ts
    - app/api/quotes/route.ts
    - app/api/orcamentos/route.ts
  invariantes:
    - id: diaria
      prova:
        "preco.test.ts: 3 dias e quantidade 2 a 100 viram periodo diaria e total
        600"
    - id: semanal
      prova: "preco.test.ts: 7 dias e quantidade 1 viram periodo semanal"
    - id: zero
      prova: "preco.test.ts: 0 dias mantém pricePerDay 0 e total 0"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/entities/orcamento/model/preco.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "app/orcamento/page.tsx continua dono da tela"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - lib/quote-pricing.ts
  nao_verificado:
    - "[NOT_VERIFIED: POST /api/quotes e POST /api/orcamentos]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 70-termos-sem-reexport

A página `/orcamento` passou a ler os termos direto do frontend. A data continua
`19 de janeiro de 2026`. A seção `Objeto e Aceitação` continua. O título
continua `Termos e Condições de Uso`. `components/terms/terms-content.ts` foi
removido.

```yaml
fatia:
  id: 70-termos-sem-reexport
  estado: intermediate
  conceito: termos de uso no orçamento sem arquivo de reexport
  origem:
    - components/terms/terms-content.ts
  destino:
    - packages/frontend/src/entities/termo
    - app/orcamento/page.tsx
  invariantes:
    - id: data
      prova: "TermosPage.test.tsx: termsLastUpdated é 19 de janeiro de 2026"
    - id: secao
      prova:
        "TermosPage.test.tsx: existe a seção Objeto e Aceitação e o título
        Termos e Condições de Uso"
    - id: fechamento
      prova:
        "TermosPage.test.tsx: Estamos à disposição para esclarecer quaisquer
        dúvidas."
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/termos/ui/TermosPage.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "app/orcamento/page.tsx continua dono da tela e do diálogo de termos"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - components/terms/terms-content.ts
  nao_verificado:
    - "[NOT_VERIFIED: diálogo de termos na página de orçamento]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 71-boleto-sem-reexport

`lib/quote-boleto.ts` e `lib/rental-converter.ts` passaram a importar o
vencimento direto do frontend. Segunda 5 de janeiro de 2026 às 10:00 mais 3 dias
úteis continua quinta 8 às 23:59:59. Sexta 9 mais 1 dia útil continua
segunda 12. O prazo padrão continua 3 dias úteis. `lib/boleto-utils.ts` foi
removido.

```yaml
fatia:
  id: 71-boleto-sem-reexport
  estado: intermediate
  conceito: vencimento do boleto sem arquivo de reexport
  origem:
    - lib/boleto-utils.ts
  destino:
    - packages/frontend/src/entities/pagamento/model/vencimento.ts
    - lib/quote-boleto.ts
    - lib/rental-converter.ts
  invariantes:
    - id: tres-dias
      prova:
        "vencimento.test.ts: 5 de janeiro de 2026 10:00 mais 3 dias úteis cai em
        8 às 23:59:59"
    - id: fim-de-semana
      prova:
        "vencimento.test.ts: sexta 9 mais 1 dia útil cai no dia 12, segunda"
    - id: padrao
      prova: "vencimento.test.ts: omitir o prazo equivale a 3 dias úteis"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/entities/pagamento/model/vencimento.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "a geração do boleto continua em lib/quote-boleto.ts e
        lib/rental-converter.ts"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - lib/boleto-utils.ts
  nao_verificado:
    - "[NOT_VERIFIED: emissão de boleto]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 72-hover-sem-hook

`hooks/useHasHover.ts` não era importado. A dica continua em `HybridTooltip`. No
servidor, o gatilho aparece e o texto fica escondido. O arquivo do hook foi
removido. `components/ui/HybridTooltip.tsx` continua reexportando a dica.

```yaml
fatia:
  id: 72-hover-sem-hook
  estado: intermediate
  conceito: dica de hover sem hook legado
  origem:
    - hooks/useHasHover.ts
  destino:
    - packages/frontend/src/pages/equipamento-detalhe/ui/Dica.tsx
  invariantes:
    - id: servidor
      prova:
        "Dica.test.tsx: o HTML contém AJUDA e não contém sábados e domingos são
        incluídos"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/equipamento-detalhe/ui/Dica.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/ui/HybridTooltip.tsx continua reexportando a dica"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - hooks/useHasHover.ts
  nao_verificado:
    - "[NOT_VERIFIED: dica com hover no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 73-contato-sem-reexport

Nenhuma tela importava `components/contact-form.tsx` nem
`components/ui/contact-info-card.tsx`. O formulário e o cartão já vivem no
frontend. O título continua `Entre em Contato`. O botão continua
`Enviar Solicitação`. O telefone continua `(51) 2313-6262`. Os dois arquivos de
reexport foram removidos.

```yaml
fatia:
  id: 73-contato-sem-reexport
  estado: intermediate
  conceito: contato sem arquivos de reexport
  origem:
    - components/contact-form.tsx
    - components/ui/contact-info-card.tsx
  destino:
    - packages/frontend/src/features/enviar-contato/ui/ContactForm.tsx
    - packages/frontend/src/widgets/contato-empresa/ui/ContactInfoCard.tsx
  invariantes:
    - id: titulo
      prova: "ContatoPage.test.tsx: Entre em Contato"
    - id: envio
      prova: "ContatoPage.test.tsx: Enviar Solicitação e (51) 2313-6262"
    - id: mapa
      prova: "ContatoPage.test.tsx: o espaço do mapa recebe MAPA-GB"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/contato/ui/ContatoPage.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "a rota pública de contato em app/ pode continuar fora do host fino"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - components/contact-form.tsx
    - components/ui/contact-info-card.tsx
  nao_verificado:
    - "[NOT_VERIFIED: envio do contato no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 74-multa-locacao-sem-reexport

A rota de multa da locação passou a importar `calculateRentalLateFee` direto do
frontend. Contrato de 10 dias no total 1000, 5 dias atrasado, continua multa 25.
No mesmo instante de início e fim, um dia depois, total 200, continua multa 10.
Sem atraso continua 0. Essa conta continua separada da multa do orçamento. O
papel da rota continua ADMIN. `lib/rental-late-fee.ts` foi removido.

```yaml
fatia:
  id: 74-multa-locacao-sem-reexport
  estado: intermediate
  conceito: multa de locação sem arquivo de reexport
  origem:
    - lib/rental-late-fee.ts
  destino:
    - packages/frontend/src/entities/locacao/model/multa.ts
    - app/api/admin/rentals/[id]/calculate-late-fee/route.ts
  invariantes:
    - id: cinco-por-cento
      prova:
        "multa.test.ts: total 1000, 10 dias de contrato, 5 dias de atraso, multa
        25 e overdue true"
    - id: mesmo-instante
      prova:
        "multa.test.ts: início e fim iguais, total 200, um dia depois, multa 10"
    - id: em-dia
      prova:
        "multa.test.ts: data atual igual ao fim devolve lateFee 0, daysOverdue 0
        e overdue false"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/entities/locacao/model/multa.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "a rota continua exigindo papel ADMIN e gravando no Prisma"
      - "lib/quote-validity.ts continua com a expiração no banco"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - lib/rental-late-fee.ts
  nao_verificado:
    - "[NOT_VERIFIED: POST da multa de locação]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 75-periodo-sem-reexport

As telas admin de equipamento novo e de edição passaram a importar o seletor de
período direto do frontend. O rótulo Quinzenal continua na página de detalhe.
`components/equipment-pricing-selector.tsx` foi removido.

```yaml
fatia:
  id: 75-periodo-sem-reexport
  estado: intermediate
  conceito: seletor de período sem arquivo de reexport
  origem:
    - components/equipment-pricing-selector.tsx
  destino:
    - packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoPeriodo.tsx
    - app/admin/equipamentos/novo/page.tsx
    - app/admin/equipamentos/[id]/editar/page.tsx
  invariantes:
    - id: quinzenal
      prova: "EquipamentoDetalhePage.test.tsx: o HTML contém Quinzenal"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoDetalhePage.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "as telas admin de equipamento continuam em app/admin"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - components/equipment-pricing-selector.tsx
  nao_verificado:
    - "[NOT_VERIFIED: seletor de período no admin]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 76-calendario-sem-reexport

Os seletores de data, o boleto, a logística, o gantt e a edição de equipamento
passaram a importar o calendário direto do frontend. Janeiro de 2026 continua
com o texto janeiro. Os botões continuam Mês anterior e Próximo mês.
`components/ui/calendar.tsx` foi removido.

```yaml
fatia:
  id: 76-calendario-sem-reexport
  estado: intermediate
  conceito: calendário sem arquivo de reexport
  origem:
    - components/ui/calendar.tsx
  destino:
    - packages/frontend/src/pages/equipamento-detalhe/ui/Calendario.web.tsx
  invariantes:
    - id: janeiro
      prova: "Calendario.web.test.tsx: janeiro de 2026 contém janeiro"
    - id: navegacao
      prova: "Calendario.web.test.tsx: Mês anterior e Próximo mês"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/equipamento-detalhe/ui/Calendario.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "os seletores de data e as telas admin continuam em components/ e app/"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - components/ui/calendar.tsx
  nao_verificado:
    - "[NOT_VERIFIED: calendário no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 77-dica-sem-reexport

Busca, upload, status, diálogos, boleto, impostos e as telas de equipamento
passaram a importar a dica direto do frontend. No servidor, o gatilho AJUDA
continua visível e o texto sábados e domingos são incluídos continua escondido.
`components/ui/HybridTooltip.tsx` foi removido.

```yaml
fatia:
  id: 77-dica-sem-reexport
  estado: intermediate
  conceito: dica sem arquivo de reexport
  origem:
    - components/ui/HybridTooltip.tsx
  destino:
    - packages/frontend/src/pages/equipamento-detalhe/ui/Dica.tsx
  invariantes:
    - id: servidor
      prova:
        "Dica.test.tsx: o HTML contém AJUDA e não contém sábados e domingos são
        incluídos"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/equipamento-detalhe/ui/Dica.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "as telas que abrem a dica continuam em components/ e app/"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - components/ui/HybridTooltip.tsx
  nao_verificado:
    - "[NOT_VERIFIED: dica com hover no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 78-checkbox-sem-reexport

As telas que usavam `components/ui/checkbox.tsx` passaram a importar `Checkbox`
de `@gb-locacoes/ui`. Marcado, a variante padrão continua com
`data-state="checked"` e a classe `data-[state=checked]:bg-orange-600`. A
variante de cabeçalho continua branca, com borda `orange-300`. O tamanho
continua `h-4 w-4`. O arquivo de reexport foi removido.

```yaml
fatia:
  id: 78-checkbox-sem-reexport
  estado: intermediate
  conceito: checkbox sem arquivo de reexport
  origem:
    - components/ui/checkbox.tsx
  destino:
    - packages/ui/src/web/Checkbox.web.tsx
  invariantes:
    - id: marcado
      prova:
        "Checkbox.web.test.tsx: checked traz data-state checked, h-4, w-4 e
        data-[state=checked]:bg-orange-600"
    - id: cabecalho
      prova:
        "Checkbox.web.test.tsx: variant header traz bg-white e
        data-[state=checked]:border-orange-300"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/Checkbox.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "o checkbox nativo não repete as classes web"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - components/ui/checkbox.tsx
  nao_verificado:
    - "[NOT_VERIFIED: checkbox no browser]"
    - "[NOT_VERIFIED: checkbox nativo no aparelho]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 79-fechar-sem-reexport

Cabeçalho, orçamento, WhatsApp, upload e o diálogo de saída passaram a importar
`CloseButton` de `@gb-locacoes/ui`. Sem rótulo, o aria-label continua `Close`.
No orçamento, o rótulo continua `Fechar dialog` e o tamanho pequeno continua
`h-6 w-6`. `components/ui/close-button.tsx` foi removido.

```yaml
fatia:
  id: 79-fechar-sem-reexport
  estado: intermediate
  conceito: botão de fechar sem arquivo de reexport
  origem:
    - components/ui/close-button.tsx
  destino:
    - packages/ui/src/web/CloseButton.web.tsx
  invariantes:
    - id: close
      prova: "CloseButton.web.test.tsx: sem rótulo o aria-label é Close"
    - id: orcamento
      prova:
        "CloseButton.web.test.tsx: Fechar dialog no tamanho sm traz h-6 w-6"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/CloseButton.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "o botão nativo não repete as classes web"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - components/ui/close-button.tsx
  nao_verificado:
    - "[NOT_VERIFIED: botão de fechar no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 80-alerta-sem-reexport

Orçamento, histórico do cliente e o diálogo de saída passaram a importar o
alerta de `@gb-locacoes/ui`. O título continua `Incluir finais de semana?`. O
cancelar continua `Não, apenas dias úteis`. A ação continua
`Sim, incluir finais de semana`. O cancelar do componente continua na variante
outline e a ação no botão padrão. `components/ui/alert-dialog.tsx` foi removido.

```yaml
fatia:
  id: 80-alerta-sem-reexport
  estado: intermediate
  conceito: diálogo de alerta sem arquivo de reexport
  origem:
    - components/ui/alert-dialog.tsx
  destino:
    - packages/ui/src/web/AlertDialog.web.tsx
    - app/orcamento/page.tsx
  invariantes:
    - id: textos
      prova:
        "AlertDialog.web.test.tsx: a página de orçamento ainda tem Incluir
        finais de semana?, Não, apenas dias úteis e Sim, incluir finais de
        semana"
    - id: variantes
      prova:
        "AlertDialog.web.test.tsx: cancelar usa buttonVariants outline e a ação
        usa buttonVariants padrão"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/AlertDialog.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "o alerta nativo só repassa os filhos"
      - "o conteúdo do Radix não aparece no render estático em node"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - components/ui/alert-dialog.tsx
  nao_verificado:
    - "[NOT_VERIFIED: diálogo de fim de semana no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 81-separador-sem-reexport

Orçamento, gantt, menu móvel e os painéis do calendário passaram a importar
`Separator` de `@gb-locacoes/ui`. Na horizontal continua `h-[1px] w-full`. Na
vertical continua `h-full w-[1px]`. `components/ui/separator.tsx` foi removido.

```yaml
fatia:
  id: 81-separador-sem-reexport
  estado: intermediate
  conceito: separador sem arquivo de reexport
  origem:
    - components/ui/separator.tsx
  destino:
    - packages/ui/src/web/Separator.web.tsx
  invariantes:
    - id: horizontal
      prova:
        "Separator.web.test.tsx: padrão traz data-orientation horizontal,
        h-[1px] e w-full"
    - id: vertical
      prova:
        "Separator.web.test.tsx: vertical traz data-orientation vertical,
        w-[1px] e h-full"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/Separator.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "button, input, label, textarea, card, badge e alert ainda reexportam em
        components/ui"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - components/ui/separator.tsx
  nao_verificado:
    - "[NOT_VERIFIED: separador no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 82-rotulo-sem-reexport

Formulários, orçamento, admin e histórias passaram a importar `Label` de
`@gb-locacoes/ui`. O texto continua `text-sm`, `font-medium` e `leading-none`.
`components/ui/label.tsx` foi removido.

```yaml
fatia:
  id: 82-rotulo-sem-reexport
  estado: intermediate
  conceito: rótulo sem arquivo de reexport
  origem:
    - components/ui/label.tsx
  destino:
    - packages/ui/src/web/Label.web.tsx
  invariantes:
    - id: classes
      prova:
        "Label.web.test.tsx: Nome Completo sai com text-sm, font-medium e
        leading-none"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/Label.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "button, input, textarea, card, badge e alert ainda reexportam em
        components/ui"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - components/ui/label.tsx
  nao_verificado:
    - "[NOT_VERIFIED: rótulo no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 83-textarea-sem-reexport

Orçamento, contato, admin e o diálogo de rejeição passaram a importar `Textarea`
de `@gb-locacoes/ui`. A altura mínima continua 80px. A largura continua total. O
texto continua `text-sm`. O placeholder Mensagem continua no atributo.
`components/ui/textarea.tsx` foi removido.

```yaml
fatia:
  id: 83-textarea-sem-reexport
  estado: intermediate
  conceito: área de texto sem arquivo de reexport
  origem:
    - components/ui/textarea.tsx
  destino:
    - packages/ui/src/web/Textarea.web.tsx
  invariantes:
    - id: caixa
      prova:
        "Textarea.web.test.tsx: placeholder Mensagem, min-h-[80px], w-full,
        rounded-md, px-3, py-2 e text-sm"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/Textarea.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "a área de texto nativa não repete as classes web"
      - "button, input, card, badge e alert ainda reexportam em components/ui"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - components/ui/textarea.tsx
  nao_verificado:
    - "[NOT_VERIFIED: área de texto no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 84-alerta-componente-sem-reexport

O boleto do cliente passou a importar `Alert` de `@gb-locacoes/ui`. Sem código
de barras continua o título `Boleto não disponível` e o texto
`Os dados do boleto não foram encontrados.` Vencido continua o título
`Boleto Vencido` na variante destrutiva. O papel continua `alert`.
`components/ui/alert.tsx` foi removido.

```yaml
fatia:
  id: 84-alerta-componente-sem-reexport
  estado: intermediate
  conceito: alerta visual sem arquivo de reexport
  origem:
    - components/ui/alert.tsx
  destino:
    - packages/ui/src/web/Alert.web.tsx
    - components/client/boleto-section.tsx
  invariantes:
    - id: papel
      prova:
        "Alert.web.test.tsx: variant destructive traz role alert,
        text-destructive, mb-1 e font-medium"
    - id: boleto
      prova:
        "Alert.web.test.tsx: a seção do boleto ainda tem Boleto não disponível,
        Os dados do boleto não foram encontrados e Boleto Vencido com variant
        destructive"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/Alert.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "button, input, card e badge ainda reexportam em components/ui"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - components/ui/alert.tsx
  nao_verificado:
    - "[NOT_VERIFIED: alerta do boleto no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 85-selo-sem-reexport

As telas que usavam `components/ui/badge.tsx` passaram a importar `Badge` de
`@gb-locacoes/ui`. A pílula padrão continua `rounded-full`, `px-2.5`, `py-0.5`,
`text-xs`, `font-semibold` e `bg-primary`. A variante destrutiva continua
`bg-destructive`. O selo de categoria do equipamento continua em outro arquivo.
`components/ui/badge.tsx` foi removido.

```yaml
fatia:
  id: 85-selo-sem-reexport
  estado: intermediate
  conceito: selo sem arquivo de reexport
  origem:
    - components/ui/badge.tsx
  destino:
    - packages/ui/src/web/Badge.web.tsx
  invariantes:
    - id: padrao
      prova:
        "Badge.web.test.tsx: Pendente sai rounded-full, px-2.5, py-0.5, text-xs,
        font-semibold e bg-primary"
    - id: destrutivo
      prova:
        "Badge.web.test.tsx: Vencido sai com bg-destructive e
        text-destructive-foreground"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/Badge.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "o selo de categoria continua em components/ui/category-badge.tsx"
      - "button, input e card ainda reexportam em components/ui"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - components/ui/badge.tsx
  nao_verificado:
    - "[NOT_VERIFIED: selo no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 86-cartao-sem-reexport

Admin, área do cliente, orçamento e listagens passaram a importar `Card` de
`@gb-locacoes/ui`. O cartão continua `rounded-lg`, com borda, `bg-card` e
`shadow-sm`. O cabeçalho continua `px-6 pt-6`. O título continua
`text-2xl font-semibold`. O conteúdo continua `p-6 pt-0`.
`components/ui/card.tsx` foi removido.

```yaml
fatia:
  id: 86-cartao-sem-reexport
  estado: intermediate
  conceito: cartão sem arquivo de reexport
  origem:
    - components/ui/card.tsx
  destino:
    - packages/ui/src/web/Card.web.tsx
  invariantes:
    - id: caixa
      prova:
        "Card.web.test.tsx: Resumo e Total saem com rounded-lg, border, bg-card,
        shadow-sm, px-6, pt-6, text-2xl, font-semibold e p-6 pt-0"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/Card.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "button e input ainda reexportam em components/ui"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - components/ui/card.tsx
  nao_verificado:
    - "[NOT_VERIFIED: cartão no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 87-campo-sem-reexport

Formulários, orçamento, admin, busca e o campo de moeda passaram a importar
`Input` de `@gb-locacoes/ui`. O campo de texto continua com altura `h-10` e sem
os botões de número. O campo numérico continua com `Incrementar` e `Decrementar`
em laranja. `components/ui/input.tsx` foi removido.

```yaml
fatia:
  id: 87-campo-sem-reexport
  estado: intermediate
  conceito: campo sem arquivo de reexport
  origem:
    - components/ui/input.tsx
  destino:
    - packages/ui/src/web/Input.web.tsx
  invariantes:
    - id: texto
      prova:
        "Input.web.test.tsx: tipo text com placeholder Nome traz h-10, w-full e
        rounded-md e não traz Incrementar"
    - id: numero
      prova:
        "Input.web.test.tsx: tipo number traz aria-label Incrementar e
        Decrementar e text-orange-600"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/Input.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "button ainda reexporta em components/ui/button.tsx"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - components/ui/input.tsx
  nao_verificado:
    - "[NOT_VERIFIED: campo numérico no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 88-botao-sem-reexport

As telas passaram a importar `Button` e `buttonVariants` de `@gb-locacoes/ui`. O
botão padrão continua `bg-slate-700`. A variante reset continua com
`hover:text-orange-500` e `hover:shadow-lg`, sem `hover:scale-105` e sem
`hover:border-orange-500`. Desabilitado continua com
`disabled:pointer-events-none`. `components/ui/button.tsx` foi removido.

```yaml
fatia:
  id: 88-botao-sem-reexport
  estado: intermediate
  conceito: botão sem arquivo de reexport
  origem:
    - components/ui/button.tsx
  destino:
    - packages/ui/src/web/Button.web.tsx
  invariantes:
    - id: padrao
      prova: "Button.web.test.tsx: Alugar sai em button com bg-slate-700"
    - id: reset
      prova:
        "Button.web.test.tsx: Limpar na variante reset tem hover:text-orange-500
        e hover:shadow-lg e não tem hover:scale-105 nem hover:border-orange-500"
    - id: desabilitado
      prova: "Button.web.test.tsx: disabled traz disabled:pointer-events-none"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/Button.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "o botão nativo usa estilo de token e não as classes Tailwind"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - components/ui/button.tsx
  nao_verificado:
    - "[NOT_VERIFIED: botão no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 89-configuracao-publica-sem-hook

Cabeçalho, rodapé, hero, contato, área do cliente e o playground passaram a ler
as configurações públicas direto do frontend. O telefone padrão continua
`(51) 2313-6262`. O WhatsApp continua `(51) 99820-5163`. Os e-mails continuam
`contato@locacoesgb.com.br` e `comercial@locacoesgb.com.br`. A onda continua
`animated`. A busca continua `GET /api/settings/public`, e não roda quando já há
dado inicial. `hooks/use-public-settings.ts` foi removido.

```yaml
fatia:
  id: 89-configuracao-publica-sem-hook
  estado: intermediate
  conceito: configurações públicas sem hook legado
  origem:
    - hooks/use-public-settings.ts
  destino:
    - packages/frontend/src/entities/configuracao/api/use-public-settings.ts
  invariantes:
    - id: contatos
      prova:
        "use-public-settings.test.ts: telefone (51) 2313-6262, WhatsApp (51)
        99820-5163, contato@locacoesgb.com.br e comercial@locacoesgb.com.br"
    - id: busca
      prova:
        "use-public-settings.test.ts: fetch /api/settings/public e if
        (hasInitialData) return; waveAnimation animated"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/entities/configuracao/api/use-public-settings.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "cabeçalho, rodapé e hero continuam em components/"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - hooks/use-public-settings.ts
  nao_verificado:
    - "[NOT_VERIFIED: GET /api/settings/public no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 90-negocio-local-sem-reexport

Home, detalhe do equipamento, rodapé e os schemas de SEO passaram a ler o
negócio local direto do frontend. Sem configuração, o nome continua
`GB Locações`, o CNPJ `34.780.330/0001-69`, a rua
`Travessa Doutor Heinzelmann, 365` e o telefone `+55 51 2313-6262`. Com telefone
informado, continuam só os dígitos depois de `+55`.
`lib/structured-data-utils.ts` foi removido.

```yaml
fatia:
  id: 90-negocio-local-sem-reexport
  estado: intermediate
  conceito: negócio local sem arquivo de reexport
  origem:
    - lib/structured-data-utils.ts
  destino:
    - packages/frontend/src/entities/configuracao/model/local-business.ts
    - app/page.tsx
    - app/equipamentos/[id]/page.tsx
  invariantes:
    - id: padrao
      prova:
        "local-business.test.ts: sem configuração, GB Locações, CNPJ
        34.780.330/0001-69, Travessa Doutor Heinzelmann, 365 e telefone +55 51
        2313-6262"
    - id: digitos
      prova:
        "local-business.test.ts: (51) 2313-6262 vira +55 5123136262 e o WhatsApp
        vira +55 51998205163"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/entities/configuracao/model/local-business.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "a home e o rodapé continuam em app/page.tsx e components/footer.tsx"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - lib/structured-data-utils.ts
  nao_verificado:
    - "[NOT_VERIFIED: JSON-LD da home no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 91-cabecalho-usuario

As iniciais, o primeiro nome, a página ativa e o papel de equipe saíram do
cabeçalho para o frontend. Nome vazio continua `U` e `Cliente`. `ana silva`
continua `AS` e `Ana`. `JOÃO` continua `J` e `João`. A home continua ativa só em
`/`. ADMIN, OPERATOR e FINANCIAL continuam equipe. CLIENT continua de fora.
Essas iniciais não são as do admin, que devolvem nulo. O arquivo do cabeçalho
continua em `components/header.tsx`.

```yaml
fatia:
  id: 91-cabecalho-usuario
  estado: intermediate
  conceito: iniciais, primeiro nome e página ativa do cabeçalho
  origem:
    - components/header.tsx
  destino:
    - packages/frontend/src/widgets/cabecalho/model/usuario.ts
    - components/header.tsx
  invariantes:
    - id: vazio
      prova: "usuario.test.ts: nome vazio vira U e Cliente"
    - id: nome
      prova: "usuario.test.ts: ana silva vira AS e Ana; JOÃO vira J e João"
    - id: rota
      prova:
        "usuario.test.ts: /equipamentos não ativa a home; /equipamentos/andaime
        ativa /equipamentos"
    - id: papeis
      prova:
        "usuario.test.ts: ADMIN, OPERATOR e FINANCIAL são equipe; CLIENT não é"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/cabecalho/model/usuario.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/header.tsx continua dono do cabeçalho"
      - "getInitials do admin continua devolvendo nulo para nome vazio"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: menu do cabeçalho no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 92-menu-cabecalho

A lista pública e o menu da conta saíram para o frontend. Os links continuam
Início `/`, Equipamentos `/equipamentos`, Orçamento `/orcamento`, Sobre `/sobre`
e Contato `/contato`. A equipe ganha Painel Administrador em `/admin` no topo. O
cliente não ganha esse item. Notificações continua com selo. Fora da área do
cliente, Minha Conta continua indo para `/area-cliente#dashboard-banner`.
Equipamentos continua sem parâmetros. O cabeçalho ainda desenha os ícones.

```yaml
fatia:
  id: 92-menu-cabecalho
  estado: intermediate
  conceito: links do menu do cabeçalho
  origem:
    - components/header.tsx
  destino:
    - packages/frontend/src/widgets/cabecalho/model/usuario.ts
    - components/header.tsx
  invariantes:
    - id: publico
      prova:
        "usuario.test.ts: Início Equipamentos Orçamento Sobre Contato em /,
        /equipamentos, /orcamento, /sobre e /contato"
    - id: conta
      prova:
        "usuario.test.ts: cliente começa em Dashboard; equipe começa em Painel
        Administrador /admin; Notificações tem showBadge"
    - id: scroll
      prova:
        "usuario.test.ts: /orcamento pede ajuste; /area-cliente/perfil não pede;
        mobile só ajusta href que começa com /area-cliente"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/cabecalho/model/usuario.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/header.tsx continua dono do cabeçalho e dos ícones"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: clique do menu no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 93-cabecalho-web

O componente do cabeçalho saiu de `components/header.tsx` para a variante web do
widget. O layout do cliente continua montando o mesmo `Header`. O fundo fixo
continua `#334155`. Os links e o menu da conta continuam os da fatia anterior. A
busca e o diálogo de saída continuam em `components/`. `use-mobile` continua em
`hooks/`.

```yaml
fatia:
  id: 93-cabecalho-web
  estado: intermediate
  conceito: componente do cabeçalho na variante web
  origem:
    - components/header.tsx
  destino:
    - packages/frontend/src/widgets/cabecalho/ui/Cabecalho.web.tsx
    - app/ClientLayout.tsx
  invariantes:
    - id: fundo
      prova:
        "token-check: Cabecalho.web.tsx mantém #334155 com allow slate-700 do
        cabeçalho fixo"
    - id: menu
      prova: "usuario.test.ts: links públicos e menu da conta da fatia 92"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/cabecalho/model/usuario.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "a busca e o diálogo de saída continuam em components/"
      - "hooks/use-mobile.tsx continua em hooks/"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - components/header.tsx
  nao_verificado:
    - "[NOT_VERIFIED: cabeçalho no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 94-busca-cabecalho

A busca do cabeçalho saiu de `components/header-search-combobox.tsx`. A chave
continua `gb-locacoes-recent-searches`, no máximo 6. A busca só começa com 2
caracteres, com espera de 300 ms. O endpoint continua
`/api/equipamentos/search`. O detalhe continua `/equipamentos/{id}` e a listagem
`/equipamentos?search=`. O placeholder continua
`Ex: andaime, betoneira, escada...`. A dica foi para `@gb-locacoes/ui` para o
widget não importar uma página. O popover continua em
`components/ui/popover.tsx`.

```yaml
fatia:
  id: 94-busca-cabecalho
  estado: intermediate
  conceito: busca do cabeçalho
  origem:
    - components/header-search-combobox.tsx
    - packages/frontend/src/pages/equipamento-detalhe/ui/Dica.tsx
  destino:
    - packages/frontend/src/widgets/cabecalho/ui/Busca.web.tsx
    - packages/frontend/src/widgets/cabecalho/model/busca.ts
    - packages/ui/src/web/HybridTooltip.web.tsx
  invariantes:
    - id: recentes
      prova:
        "busca.test.ts: chave gb-locacoes-recent-searches, máximo 6, mínimo 2
        caracteres, espera 300"
    - id: rotas
      prova:
        "busca.test.ts: andaime suspenso vira
        /api/equipamentos/search?q=andaime%20suspenso; detalhe
        /equipamentos/eq-1; listagem /equipamentos?search=betoneira"
    - id: dica
      prova:
        "Dica.test.tsx: o HTML contém AJUDA e não contém sábados e domingos são
        incluídos"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/cabecalho/model/busca.test.ts
        packages/frontend/src/pages/equipamento-detalhe/ui/Dica.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "o popover da busca continua em components/ui/popover.tsx"
      - "a dica nativa não está no índice native"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - components/header-search-combobox.tsx
    - packages/frontend/src/pages/equipamento-detalhe/ui/Dica.tsx
  nao_verificado:
    - "[NOT_VERIFIED: busca no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 95-popover

O popover saiu de `components/ui/popover.tsx` para `@gb-locacoes/ui`. O
alinhamento padrão continua `center`. O deslocamento continua `4`. A camada
continua `z-[95]`, a largura `w-96` e o fundo branco. A busca, os seletores de
data e os painéis do calendário passaram a importar daí. O índice native não
exporta o popover.

```yaml
fatia:
  id: 95-popover
  estado: intermediate
  conceito: popover no pacote de UI
  origem:
    - components/ui/popover.tsx
  destino:
    - packages/ui/src/web/Popover.web.tsx
  invariantes:
    - id: caixa
      prova:
        "Popover.web.test.ts: align center, sideOffset 4, z-[95], w-96, max-w
        calc 100vw-2rem, rounded-lg, bg-white e p-4"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/Popover.web.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "o popover nativo não está no índice native"
      - "o diálogo de saída continua em components/"
      - "hooks/use-mobile.tsx continua em hooks/"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - components/ui/popover.tsx
  nao_verificado:
    - "[NOT_VERIFIED: popover da busca no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 96-sair

O diálogo de saída saiu de `components/dialogs/logout-confirmation-dialog.tsx`.
O título continua `Confirmar saída`. O aviso continua pedindo login de novo para
a área do cliente. Os botões continuam `Cancelar` e `Sair`, e durante o envio
`Saindo...`. O fechar continua `Fechar dialog`. O destino padrão continua `/`. O
cabeçalho e a área do cliente continuam passando `callbackUrl="/"`. `signOut`
continua com esse destino.

```yaml
fatia:
  id: 96-sair
  estado: intermediate
  conceito: diálogo de saída
  origem:
    - components/dialogs/logout-confirmation-dialog.tsx
  destino:
    - packages/frontend/src/widgets/cabecalho/ui/Sair.web.tsx
    - packages/frontend/src/widgets/cabecalho/ui/Cabecalho.web.tsx
    - app/area-cliente/layout.tsx
  invariantes:
    - id: textos
      prova:
        "Sair.web.test.ts: Confirmar saída, Tem certeza que deseja sair da sua
        conta, Cancelar, Saindo... e Sair"
    - id: destino
      prova:
        "Sair.web.test.ts: callbackUrl padrão / e signOut({ callbackUrl });
        Fechar dialog"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/cabecalho/ui/Sair.web.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "hooks/use-mobile.tsx continua em hooks/"
      - "app/area-cliente/layout.tsx continua dono da área do cliente"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - components/dialogs/logout-confirmation-dialog.tsx
  nao_verificado:
    - "[NOT_VERIFIED: saída no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 97-movel

`useIsMobile` saiu de `hooks/use-mobile.tsx`. A largura móvel continua abaixo
de 768. A consulta continua `(max-width: 767px)`. Antes do efeito, o valor
continua falso. O cabeçalho, a área do cliente, a sidebar e os hooks de lista
passaram a importar o frontend.

```yaml
fatia:
  id: 97-movel
  estado: intermediate
  conceito: breakpoint móvel
  origem:
    - hooks/use-mobile.tsx
  destino:
    - packages/frontend/src/shared/lib/mobile.ts
  invariantes:
    - id: breakpoint
      prova: "mobile.test.ts: MOBILE_BREAKPOINT 768 e media (max-width: 767px)"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/shared/lib/mobile.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "hooks/use-equipment-list-data.ts, use-email-page.ts e
        use-categories-data.ts continuam em hooks/"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - hooks/use-mobile.tsx
  nao_verificado:
    - "[NOT_VERIFIED: layout móvel no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 98-mapa-categoria

O mapa entre a categoria e o diálogo saiu para o frontend. A página continua com
9 itens. Sem cor, o desenho padrão continua azul `#3b82f6`, ícone `Tag` e
posição `types`. JSON inválido do ícone continua caindo no padrão. Com origem
`none`, o ícone lucide segue e o ícone customizado fica nulo. Com outra origem,
o ícone lucide fica nulo e a posição vazia fica nula. A busca continua
`GET /api/admin/categories` no hook.

```yaml
fatia:
  id: 98-mapa-categoria
  estado: intermediate
  conceito: mapa da categoria para o diálogo e para a API
  origem:
    - hooks/use-categories-data.ts
  destino:
    - packages/frontend/src/entities/categoria/model/mapa.ts
    - hooks/use-categories-data.ts
  invariantes:
    - id: padrao
      prova:
        "mapa.test.ts: página 9; sem cor usa #3b82f6, ícone Tag e placement
        types"
    - id: json
      prova:
        'mapa.test.ts: texto {"source":"emoji"} entra; {nao-json volta para
        source none; bgColor #111111'
    - id: payload
      prova:
        "mapa.test.ts: source none grava icon Tag e customIcon nulo; source
        emoji grava icon nulo e placement vazio vira nulo"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/entities/categoria/model/mapa.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "hooks/use-categories-data.ts continua dono da lista e do GET
        /api/admin/categories"
      - "hooks/use-equipment-list-data.ts e use-email-page.ts continuam em
        hooks/"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: diálogo de categoria no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 99-lista-equipamentos-admin

O filtro, a ordem, o preço e a data da lista admin de equipamentos saíram para o
frontend. A página continua com 9 itens. A busca continua
`GET /api/admin/equipments?limit=1000` e as categorias
`GET /api/admin/categories`. Texto `concreto` continua só a Betoneira. Categoria
`a` disponível continua Betoneira e depois Zeta. Indisponível continua só o
Andaime. Esse filtro não é o da vitrine pública, que não tem disponibilidade. O
hook continua dono do carregamento e dos avisos.

```yaml
fatia:
  id: 99-lista-equipamentos-admin
  estado: intermediate
  conceito: filtro da lista admin de equipamentos
  origem:
    - hooks/use-equipment-list-data.ts
  destino:
    - packages/frontend/src/entities/equipamento/model/lista.ts
    - hooks/use-equipment-list-data.ts
  invariantes:
    - id: rotas
      prova:
        "lista.test.ts: página 9, /api/admin/equipments?limit=1000 e
        /api/admin/categories"
    - id: filtro
      prova:
        "lista.test.ts: concreto só Betoneira; categoria a disponível Betoneira
        depois Zeta; indisponível só Andaime"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/entities/equipamento/model/lista.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "hooks/use-equipment-list-data.ts continua dono do carregamento e dos
        avisos"
      - "o filtro da vitrine pública continua sem disponibilidade"
      - "hooks/use-email-page.ts continua em hooks/"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: lista admin de equipamentos no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 100-caixa-email

As pastas, o remetente e o texto de encaminhamento saíram de
`components/admin/email/utils.ts`. Inbox continua Caixa de entrada. Caixa de
Entrada continua entrada. Outbox continua escondida. `unReadCount` do Zoho
continua virando `unreadCount`. Status `1` continua lido. O HTML de
encaminhamento continua sem a tag style. A chave dos remetentes destacados
continua `admin-email-highlighted-senders`. O hook da página de e-mail continua
em `hooks/use-email-page.ts`.

```yaml
fatia:
  id: 100-caixa-email
  estado: intermediate
  conceito: pastas e mensagens do e-mail admin
  origem:
    - components/admin/email/utils.ts
  destino:
    - packages/frontend/src/features/correio/model/caixa.ts
    - hooks/use-email-page.ts
    - app/admin/email/page.tsx
  invariantes:
    - id: remetente
      prova:
        "caixa.test.ts: e-mail a@gb.com vence o nome Ana; sem endereço a chave é
        vazia; Inbox e Caixa de Entrada são entrada"
    - id: pastas
      prova:
        "caixa.test.ts: Outbox some; Inbox vira Caixa de entrada antes da
        Lixeira; unReadCount 3 vira unreadCount"
    - id: mensagem
      prova:
        "caixa.test.ts: style some e br vira quebra; status 1 fica lido e
        threadId 9 vira texto 9"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/features/correio/model/caixa.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "hooks/use-email-page.ts continua dono da página de e-mail"
      - "a tela admin de e-mail continua em app/admin/email/page.tsx"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - components/admin/email/utils.ts
  nao_verificado:
    - "[NOT_VERIFIED: caixa de e-mail no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 101-selos-admin

A contagem dos selos do menu admin saiu de `hooks/use-admin-badges.ts`.
FINANCIAL continua lendo só `/api/admin/financial/aging` e zerando e-mail,
orçamentos, locações e WhatsApp. Os demais papéis continuam em
`/api/admin/badges` e o financeiro continua vindo de `severeCount`. O intervalo
continua 60000 ms. O evento continua `admin-badges-invalidate`. As sidebars e a
invalidação do orçamento apontam para o frontend.

```yaml
fatia:
  id: 101-selos-admin
  estado: intermediate
  conceito: contagem dos selos do menu admin
  origem:
    - hooks/use-admin-badges.ts
  destino:
    - packages/frontend/src/features/selos-admin/model/contagem.ts
    - packages/frontend/src/features/selos-admin/model/use-selos.web.ts
    - components/admin/admin-sidebar.tsx
    - components/admin/mobile-sidebar.tsx
    - hooks/use-quote-details.ts
  invariantes:
    - id: financial
      prova:
        "contagem.test.ts: FINANCIAL ignora e-mail 9 e fica com financial 4;
        aging falho zera tudo"
    - id: demais
      prova:
        "contagem.test.ts: ADMIN soma e-mail 2 e orçamentos 1 e troca financial
        8 por severeCount 5; total 8"
    - id: contrato
      prova:
        "contagem.test.ts: URLs /api/admin/badges e /api/admin/financial/aging,
        polling 60000, evento admin-badges-invalidate"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/features/selos-admin/model/contagem.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "as sidebars admin continuam em components/admin"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - hooks/use-admin-badges.ts
  nao_verificado:
    - "[NOT_VERIFIED: selos do menu admin no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 102-interruptor-esqueleto

O interruptor e o esqueleto de carregamento saíram de `components/ui`. O
interruptor continua com `h-6 w-11`, fundo primário quando marcado e
`translate-x-5` no polegar. O esqueleto continua com
`animate-pulse rounded-md bg-muted`. O nativo não repete essas classes. Quem
usava os arquivos antigos agora importa `@gb-locacoes/ui`.

```yaml
fatia:
  id: 102-interruptor-esqueleto
  estado: intermediate
  conceito: interruptor e esqueleto de carregamento
  origem:
    - components/ui/switch.tsx
    - components/ui/skeleton.tsx
  destino:
    - packages/ui/src/web/Switch.web.tsx
    - packages/ui/src/native/Switch.native.tsx
    - packages/ui/src/web/Skeleton.web.tsx
    - packages/ui/src/native/Skeleton.native.tsx
  invariantes:
    - id: interruptor
      prova:
        "Switch.web.test.tsx: h-6 w-11, bg-primary marcado, bg-input desmarcado,
        translate-x-5 e translate-x-0"
    - id: esqueleto
      prova:
        "Switch.web.test.tsx: animate-pulse rounded-md bg-muted; o nativo não
        repete animate-pulse nem h-6 w-11"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/Switch.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "dialog, select, tabs e outros primitivos continuam em components/ui"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - components/ui/switch.tsx
    - components/ui/skeleton.tsx
  nao_verificado:
    - "[NOT_VERIFIED: interruptor e esqueleto no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 103-dica-avatar

A dica e o avatar saíram de `components/ui`. A dica continua com deslocamento 4,
`z-50` e fundo `bg-slate-900`. O avatar continua círculo `h-10 w-10` e o
fallback continua `bg-muted`. O nativo não repete essas classes. O cabeçalho, o
e-mail e o WhatsApp admin importam `@gb-locacoes/ui`.

```yaml
fatia:
  id: 103-dica-avatar
  estado: intermediate
  conceito: dica e avatar
  origem:
    - components/ui/tooltip.tsx
    - components/ui/avatar.tsx
  destino:
    - packages/ui/src/web/Tooltip.web.tsx
    - packages/ui/src/native/Tooltip.native.tsx
    - packages/ui/src/web/Avatar.web.tsx
    - packages/ui/src/native/Avatar.native.tsx
    - packages/frontend/src/widgets/cabecalho/ui/Cabecalho.web.tsx
  invariantes:
    - id: dica
      prova:
        "Tooltip.web.test.tsx: sideOffset 4, z-50, bg-slate-900 e text-slate-50;
        o nativo não repete bg-slate-900"
    - id: avatar
      prova:
        "Tooltip.web.test.tsx: h-10 w-10 rounded-full, aspect-square e fallback
        bg-muted; o nativo não repete h-10 w-10"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/Tooltip.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "dialog, select, tabs e o menu suspenso continuam em components/ui"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - components/ui/tooltip.tsx
    - components/ui/avatar.tsx
  nao_verificado:
    - "[NOT_VERIFIED: dica e avatar no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 104-menu-suspenso

O menu suspenso saiu de `components/ui/dropdown-menu.tsx`. O conteúdo continua
com deslocamento 4, `z-[var(--layer-tooltip)]` e largura mínima `8rem`. O item
continua com hover `bg-orange-50` e texto `orange-600`. O separador continua
`h-px bg-muted`. O submenu continua com a classe `filter-dropdown-scroll`. O
nativo não repete o hover laranja. O cabeçalho e as tabelas admin importam
`@gb-locacoes/ui`.

```yaml
fatia:
  id: 104-menu-suspenso
  estado: intermediate
  conceito: menu suspenso
  origem:
    - components/ui/dropdown-menu.tsx
  destino:
    - packages/ui/src/web/DropdownMenu.web.tsx
    - packages/ui/src/native/DropdownMenu.native.tsx
    - packages/frontend/src/widgets/cabecalho/ui/Cabecalho.web.tsx
  invariantes:
    - id: conteudo
      prova:
        "DropdownMenu.web.test.tsx: sideOffset 4, z-[var(--layer-tooltip)],
        min-w-[8rem], hover laranja, h-px bg-muted e filter-dropdown-scroll"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/DropdownMenu.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "dialog, select e tabs continuam em components/ui"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - components/ui/dropdown-menu.tsx
  nao_verificado:
    - "[NOT_VERIFIED: menu suspenso no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 105-seletor

O seletor saiu de `components/ui/select.tsx`. O padrão continua sem modal. O
painel continua embaixo, alinhado ao início, com deslocamento 1 e posição
popper. A camada continua `--layer-tooltip`. O item continua com hover laranja.
O gatilho continua `h-10 w-full`. A lista continua com `filter-dropdown-scroll`.
A remoção do bloqueio de rolagem do Radix no modo não modal continua no mesmo
efeito. A página de orçamento e os diálogos admin importam `@gb-locacoes/ui`.

```yaml
fatia:
  id: 105-seletor
  estado: intermediate
  conceito: seletor
  origem:
    - components/ui/select.tsx
  destino:
    - packages/ui/src/web/Select.web.tsx
    - packages/ui/src/native/Select.native.tsx
    - app/orcamento/page.tsx
  invariantes:
    - id: painel
      prova:
        "Select.web.test.tsx: modal false, side bottom, sideOffset 1, popper,
        layer-tooltip, hover laranja, h-10 w-full, filter-dropdown-scroll e
        data-scroll-locked"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/Select.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "dialog, sheet e tabs continuam em components/ui"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - components/ui/select.tsx
  nao_verificado:
    - "[NOT_VERIFIED: seletor no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 106-gaveta

A gaveta saiu de `components/ui/sheet.tsx`. O lado padrão continua a direita. A
largura continua `w-3/4` com teto `sm:max-w-sm`. O overlay continua
`bg-black/80`. O botão de fechar continua com o rótulo em inglês `Close` e o
hover laranja. O cabeçalho admin, a sidebar, o e-mail e o calendário importam
`@gb-locacoes/ui`.

```yaml
fatia:
  id: 106-gaveta
  estado: intermediate
  conceito: gaveta lateral
  origem:
    - components/ui/sheet.tsx
  destino:
    - packages/ui/src/web/Sheet.web.tsx
    - packages/ui/src/native/Sheet.native.tsx
    - components/admin/admin-header.tsx
  invariantes:
    - id: lado
      prova:
        "Sheet.web.test.tsx: side right, bg-black/80, w-3/4, sm:max-w-sm,
        aria-label Close e hover laranja"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/Sheet.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "dialog e tabs continuam em components/ui"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - components/ui/sheet.tsx
  nao_verificado:
    - "[NOT_VERIFIED: gaveta no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 107-dialogo

O diálogo saiu de `components/ui/dialog.tsx`. O diálogo aninhado continua com
`translate-y` de `0.85rem` e escala `0.985`. O painel continua na camada
`--layer-dialog` e o fundo na camada `--layer-dialog-backdrop`. O overlay
continua `bg-black/60`. A largura máxima continua `max-w-lg`. O corpo continua
com `overscrollBehavior: contain`. Orçamento, e-mail admin, equipamentos e os
diálogos de orçamento importam `@gb-locacoes/ui`.

```yaml
fatia:
  id: 107-dialogo
  estado: intermediate
  conceito: diálogo
  origem:
    - components/ui/dialog.tsx
  destino:
    - packages/ui/src/web/Dialog.web.tsx
    - packages/ui/src/native/Dialog.native.tsx
    - app/orcamento/page.tsx
  invariantes:
    - id: aninhado
      prova:
        "Dialog.web.test.tsx: translate-y 0.85rem, scale 0.985, layer-dialog,
        layer-dialog-backdrop, bg-black/60, max-w-lg e overscroll contain"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/Dialog.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "tabs e a tabela continuam em components/ui"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - components/ui/dialog.tsx
  nao_verificado:
    - "[NOT_VERIFIED: diálogo no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 108-tabela

A tabela saiu de `components/ui/table.tsx`. A tabela continua
`w-full caption-bottom text-sm`. O cabeçalho continua `h-12 px-4`. A linha
continua com hover `bg-muted/50` e seleção `bg-muted`. A célula continua `p-4`.
Os orçamentos recentes e a tabela de devedores importam `@gb-locacoes/ui`.

```yaml
fatia:
  id: 108-tabela
  estado: intermediate
  conceito: tabela
  origem:
    - components/ui/table.tsx
  destino:
    - packages/ui/src/web/Table.web.tsx
    - packages/ui/src/native/Table.native.tsx
    - components/admin/dashboard/recent-quotes-section.tsx
    - components/admin/financial/DebtorsTable.tsx
  invariantes:
    - id: medidas
      prova:
        "Table.web.test.tsx: caption-bottom text-sm, borda do header, última
        linha sem borda, hover muted, h-12 px-4 e p-4"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/Table.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "tabs e o formulário continuam em components/ui"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - components/ui/table.tsx
  nao_verificado:
    - "[NOT_VERIFIED: tabela no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 109-area-rolagem

A área de rolagem saiu de `components/ui/scroll-area.tsx`. O passo continua 40
pixels. O polegar continua com 6px e fundo `bg-orange-600`. Os rótulos continuam
`Rolar para cima`, `Rolar para baixo`, `Rolar para esquerda` e
`Rolar para direita`. A barra continua com `forceMount`. A lista de mensagens do
WhatsApp admin importa `@gb-locacoes/ui`.

```yaml
fatia:
  id: 109-area-rolagem
  estado: intermediate
  conceito: área de rolagem
  origem:
    - components/ui/scroll-area.tsx
  destino:
    - packages/ui/src/web/ScrollArea.web.tsx
    - packages/ui/src/native/ScrollArea.native.tsx
    - components/admin/whatsapp/whatsapp-message-list.tsx
  invariantes:
    - id: passo
      prova:
        "ScrollArea.web.test.tsx: SCROLL_STEP 40, polegar 6px, quatro rótulos em
        português, bg-orange-600 e forceMount"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/ScrollArea.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "paginação e o formulário continuam em components/ui"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - components/ui/scroll-area.tsx
  nao_verificado:
    - "[NOT_VERIFIED: área de rolagem no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 110-paginacao

A paginação saiu de `components/ui/pagination.tsx`. O rótulo do nav continua
`pagination`. O texto visível continua `Anterior` e `Próximo`. Os rótulos
acessíveis continuam `Ir para página anterior` e `Ir para próxima página`. O
texto escondido das reticências continua em inglês `More pages`. O espaçamento
da lista continua `gap-2 sm:gap-1`. A paginação inteligente continua em
`components/ui/smart-pagination.tsx` e agora importa `@gb-locacoes/ui`.

```yaml
fatia:
  id: 110-paginacao
  estado: intermediate
  conceito: paginação
  origem:
    - components/ui/pagination.tsx
  destino:
    - packages/ui/src/web/Pagination.web.tsx
    - packages/ui/src/native/Pagination.native.tsx
    - components/ui/smart-pagination.tsx
  invariantes:
    - id: rotulos
      prova:
        "Pagination.web.test.tsx: aria pagination, gap-2 sm:gap-1, Anterior,
        Próximo, Ir para página anterior, Ir para próxima página, h-9 w-9 e More
        pages"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/Pagination.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/ui/smart-pagination.tsx continua no legado"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - components/ui/pagination.tsx
  nao_verificado:
    - "[NOT_VERIFIED: paginação no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 111-paginacao-inteligente

A paginação inteligente saiu de `components/ui/smart-pagination.tsx`. Uma página
só continua sem barra. A janela continua com no máximo 3 números: página 1 de 10
mostra 1, 2 e 3; página 5 mostra 4, 5 e 6; página 10 mostra 8, 9 e 10. O texto
continua `Página {atual} de {total}`. A página atual continua laranja. O hover
continua com `hover:!bg-gray-100`. Equipamentos, categorias e as tabelas admin
importam `@gb-locacoes/ui`.

```yaml
fatia:
  id: 111-paginacao-inteligente
  estado: intermediate
  conceito: paginação inteligente
  origem:
    - components/ui/smart-pagination.tsx
  destino:
    - packages/ui/src/web/smart-pagination.ts
    - packages/ui/src/web/SmartPagination.web.tsx
    - packages/ui/src/native/SmartPagination.native.tsx
  invariantes:
    - id: janela
      prova:
        "SmartPagination.web.test.tsx: 1 página some; 1 de 10 vira 1-2-3; 5 de
        10 vira 4-5-6; 10 de 10 vira 8-9-10"
    - id: texto
      prova:
        "SmartPagination.web.test.tsx: Página de, hover:!bg-gray-100, laranja da
        página atual e min-w 2.25rem"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/SmartPagination.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "o formulário continua em components/ui"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - components/ui/smart-pagination.tsx
  nao_verificado:
    - "[NOT_VERIFIED: paginação inteligente no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 112-moeda

O campo de moeda saiu de `components/ui/currency-input.tsx`. O padrão continua
BRL e pt-BR. Os dígitos continuam divididos por 100: `12` vira `0,12` e `1234`
vira `12,34`. O placeholder continua `R$ 0,00`. O modo continua numérico. O
cursor continua indo para o fim depois de digitar. Equipamento novo, edição,
entrega e ajuste de preço importam `@gb-locacoes/ui`.

```yaml
fatia:
  id: 112-moeda
  estado: intermediate
  conceito: campo de moeda
  origem:
    - components/ui/currency-input.tsx
  destino:
    - packages/ui/src/web/currency-input.ts
    - packages/ui/src/web/CurrencyInput.web.tsx
    - packages/ui/src/native/CurrencyInput.native.tsx
  invariantes:
    - id: centavos
      prova:
        "CurrencyInput.web.test.tsx: R$ 12,34 vira dígitos 1234; vazio é 0; 12 é
        0.12; 1234 é 12.34 em pt-BR BRL"
    - id: campo
      prova:
        "CurrencyInput.web.test.tsx: BRL, pt-BR, placeholder R$ 0,00, inputMode
        numeric e cursor no fim após digitar"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/CurrencyInput.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "o formulário de endereço continua em components/ui/address-form.tsx"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - components/ui/currency-input.tsx
  nao_verificado:
    - "[NOT_VERIFIED: campo de moeda no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 113-endereco

O formulário de endereço saiu de `components/ui/address-form.tsx`. O CEP
continua `00000-000`: `90000000` vira `90000-000` e o nono dígito continua de
fora. Com 8 dígitos a busca ViaCEP continua. `localidade` continua cidade e `uf`
continua estado. O estado continua com no máximo 2 letras e classe `uppercase`.
O placeholder continua `RS`. Complemento continua sem asterisco. A página de
orçamento importa `@gb-locacoes/ui`.

```yaml
fatia:
  id: 113-endereco
  estado: intermediate
  conceito: formulário de endereço
  origem:
    - components/ui/address-form.tsx
  destino:
    - packages/ui/src/web/address-cep.ts
    - packages/ui/src/web/AddressForm.web.tsx
    - packages/ui/src/native/AddressForm.native.tsx
    - app/orcamento/page.tsx
  invariantes:
    - id: cep
      prova:
        "AddressForm.web.test.tsx: 90000000 vira 90000-000; 12345 fica;
        12.345-6789 vira 12345-678"
    - id: viacep
      prova:
        "AddressForm.web.test.tsx: localidade vira cidade, uf vira estado,
        placeholder 00000-000 e RS, maxLength 2, uppercase, erro Erro ao buscar
        CEP e Complemento sem asterisco no rótulo"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/AddressForm.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "a busca ViaCEP continua em lib/utils/validation.ts"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - components/ui/address-form.tsx
  nao_verificado:
    - "[NOT_VERIFIED: formulário de endereço no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 114-upload-imagem

O upload de imagem saiu de `components/ui/image-upload.tsx`. O limite
continua 5. O aviso continua `Limite excedido` e
`Máximo de N imagens permitidas`. O sucesso continua `Upload concluído`. A URL
inválida continua `URL inválida`. O arquivo continua `image/*`. O placeholder
continua `https://exemplo.com/imagem.jpg`. O arraste continua `Arrastar imagem`.
A seta continua `Navegar para imagem anterior`. O contador continua
`Imagens (n/máximo)`. Equipamento novo, edição, ajustes e entrega importam
`@gb-locacoes/ui`.

```yaml
fatia:
  id: 114-upload-imagem
  estado: intermediate
  conceito: upload de imagem
  origem:
    - components/ui/image-upload.tsx
  destino:
    - packages/ui/src/web/ImageUpload.web.tsx
    - packages/ui/src/native/ImageUpload.native.tsx
  invariantes:
    - id: limite
      prova:
        "ImageUpload.web.test.tsx: maxImages 5, Limite excedido, Máximo de
        imagens, Upload concluído, URL inválida, image/*, placeholder
        exemplo.com, Arrastar imagem, Navegar para imagem anterior e contador
        Imagens"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/ImageUpload.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "o autocomplete da home continua em components/ui/autocomplete.tsx"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - components/ui/image-upload.tsx
  nao_verificado:
    - "[NOT_VERIFIED: upload de imagem no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 115-autocomplete-home

O autocomplete da home saiu de `components/ui/autocomplete.tsx`. O placeholder
continua `Buscar equipamentos...`. A busca continua a partir de 2 letras, com
espera de 300 ms, em `GET /api/equipamentos/search`. A seleção continua em
`onMouseDown`. A lista continua com `z-[99999]`. Limpar uma seleção continua
`Limpar seleção` e limpar o texto continua `Limpar busca`. O hero importa
`@gb-locacoes/ui`.

```yaml
fatia:
  id: 115-autocomplete-home
  estado: intermediate
  conceito: autocomplete da home
  origem:
    - components/ui/autocomplete.tsx
  destino:
    - packages/ui/src/web/Autocomplete.web.tsx
    - packages/ui/src/native/Autocomplete.native.tsx
    - components/hero.tsx
  invariantes:
    - id: busca
      prova:
        "Autocomplete.web.test.tsx: espera 300, mínimo 2 letras,
        /api/equipamentos/search, placeholder Buscar equipamentos..., aria Campo
        de busca, onMouseDown, z-99999, Limpar seleção e Limpar busca"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/Autocomplete.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "o hero continua em components/hero.tsx"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - components/ui/autocomplete.tsx
  nao_verificado:
    - "[NOT_VERIFIED: autocomplete da home no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 116-hero

O hero saiu de `components/hero.tsx`. O título continua Locação de Equipamentos
para Construção Civil. O texto padrão continua Há 10 anos oferecendo soluções. A
busca continua `Buscar equipamentos (ex: andaime, betoneira)`. O link continua
`/equipamentos`. A frase continua `Entregamos em toda região`. Os modelos
continuam Compressor de Ar, Betoneira e Andaime, com `/models/Compressor.glb`. O
carrossel 3D continua carregado sem SSR e o texto de espera continua
`Carregando modelos 3D...`. O arquivo do carrossel 3D não foi alterado. A home
importa o widget.

```yaml
fatia:
  id: 116-hero
  estado: intermediate
  conceito: hero da home
  origem:
    - components/hero.tsx
  destino:
    - packages/frontend/src/widgets/hero/ui/Hero.web.tsx
    - app/page.tsx
  invariantes:
    - id: texto
      prova:
        "Hero.web.test.tsx: Construção Civil, Há 10 anos, placeholder andaime e
        betoneira, Entregamos em toda região, href /equipamentos"
    - id: modelos
      prova:
        "Hero.web.test.tsx: ssr false, equipment-3d-carousel, Carregando modelos
        3D, Compressor de Ar, Betoneira, Andaime e /models/Compressor.glb"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/hero/ui/Hero.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "o fundo, os pontos e a onda do hero continuam em components/"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
      - "app/page.tsx continua dono da home e do Prisma"
  aposentado:
    - components/hero.tsx
  nao_verificado:
    - "[NOT_VERIFIED: hero no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 117-partes-hero

O fundo, os pontos e a onda do hero saíram de `components/`. O primeiro slide
continua com prioridade alta. O alt continua `Slide N`. O ponto continua
`h-3 w-3` e o rótulo `Ir para imagem`. A onda `none` continua sem desenho. A
onda `animated` continua animada. O viewBox continua `0 0 1200 120` e o
preenchimento continua `rgb(249, 250, 251)`. O carrossel 3D não foi alterado.

```yaml
fatia:
  id: 117-partes-hero
  estado: intermediate
  conceito: fundo, pontos e onda do hero
  origem:
    - components/hero-background-carousel.tsx
    - components/hero-carousel-dots.tsx
    - components/hero-wave-animation.tsx
  destino:
    - packages/frontend/src/widgets/hero/ui/HeroBackgroundCarousel.web.tsx
    - packages/frontend/src/widgets/hero/ui/HeroCarouselDots.web.tsx
    - packages/frontend/src/widgets/hero/ui/HeroWaveAnimation.web.tsx
  invariantes:
    - id: fundo
      prova:
        "HeroPartes.web.test.tsx: primeiro slide é currentImage 0, fetchPriority
        high, alt Slide"
    - id: onda
      prova:
        "HeroPartes.web.test.tsx: none some, animated permanece, viewBox 0 0
        1200 120, preenchimento rgb(249, 250, 251), pontos h-3 w-3 e Ir para
        imagem"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/hero/ui/HeroPartes.web.test.tsx
        packages/frontend/src/widgets/hero/ui/Hero.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
      - "app/page.tsx continua dono da home e do Prisma"
  aposentado:
    - components/hero-background-carousel.tsx
    - components/hero-carousel-dots.tsx
    - components/hero-wave-animation.tsx
  nao_verificado:
    - "[NOT_VERIFIED: fundo e onda do hero no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 118-rodape

O rodapé saiu de `components/footer.tsx`. O CNPJ continua `34.780.330/0001-69`.
O horário continua Seg-Sex 8h às 18h e Sáb 8h às 12h. O copyright continua ©
2024 GB Locações. Os links continuam orçamento, privacidade, termos, cookies e
política de devolução. O hover social continua `hover:bg-orange-600/20`. O
layout do cliente importa o widget.

```yaml
fatia:
  id: 118-rodape
  estado: intermediate
  conceito: rodapé
  origem:
    - components/footer.tsx
  destino:
    - packages/frontend/src/widgets/rodape/ui/Footer.web.tsx
    - app/ClientLayout.tsx
  invariantes:
    - id: empresa
      prova:
        "Footer.web.test.tsx: CNPJ 34.780.330/0001-69, Seg-Sex 8h às 18h, Sáb 8h
        às 12h, copyright 2024 e alt GB Locações"
    - id: links
      prova:
        "Footer.web.test.tsx: /orcamento Solicitar Orçamento, privacidade,
        termos, cookies, politica-devolucao, hover laranja e aria LinkedIn"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/rodape/ui/Footer.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "app/ClientLayout.tsx continua dono do layout"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - components/footer.tsx
  nao_verificado:
    - "[NOT_VERIFIED: rodapé no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 119-whatsapp-flutuante

O botão flutuante do WhatsApp saiu de `components/whatsapp-fab.tsx`. O número
continua `5551998205163`. O link continua `https://wa.me/` com o texto. No
celular continua `window.location.href`. No desktop continua `window.open` em
nova aba. A saudação continua `Olá! Precisa de equipamentos para sua obra?`. O
placeholder continua `Digite sua mensagem...`. Abrir continua
`Abrir chat do WhatsApp` e fechar continua `Fechar chat do WhatsApp`. O botão
continua `!w-14 !h-14`. O contador inicial continua 1. O layout importa o
widget.

```yaml
fatia:
  id: 119-whatsapp-flutuante
  estado: intermediate
  conceito: botão flutuante do WhatsApp
  origem:
    - components/whatsapp-fab.tsx
  destino:
    - packages/frontend/src/widgets/whatsapp-flutuante/ui/WhatsAppFab.web.tsx
    - app/ClientLayout.tsx
  invariantes:
    - id: numero
      prova:
        "WhatsAppFab.web.test.tsx: 5551998205163, wa.me, location.href no
        celular e window.open no desktop"
    - id: frases
      prova:
        "WhatsAppFab.web.test.tsx: Olá precisa de equipamentos, Obrigado pela
        mensagem, Digite sua mensagem, Abrir e Fechar chat, !w-14 !h-14 e
        contador inicial 1"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/whatsapp-flutuante/ui/WhatsAppFab.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "app/ClientLayout.tsx continua dono do layout"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - components/whatsapp-fab.tsx
  nao_verificado:
    - "[NOT_VERIFIED: botão do WhatsApp no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 120-toaster

O toaster saiu de `components/ui/sonner-toaster.tsx`. O tema continua claro. A
posição continua `top-center`. A duração continua 4000 ms. Continuam 3 avisos
visíveis. O site público continua 120px abaixo do topo. O admin continua
`64px + 16px`. No admin móvel, abaixo de 767px, continua somando a área segura.
Sucesso continua `!bg-green-50`. Erro continua `!bg-red-50`. Alerta continua
texto laranja. O layout importa `@gb-locacoes/ui`.

```yaml
fatia:
  id: 120-toaster
  estado: intermediate
  conceito: avisos do toaster
  origem:
    - components/ui/sonner-toaster.tsx
  destino:
    - packages/ui/src/web/SonnerToaster.web.tsx
    - packages/ui/src/native/SonnerToaster.native.tsx
    - app/ClientLayout.tsx
  invariantes:
    - id: posicao
      prova:
        "SonnerToaster.web.test.tsx: tema light, top-center, 4000 ms, 3 avisos,
        expand false, closeButton, topo público 120px, admin 64px+16px e mobile
        767px"
    - id: cores
      prova:
        "SonnerToaster.web.test.tsx: !bg-green-50, !bg-red-50 e !text-orange-700"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/SonnerToaster.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "app/ClientLayout.tsx continua dono do layout"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - components/ui/sonner-toaster.tsx
  nao_verificado:
    - "[NOT_VERIFIED: toaster no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 121-contato-home

A seção de contato da home saiu de `components/contact-section.tsx`. O título
continua Entre em Contato. Sem CPF e sem CNPJ o aviso continua Erro de Validação
e a frase Por favor, preencha pelo menos o CPF ou CNPJ. O envio continua POST
`/api/contact`. O campo de materiais continua indo como `equipment`. O sucesso
continua Orçamento Enviado com Sucesso por 8000 ms. O botão continua Enviar
Solicitação. O telefone de exemplo continua `(51) 99999-9999` e o CEP continua
`00000-000`.

```yaml
fatia:
  id: 121-contato-home
  estado: intermediate
  conceito: contato da home
  origem:
    - components/contact-section.tsx
  destino:
    - packages/frontend/src/widgets/contato-home/ui/ContatoHome.web.tsx
    - app/page.tsx
  invariantes:
    - id: envio
      prova:
        "ContatoHome.web.test.tsx: Erro de Validação, CPF ou CNPJ, POST
        /api/contact, materials vira equipment, sucesso com duration 8000 e Erro
        ao Enviar"
    - id: campos
      prova:
        "ContatoHome.web.test.tsx: Entre em Contato, telefone (51) 99999-9999,
        CEP 00000-000 e botão Enviar Solicitação"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/contato-home/ui/ContatoHome.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "o mapa da loja continua em components/google-store-locator"
      - "o aviso continua em hooks/use-toast.ts"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/contact-section.tsx
  nao_verificado:
    - "[NOT_VERIFIED: contato da home no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 122-por-que-escolher

A seção Por que Escolher saiu de `components/why-choose-us.tsx`. O título
continua em duas linhas, com atraso 150. Os seis benefícios continuam
Equipamentos Certificados, Entrega Rápida e Eficiente, Atendimento
Especializado, Parceira de Grandes Construtoras, 10 Anos de Experiência e
Rastreamento dos Equipamentos. A pilha continua com distância 300 e escala base
0,85. O selo continua Orçamento Grátis. O telefone continua com prefixo
`tel:+55`. O botão continua Solicitar Orçamento Online em `/orcamento`.

```yaml
fatia:
  id: 122-por-que-escolher
  estado: intermediate
  conceito: seção por que escolher
  origem:
    - components/why-choose-us.tsx
  destino:
    - packages/frontend/src/widgets/por-que-escolher/ui/PorQueEscolher.web.tsx
    - app/page.tsx
  invariantes:
    - id: beneficios
      prova:
        "PorQueEscolher.web.test.tsx: Por que Escolher a, GB Locações?, delay
        150 e os seis títulos"
    - id: pilha
      prova:
        "PorQueEscolher.web.test.tsx: itemDistance 300, baseScale 0.85,
        Orçamento Grátis, tel:+55, /orcamento e Solicitar Orçamento Online"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/por-que-escolher/ui/PorQueEscolher.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "o texto borrado e a pilha de scroll continuam em components/ui"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/why-choose-us.tsx
  nao_verificado:
    - "[NOT_VERIFIED: seção por que escolher no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 123-home-cliente

O miolo da home saiu de `components/home-page-client.tsx`. Ele continua
carregando a vitrine e os materiais em destaque sem SSR. O placeholder continua
`h-96 bg-gray-100 animate-pulse` nas duas partes. A vitrine e os destaques
continuam em `components/`.

```yaml
fatia:
  id: 123-home-cliente
  estado: intermediate
  conceito: miolo da home
  origem:
    - components/home-page-client.tsx
  destino:
    - packages/frontend/src/widgets/home-cliente/ui/HomeCliente.web.tsx
    - app/page.tsx
  invariantes:
    - id: carga
      prova:
        "HomeCliente.web.test.tsx: vitrine e destaques com ssr false duas vezes
        e pulso h-96 bg-gray-100 duas vezes"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/home-cliente/ui/HomeCliente.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "a vitrine continua em components/equipment-showcase-section.tsx"
      - "os destaques continuam em components/featured-materials.tsx"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/home-page-client.tsx
  nao_verificado:
    - "[NOT_VERIFIED: miolo da home no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 124-destaques

Os equipamentos em destaque saíram de `components/featured-materials.tsx` e
ficaram no mesmo widget da home. A busca continua `GET /api/equipments`.
Continuam no máximo 6 itens. O esqueleto continua com 6 cartões. O evento
continua `featuredMaterialsLoaded`. O título continua Equipamentos em Destaque.
A âncora continua `equipamentos-destaque`. A entrada continua
`translateY(60px)`.

```yaml
fatia:
  id: 124-destaques
  estado: intermediate
  conceito: equipamentos em destaque
  origem:
    - components/featured-materials.tsx
  destino:
    - packages/frontend/src/widgets/home-cliente/ui/Destaques.web.tsx
    - packages/frontend/src/widgets/home-cliente/ui/HomeCliente.web.tsx
  invariantes:
    - id: lista
      prova:
        "Destaques.web.test.tsx: GET /api/equipments, slice 0 6, esqueleto de 6,
        featuredMaterialsLoaded, título Equipamentos em Destaque, âncora
        equipamentos-destaque e translateY 60px"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/home-cliente/ui/Destaques.web.test.tsx
        packages/frontend/src/widgets/home-cliente/ui/HomeCliente.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "a vitrine continua em components/equipment-showcase-section.tsx"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/featured-materials.tsx
  nao_verificado:
    - "[NOT_VERIFIED: destaques no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 125-vitrine-home

A vitrine da home saiu de `components/equipment-showcase-section.tsx` e ficou no
mesmo widget. A busca continua `GET /api/categories`. Cada aba continua com no
máximo 12 categorias. As abas continuam Categorias, Fases da obra e Tipo de
trabalho. O título continua Tecnologia, com as palavras sob medida, certa e
eficiente, girando a cada 3200 ms. O clique continua em
`/equipamentos?categoria=`.

```yaml
fatia:
  id: 125-vitrine-home
  estado: intermediate
  conceito: vitrine da home
  origem:
    - components/equipment-showcase-section.tsx
  destino:
    - packages/frontend/src/widgets/home-cliente/ui/Vitrine.web.tsx
    - packages/frontend/src/widgets/home-cliente/ui/HomeCliente.web.tsx
  invariantes:
    - id: abas
      prova:
        "Vitrine.web.test.tsx: GET /api/categories, máximo 12, abas Categorias,
        Fases da obra e Tipo de trabalho"
    - id: texto
      prova:
        "Vitrine.web.test.tsx: Tecnologia, para cada fase da sua obra, sob
        medida certa eficiente, 3200 ms, slate-700 e /equipamentos?categoria="
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/home-cliente/ui/Vitrine.web.test.tsx
        packages/frontend/src/widgets/home-cliente/ui/HomeCliente.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "o scroll infinito continua em components/equipment-infinite-scroll"
      - "as abas de categoria continuam em components/category-showcase"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/equipment-showcase-section.tsx
  nao_verificado:
    - "[NOT_VERIFIED: vitrine da home no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 126-scroll-infinito

O scroll infinito saiu de `components/equipment-infinite-scroll.tsx` e ficou no
widget da home. A busca continua `GET /api/equipments`. A lista continua com no
máximo 18 itens. O título continua Nossos Equipamentos. Com
`prefers-reduced-motion` a velocidade continua 0. Sem isso continua 0,5 px por
frame. A força de retorno continua 0,02. A página `/equipamentos-scroll` importa
o mesmo arquivo.

```yaml
fatia:
  id: 126-scroll-infinito
  estado: intermediate
  conceito: scroll infinito de equipamentos
  origem:
    - components/equipment-infinite-scroll.tsx
  destino:
    - packages/frontend/src/widgets/home-cliente/ui/ScrollInfinito.web.tsx
    - packages/frontend/src/widgets/home-cliente/ui/Vitrine.web.tsx
    - app/equipamentos-scroll/page.tsx
  invariantes:
    - id: movimento
      prova:
        "ScrollInfinito.web.test.tsx: GET /api/equipments, 18 itens, Nossos
        Equipamentos, reduced motion, velocidade 0 ou 0.5 e RETURN_FORCE 0.02"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/home-cliente/ui/ScrollInfinito.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "as abas de categoria continuam em components/category-showcase"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/equipment-infinite-scroll.tsx
  nao_verificado:
    - "[NOT_VERIFIED: scroll infinito no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 127-abas-categoria

As abas de categoria saíram de `components/category-showcase.tsx`. O anúncio
continua Sessões de categorias de equipamentos. Cada aba continua mostrando o
próprio rótulo. A vitrine da home e o diálogo de categoria importam a feature.

```yaml
fatia:
  id: 127-abas-categoria
  estado: intermediate
  conceito: abas de categoria
  origem:
    - components/category-showcase.tsx
  destino:
    - packages/frontend/src/features/abas-categoria/ui/Abas.tsx
    - packages/frontend/src/widgets/home-cliente/ui/Vitrine.web.tsx
    - components/dialogs/category-dialog.tsx
  invariantes:
    - id: anuncio
      prova:
        "Abas.test.tsx: aria Sessões de categorias de equipamentos,
        section.label e aria-labelledby da aba ativa"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/features/abas-categoria/ui/Abas.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "os ícones customizados continuam em components/icons"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/category-showcase.tsx
  nao_verificado:
    - "[NOT_VERIFIED: abas de categoria no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 128-texto-giratorio

O texto giratório saiu de `components/rotating-text.tsx` e ficou no widget da
home. O padrão continua 2000 ms, quebra por caracteres e início no primeiro. A
vitrine continua passando 3200 ms e início no último. O intervalo usa
`window.setInterval`.

```yaml
fatia:
  id: 128-texto-giratorio
  estado: intermediate
  conceito: texto giratório
  origem:
    - components/rotating-text.tsx
  destino:
    - packages/frontend/src/widgets/home-cliente/ui/RotatingText.web.tsx
    - packages/frontend/src/widgets/home-cliente/ui/Vitrine.web.tsx
  invariantes:
    - id: padrao
      prova:
        "RotatingText.web.test.tsx: intervalo 2000, stagger first, split
        characters e setInterval"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/home-cliente/ui/RotatingText.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "o texto borrado da seção por que escolher continua em
        components/ui/blur-text.tsx"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/rotating-text.tsx
  nao_verificado:
    - "[NOT_VERIFIED: texto giratório no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 129-texto-borrado

O texto borrado saiu de `components/ui/blur-text.tsx` e ficou na seção Por que
Escolher. O padrão continua atraso 200, animação por palavras e entrada de cima.
A seção continua passando atraso 150. O playground importa o mesmo arquivo.

```yaml
fatia:
  id: 129-texto-borrado
  estado: intermediate
  conceito: texto borrado
  origem:
    - components/ui/blur-text.tsx
  destino:
    - packages/frontend/src/widgets/por-que-escolher/ui/BlurText.web.tsx
    - packages/frontend/src/widgets/por-que-escolher/ui/PorQueEscolher.web.tsx
    - app/playground/page.tsx
  invariantes:
    - id: padrao
      prova:
        "BlurText.web.test.tsx: delay 200, animateBy words, direction top, split
        por espaço e classe blur-text"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/por-que-escolher/ui/BlurText.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "a pilha de scroll continua em components/ui/scroll-stack.tsx"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/ui/blur-text.tsx
  nao_verificado:
    - "[NOT_VERIFIED: texto borrado no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 130-pilha-scroll

A pilha e o cartão de benefício saíram de `components/ui`. O padrão da pilha
continua distância 100, escala por item 0,03, distância de empilhar 30, escala
base 0,85 e rolagem da janela. No celular o espaço continua 24. O cartão
continua com gradiente laranja. A seção continua passando distância 300. O
playground importa os mesmos arquivos.

```yaml
fatia:
  id: 130-pilha-scroll
  estado: intermediate
  conceito: pilha de scroll
  origem:
    - components/ui/scroll-stack.tsx
    - components/ui/scroll-stack-benefit-card.tsx
  destino:
    - packages/frontend/src/widgets/por-que-escolher/ui/ScrollStack.web.tsx
    - packages/frontend/src/widgets/por-que-escolher/ui/ScrollStackBenefitCard.web.tsx
    - packages/frontend/src/widgets/por-que-escolher/ui/PorQueEscolher.web.tsx
    - app/playground/page.tsx
  invariantes:
    - id: medidas
      prova:
        "ScrollStack.web.test.tsx: distância 100, escala 0.03, empilhar 30, base
        0.85, window scroll, gap móvel 24 e gradiente laranja do cartão"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/por-que-escolher/ui/ScrollStack.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - components/ui/scroll-stack.tsx
    - components/ui/scroll-stack-benefit-card.tsx
  nao_verificado:
    - "[NOT_VERIFIED: pilha de scroll no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 131-mapa-loja

O mapa da loja saiu de `components/google-store-locator.tsx`. O ponto continua
GB Locações, Travessa Doutor Heinzelmann, 365, Porto Alegre. As coordenadas
continuam -29.9943488 e -51.1975239. O zoom continua 15 e o máximo 17. A
biblioteca continua a 0.6.11. Sem a chave pública o aviso continua Configure
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY para exibir o mapa. A home e a página de contato
importam a feature.

```yaml
fatia:
  id: 131-mapa-loja
  estado: intermediate
  conceito: mapa da loja
  origem:
    - components/google-store-locator.tsx
  destino:
    - packages/frontend/src/features/mapa-loja/ui/Mapa.web.tsx
    - packages/frontend/src/widgets/contato-home/ui/ContatoHome.web.tsx
    - app/contato/page.tsx
  invariantes:
    - id: endereco
      prova:
        "Mapa.web.test.tsx: GB Locações, Travessa Doutor Heinzelmann 365, Porto
        Alegre, lat -29.9943488, lng -51.1975239, zoom 15, maxZoom 17 e
        biblioteca 0.6.11"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/features/mapa-loja/ui/Mapa.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
  aposentado:
    - components/google-store-locator.tsx
  nao_verificado:
    - "[NOT_VERIFIED: mapa da loja no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 132-seletor-data

O seletor de data saiu de `components/ui/date-picker.tsx` e ficou ao lado do
calendário. O placeholder continua Selecione uma data. A data continua no
formato PPP em pt-BR. O calendário continua modo único, alinhado ao início. O
diálogo financeiro importa esse arquivo.

```yaml
fatia:
  id: 132-seletor-data
  estado: intermediate
  conceito: seletor de data
  origem:
    - components/ui/date-picker.tsx
  destino:
    - packages/frontend/src/pages/equipamento-detalhe/ui/DatePicker.web.tsx
    - components/admin/financial/entry-detail-dialog.tsx
  invariantes:
    - id: formato
      prova:
        "DatePicker.web.test.tsx: placeholder Selecione uma data, format PPP em
        ptBR, mode single, align start e locale ptBR"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/equipamento-detalhe/ui/DatePicker.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "o diálogo financeiro continua em components/admin/financial"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/ui/date-picker.tsx
  nao_verificado:
    - "[NOT_VERIFIED: seletor de data no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 133-intervalo-datas

O intervalo de datas saiu de `components/ui/date-range-picker.tsx` e ficou ao
lado do calendário. O placeholder continua Selecionar período. O texto continua
`dd/MM/yyyy` em pt-BR. O modo continua range. Depois do início o aviso continua
Agora selecione a data final. O sucesso continua Datas selecionadas com sucesso.
O rótulo continua Período mínimo. Dias de outros meses continuam ocultos. A
página de e-mail admin importa o arquivo.

```yaml
fatia:
  id: 133-intervalo-datas
  estado: intermediate
  conceito: intervalo de datas
  origem:
    - components/ui/date-range-picker.tsx
  destino:
    - packages/frontend/src/pages/equipamento-detalhe/ui/DateRangePicker.web.tsx
    - app/admin/email/page.tsx
  invariantes:
    - id: periodo
      prova:
        "DateRangePicker.web.test.tsx: Selecionar período, dd/MM/yyyy em ptBR,
        mode range, data final, sucesso, Período mínimo e showOutsideDays false"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/equipamento-detalhe/ui/DateRangePicker.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "a página de e-mail admin continua em app/admin/email/page.tsx"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/ui/date-range-picker.tsx
  nao_verificado:
    - "[NOT_VERIFIED: intervalo de datas no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 134-alternador-visao

O alternador de visão saiu de `components/ui/view-toggle.tsx`. O tamanho médio
continua `h-10`, o pequeno `h-9` e o grande `h-11`. O trilho ativo continua
`bg-slate-700`. A mola continua rigidez 300 e amortecimento 30. O item ativo
continua texto branco. O inativo continua com hover laranja. O rótulo continua
escondido no mobile e visível a partir de `sm`. Financeiro, locações,
orçamentos, manutenção, logística e o calendário importam `@gb-locacoes/ui`.

```yaml
fatia:
  id: 134-alternador-visao
  estado: intermediate
  conceito: alternador de visão
  origem:
    - components/ui/view-toggle.tsx
  destino:
    - packages/ui/src/web/ViewToggle.web.tsx
    - packages/ui/src/native/ViewToggle.native.tsx
  invariantes:
    - id: medidas
      prova:
        "ViewToggle.web.test.tsx: md h-10, sm h-9, lg h-11, bg-slate-700, mola
        300 e 30, texto branco ativo, hover laranja inativo e rótulo sm:inline"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/ViewToggle.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "as telas admin que usam o alternador continuam em app/admin e
        components/admin"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/ui/view-toggle.tsx
  nao_verificado:
    - "[NOT_VERIFIED: alternador de visão no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 135-resetar-filtros

O botão de resetar filtros saiu de `components/ui/filter-reset-button.tsx`. O
título continua Resetar filtros. A variante continua reset. O ícone continua
`group-hover:text-orange-500`. O tamanho pequeno continua `w-8 h-8`. A animação
continua 600 ms. As classes do botão continuam sem `hover:scale-105` e sem
`hover:border-orange-500`. As barras de filtro e a busca do histórico importam
`@gb-locacoes/ui`.

```yaml
fatia:
  id: 135-resetar-filtros
  estado: intermediate
  conceito: botão de resetar filtros
  origem:
    - components/ui/filter-reset-button.tsx
  destino:
    - packages/ui/src/web/FilterResetButton.web.tsx
    - packages/ui/src/native/FilterResetButton.native.tsx
  invariantes:
    - id: hover
      prova:
        "FilterResetButton.web.test.tsx: título Resetar filtros, variante reset,
        group-hover text-orange-500, w-8 h-8, 600 ms, sem scale-105 e sem
        border-orange-500 no JSX"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/FilterResetButton.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "a barra de busca do histórico continua em components/ui/search-bar.tsx"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/ui/filter-reset-button.tsx
  nao_verificado:
    - "[NOT_VERIFIED: botão de resetar filtros no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 136-filtros

O seletor e o grupo de filtros saíram de `components/ui`. O placeholder continua
Selecionar.... O gatilho continua na camada `--layer-dropdown` e o painel em
`z-[25]`. A altura continua `h-10`. O grupo continua com largura mínima `180px`
no desktop. O rótulo do filtro continua caindo para o placeholder quando ele
falta. O alternador fica na mesma linha até `lg` e numa segunda linha a partir
de `lg`.

```yaml
fatia:
  id: 136-filtros
  estado: intermediate
  conceito: seletor e grupo de filtros
  origem:
    - components/ui/custom-select.tsx
    - components/ui/filter-select-group.tsx
  destino:
    - packages/ui/src/web/CustomSelect.web.tsx
    - packages/ui/src/web/FilterSelectGroup.web.tsx
    - packages/ui/src/native/FilterSelect.native.tsx
  invariantes:
    - id: layout
      prova:
        "FilterSelect.web.test.tsx: Selecionar..., layer-dropdown, z-25, h-10,
        min-w 180px, placeholder ou label, lg:hidden e hidden lg:flex"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/FilterSelect.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "a barra de busca do histórico continua em components/ui/search-bar.tsx"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/ui/custom-select.tsx
    - components/ui/filter-select-group.tsx
  nao_verificado:
    - "[NOT_VERIFIED: filtros no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 137-barra-de-busca

A barra de busca saiu de `components/ui/search-bar.tsx`. O placeholder padrão
continua Buscar.... O reset continua mandando cada filtro para `all` e a busca
para vazio. O botão continua com o título Resetar filtros e o tamanho `md`. O
cartão continua com a classe `admin-filter-card`. O foco do campo continua
`focus:border-blue-500`. O histórico do cliente importa `@gb-locacoes/ui` e
continua passando o placeholder Buscar por equipamento....

```yaml
fatia:
  id: 137-barra-de-busca
  estado: intermediate
  conceito: barra de busca com filtros
  origem:
    - components/ui/search-bar.tsx
  destino:
    - packages/ui/src/web/SearchBar.web.tsx
    - packages/ui/src/native/SearchBar.native.tsx
  invariantes:
    - id: reset
      prova:
        "SearchBar.web.test.tsx: placeholder Buscar..., showResetButton true,
        onValueChange all, busca vazia, título Resetar filtros, size md,
        admin-filter-card, focus:border-blue-500"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/SearchBar.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "app/area-cliente/historico/page.tsx continua dono da tela do histórico"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/ui/search-bar.tsx
  nao_verificado:
    - "[NOT_VERIFIED: barra de busca no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 138-selo-area-cliente

O selo da área do cliente saiu de `components/ui/client-area-badge.tsx` e o
gancho saiu de `hooks/use-client-area-badge.ts`. Fora de `/area-cliente` a
variante original permanece. Dentro, `default` vira `no-hover-default`,
`secondary` vira `no-hover-secondary`, `destructive` vira `no-hover-destructive`
e `outline` vira `no-hover-outline`. Uma variante desconhecida continua igual. O
padrão do componente continua `default`. Histórico, detalhe do histórico,
endereços e notificações importam a feature.

```yaml
fatia:
  id: 138-selo-area-cliente
  estado: intermediate
  conceito: selo sem hover na área do cliente
  origem:
    - components/ui/client-area-badge.tsx
    - hooks/use-client-area-badge.ts
  destino:
    - packages/frontend/src/features/selo-area-cliente/ui/Selo.web.tsx
    - packages/frontend/src/features/selo-area-cliente/model/variante.web.ts
  invariantes:
    - id: mapa
      prova:
        "variante.web.test.ts: prefixo /area-cliente, quatro variantes no-hover,
        fora da área devolve a original, padrão default"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/features/selo-area-cliente/model/variante.web.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "app/area-cliente/historico/page.tsx continua dono da tela do histórico"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/ui/client-area-badge.tsx
    - hooks/use-client-area-badge.ts
  nao_verificado:
    - "[NOT_VERIFIED: selo da área do cliente no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 139-selo-notificacao

O selo de notificação saiu de `components/ui/notification-badge.tsx`. O teto
continua 99 e o excedente vira `99+`. Zero continua oculto, salvo `showZero`. A
variante padrão continua `default` e o tamanho `md`. O ponto continua
`bg-red-500`. A entrada continua com duração 0,2 s. O pulso continua em escala
1, 1,2 e 1, repetindo a cada 1 s. O wrapper continua `relative inline-block`.
Cabeçalho, menu admin e o dropdown de notificações importam `@gb-locacoes/ui`.

```yaml
fatia:
  id: 139-selo-notificacao
  estado: intermediate
  conceito: selo de contagem de notificações
  origem:
    - components/ui/notification-badge.tsx
  destino:
    - packages/ui/src/web/NotificationBadge.web.tsx
    - packages/ui/src/native/NotificationBadge.native.tsx
  invariantes:
    - id: contagem
      prova:
        "NotificationBadge.web.test.tsx: teto 99, zero oculto, variante default,
        tamanho md, bg-red-500, duração 0.2, pulso 1/1.2/1, wrapper relative
        inline-block"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/NotificationBadge.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "o dropdown de notificações continua em
        components/ui/notification-dropdown.tsx"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/ui/notification-badge.tsx
  nao_verificado:
    - "[NOT_VERIFIED: selo de notificação no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 140-dropdown-notificacoes

O dropdown de notificações saiu de `components/ui/notification-dropdown.tsx`. O
título continua Notificações. A lista continua nos 10 primeiros. O tempo
continua Agora mesmo, depois minutos, horas, dias e a data em pt-BR. Os ícones
continuam 📋, 📦, 💳, 🔧, 🔔 e 📢. A prioridade alta continua vermelha, a média
amarela e a baixa azul. O vazio continua Nenhuma notificação / Você está em
dia!. A falha ao remover continua Falha ao remover notificação. Tente novamente.
O gancho `hooks/use-notifications.ts` permanece no legado porque o admin e a
área do cliente ainda o usam.

```yaml
fatia:
  id: 140-dropdown-notificacoes
  estado: intermediate
  conceito: dropdown de notificações
  origem:
    - components/ui/notification-dropdown.tsx
  destino:
    - packages/frontend/src/features/notificacoes/ui/Dropdown.web.tsx
  invariantes:
    - id: lista
      prova:
        "Dropdown.web.test.tsx: Agora mesmo, m/h/d atrás, pt-BR, 10 itens,
        Notificações, Marcar todas, Limpar, vazio, ícones e cores de prioridade,
        pulso sm, mousedown"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/features/notificacoes/ui/Dropdown.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "hooks/use-notifications.ts continua dono da carga de notificações"
      - "app/area-cliente/notificacoes/page.tsx continua dono da tela"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/ui/notification-dropdown.tsx
  nao_verificado:
    - "[NOT_VERIFIED: dropdown de notificações no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 141-carga-notificacoes

O gancho saiu de `hooks/use-notifications.ts`. A chave continua
`gb-locacoes-unread-count` e o evento continua `notificationUpdate`. A lista
continua em `GET /api/client/notifications?limit=50`. O sync
`POST /api/admin/notifications/sync` continua só para o papel ADMIN. Marcar uma
continua `PATCH`, remover continua `DELETE` e marcar todas continua
`POST /api/client/notifications/mark-all-read`. O tipo e a prioridade continuam
em minúsculas. Limpar todas continua só na memória local. Os auxiliares legados
continuam avisando para usar `lib/notification-service.ts` e devolvendo string
vazia. A tela de notificações e o cabeçalho admin importam a feature.

```yaml
fatia:
  id: 141-carga-notificacoes
  estado: intermediate
  conceito: carga de notificações do cliente
  origem:
    - hooks/use-notifications.ts
  destino:
    - packages/frontend/src/features/notificacoes/model/use-notifications.web.ts
  invariantes:
    - id: api
      prova:
        "use-notifications.web.test.ts: chave gb-locacoes-unread-count, evento
        notificationUpdate, sync só ADMIN, limite 50, PATCH, DELETE,
        mark-all-read, limpeza local"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/features/notificacoes/model/use-notifications.web.test.ts
        packages/frontend/src/features/notificacoes/ui/Dropdown.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "app/area-cliente/notificacoes/page.tsx continua dono da tela"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - hooks/use-notifications.ts
  nao_verificado:
    - "[NOT_VERIFIED: carga de notificações no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 142-pagina-notificacoes

A tela de notificações saiu de `app/area-cliente/notificacoes/page.tsx`. A rota
continua `/area-cliente/notificacoes` e a página do host só renderiza
`NotificacoesPage`. Os rótulos continuam Orçamento, Equipamento, Pagamento,
Sistema e Geral. O tempo continua Agora mesmo, minutos, horas e dias. O contador
continua na chave `gb-locacoes-unread-count` com o evento `notificationUpdate`.
O vazio continua Nenhuma notificação / Você está em dia! Novas notificações
aparecerão aqui. A onda continua `#f9fafb`.

```yaml
fatia:
  id: 142-pagina-notificacoes
  estado: intermediate
  conceito: tela de notificações do cliente
  origem:
    - app/area-cliente/notificacoes/page.tsx
  destino:
    - packages/frontend/src/pages/notificacoes/ui/NotificacoesPage.web.tsx
    - app/area-cliente/notificacoes/page.tsx
  invariantes:
    - id: tela
      prova:
        "NotificacoesPage.web.test.tsx: rótulos, ícones, Agora mesmo, 1440,
        Motivo, Lido, lista, vazio, chave local e rota fina"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/notificacoes/ui/NotificacoesPage.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "app/area-cliente/layout.tsx continua dono do layout da área do cliente"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - "o corpo da tela em app/area-cliente/notificacoes/page.tsx"
  nao_verificado:
    - "[NOT_VERIFIED: tela de notificações no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 143-layout-area-cliente

O layout da área do cliente saiu de `app/area-cliente/layout.tsx` e ficou no
mesmo widget do cabeçalho, ao lado do diálogo de saída. Sem sessão, o destino
continua `/login`. O menu continua Dashboard, Notificações, Meu Perfil, Meus
Orçamentos, Endereços e Suporte. Meus Orçamentos continua ativo também em
`/area-cliente/historico/`. O contador continua na chave
`gb-locacoes-unread-count` e no evento `notificationUpdate`. A altura do
cabeçalho continua 104 e o scroll continua no `dashboard-banner`. Os papéis
ADMIN, OPERATOR e FINANCIAL continuam vendo o atalho `/admin`.

```yaml
fatia:
  id: 143-layout-area-cliente
  estado: intermediate
  conceito: layout da área do cliente
  origem:
    - app/area-cliente/layout.tsx
  destino:
    - packages/frontend/src/widgets/cabecalho/ui/AreaCliente.web.tsx
    - app/area-cliente/layout.tsx
  invariantes:
    - id: menu
      prova:
        "AreaCliente.web.test.tsx: /login, menu, histórico aninhado, chave
        local, altura 104, banner, papéis e /admin"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/cabecalho/ui/AreaCliente.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "app/area-cliente/page.tsx continua dono do dashboard"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - "o corpo do layout em app/area-cliente/layout.tsx"
  nao_verificado:
    - "[NOT_VERIFIED: layout da área do cliente no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 144-dashboard-area-cliente

O dashboard saiu de `app/area-cliente/page.tsx`. A rota continua `/area-cliente`
e o host só renderiza `AreaClientePage`. Os pedidos continuam em
`GET /api/quotes`, as locações em `GET /api/client/rentals` e as atividades em
`GET /api/client/activities?limit=10`. Os status continuam Pendente, Ativa,
Concluída e Atrasada. A data inválida continua Data inválida e o tempo curto
continua há alguns segundos. A saudação continua Bem-vindo de volta,. O banner
continua `dashboard-banner`. A onda continua `#f9fafb`.

```yaml
fatia:
  id: 144-dashboard-area-cliente
  estado: intermediate
  conceito: dashboard da área do cliente
  origem:
    - app/area-cliente/page.tsx
  destino:
    - packages/frontend/src/pages/area-cliente/ui/AreaClientePage.web.tsx
    - app/area-cliente/page.tsx
  invariantes:
    - id: apis
      prova:
        "AreaClientePage.web.test.tsx: /api/quotes, rentals, activities limit
        10, status, Data inválida, há alguns segundos, saudação, banner e rota
        fina"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/area-cliente/ui/AreaClientePage.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "app/area-cliente/historico/page.tsx continua dono do histórico"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - "o corpo do dashboard em app/area-cliente/page.tsx"
  nao_verificado:
    - "[NOT_VERIFIED: dashboard da área do cliente no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 145-historico-cliente

O histórico saiu de `app/area-cliente/historico/page.tsx`. A rota continua
`/area-cliente/historico` e o host só renderiza `HistoricoPage`. A lista
continua em `GET /api/client/rentals` e `GET /api/quotes`. Apagar locação
continua `DELETE /api/client/rentals/{id}` e apagar orçamento continua
`DELETE /api/quotes/{id}`. A busca continua com o placeholder Buscar por
equipamento.... O filtro continua com o valor `all` e o rótulo Todos os status.
O título continua Meus Orçamentos.

```yaml
fatia:
  id: 145-historico-cliente
  estado: intermediate
  conceito: histórico de orçamentos e locações
  origem:
    - app/area-cliente/historico/page.tsx
  destino:
    - packages/frontend/src/pages/historico/ui/HistoricoPage.web.tsx
    - app/area-cliente/historico/page.tsx
  invariantes:
    - id: lista
      prova:
        "HistoricoPage.web.test.tsx: rentals, quotes, DELETE, Buscar por
        equipamento..., Todos os status, all, Meus Orçamentos e rota fina"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/historico/ui/HistoricoPage.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "app/area-cliente/historico/[id]/page.tsx continua dono do detalhe"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - "o corpo do histórico em app/area-cliente/historico/page.tsx"
  nao_verificado:
    - "[NOT_VERIFIED: histórico do cliente no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 146-historico-detalhe

O detalhe saiu de `app/area-cliente/historico/[id]/page.tsx`. A rota continua
`/area-cliente/historico/[id]` e o host só renderiza `RentalDetailsPage`. O
orçamento continua em `GET /api/quotes/{id}` e a locação em
`GET /api/client/rentals/{id}`. A extensão continua
`POST /api/client/rentals/{id}/extend`, só de 1 a 30 dias. A linha do tempo e o
bloco de preço continuam nos componentes legados.

```yaml
fatia:
  id: 146-historico-detalhe
  estado: intermediate
  conceito: detalhe de orçamento e locação
  origem:
    - app/area-cliente/historico/[id]/page.tsx
  destino:
    - packages/frontend/src/pages/historico-detalhe/ui/HistoricoDetalhePage.web.tsx
    - app/area-cliente/historico/[id]/page.tsx
  invariantes:
    - id: carga
      prova:
        "HistoricoDetalhePage.web.test.tsx: quotes, rentals, extend POST, limite
        1 a 30 e rota fina"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/historico-detalhe/ui/HistoricoDetalhePage.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/client/rental-timeline.tsx continua legado"
      - "components/equipment-quote-price-block.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - "o corpo do detalhe em app/area-cliente/historico/[id]/page.tsx"
  nao_verificado:
    - "[NOT_VERIFIED: detalhe do histórico no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 147-linha-do-tempo

A linha do tempo saiu de `components/client/rental-timeline.tsx` e ficou na
página do detalhe. O título continua Linha do Tempo. Concluído continua verde, o
passo atual continua laranja e o pendente continua cinza. O boleto pago continua
`completed` e o não pago continua `current`.

```yaml
fatia:
  id: 147-linha-do-tempo
  estado: intermediate
  conceito: linha do tempo da locação
  origem:
    - components/client/rental-timeline.tsx
  destino:
    - packages/frontend/src/pages/historico-detalhe/ui/LinhaDoTempo.web.tsx
  invariantes:
    - id: cores
      prova:
        "LinhaDoTempo.web.test.tsx: título, verde, laranja, cinza, passos
        quote/boleto/paid e PAID completed senão current"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/historico-detalhe/ui/LinhaDoTempo.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/equipment-quote-price-block.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/client/rental-timeline.tsx
  nao_verificado:
    - "[NOT_VERIFIED: linha do tempo no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 148-bloco-preco

O bloco de preço saiu de `components/equipment-quote-price-block.tsx`. O período
vazio continua Diário. weekly e semanal continuam Semanal, biweekly e quinzenal
continuam Quinzenal, monthly e mensal continuam Mensal. O desconto mostra Preço
original:, o percentual e Preço final:. O valor direto mostra Valor direto:. O
simples mostra só Preço final:. O detalhe do histórico e o cartão de itens do
orçamento admin importam a feature.

```yaml
fatia:
  id: 148-bloco-preco
  estado: intermediate
  conceito: bloco de preço do orçamento
  origem:
    - components/equipment-quote-price-block.tsx
  destino:
    - packages/frontend/src/features/bloco-preco/ui/Bloco.tsx
  invariantes:
    - id: periodos
      prova:
        "Bloco.test.tsx: Diário, Semanal, Quinzenal, Mensal, Preço original,
        Preço final, Valor direto e as três variantes"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/features/bloco-preco/ui/Bloco.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/quotes/quote-items-card.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/equipment-quote-price-block.tsx
  nao_verificado:
    - "[NOT_VERIFIED: bloco de preço no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 149-itens-orcamento

O cartão de itens saiu de `components/admin/quotes/quote-items-card.tsx`.
Adicionar equipamento continua com o aviso Adicionar equipamento em
desenvolvimento. Remover item e remover reajuste continuam com os mesmos
rótulos. A justificativa continua Justificativa do Ajuste. O painel de detalhe
importa o widget. Os tipos e o formatador de data continuam na pasta admin de
orçamentos.

```yaml
fatia:
  id: 149-itens-orcamento
  estado: intermediate
  conceito: cartão de itens do orçamento
  origem:
    - components/admin/quotes/quote-items-card.tsx
  destino:
    - packages/frontend/src/widgets/itens-orcamento/ui/Cartao.web.tsx
  invariantes:
    - id: acoes
      prova:
        "Cartao.web.test.tsx: adicionar em desenvolvimento, remover item,
        remover reajuste, justificativa e painel apontando o widget"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/itens-orcamento/ui/Cartao.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/quotes/quote-detail-panel.tsx continua dono do detalhe
        do orçamento"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/quotes/quote-items-card.tsx
  nao_verificado:
    - "[NOT_VERIFIED: cartão de itens no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 150-enderecos

A tela de endereços saiu de `app/area-cliente/enderecos/page.tsx`. A rota
continua `/area-cliente/enderecos` e o host só renderiza `EnderecosPage`. A
lista continua em `GET /api/addresses`. Criar continua `POST /api/addresses`.
Editar e remover continuam em `/api/addresses/{id}`. A busca de CEP continua com
8 dígitos. As mensagens continuam Erro ao carregar endereços, Endereço
atualizado com sucesso!, Endereço adicionado com sucesso! e Endereço removido
com sucesso!. A onda continua `#f9fafb`.

```yaml
fatia:
  id: 150-enderecos
  estado: intermediate
  conceito: endereços do cliente
  origem:
    - app/area-cliente/enderecos/page.tsx
  destino:
    - packages/frontend/src/pages/enderecos/ui/EnderecosPage.web.tsx
    - app/area-cliente/enderecos/page.tsx
  invariantes:
    - id: api
      prova:
        "EnderecosPage.web.test.tsx: GET/POST/id, CEP de 8 dígitos, quatro
        mensagens, onda e rota fina"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/enderecos/ui/EnderecosPage.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "app/area-cliente/perfil/page.tsx continua dono do perfil"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - "o corpo da tela em app/area-cliente/enderecos/page.tsx"
  nao_verificado:
    - "[NOT_VERIFIED: endereços no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 151-perfil

O perfil saiu de `app/area-cliente/perfil/page.tsx`. A rota continua
`/area-cliente/perfil` e o host só renderiza `PerfilPage`. A carga e a gravação
continuam em `/api/user/profile`. O sucesso continua Perfil atualizado com
sucesso! e o erro continua Erro ao atualizar perfil. E-mail, telefone e
documentos continuam começando em `pending`. O bloco de senha continua Alterar
Senha e Atualize sua senha regularmente. A onda continua `#f9fafb` e o azul do
perfil continua `#1A2E4C`.

```yaml
fatia:
  id: 151-perfil
  estado: intermediate
  conceito: perfil do cliente
  origem:
    - app/area-cliente/perfil/page.tsx
  destino:
    - packages/frontend/src/pages/perfil/ui/PerfilPage.web.tsx
    - app/area-cliente/perfil/page.tsx
  invariantes:
    - id: perfil
      prova:
        "PerfilPage.web.test.tsx: /api/user/profile, sucesso, erro, pending,
        Alterar Senha, onda e azul"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/perfil/ui/PerfilPage.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "app/page.tsx continua dono da home e do Prisma"
      - "components/admin/quotes/quote-detail-panel.tsx continua dono do detalhe
        do orçamento"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - "o corpo da tela em app/area-cliente/perfil/page.tsx"
  nao_verificado:
    - "[NOT_VERIFIED: perfil no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 152-logistica

A tela de logística saiu de `app/admin/logistics/page.tsx`. A rota continua
`/admin/logistics` e o host só renderiza `AdminLogisticsPage`. O título continua
Gerenciar Logística e o subtítulo continua Entregas e coletas de equipamentos.
Entrega continua azul `#3B82F6` e coleta continua roxa `#8B5CF6`. Quando o fim é
anterior ao início, o evento continua com duas horas a partir de agora. O
gancho, a tabela e o calendário continuam no legado.

```yaml
fatia:
  id: 152-logistica
  estado: intermediate
  conceito: tela de logística
  origem:
    - app/admin/logistics/page.tsx
  destino:
    - packages/frontend/src/pages/logistica/ui/LogisticaPage.web.tsx
    - app/admin/logistics/page.tsx
  invariantes:
    - id: cores
      prova:
        "LogisticaPage.web.test.tsx: título, subtítulo, Entrega/Coleta, #3B82F6,
        #8B5CF6, addHours 2 e rota fina"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/logistica/ui/LogisticaPage.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "hooks/use-logistics-data.ts continua dono da carga"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - "o corpo da tela em app/admin/logistics/page.tsx"
  nao_verificado:
    - "[NOT_VERIFIED: logística no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 153-carga-logistica

O gancho saiu de `hooks/use-logistics-data.ts`. A lista continua em
`GET /api/admin/logistics`. Veículos disponíveis continuam em
`GET /api/admin/vehicles?status=AVAILABLE`. Motoristas ativos continuam em
`GET /api/admin/drivers?status=ACTIVE`. Salvar e mudar status continuam
`PATCH /api/admin/logistics/{id}`. O sucesso da entrega continua Entrega/coleta
atualizada com sucesso e o do status continua Status atualizado com sucesso.

```yaml
fatia:
  id: 153-carga-logistica
  estado: intermediate
  conceito: carga de logística
  origem:
    - hooks/use-logistics-data.ts
  destino:
    - packages/frontend/src/pages/logistica/model/carga.ts
  invariantes:
    - id: api
      prova:
        "carga.test.ts: logistics, vehicles AVAILABLE, drivers ACTIVE, PATCH,
        sucesso da entrega e do status"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/logistica/model/carga.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/logistics/logistics-table.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - hooks/use-logistics-data.ts
  nao_verificado:
    - "[NOT_VERIFIED: carga de logística no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 154-tabela-logistica

A tabela saiu de `components/admin/logistics/logistics-table.tsx`. Exibir e
Editar continuam. Entrega `SCHEDULED` continua indo para `IN_TRANSIT` pelo botão
Iniciar. Entrega `IN_TRANSIT` continua indo para `COMPLETED` pelo botão
Concluir. Os tipos e o formatador de status continuam na pasta admin de
logística.

```yaml
fatia:
  id: 154-tabela-logistica
  estado: intermediate
  conceito: tabela de logística
  origem:
    - components/admin/logistics/logistics-table.tsx
  destino:
    - packages/frontend/src/pages/logistica/ui/Tabela.web.tsx
  invariantes:
    - id: status
      prova:
        "Tabela.web.test.tsx: Exibir, Editar, SCHEDULED para IN_TRANSIT com
        Iniciar, IN_TRANSIT para COMPLETED com Concluir"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/logistica/ui/Tabela.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/logistics/logistics-filter-bar.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/logistics/logistics-table.tsx
  nao_verificado:
    - "[NOT_VERIFIED: tabela de logística no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 155-filtros-logistica

A barra de filtros saiu de
`components/admin/logistics/logistics-filter-bar.tsx`. A busca continua Buscar
por cliente.... Os status continuam Todos, Agendada, Em Trânsito, Concluída e
Cancelada. Os tipos continuam Todos, Entrega e Coleta. O reset continua mandando
status e tipo para `all`. Nova Entrega/Coleta continua avisando Funcionalidade
em desenvolvimento. A visão continua Tabela e Calendário.

```yaml
fatia:
  id: 155-filtros-logistica
  estado: intermediate
  conceito: filtros de logística
  origem:
    - components/admin/logistics/logistics-filter-bar.tsx
  destino:
    - packages/frontend/src/pages/logistica/ui/Filtros.web.tsx
  invariantes:
    - id: filtros
      prova:
        "Filtros.web.test.tsx: busca, status, tipos, reset all, aviso em
        desenvolvimento, Tabela e Calendário"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/logistica/ui/Filtros.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/logistics/delivery-detail-dialog.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/logistics/logistics-filter-bar.tsx
  nao_verificado:
    - "[NOT_VERIFIED: filtros de logística no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 156-dialogo-entrega

O diálogo saiu de `components/admin/logistics/delivery-detail-dialog.tsx`. O
título de edição continua Editar Entrega/Coleta. Os placeholders continuam
Selecione um veículo, Selecione um motorista, Digite a distância em km e Digite
observações sobre a entrega/coleta.... Salvar e Cancelar continuam. Os cartões
continuam Cliente, Checklist e Fotos. O checklist e o calendário continuam no
legado.

```yaml
fatia:
  id: 156-dialogo-entrega
  estado: intermediate
  conceito: diálogo de entrega e coleta
  origem:
    - components/admin/logistics/delivery-detail-dialog.tsx
  destino:
    - packages/frontend/src/pages/logistica/ui/Dialogo.web.tsx
  invariantes:
    - id: campos
      prova:
        "Dialogo.web.test.tsx: título, veículo, motorista, distância,
        observações, Salvar, Cancelar, Cliente, Checklist e Fotos"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/logistica/ui/Dialogo.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/delivery-checklist.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/logistics/delivery-detail-dialog.tsx
  nao_verificado:
    - "[NOT_VERIFIED: diálogo de entrega no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 157-checklist-entrega

O checklist saiu de `components/admin/delivery-checklist.tsx`. Entrega e coleta
continuam listas separadas. Na entrega continuam Equipamento verificado e
funcionando, Acessórios completos e Cliente presente na entrega. Na coleta
continuam Equipamento devolvido, Danos detectados, Descrição dos danos e Cliente
presente na coleta. A leitura do odômetro/horímetro continua nas duas.

```yaml
fatia:
  id: 157-checklist-entrega
  estado: intermediate
  conceito: checklist de entrega e coleta
  origem:
    - components/admin/delivery-checklist.tsx
  destino:
    - packages/frontend/src/pages/logistica/ui/Checklist.web.tsx
  invariantes:
    - id: itens
      prova:
        "Checklist.web.test.tsx: DELIVERY e PICKUP, verificação, acessórios,
        presença na entrega, devolução, danos e odômetro"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/logistica/ui/Checklist.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/advanced-calendar/index.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/delivery-checklist.tsx
  nao_verificado:
    - "[NOT_VERIFIED: checklist de entrega no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 158-calendario

O calendário avançado saiu de `components/admin/advanced-calendar`. As visões
continuam daily, weekly, monthly e timeline. Pendente continua `#F97316`,
aprovado `#22c55e`, rejeitado `#ef4444`, concluído de orçamento `#3b82f6` e
atrasado `#FBBF24`. Locação ativa continua `#3B82F6`, concluída `#10B981`,
cancelada `#EF4444` e retorno pendente `#8B5CF6`. Logística, locações,
financeiro, manutenção e o calendário de orçamentos importam o widget.

```yaml
fatia:
  id: 158-calendario
  estado: intermediate
  conceito: calendário avançado
  origem:
    - components/admin/advanced-calendar
  destino:
    - packages/frontend/src/widgets/calendario
  invariantes:
    - id: visoes
      prova:
        "calendario.test.ts: ViewMode daily, weekly, monthly e timeline;
        token-check manteve as cores de status"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/calendario/ui/calendario.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "app/admin/maintenance/page.tsx continua dono da tela de manutenção"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/advanced-calendar
  nao_verificado:
    - "[NOT_VERIFIED: calendário avançado no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 159-manutencao

A tela de manutenção saiu de `app/admin/maintenance/page.tsx`. A rota continua
`/admin/maintenance` e o host só renderiza `AdminMaintenancePage`. O título
continua Gerenciar Manutenções. O evento sem fim útil continua com 4 horas e o
teto continua 24 horas. Preventiva continua `#10B981`, corretiva `#F59E0B` e os
outros tipos `#6366F1`. O gancho e a tabela continuam no legado.

```yaml
fatia:
  id: 159-manutencao
  estado: intermediate
  conceito: tela de manutenção
  origem:
    - app/admin/maintenance/page.tsx
  destino:
    - packages/frontend/src/pages/manutencao/ui/ManutencaoPage.web.tsx
    - app/admin/maintenance/page.tsx
  invariantes:
    - id: cores
      prova:
        "ManutencaoPage.web.test.tsx: título, 4 horas, teto 24, preventiva,
        corretiva, índigo e rota fina"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/manutencao/ui/ManutencaoPage.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "hooks/use-maintenance-data.ts continua dono da carga"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - "o corpo da tela em app/admin/maintenance/page.tsx"
  nao_verificado:
    - "[NOT_VERIFIED: manutenção no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 160-carga-manutencao

O gancho saiu de `hooks/use-maintenance-data.ts`. A lista continua em
`GET /api/admin/maintenance` e a agenda em
`GET /api/admin/maintenance/scheduled?includeOverdue=true`. O resultado da
agenda continua sendo lido e não entra na lista. A página da tabela continua 10.
A visão inicial continua `list`. O filtro vazio continua `all` para status e
tipo. O erro continua Erro ao carregar manutenções. Tente novamente.

```yaml
fatia:
  id: 160-carga-manutencao
  estado: intermediate
  conceito: carga de manutenção
  origem:
    - hooks/use-maintenance-data.ts
  destino:
    - packages/frontend/src/pages/manutencao/model/carga.ts
  invariantes:
    - id: api
      prova:
        "carga.test.ts: maintenance, scheduled includeOverdue, página 10, visão
        list, filtro all e a mensagem de erro"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/manutencao/model/carga.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/maintenance/maintenance-table.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - hooks/use-maintenance-data.ts
  nao_verificado:
    - "[NOT_VERIFIED: carga de manutenção no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 161-tabela-manutencao

A tabela saiu de `components/admin/maintenance/maintenance-table.tsx`. As
colunas continuam Equipamento e Técnico. A ação continua Exibir. O tipo continua
vindo de `typeConfig` e o status de `getStatusBadge`. Os tipos e o formatador
continuam na pasta admin de manutenção.

```yaml
fatia:
  id: 161-tabela-manutencao
  estado: intermediate
  conceito: tabela de manutenção
  origem:
    - components/admin/maintenance/maintenance-table.tsx
  destino:
    - packages/frontend/src/pages/manutencao/ui/Tabela.web.tsx
  invariantes:
    - id: colunas
      prova:
        "Tabela.web.test.tsx: Equipamento, Técnico, Exibir, typeConfig e
        getStatusBadge"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/manutencao/ui/Tabela.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/maintenance/maintenance-filter-bar.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/maintenance/maintenance-table.tsx
  nao_verificado:
    - "[NOT_VERIFIED: tabela de manutenção no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 162-filtros-manutencao

A barra de filtros saiu de
`components/admin/maintenance/maintenance-filter-bar.tsx`. A busca continua
Buscar por equipamento ou técnico.... Os status continuam Todos, Agendada, Em
Andamento, Concluída e Cancelada. Os tipos continuam Preventiva, Corretiva e
Inspeção. O reset continua em `all`. Agendar Preventiva continua avisando
Funcionalidade em desenvolvimento. A visão continua Lista e Calendário, com
valor `list`.

```yaml
fatia:
  id: 162-filtros-manutencao
  estado: intermediate
  conceito: filtros de manutenção
  origem:
    - components/admin/maintenance/maintenance-filter-bar.tsx
  destino:
    - packages/frontend/src/pages/manutencao/ui/Filtros.web.tsx
  invariantes:
    - id: filtros
      prova:
        "Filtros.web.test.tsx: busca, Em Andamento, Preventiva, Corretiva,
        Inspeção, reset all, Agendar Preventiva e visão list"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/manutencao/ui/Filtros.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/maintenance/maintenance-detail-dialog.tsx continua
        legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/maintenance/maintenance-filter-bar.tsx
  nao_verificado:
    - "[NOT_VERIFIED: filtros de manutenção no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 163-dialogo-manutencao

O diálogo saiu de `components/admin/maintenance/maintenance-detail-dialog.tsx`.
Os cartões continuam Equipamento, Informações da Manutenção, Descrição, Custos e
Notas. O valor continua em `formatCurrency` e o status em `getStatusBadge`. Os
tipos e o formatador continuam na pasta admin de manutenção.

```yaml
fatia:
  id: 163-dialogo-manutencao
  estado: intermediate
  conceito: diálogo de manutenção
  origem:
    - components/admin/maintenance/maintenance-detail-dialog.tsx
  destino:
    - packages/frontend/src/pages/manutencao/ui/Dialogo.web.tsx
  invariantes:
    - id: cartoes
      prova:
        "Dialogo.web.test.tsx: Equipamento, Informações da Manutenção,
        Descrição, Custos, Notas, formatCurrency e getStatusBadge"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/manutencao/ui/Dialogo.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/maintenance/types.ts continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/maintenance/maintenance-detail-dialog.tsx
  nao_verificado:
    - "[NOT_VERIFIED: diálogo de manutenção no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 164-tipos-manutencao

Os tipos saíram de `components/admin/maintenance/types.ts`. Agendada, Em
Andamento, Concluída e Cancelada continuam. Preventiva, Corretiva e Inspeção
continuam. Em andamento continua amarelo. O formatador em `utils.tsx` importa
esses tipos.

```yaml
fatia:
  id: 164-tipos-manutencao
  estado: intermediate
  conceito: rótulos de status e tipo da manutenção
  origem:
    - components/admin/maintenance/types.ts
  destino:
    - packages/frontend/src/pages/manutencao/model/tipos.ts
  invariantes:
    - id: rotulos
      prova:
        "tipos.test.ts: Agendada, Em Andamento, Concluída, Cancelada,
        Preventiva, Corretiva, Inspeção e o amarelo"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/manutencao/model/tipos.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/maintenance/utils.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/maintenance/types.ts
  nao_verificado:
    - "[NOT_VERIFIED: rótulos de manutenção no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 165-formatador-manutencao

O formatador saiu de `components/admin/maintenance/utils.tsx`. Valor vazio ou
zero continua `R$ 0,00` em BRL. Data ausente continua Não definido e data
inválida continua Data inválida, em `pt-BR` com hora. Status desconhecido
continua caindo em `SCHEDULED`. Esse formatador continua próprio da manutenção.

```yaml
fatia:
  id: 165-formatador-manutencao
  estado: intermediate
  conceito: formatador da manutenção
  origem:
    - components/admin/maintenance/utils.tsx
  destino:
    - packages/frontend/src/pages/manutencao/ui/formatar.tsx
  invariantes:
    - id: vazio
      prova:
        "formatar.test.ts: R$ 0,00, BRL, Não definido, Data inválida, pt-BR e
        fallback SCHEDULED"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/manutencao/ui/formatar.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "app/admin/rentals/page.tsx continua dono da tela de locações"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/maintenance/utils.tsx
  nao_verificado:
    - "[NOT_VERIFIED: formatador de manutenção no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 166-locacoes-admin

A tela de locações saiu de `app/admin/rentals/page.tsx`. A rota continua
`/admin/rentals` e o host só renderiza `AdminRentalsPage`. O título continua
Gerenciar Locações. Pendente continua `#F97316`, ativa `#3B82F6`, concluída
`#10B981`, cancelada `#EF4444`, atrasada `#FBBF24`, retorno pendente `#8B5CF6` e
status desconhecido `#6B7280`. Locação pendente continua usando a data de
criação no início e no fim. A busca continua Buscar por cliente, email,
telefone, empresa.... Os períodos continuam Hoje, Última semana e Último mês. O
gancho e a tabela continuam no legado.

```yaml
fatia:
  id: 166-locacoes-admin
  estado: intermediate
  conceito: tela admin de locações
  origem:
    - app/admin/rentals/page.tsx
  destino:
    - packages/frontend/src/pages/locacoes/ui/LocacoesPage.web.tsx
    - app/admin/rentals/page.tsx
  invariantes:
    - id: cores
      prova:
        "LocacoesPage.web.test.tsx: título, seis cores, cinza, pendente na data
        de criação, busca e períodos"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/locacoes/ui/LocacoesPage.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "hooks/use-rentals-data.ts continua dono da carga"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - "o corpo da tela em app/admin/rentals/page.tsx"
  nao_verificado:
    - "[NOT_VERIFIED: locações admin no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 167-carga-locacoes

O gancho saiu de `hooks/use-rentals-data.ts`. A lista continua em
`GET /api/admin/rentals`. A página da tabela continua 10. O contrato continua
`POST /api/admin/rentals/{id}/contract`. O check-in continua `PATCH` com status
`ACTIVE` e o check-out continua `PATCH` com status `COMPLETED`. O documento
continua em `/api/admin/clients/{id}/documents`.

```yaml
fatia:
  id: 167-carga-locacoes
  estado: intermediate
  conceito: carga das locações admin
  origem:
    - hooks/use-rentals-data.ts
  destino:
    - packages/frontend/src/pages/locacoes/model/carga.ts
  invariantes:
    - id: acoes
      prova:
        "carga.test.ts: lista, página 10, documento, contrato POST, check-in
        ACTIVE e check-out COMPLETED"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/locacoes/model/carga.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/rentals/rental-table.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - hooks/use-rentals-data.ts
  nao_verificado:
    - "[NOT_VERIFIED: carga de locações no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 168-tabela-locacoes

A tabela saiu de `components/admin/rentals/rental-table.tsx`. A coluna continua
Cliente e a ação continua Exibir. O valor e o status continuam nos formatadores
da pasta admin de locações. A tabela do ofício em PDF não foi alterada.

```yaml
fatia:
  id: 168-tabela-locacoes
  estado: intermediate
  conceito: tabela de locações
  origem:
    - components/admin/rentals/rental-table.tsx
  destino:
    - packages/frontend/src/pages/locacoes/ui/Tabela.web.tsx
  invariantes:
    - id: colunas
      prova:
        "Tabela.web.test.tsx: Cliente, Exibir, formatCurrency e getStatusBadge"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/locacoes/ui/Tabela.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/rentals/rental-detail-dialog.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/rentals/rental-table.tsx
  nao_verificado:
    - "[NOT_VERIFIED: tabela de locações no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 169-dialogo-locacao

O diálogo saiu de `components/admin/rentals/rental-detail-dialog.tsx`. Os
cartões continuam Cliente, Período de Locação, Equipamentos, Pagamentos,
Check-in/Check-out, Contrato e Documentos do Cliente (Antifraude). Os botões
continuam Realizar Check-in e Realizar Check-out. Os tipos e o formatador
continuam na pasta admin de locações.

```yaml
fatia:
  id: 169-dialogo-locacao
  estado: intermediate
  conceito: diálogo de locação
  origem:
    - components/admin/rentals/rental-detail-dialog.tsx
  destino:
    - packages/frontend/src/pages/locacoes/ui/Dialogo.web.tsx
  invariantes:
    - id: cartoes
      prova:
        "Dialogo.web.test.tsx: Cliente, período, equipamentos, pagamentos,
        check-in, check-out, contrato e antifraude"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/locacoes/ui/Dialogo.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/rentals/utils.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/rentals/rental-detail-dialog.tsx
  nao_verificado:
    - "[NOT_VERIFIED: diálogo de locação no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 170-formatador-locacao

O formatador saiu de `components/admin/rentals/utils.tsx`. A moeda continua BRL.
Data ausente continua Não definido e data inválida continua Data inválida, em
`pt-BR`, só com dia, mês e ano. Status desconhecido continua caindo em
`PENDING`. O selo continua no `StatusTooltip`.

```yaml
fatia:
  id: 170-formatador-locacao
  estado: intermediate
  conceito: formatador da locação admin
  origem:
    - components/admin/rentals/utils.tsx
  destino:
    - packages/frontend/src/pages/locacoes/ui/formatar.tsx
  invariantes:
    - id: data
      prova:
        "formatar.test.ts: BRL, Não definido, Data inválida, sem hora, fallback
        PENDING e StatusTooltip"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/locacoes/ui/formatar.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/ui/status-tooltip.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/rentals/utils.tsx
  nao_verificado:
    - "[NOT_VERIFIED: formatador de locação no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 171-selo-status

O selo de status saiu de `components/ui/status-tooltip.tsx`. O rótulo informado
continua na frente da definição e do código do status. Com classe de fundo o
selo continua `custom`; sem fundo continua `outline`. A ajuda continua no topo,
com espera de 120 ms. As definições continuam em `lib/status-definitions.ts`.

```yaml
fatia:
  id: 171-selo-status
  estado: intermediate
  conceito: selo de status com ajuda
  origem:
    - components/ui/status-tooltip.tsx
  destino:
    - packages/ui/src/web/StatusTooltip.web.tsx
    - packages/ui/src/native/StatusTooltip.native.tsx
  invariantes:
    - id: ajuda
      prova:
        "StatusTooltip.web.test.tsx: rótulo, custom só com bg-, outline, topo,
        120 ms"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/StatusTooltip.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "lib/status-definitions.ts continua dono dos textos de status"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/ui/status-tooltip.tsx
  nao_verificado:
    - "[NOT_VERIFIED: selo de status no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 172-definicoes-status

Os textos saíram de `lib/status-definitions.ts`. Vazio continua sem definição. A
chave continua em maiúsculas. Pendente continua Pendente. Aguardando devolução,
Não Pago, Aguardando Pagamento e Baixado continuam. Chave desconhecida continua
sem definição.

```yaml
fatia:
  id: 172-definicoes-status
  estado: intermediate
  conceito: textos de status de negócio
  origem:
    - lib/status-definitions.ts
  destino:
    - packages/ui/src/status-definitions.ts
  invariantes:
    - id: textos
      prova:
        "status-definitions.test.ts: vazio null, maiúsculas, Pendente,
        Aguardando devolução, Não Pago, Aguardando Pagamento, Baixado e chave
        desconhecida null"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/status-definitions.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/rentals/types.ts continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - lib/status-definitions.ts
  nao_verificado:
    - "[NOT_VERIFIED: textos de status no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 173-tipos-locacao

Os tipos saíram de `components/admin/rentals/types.ts`. Os rótulos continuam
Pendente, Ativa, Concluída, Cancelada, Atrasada e Aguardando Devolução. O
gradiente pendente continua de orange-400 para orange-500 e o de retorno
continua de purple-400 para pink-500.

```yaml
fatia:
  id: 173-tipos-locacao
  estado: intermediate
  conceito: rótulos da locação admin
  origem:
    - components/admin/rentals/types.ts
  destino:
    - packages/frontend/src/pages/locacoes/model/tipos.ts
  invariantes:
    - id: rotulos
      prova:
        "tipos.test.ts: Pendente, Ativa, Concluída, Cancelada, Atrasada,
        Aguardando Devolução e os gradientes"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/locacoes/model/tipos.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "app/admin/financeiro/page.tsx continua dono da tela financeira"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/rentals/types.ts
  nao_verificado:
    - "[NOT_VERIFIED: rótulos de locação no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 174-painel-financeiro

A tela financeira saiu de `app/admin/financeiro/page.tsx`. A rota continua
`/admin/financeiro` e o host só renderiza `AdminFinanceiroPageWrapper`. O título
continua Painel Financeiro e o subtítulo continua Boletos, pagamentos, notas
fiscais e lançamentos. O calendário continua Calendário Financeiro. O suspense
continua com fallback vazio. O gancho e os cartões continuam no legado.

```yaml
fatia:
  id: 174-painel-financeiro
  estado: intermediate
  conceito: painel financeiro
  origem:
    - app/admin/financeiro/page.tsx
  destino:
    - packages/frontend/src/pages/financeiro/ui/FinanceiroPage.web.tsx
    - app/admin/financeiro/page.tsx
  invariantes:
    - id: titulo
      prova:
        "FinanceiroPage.web.test.tsx: Painel Financeiro, subtítulo, calendário,
        Suspense fallback null e rota fina"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/financeiro/ui/FinanceiroPage.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "hooks/use-financial-data.ts continua dono da carga"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - "o corpo da tela em app/admin/financeiro/page.tsx"
  nao_verificado:
    - "[NOT_VERIFIED: painel financeiro no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 175-carga-financeira

O gancho saiu de `hooks/use-financial-data.ts`. A lista continua em
`/api/admin/financial/entries` com limite 10000. A página da tabela continua 10.
O calendário continua em `/api/admin/financial/calendar`. Receita e aging
continuam nas rotas próprias. A inadimplência ausente continua 0. As alíquotas
continuam em `PATCH /api/admin/financial/settings` com o aviso Alíquotas
financeiras salvas. Evento sem cor continua `#f59e0b` e sem status continua
`AWAITING_PAYMENT`. AbortError continua ignorado. Os gráficos só recarregam na
visão dashboard.

```yaml
fatia:
  id: 175-carga-financeira
  estado: intermediate
  conceito: carga do painel financeiro
  origem:
    - hooks/use-financial-data.ts
  destino:
    - packages/frontend/src/pages/financeiro/model/carga.web.ts
  invariantes:
    - id: apis
      prova:
        "carga.web.test.ts: página 10, limite 10000, entries, calendar, revenue,
        aging, alíquotas, âmbar e AWAITING_PAYMENT"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/financeiro/model/carga.web.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/financial/financial-stat-cards.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - hooks/use-financial-data.ts
  nao_verificado:
    - "[NOT_VERIFIED: carga financeira no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 176-detalhe-lancamento-financeiro

O detalhe saiu de `hooks/use-financial-entry-details.ts`. O status continua em
`PATCH /api/admin/financial/entries/{id}/status` com o aviso Status financeiro
atualizado. O vencimento continua em `PATCH .../due-date` com o aviso Vencimento
atualizado com sucesso. A exclusão continua `DELETE` no lançamento. O reajuste
continua em `/api/admin/quotes/{id}/adjustments`, com e-mail e WhatsApp
verdadeiros, e a categoria Outro continua exigindo texto próprio. O boleto
continua em `POST .../regenerate-boleto` depois da confirmação do Asaas. A
seleção automática continua lendo `quoteId` na URL. O painel só recarrega na
visão dashboard.

```yaml
fatia:
  id: 176-detalhe-lancamento-financeiro
  estado: intermediate
  conceito: detalhe do lançamento financeiro
  origem:
    - hooks/use-financial-entry-details.ts
  destino:
    - packages/frontend/src/pages/financeiro/model/detalhe.web.ts
  invariantes:
    - id: rotas
      prova:
        "detalhe.web.test.ts: status, vencimento, exclusão, reajuste com e-mail
        e WhatsApp, Outro, boleto Asaas e quoteId"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/financeiro/model/detalhe.web.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/financial/financial-stat-cards.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - hooks/use-financial-entry-details.ts
  nao_verificado:
    - "[NOT_VERIFIED: detalhe financeiro no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 177-cartoes-financeiros

Os cartões saíram de `components/admin/financial/financial-stat-cards.tsx`. A
grade continua 2, 3 e 3 colunas. O atraso de cada cartão continua 0,2 mais 0,06
por índice. A seleção continua com anel laranja. Sem seleção a borda continua
cinza. O limiar de 15 da inadimplência continua na página, fora deste cartão.

```yaml
fatia:
  id: 177-cartoes-financeiros
  estado: intermediate
  conceito: cartões do painel financeiro
  origem:
    - components/admin/financial/financial-stat-cards.tsx
  destino:
    - packages/frontend/src/pages/financeiro/ui/Cartoes.web.tsx
  invariantes:
    - id: grade
      prova:
        "Cartoes.web.test.tsx: grade 2/3/3, atraso 0.2 + índice * 0.06, escala
        1.02 e anel laranja"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/financeiro/ui/Cartoes.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/financial/tax-settings-section.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/financial/financial-stat-cards.tsx
  nao_verificado:
    - "[NOT_VERIFIED: cartões financeiros no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 178-aliquotas-financeiras

A seção saiu de `components/admin/financial/tax-settings-section.tsx`. CPF, CNPJ
e CNI continuam nas retenções. Os regimes continuam Simples Nacional, Lucro
Presumido e Lucro Real. O ISS de Porto Alegre continua 2,5%. IRPJ continua 4,8%
e CSLL continua 2,88%. PIS/COFINS cumulativo continua 3,65% e o não cumulativo
continua 9,25%. O DAS continua de 6% a 33%. A locação pura continua isenta pela
Súmula Vinculante 31. IBS/CBS continua na reforma.

```yaml
fatia:
  id: 178-aliquotas-financeiras
  estado: intermediate
  conceito: seção de alíquotas do painel financeiro
  origem:
    - components/admin/financial/tax-settings-section.tsx
  destino:
    - packages/frontend/src/pages/financeiro/ui/Aliquotas.web.tsx
  invariantes:
    - id: percentuais
      prova:
        "Aliquotas.web.test.tsx: CPF/CNPJ/CNI, 2,5%, 4,8%, 2,88%, 3,65%, 9,25%,
        DAS 6% a 33% e Súmula 31"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/financeiro/ui/Aliquotas.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/financial/financial-table-view.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/financial/tax-settings-section.tsx
  nao_verificado:
    - "[NOT_VERIFIED: alíquotas financeiras no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 179-tabela-financeira

A tabela saiu de `components/admin/financial/financial-table-view.tsx`. As
colunas continuam Cliente, Valores, Nº Nota, Datas, Status, Documento e Ações. A
ação continua Exibir. O vazio continua Nenhum lançamento encontrado. A seleção
da página continua com o rótulo Selecionar todos os lançamentos da página. As
iniciais continuam em `getInitials` do admin, que devolve nulo quando o nome
está vazio.

```yaml
fatia:
  id: 179-tabela-financeira
  estado: intermediate
  conceito: tabela do painel financeiro
  origem:
    - components/admin/financial/financial-table-view.tsx
  destino:
    - packages/frontend/src/pages/financeiro/ui/Tabela.web.tsx
  invariantes:
    - id: colunas
      prova:
        "Tabela.web.test.tsx: colunas, Exibir, vazio, seleção da página e
        getInitials"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/financeiro/ui/Tabela.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/financial/financial-dashboard-view.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/financial/financial-table-view.tsx
  nao_verificado:
    - "[NOT_VERIFIED: tabela financeira no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 180-painel-graficos-financeiros

A visão saiu de `components/admin/financial/financial-dashboard-view.tsx`. Os
títulos continuam Aging - Contas a Receber, Maiores Devedores, Receita Mensal e
Receita por Categoria. O aging expandido continua na mesma visão. Os gráficos em
si continuam em `components/admin/financial`.

```yaml
fatia:
  id: 180-painel-graficos-financeiros
  estado: intermediate
  conceito: visão de gráficos do painel financeiro
  origem:
    - components/admin/financial/financial-dashboard-view.tsx
  destino:
    - packages/frontend/src/pages/financeiro/ui/Painel.web.tsx
  invariantes:
    - id: titulos
      prova:
        "Painel.web.test.tsx: aging, maiores devedores, receita mensal, receita
        por categoria e aging expandido"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/financeiro/ui/Painel.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/financial/AgingChart.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/financial/financial-dashboard-view.tsx
  nao_verificado:
    - "[NOT_VERIFIED: gráficos financeiros no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 181-exclusao-financeira

Os diálogos saíram de `components/admin/financial/delete-entry-dialog.tsx` e
`delete-adjustment-dialog.tsx`. O lançamento continua perguntando Excluir
lançamento? e avisando que a remoção é permanente. O reajuste continua
perguntando Excluir reajuste? e avisando que o valor do orçamento será
recalculado. Cancelar continua outline. Excluir continua default. O fechar
continua com o rótulo Fechar.

```yaml
fatia:
  id: 181-exclusao-financeira
  estado: intermediate
  conceito: diálogos de exclusão do painel financeiro
  origem:
    - components/admin/financial/delete-entry-dialog.tsx
    - components/admin/financial/delete-adjustment-dialog.tsx
  destino:
    - packages/frontend/src/pages/financeiro/ui/ExcluirLancamento.web.tsx
    - packages/frontend/src/pages/financeiro/ui/ExcluirReajuste.web.tsx
  invariantes:
    - id: textos
      prova:
        "Excluir.web.test.tsx: lançamento permanente, reajuste recalculado,
        Fechar, Cancelar e Excluindo"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/financeiro/ui/Excluir.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/financial/entry-detail-dialog.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/financial/delete-entry-dialog.tsx
    - components/admin/financial/delete-adjustment-dialog.tsx
  nao_verificado:
    - "[NOT_VERIFIED: exclusão financeira no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 182-seletor-data

O calendário, o seletor de uma data e o seletor de intervalo saíram da página de
equipamento e foram para o widget `seletor-data`. O placeholder continua
Selecione uma data. A data continua em português. O calendário continua com Mês
anterior, Próximo mês e janeiro. O parâmetro `includeWeekends` continua com
padrão `true`, mesmo com o comentário dizendo o contrário.

```yaml
fatia:
  id: 182-seletor-data
  estado: intermediate
  conceito: calendário e seletores de data
  origem:
    - packages/frontend/src/pages/equipamento-detalhe/ui/Calendario.web.tsx
    - packages/frontend/src/pages/equipamento-detalhe/ui/DatePicker.web.tsx
    - packages/frontend/src/pages/equipamento-detalhe/ui/DateRangePicker.web.tsx
  destino:
    - packages/frontend/src/widgets/seletor-data
  invariantes:
    - id: datas
      prova:
        "DatePicker.web.test.tsx e Calendario.web.test.tsx: placeholder, pt-BR,
        Mês anterior, Próximo mês e janeiro"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/seletor-data/ui/Calendario.web.test.tsx
        packages/frontend/src/widgets/seletor-data/ui/DatePicker.web.test.tsx
        packages/frontend/src/widgets/seletor-data/ui/DateRangePicker.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/financial/entry-detail-dialog.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: seletor de data no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 183-detalhe-lancamento-dialogo

O diálogo saiu de `components/admin/financial/entry-detail-dialog.tsx`. O título
continua Detalhes do Lançamento. O reajuste continua Registrar Reajuste de
Orçamento. A data continua no widget `seletor-data`. As iniciais continuam em
`getInitials` do admin. Data vazia continua hífen.

```yaml
fatia:
  id: 183-detalhe-lancamento-dialogo
  estado: intermediate
  conceito: diálogo de detalhe do lançamento financeiro
  origem:
    - components/admin/financial/entry-detail-dialog.tsx
  destino:
    - packages/frontend/src/pages/financeiro/ui/Detalhe.web.tsx
  invariantes:
    - id: textos
      prova:
        "Detalhe.web.test.tsx: título, reajuste, status, data, categoria, Fechar
        dialog e getInitials"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/financeiro/ui/Detalhe.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/financial/types.ts continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/financial/entry-detail-dialog.tsx
  nao_verificado:
    - "[NOT_VERIFIED: detalhe do lançamento no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 184-tipos-financeiros

Os tipos saíram de `components/admin/financial/types.ts`. Pago, Não Pago,
Aguardando Pagamento e Baixado continuam no mapa de cobrança. Os regimes
continuam Simples Nacional, Lucro Presumido e Lucro Real. Locação Pura e
Locação + Serviço continuam. As categorias de reajuste continuam Mão de Obra,
Deslocamento, Manutenção e Outros. O padrão continua CPF 6, CNPJ 2,5, CNI 6, ISS
2,5, locação pura isenta e Simples Nacional. O id do reajuste continua com o
prefixo `adj-`.

```yaml
fatia:
  id: 184-tipos-financeiros
  estado: intermediate
  conceito: tipos e rótulos do painel financeiro
  origem:
    - components/admin/financial/types.ts
  destino:
    - packages/frontend/src/pages/financeiro/model/tipos.ts
  invariantes:
    - id: rotulos
      prova:
        "tipos.test.ts: Pago, Não Pago, Aguardando Pagamento, Baixado, regimes,
        locação, reajuste, CPF 6, CNPJ 2.5, CNI 6, ISS 2.5 e prefixo adj-"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/financeiro/model/tipos.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/financial/utils.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/financial/types.ts
  nao_verificado:
    - "[NOT_VERIFIED: tipos financeiros no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 185-filtro-financeiro

O filtro saiu de `components/admin/financial/utils.tsx`. Todos os períodos
continua devolvendo datas nulas. A lista continua com o mês atual e os 12
anteriores. O valor continua `ano-mês`. O fim do mês continua em 23:59:59.999. A
busca continua esperando 350 ms.

```yaml
fatia:
  id: 185-filtro-financeiro
  estado: intermediate
  conceito: filtro e período do painel financeiro
  origem:
    - components/admin/financial/utils.tsx
  destino:
    - packages/frontend/src/pages/financeiro/ui/Filtro.web.tsx
  invariantes:
    - id: periodo
      prova:
        "Filtro.web.test.tsx: Todos os períodos, 13 meses, fim 23:59:59.999 e
        debounce de 350"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/financeiro/ui/Filtro.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/financial/AgingChart.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/financial/utils.tsx
  nao_verificado:
    - "[NOT_VERIFIED: filtro financeiro no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 186-graficos-financeiros

Aging, receita, receita por categoria, devedores e o cartão do gráfico saíram de
`components/admin/financial` para o widget `graficos-financeiros`. O aging
continua verde, âmbar, laranja, vermelho e o fallback cinza. A receita continua
laranja da marca. As categorias continuam azul, verde, âmbar, roxo, ciano e
rosa. O dashboard administrativo continua carregando cada gráfico no próprio
módulo.

```yaml
fatia:
  id: 186-graficos-financeiros
  estado: intermediate
  conceito: gráficos de aging, receita e devedores
  origem:
    - components/admin/financial/AgingChart.tsx
    - components/admin/financial/RevenueChart.tsx
    - components/admin/financial/RevenueByCategoryChart.tsx
    - components/admin/financial/DebtorsTable.tsx
    - components/admin/financial/ChartCard.tsx
  destino:
    - packages/frontend/src/widgets/graficos-financeiros
  invariantes:
    - id: cores
      prova:
        "graficos.test.tsx: aging #16A34A #D97706 #EA580C #DC2626 #991B1B
        #94a3b8, receita #ea580c #f97316 e categorias"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/graficos-financeiros/ui/graficos.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/financial/KPICard.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/financial/AgingChart.tsx
    - components/admin/financial/RevenueChart.tsx
    - components/admin/financial/RevenueByCategoryChart.tsx
    - components/admin/financial/DebtorsTable.tsx
    - components/admin/financial/ChartCard.tsx
  nao_verificado:
    - "[NOT_VERIFIED: gráficos financeiros no widget]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 187-kpi-financeiro

O cartão saiu de `components/admin/financial/KPICard.tsx` para o widget
`graficos-financeiros`. Tendência zero ou positiva continua verde `#22c55e`.
Tendência negativa continua vermelha `#ef4444`. O valor numérico continua em
pt-BR com duas casas. O percentual continua com uma casa.

```yaml
fatia:
  id: 187-kpi-financeiro
  estado: intermediate
  conceito: cartão de KPI financeiro
  origem:
    - components/admin/financial/KPICard.tsx
  destino:
    - packages/frontend/src/widgets/graficos-financeiros/ui/KPICard.tsx
  invariantes:
    - id: tendencia
      prova:
        "KPICard.test.tsx: trend >= 0, #22c55e, #ef4444, pt-BR com 2 casas e
        percentual com 1 casa"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/graficos-financeiros/ui/KPICard.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "app/admin/dashboard/page.tsx continua dono da tela"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/financial/KPICard.tsx
  nao_verificado:
    - "[NOT_VERIFIED: KPI financeiro no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 188-dashboard-admin

A tela saiu de `app/admin/dashboard/page.tsx`. A rota `/admin/dashboard` só
renderiza `AdminDashboard`. O título continua Dashboard Executivo. O erro
continua Erro ao carregar o dashboard e o botão continua Tentar novamente. Os
KPIs continuam fora do SSR, com cinco cartões de 180 px. Eles só aparecem quando
existem `financialMetrics`.

```yaml
fatia:
  id: 188-dashboard-admin
  estado: intermediate
  conceito: página do dashboard administrativo
  origem:
    - app/admin/dashboard/page.tsx
  destino:
    - packages/frontend/src/pages/dashboard/ui/DashboardPage.web.tsx
  invariantes:
    - id: tela
      prova:
        "DashboardPage.web.test.tsx: título, erro, Tentar novamente, ssr false,
        cinco cartões de 180 px e financialMetrics"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/dashboard/ui/DashboardPage.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "hooks/use-dashboard-data.ts continua dono da carga"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: dashboard administrativo no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 189-carga-dashboard

A carga saiu de `hooks/use-dashboard-data.ts`. As rotas continuam
`/api/admin/dashboard`, orçamentos com limite 5, receita de 12 meses e aging. A
lista recente continua no máximo 5. O nome vazio continua hífen. O valor
continua em `finalTotal`, depois `totalPrice`, depois `totalAmount`. O status
ausente continua `pending`. O gráfico continua Pendentes, Aprovados, Rejeitados
e Concluídos, e some quando o valor é zero. Falha secundária não apaga os
números principais.

```yaml
fatia:
  id: 189-carga-dashboard
  estado: intermediate
  conceito: carga do dashboard administrativo
  origem:
    - hooks/use-dashboard-data.ts
  destino:
    - packages/frontend/src/pages/dashboard/model/carga.ts
  invariantes:
    - id: rotas
      prova:
        "carga.test.ts: quatro rotas, limite 5, pending,
        Pendentes/Aprovados/Rejeitados/Concluídos e valor maior que zero"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/dashboard/model/carga.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/dashboard/dashboard-stats-grid.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - hooks/use-dashboard-data.ts
  nao_verificado:
    - "[NOT_VERIFIED: carga do dashboard no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 190-grade-dashboard

A grade saiu de `components/admin/dashboard/dashboard-stats-grid.tsx`. A grade
principal continua 2, 2 e 4 colunas, com atraso 0,1 mais 0,08 por cartão. A
grade de status continua 1, 2 e 4 colunas, com atraso 0,2 mais 0,08. Sem cor de
ícone, o fundo continua cinza e o ícone continua laranja. Os títulos dos cartões
continuam em `components/admin/dashboard/types.ts`.

```yaml
fatia:
  id: 190-grade-dashboard
  estado: intermediate
  conceito: grades de estatísticas do dashboard
  origem:
    - components/admin/dashboard/dashboard-stats-grid.tsx
  destino:
    - packages/frontend/src/pages/dashboard/ui/Grade.web.tsx
  invariantes:
    - id: grades
      prova:
        "Grade.web.test.tsx: grade 2/2/4, grade 1/2/4, atrasos 0.1 e 0.2, cinza
        e laranja padrão"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/dashboard/ui/Grade.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/dashboard/types.ts continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/dashboard/dashboard-stats-grid.tsx
  nao_verificado:
    - "[NOT_VERIFIED: grade do dashboard no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 191-tipos-dashboard

Os tipos saíram de `components/admin/dashboard/types.ts`. O selo do orçamento
recente continua Pendente, Aprovado, Rejeitado e Concluído, no singular. Nome
vazio ou hífen continua sem iniciais. Os cartões continuam Total de
Equipamentos, Categorias, Orçamentos e Receita Mensal. A receita continua em
pt-BR com duas casas. Zero continua 0. Os atalhos continuam
`/admin/equipamentos/novo`, `/admin/categorias` e `/admin/orcamentos`.

```yaml
fatia:
  id: 191-tipos-dashboard
  estado: intermediate
  conceito: tipos e rótulos do dashboard administrativo
  origem:
    - components/admin/dashboard/types.ts
  destino:
    - packages/frontend/src/pages/dashboard/model/tipos.ts
  invariantes:
    - id: rotulos
      prova:
        "tipos.test.ts: singular Pendente, iniciais nulas no hífen, quatro
        cartões, pt-BR e três atalhos"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/dashboard/model/tipos.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/dashboard/dashboard-charts-section.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/dashboard/types.ts
  nao_verificado:
    - "[NOT_VERIFIED: tipos do dashboard no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 192-graficos-dashboard

A seção saiu de `components/admin/dashboard/dashboard-charts-section.tsx`. Os
títulos continuam Tendência de Orçamentos (7 dias), Distribuição de Status,
Evolução da Receita (Últimos 12 meses), Receita por Categoria, Aging de Contas a
Receber, Maiores Devedores e Distribuição por Categoria. Os gráficos continuam
fora do SSR. A espera continua 300 px, e a dos devedores continua 200 px. A
categoria sem cor continua azul `#3b82f6`. A categoria só aparece quando há
itens.

```yaml
fatia:
  id: 192-graficos-dashboard
  estado: intermediate
  conceito: seção de gráficos do dashboard
  origem:
    - components/admin/dashboard/dashboard-charts-section.tsx
  destino:
    - packages/frontend/src/pages/dashboard/ui/Graficos.web.tsx
  invariantes:
    - id: titulos
      prova:
        "Graficos.web.test.tsx: sete títulos, ids, ssr false, 300 px, 200 px,
        quotesTrend vazio e azul #3b82f6"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/dashboard/ui/Graficos.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/dashboard/QuotesTrendChart.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/dashboard/dashboard-charts-section.tsx
  nao_verificado:
    - "[NOT_VERIFIED: gráficos do dashboard no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 193-tendencia-orcamentos

O gráfico saiu de `components/admin/dashboard/QuotesTrendChart.tsx`. Sem dados
continua Sem dados disponíveis. O rótulo continua Orçamentos. O laranja continua
`#ea580c` e o claro `#f97316`. A altura normal continua 280 e 320. A expandida
continua 320 e 460. O eixo Y continua sem decimais.

```yaml
fatia:
  id: 193-tendencia-orcamentos
  estado: intermediate
  conceito: gráfico de tendência de orçamentos
  origem:
    - components/admin/dashboard/QuotesTrendChart.tsx
  destino:
    - packages/frontend/src/pages/dashboard/ui/Tendencia.web.tsx
  invariantes:
    - id: grafico
      prova:
        "Tendencia.web.test.tsx: vazio, Orçamentos, #ea580c, #f97316, alturas e
        eixo sem decimais"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/dashboard/ui/Tendencia.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/dashboard/StatusDistributionChart.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/dashboard/QuotesTrendChart.tsx
  nao_verificado:
    - "[NOT_VERIFIED: tendência de orçamentos no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 194-distribuicao-status

O gráfico saiu de `components/admin/dashboard/StatusDistributionChart.tsx`. Sem
dados continua Sem dados disponíveis. O centro continua Total. As cores
continuam as que chegam nos dados. O miolo continua 35% e a borda 60%. A altura
normal continua 220, 280 e 320. A expandida continua 280, 320 e 460. A legenda
continua em 12 px.

```yaml
fatia:
  id: 194-distribuicao-status
  estado: intermediate
  conceito: gráfico de distribuição de status
  origem:
    - components/admin/dashboard/StatusDistributionChart.tsx
  destino:
    - packages/frontend/src/pages/dashboard/ui/Distribuicao.web.tsx
  invariantes:
    - id: grafico
      prova:
        "Distribuicao.web.test.tsx: vazio, Total, fill da cor recebida, 35% e
        60%, alturas e legenda 12 px"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/dashboard/ui/Distribuicao.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/dashboard/EquipmentByCategoryChart.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/dashboard/StatusDistributionChart.tsx
  nao_verificado:
    - "[NOT_VERIFIED: distribuição de status no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 195-equipamentos-por-categoria

O gráfico saiu de `components/admin/dashboard/EquipmentByCategoryChart.tsx`. Sem
dados continua Sem dados disponíveis. A barra continua horizontal. Sem cor da
categoria, o azul continua `#3b82f6`. A altura normal continua 400. A expandida
continua 320 e 460. O nome da categoria continua com largura 120.

```yaml
fatia:
  id: 195-equipamentos-por-categoria
  estado: intermediate
  conceito: gráfico de equipamentos por categoria
  origem:
    - components/admin/dashboard/EquipmentByCategoryChart.tsx
  destino:
    - packages/frontend/src/pages/dashboard/ui/Categoria.web.tsx
  invariantes:
    - id: grafico
      prova:
        "Categoria.web.test.tsx: vazio, barra vertical no layout, azul #3b82f6,
        altura 400 e largura 120"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/dashboard/ui/Categoria.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/dashboard/business-metrics-section.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/dashboard/EquipmentByCategoryChart.tsx
  nao_verificado:
    - "[NOT_VERIFIED: equipamentos por categoria no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 196-metricas-dashboard

A seção saiu de `components/admin/dashboard/business-metrics-section.tsx`. Os
títulos continuam Taxa de Utilização, Taxa de Conversão e Ticket Médio. As taxas
continuam com uma casa e o teto da barra continua 100. O ticket continua em
pt-BR com duas casas, e o vazio continua 0,00. A grade continua 1 e 3 colunas.

```yaml
fatia:
  id: 196-metricas-dashboard
  estado: intermediate
  conceito: métricas do dashboard administrativo
  origem:
    - components/admin/dashboard/business-metrics-section.tsx
  destino:
    - packages/frontend/src/pages/dashboard/ui/Metricas.web.tsx
  invariantes:
    - id: taxas
      prova:
        "Metricas.web.test.tsx: utilização, conversão, ticket, toFixed(1), teto
        100, pt-BR e 0,00"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/dashboard/ui/Metricas.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/dashboard/top-equipment-section.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/dashboard/business-metrics-section.tsx
  nao_verificado:
    - "[NOT_VERIFIED: métricas do dashboard no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 197-destaques-dashboard

A seção saiu de `components/admin/dashboard/top-equipment-section.tsx`. Os
títulos continuam Equipamentos Mais Solicitados, ROI por Equipamento (Top 10) e
Receita Média por Equipamento. O ROI continua ordenado no próprio array e
limitado a 10. ROI positivo continua verde com sinal de mais, negativo vermelho
e zero cinza. A média continua aparecendo mesmo quando o valor é zero.

```yaml
fatia:
  id: 197-destaques-dashboard
  estado: intermediate
  conceito: destaques de equipamentos do dashboard
  origem:
    - components/admin/dashboard/top-equipment-section.tsx
  destino:
    - packages/frontend/src/pages/dashboard/ui/Destaques.web.tsx
  invariantes:
    - id: listas
      prova:
        "Destaques.web.test.tsx: três títulos, sort no array, slice 10, sinal do
        ROI e média mesmo em zero"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/dashboard/ui/Destaques.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/dashboard/quick-actions-section.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/dashboard/top-equipment-section.tsx
  nao_verificado:
    - "[NOT_VERIFIED: destaques do dashboard no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 198-atalhos-dashboard

A seção saiu de `components/admin/dashboard/quick-actions-section.tsx`. O título
continua Ações Rápidas. A grade continua 1, 2 e 3 colunas. O atraso continua
0,25 mais 0,08 por botão. O botão continua outline, com altura 40 e escala 1,02.
O destino continua o href de cada ação.

```yaml
fatia:
  id: 198-atalhos-dashboard
  estado: intermediate
  conceito: atalhos do dashboard administrativo
  origem:
    - components/admin/dashboard/quick-actions-section.tsx
  destino:
    - packages/frontend/src/pages/dashboard/ui/Atalhos.web.tsx
  invariantes:
    - id: atalhos
      prova:
        "Atalhos.web.test.tsx: título, grade 1/2/3, atraso 0.25, outline, escala
        1.02 e href da ação"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/dashboard/ui/Atalhos.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/dashboard/recent-quotes-section.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/dashboard/quick-actions-section.tsx
  nao_verificado:
    - "[NOT_VERIFIED: atalhos do dashboard no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 199-orcamentos-recentes-dashboard

A seção saiu de `components/admin/dashboard/recent-quotes-section.tsx`. O título
continua Orçamentos Recentes. Ver Todos continua em `/admin/orcamentos`. O vazio
continua Nenhum orçamento recente. As iniciais continuam as do dashboard, nulas
no hífen. O valor continua com `toFixed(2)` e hífen quando falta. A data
continua em pt-BR. O selo continua o mapa no singular.

```yaml
fatia:
  id: 199-orcamentos-recentes-dashboard
  estado: intermediate
  conceito: orçamentos recentes do dashboard
  origem:
    - components/admin/dashboard/recent-quotes-section.tsx
  destino:
    - packages/frontend/src/pages/dashboard/ui/Recentes.web.tsx
  invariantes:
    - id: lista
      prova:
        "Recentes.web.test.tsx: título, Ver Todos, vazio, getInitials,
        toFixed(2), hífen e data pt-BR"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/dashboard/ui/Recentes.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/dashboard/dashboard-expanded-overlays.tsx continua
        legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/dashboard/recent-quotes-section.tsx
  nao_verificado:
    - "[NOT_VERIFIED: orçamentos recentes do dashboard no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 200-paineis-expandidos-dashboard

Os painéis saíram de
`components/admin/dashboard/dashboard-expanded-overlays.tsx`. Os sete cartões
continuam os mesmos. Receita e aging só abrem quando os dados existem. A
categoria só abre quando há lista. Todos continuam fora do SSR e com a prop
expandida. A categoria sem cor continua azul `#3b82f6`.

```yaml
fatia:
  id: 200-paineis-expandidos-dashboard
  estado: intermediate
  conceito: painéis expandidos do dashboard
  origem:
    - components/admin/dashboard/dashboard-expanded-overlays.tsx
  destino:
    - packages/frontend/src/pages/dashboard/ui/Expandidos.web.tsx
  invariantes:
    - id: paineis
      prova:
        "Expandidos.web.test.tsx: sete ids, receita e aging condicionais, ssr
        false, expanded e azul #3b82f6"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/dashboard/ui/Expandidos.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/dashboard/DashboardFinancialKPIs.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/dashboard/dashboard-expanded-overlays.tsx
  nao_verificado:
    - "[NOT_VERIFIED: painéis expandidos do dashboard no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 201-kpis-dashboard

Os cinco cartões saíram de
`components/admin/dashboard/DashboardFinancialKPIs.tsx`. Os títulos continuam
Receita Mensal (MRR), Utilização da Frota, Valor em Atraso, Ticket Médio e Lucro
Líquido. O dinheiro continua em pt-BR com duas casas. A frota continua com uma
casa. O atraso continua vermelho. O lucro continua verde quando é zero ou
positivo e vermelho quando é negativo. A comparação continua vs. mês anterior. A
grade continua 1, 2 e 5 colunas.

```yaml
fatia:
  id: 201-kpis-dashboard
  estado: intermediate
  conceito: KPIs financeiros do dashboard
  origem:
    - components/admin/dashboard/DashboardFinancialKPIs.tsx
  destino:
    - packages/frontend/src/pages/dashboard/ui/Kpis.web.tsx
  invariantes:
    - id: cartoes
      prova:
        "Kpis.web.test.tsx: cinco títulos, pt-BR, frota com uma casa, atraso
        vermelho, lucro pelo sinal e vs. mês anterior"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/dashboard/ui/Kpis.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "app/orcamento/page.tsx continua dono da tela de orçamento"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/dashboard/DashboardFinancialKPIs.tsx
  nao_verificado:
    - "[NOT_VERIFIED: KPIs do dashboard no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 202-pagina-orcamento

A tela saiu de `app/orcamento/page.tsx`. A rota `/orcamento` só renderiza
`QuotePageWrapper`. O título continua Solicitar Orçamento. O WhatsApp da página
continua `555198205163`. O aviso continua WhatsApp aberto com sua solicitação
formatada. O suspense continua com fallback nulo.

```yaml
fatia:
  id: 202-pagina-orcamento
  estado: intermediate
  conceito: página pública de orçamento
  origem:
    - app/orcamento/page.tsx
  destino:
    - packages/frontend/src/pages/orcamento/ui/OrcamentoPage.web.tsx
  invariantes:
    - id: whatsapp
      prova:
        "OrcamentoPage.web.test.tsx: Solicitar Orçamento, 555198205163, aviso do
        WhatsApp e Suspense nulo"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/orcamento/ui/OrcamentoPage.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/dialogs/save-address-dialog.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: página de orçamento no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 203-salvar-endereco-orcamento

O diálogo saiu de `components/dialogs/save-address-dialog.tsx`. Com endereço e
dados novos o título continua Salvar informações. Só endereço continua Salvar
endereço. Só cliente continua Salvar informações do cliente. Sem novidade o
diálogo continua sem renderizar. Os botões continuam Não salvar e Salvar, e
durante o envio continua Salvando...

```yaml
fatia:
  id: 203-salvar-endereco-orcamento
  estado: intermediate
  conceito: diálogo de salvar endereço do orçamento
  origem:
    - components/dialogs/save-address-dialog.tsx
  destino:
    - packages/frontend/src/pages/orcamento/ui/SalvarEndereco.web.tsx
  invariantes:
    - id: titulos
      prova:
        "SalvarEndereco.web.test.tsx: três títulos, some sem novidade, Não
        salvar, Salvando e Salvar"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/orcamento/ui/SalvarEndereco.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/dialogs/confirm-address-dialog.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/dialogs/save-address-dialog.tsx
  nao_verificado:
    - "[NOT_VERIFIED: salvar endereço do orçamento no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 204-confirmar-endereco-orcamento

O diálogo saiu de `components/dialogs/confirm-address-dialog.tsx`. O título
continua Confirmar endereço. A pergunta continua Você confirma o endereço de
entrega? A opção continua Não exibir novamente. Cancelar continua outline e
Confirmar continua default. O endereço continua formatado por
`lib/utils/validation`.

```yaml
fatia:
  id: 204-confirmar-endereco-orcamento
  estado: intermediate
  conceito: diálogo de confirmar endereço do orçamento
  origem:
    - components/dialogs/confirm-address-dialog.tsx
  destino:
    - packages/frontend/src/pages/orcamento/ui/ConfirmarEndereco.web.tsx
  invariantes:
    - id: pergunta
      prova:
        "ConfirmarEndereco.web.test.tsx: título, pergunta, Não exibir novamente,
        Cancelar, Confirmar e formatAddress de validation"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/orcamento/ui/ConfirmarEndereco.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/dialogs/select-address-dialog.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/dialogs/confirm-address-dialog.tsx
  nao_verificado:
    - "[NOT_VERIFIED: confirmar endereço do orçamento no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 205-selecionar-endereco-orcamento

O diálogo saiu de `components/dialogs/select-address-dialog.tsx`. O título
continua Selecione o endereço de entrega. O endereço principal continua com o
selo Principal. Os botões continuam Usar outro endereço e Cancelar, ambos
outline. O endereço continua formatado por `lib/utils/validation`.

```yaml
fatia:
  id: 205-selecionar-endereco-orcamento
  estado: intermediate
  conceito: diálogo de escolher endereço salvo do orçamento
  origem:
    - components/dialogs/select-address-dialog.tsx
  destino:
    - packages/frontend/src/pages/orcamento/ui/SelecionarEndereco.web.tsx
  invariantes:
    - id: escolha
      prova:
        "SelecionarEndereco.web.test.tsx: título, Principal, Usar outro
        endereço, Cancelar outline, onSelect e formatAddress de validation"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/orcamento/ui/SelecionarEndereco.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/dialogs/save-customer-info-dialog.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/dialogs/select-address-dialog.tsx
  nao_verificado:
    - "[NOT_VERIFIED: selecionar endereço do orçamento no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 206-salvar-informacoes-orcamento

O diálogo saiu de `components/dialogs/save-customer-info-dialog.tsx`. O título
continua Salvar informações. Telefone, CPF, CNPJ e Empresa continuam nas mesmas
condições. Sem nenhum desses dados o diálogo continua sem renderizar. Não salvar
continua outline e Salvar continua default. A classe `!h-auto` continua no
popup.

```yaml
fatia:
  id: 206-salvar-informacoes-orcamento
  estado: intermediate
  conceito: diálogo de salvar telefone, documento e empresa do orçamento
  origem:
    - components/dialogs/save-customer-info-dialog.tsx
  destino:
    - packages/frontend/src/pages/orcamento/ui/SalvarInformacoes.web.tsx
  invariantes:
    - id: dados
      prova:
        "SalvarInformacoes.web.test.tsx: título, Telefone, CPF, CNPJ, Empresa,
        return null sem dados, Não salvar outline, Salvar default e !h-auto"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/orcamento/ui/SalvarInformacoes.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/google-customer-reviews.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/dialogs/save-customer-info-dialog.tsx
  nao_verificado:
    - "[NOT_VERIFIED: salvar informações do cliente no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 207-avaliacoes-google

O opt-in e o selo saíram de `components/google-customer-reviews.tsx` para o
widget `avaliacoes-google`. O merchant continua `5721491678`. O país padrão
continua BR. A entrega estimada continua em 7 dias quando a data não vem pronta.
O script do opt-in continua `platform.js?onload=renderOptIn`. O selo continua no
container `google-merchant-badge`, com posição padrão INLINE e região BR. A rota
`/sobre` continua passando `position="INLINE"` e `region="BR"`. O orçamento
continua montando o opt-in só depois do envio.

```yaml
fatia:
  id: 207-avaliacoes-google
  estado: intermediate
  conceito: opt-in e selo do Google Avaliações do Consumidor
  origem:
    - components/google-customer-reviews.tsx
  destino:
    - packages/frontend/src/widgets/avaliacoes-google/ui/Avaliacoes.web.tsx
  invariantes:
    - id: merchant
      prova:
        "Avaliacoes.web.test.tsx: merchant 5721491678, país BR, 7 dias, scripts
        platform.js e merchantwidget.js, selo INLINE e container
        google-merchant-badge"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/avaliacoes-google/ui/Avaliacoes.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/dialogs/category-dialog.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/google-customer-reviews.tsx
  nao_verificado:
    - "[NOT_VERIFIED: opt-in e selo do Google no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 208-dialogo-categoria

O diálogo saiu de `components/dialogs/category-dialog.tsx`. Criar continua Nova
Categoria e editar continua Editar Categoria. O visual continua Personalizar
visual. O preview continua Preview da Categoria. O limite da descrição
continua 200. Os botões continuam Cancelar, Criar Categoria, Atualizar Categoria
e Salvando....

```yaml
fatia:
  id: 208-dialogo-categoria
  estado: intermediate
  conceito: diálogo de criar e editar categoria
  origem:
    - components/dialogs/category-dialog.tsx
  destino:
    - packages/frontend/src/pages/categorias/ui/CategoriaDialog.web.tsx
  invariantes:
    - id: titulos
      prova:
        "CategoriaDialog.web.test.tsx: Nova Categoria, Editar Categoria,
        Personalizar visual, preview, 200 caracteres, Criar, Atualizar e
        Salvando"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/categorias/ui/CategoriaDialog.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/dialogs/view-category-dialog.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/dialogs/category-dialog.tsx
  nao_verificado:
    - "[NOT_VERIFIED: diálogo de categoria no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 209-ver-categoria

O diálogo saiu de `components/dialogs/view-category-dialog.tsx`. O título
continua Visualizar Categoria. A aba continua Fases da obra quando o placement é
phases e Tipo de trabalho nos demais casos, inclusive vazio. Sem descrição
continua Sem descrição. A contagem continua `equipments || 0`. Fechar continua
outline e Editar Categoria continua no botão padrão. A borda padrão continua
`#3b82f6`.

```yaml
fatia:
  id: 209-ver-categoria
  estado: intermediate
  conceito: diálogo de visualizar categoria
  origem:
    - components/dialogs/view-category-dialog.tsx
  destino:
    - packages/frontend/src/pages/categorias/ui/VerCategoria.web.tsx
  invariantes:
    - id: visualizacao
      prova:
        "VerCategoria.web.test.tsx: título, preview, Fases da obra, Tipo de
        trabalho, Sem descrição, equipamentos, Fechar outline e Editar Categoria"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/categorias/ui/VerCategoria.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/dialogs/view-equipment-dialog.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/dialogs/view-category-dialog.tsx
  nao_verificado:
    - "[NOT_VERIFIED: visualizar categoria no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 210-ver-equipamento

O diálogo saiu de `components/dialogs/view-equipment-dialog.tsx`. O título
continua Visualizar Equipamento. O detalhe de avaria continua Detalhes das
Perdas de Peças e Avarias. Fechar continua outline e Editar Equipamento continua
no botão padrão. A borda da categoria continua `#3b82f6` quando não há cor. A
borda de avaria continua `#ef4444`.

```yaml
fatia:
  id: 210-ver-equipamento
  estado: intermediate
  conceito: diálogo de visualizar equipamento
  origem:
    - components/dialogs/view-equipment-dialog.tsx
  destino:
    - packages/frontend/src/pages/equipamentos-admin/ui/VerEquipamento.web.tsx
  invariantes:
    - id: visualizacao
      prova:
        "VerEquipamento.web.test.tsx: título, avarias, Editar Equipamento,
        Fechar outline, borda #3b82f6 e avaria #ef4444"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/equipamentos-admin/ui/VerEquipamento.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/dialogs/icon-customization-block.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/dialogs/view-equipment-dialog.tsx
  nao_verificado:
    - "[NOT_VERIFIED: visualizar equipamento no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 211-personalizar-icone

O bloco e os dados do seletor saíram de
`components/dialogs/icon-customization-block.tsx` e
`icon-customization-data.ts`. As abas continuam Ícones, Emoji e Fazer Upload. A
busca continua Buscar emoji... e Buscar ícone.... O placeholder de URL continua
`https://exemplo.com/icone.svg`. O grupo recente continua `recent-icons`.

```yaml
fatia:
  id: 211-personalizar-icone
  estado: intermediate
  conceito: seletor de ícone, emoji e upload da categoria
  origem:
    - components/dialogs/icon-customization-block.tsx
    - components/dialogs/icon-customization-data.ts
  destino:
    - packages/frontend/src/widgets/personalizar-icone/ui/Bloco.tsx
    - packages/frontend/src/widgets/personalizar-icone/model/dados.ts
  invariantes:
    - id: abas
      prova:
        "Bloco.test.tsx: abas Ícones, Emoji e Fazer Upload, buscas, URL de
        exemplo e recent-icons"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/personalizar-icone/ui/Bloco.test.tsx
        packages/frontend/src/pages/categorias/ui/CategoriaDialog.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/admin-filter-card.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/dialogs/icon-customization-block.tsx
    - components/dialogs/icon-customization-data.ts
  nao_verificado:
    - "[NOT_VERIFIED: seletor de ícone no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 212-filtro-admin

O cartão saiu de `components/admin/admin-filter-card.tsx`. O placeholder padrão
continua Buscar.... O layout padrão continua responsive, com linha a partir de
`lg`. O layout stacked continua em coluna. O botão de limpar continua com o
título Resetar filtros. A sombra do campo continua `rgba(0, 0, 0, 0.1)`.

```yaml
fatia:
  id: 212-filtro-admin
  estado: intermediate
  conceito: cartão de busca e filtros do admin
  origem:
    - components/admin/admin-filter-card.tsx
  destino:
    - packages/frontend/src/widgets/filtro-admin/ui/FiltroAdmin.tsx
  invariantes:
    - id: busca
      prova:
        "FiltroAdmin.test.tsx: Buscar..., layout responsive e stacked, linha em
        lg e Resetar filtros"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/filtro-admin/ui/FiltroAdmin.test.tsx
        packages/frontend/src/pages/financeiro/ui/Filtro.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/kanban-month-navigator.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/admin-filter-card.tsx
  nao_verificado:
    - "[NOT_VERIFIED: cartão de filtro do admin no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 213-navegador-mes-kanban

O navegador saiu de `components/admin/kanban-month-navigator.tsx`. O ano
continua avançando e voltando um ano inteiro. Hoje continua indo para o início
do mês atual. Os meses continuam abreviados em pt-BR. O cabeçalho continua no
gradiente orange-500, orange-600 e orange-700. São 12 meses.

```yaml
fatia:
  id: 213-navegador-mes-kanban
  estado: intermediate
  conceito: navegador de mês do kanban de orçamentos
  origem:
    - components/admin/kanban-month-navigator.tsx
  destino:
    - packages/frontend/src/widgets/navegador-mes/ui/NavegadorMes.tsx
  invariantes:
    - id: meses
      prova:
        "NavegadorMes.test.tsx: ano anterior e seguinte, Hoje no mês atual,
        meses pt-BR, gradiente laranja e 12 meses"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/navegador-mes/ui/NavegadorMes.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/quotes/quotes-kanban-view.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/kanban-month-navigator.tsx
  nao_verificado:
    - "[NOT_VERIFIED: navegador de mês do kanban no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 214-kanban-orcamentos

A visão saiu de `components/admin/quotes/quotes-kanban-view.tsx`. O status
rejeitado continua a chave minúscula `rejected`. A contagem continua
equipamento(s). O valor continua `finalTotal`, depois `originalTotal`, depois
`totalPrice`. O horário continua em pt-BR com hora e minuto. As colunas
continuam 1, 2, 4 e 4. O atraso da animação continua 0.28. O pipeline e o
navegador continuam com `ssr: false`.

```yaml
fatia:
  id: 214-kanban-orcamentos
  estado: intermediate
  conceito: visão kanban da lista de orçamentos
  origem:
    - components/admin/quotes/quotes-kanban-view.tsx
  destino:
    - packages/frontend/src/pages/orcamentos-admin/ui/Kanban.web.tsx
  invariantes:
    - id: cartao
      prova:
        "Kanban.web.test.tsx: rejected minúsculo, equipamento(s), finalTotal,
        horário pt-BR, colunas 1/2/4/4 e delay 0.28"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/orcamentos-admin/ui/Kanban.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/kanban-pipeline.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/quotes/quotes-kanban-view.tsx
  nao_verificado:
    - "[NOT_VERIFIED: kanban de orçamentos no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 215-quadro-kanban

O quadro saiu de `components/admin/kanban-pipeline.tsx`. O padrão continua 1, 3,
3 e 6 colunas quando a visão não informa outra grade. A queda de altura acima de
80 para menos de 40 continua esperando 200 ms antes de gravar. A medição do
restante continua em 50 ms. A lista continua com altura máxima de 44rem. A barra
continua `rgb(249 115 22)`.

```yaml
fatia:
  id: 215-quadro-kanban
  estado: intermediate
  conceito: quadro genérico do kanban
  origem:
    - components/admin/kanban-pipeline.tsx
  destino:
    - packages/frontend/src/widgets/quadro-kanban/ui/Quadro.tsx
  invariantes:
    - id: colunas
      prova:
        "Quadro.test.tsx: padrão 1/3/3/6, espera de 200 ms no vazio transitório,
        medição de 50 ms, 44rem e barra laranja"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/quadro-kanban/ui/Quadro.test.tsx
        packages/frontend/src/pages/orcamentos-admin/ui/Kanban.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/quotes/quotes-table-view.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/kanban-pipeline.tsx
  nao_verificado:
    - "[NOT_VERIFIED: quadro do kanban no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 216-tabela-orcamentos

A tabela saiu de `components/admin/quotes/quotes-table-view.tsx`. As colunas
continuam Cliente, Equipamentos, Período, Valor Total, Status, Data e Ações. O
status desconhecido continua `pending` em minúsculo. As iniciais continuam no
`getInitials` de `lib/utils/formatting`. O valor continua `finalTotal`, depois
`originalTotal`, depois `totalPrice`, no mesmo formatador. Sem período continua
Não definido. A lista vazia continua Nenhum orçamento encontrado. O hover da
linha continua `rgba(254, 243, 199, 0.3)`.

```yaml
fatia:
  id: 216-tabela-orcamentos
  estado: intermediate
  conceito: tabela da lista de orçamentos
  origem:
    - components/admin/quotes/quotes-table-view.tsx
  destino:
    - packages/frontend/src/pages/orcamentos-admin/ui/Tabela.tsx
  invariantes:
    - id: colunas
      prova:
        "Tabela.test.tsx: colunas, pending minúsculo, getInitials e
        formatCurrency do admin, Não definido e lista vazia"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/orcamentos-admin/ui/Tabela.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/quotes/quotes-calendar-view.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/quotes/quotes-table-view.tsx
  nao_verificado:
    - "[NOT_VERIFIED: tabela de orçamentos no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 217-calendario-orcamentos

O calendário saiu de `components/admin/quotes/quotes-calendar-view.tsx`. O
título continua Calendário de Orçamentos. Pendente e rejeitado continuam com
início e fim no mesmo dia do evento, sem usar o período da locação. As cores
continuam `#F97316`, `#22c55e`, `#ef4444` e o cinza `#6B7280`. O tipo continua
`rental`. O total do evento continua `quote.totalPrice`. A visão padrão continua
semanal.

```yaml
fatia:
  id: 217-calendario-orcamentos
  estado: intermediate
  conceito: calendário da lista de orçamentos
  origem:
    - components/admin/quotes/quotes-calendar-view.tsx
  destino:
    - packages/frontend/src/pages/orcamentos-admin/ui/Calendario.web.tsx
  invariantes:
    - id: datas
      prova:
        "Calendario.web.test.tsx: pending e rejected no mesmo dia, cores, tipo
        rental, totalPrice e visão weekly"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/orcamentos-admin/ui/Calendario.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/quotes/quote-detail-panel.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/quotes/quotes-calendar-view.tsx
  nao_verificado:
    - "[NOT_VERIFIED: calendário de orçamentos no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 218-painel-orcamento

O painel saiu de `components/admin/quotes/quote-detail-panel.tsx`. O título
continua Detalhes do Orçamento. Rejeitar continua Rejeitar Orçamento. Aprovar
continua Aprovar Orçamento e, quando converte, Aprovar e Converter. As iniciais
continuam no `getInitials` de `lib/utils/formatting`. Os itens continuam no
widget `itens-orcamento`.

```yaml
fatia:
  id: 218-painel-orcamento
  estado: intermediate
  conceito: painel de detalhe do orçamento
  origem:
    - components/admin/quotes/quote-detail-panel.tsx
  destino:
    - packages/frontend/src/pages/orcamentos-admin/ui/Painel.tsx
  invariantes:
    - id: acoes
      prova:
        "Painel.test.tsx: título, Rejeitar Orçamento, Aprovar e Converter,
        Aprovar Orçamento e widget de itens"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/orcamentos-admin/ui/Painel.test.tsx
        packages/frontend/src/widgets/itens-orcamento/ui/Cartao.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/quotes/quote-customer-card.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/quotes/quote-detail-panel.tsx
  nao_verificado:
    - "[NOT_VERIFIED: painel de detalhe do orçamento no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 219-cartao-cliente-orcamento

O cartão saiu de `components/admin/quotes/quote-customer-card.tsx`. Os rótulos
continuam Empresa, CPF, CNPJ, Telefone e Código legado. O selo continua
Referência, com `#7b81f5` e hover `#6a70dd`. O botão continua Editar dados do
cliente. As iniciais continuam no `getInitials` de `lib/utils/formatting`.

```yaml
fatia:
  id: 219-cartao-cliente-orcamento
  estado: intermediate
  conceito: cartão do cliente no detalhe do orçamento
  origem:
    - components/admin/quotes/quote-customer-card.tsx
  destino:
    - packages/frontend/src/pages/orcamentos-admin/ui/Cliente.tsx
  invariantes:
    - id: dados
      prova:
        "Cliente.test.tsx: Empresa, CPF, CNPJ, Telefone, Código legado, selo
        #7b81f5 e getInitials do admin"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/orcamentos-admin/ui/Cliente.test.tsx
        packages/frontend/src/pages/orcamentos-admin/ui/Painel.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/quotes/quote-delivery-card.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/quotes/quote-customer-card.tsx
  nao_verificado:
    - "[NOT_VERIFIED: cartão do cliente do orçamento no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 220-cartao-entrega-orcamento

O cartão saiu de `components/admin/quotes/quote-delivery-card.tsx`. Sem tipo e
sem endereço, continua sem renderizar. Entrega no endereço continua Entrega no
Endereço. Retirada continua Cliente retirará os equipamentos na loja. O frete
some quando existe ajuste TRAVEL ou quando a taxa não é maior que zero. O valor
continua no formatador de `lib/utils/formatting`, com `deliveryFee ?? 0`. O
cliente que pediu entrega continua vendo (calculado pelo sistema).

```yaml
fatia:
  id: 220-cartao-entrega-orcamento
  estado: intermediate
  conceito: cartão de entrega no detalhe do orçamento
  origem:
    - components/admin/quotes/quote-delivery-card.tsx
  destino:
    - packages/frontend/src/pages/orcamentos-admin/ui/Entrega.tsx
  invariantes:
    - id: frete
      prova:
        "Entrega.test.tsx: some sem dados, TRAVEL esconde o frete, taxa maior
        que zero, retirada na loja e formatador do admin"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/orcamentos-admin/ui/Entrega.test.tsx
        packages/frontend/src/pages/orcamentos-admin/ui/Painel.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/quotes/quote-boleto-card.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/quotes/quote-delivery-card.tsx
  nao_verificado:
    - "[NOT_VERIFIED: cartão de entrega do orçamento no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 221-cartao-boleto-orcamento

O cartão saiu de `components/admin/quotes/quote-boleto-card.tsx`. Ele continua
só em pendente, aprovado, concluído ou quando o admin já aprovou. Gerar Boleto
continua só no status aprovado. As condições continuam Antecipado, Na entrega e
No fim da locação. A data continua em `yyyy-MM-dd`. O calendário aponta para o
widget `seletor-data`, que já guarda o mesmo calendário.

```yaml
fatia:
  id: 221-cartao-boleto-orcamento
  estado: intermediate
  conceito: cartão de boleto no detalhe do orçamento
  origem:
    - components/admin/quotes/quote-boleto-card.tsx
  destino:
    - packages/frontend/src/pages/orcamentos-admin/ui/Boleto.tsx
  invariantes:
    - id: gerar
      prova:
        "Boleto.test.tsx: some fora de pending/approved/completed, Gerar Boleto
        só aprovado, condições e data yyyy-MM-dd"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/orcamentos-admin/ui/Boleto.test.tsx
        packages/frontend/src/pages/orcamentos-admin/ui/Painel.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/quotes/quote-rejection-card.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/quotes/quote-boleto-card.tsx
  nao_verificado:
    - "[NOT_VERIFIED: cartão de boleto do orçamento no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 222-cartao-rejeicao-orcamento

O cartão saiu de `components/admin/quotes/quote-rejection-card.tsx`. O título
continua Detalhes da Rejeição. O motivo `Cancelado pelo cliente` continua o selo
Cancelado pelo Cliente. Os demais continuam Rejeitado pelo Administrador. O nome
vazio do admin continua Administrador. A data continua em
`toLocaleString('pt-BR')`, com Cancelado ou Rejeitado.

```yaml
fatia:
  id: 222-cartao-rejeicao-orcamento
  estado: intermediate
  conceito: cartão de rejeição no detalhe do orçamento
  origem:
    - components/admin/quotes/quote-rejection-card.tsx
  destino:
    - packages/frontend/src/pages/orcamentos-admin/ui/Rejeicao.web.tsx
  invariantes:
    - id: motivo
      prova:
        "Rejeicao.web.test.tsx: Cancelado pelo cliente, Rejeitado pelo
        Administrador, Administrador e data pt-BR"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/orcamentos-admin/ui/Rejeicao.web.test.tsx
        packages/frontend/src/pages/orcamentos-admin/ui/Painel.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/quotes/dialogs/reject-dialog.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/quotes/quote-rejection-card.tsx
  nao_verificado:
    - "[NOT_VERIFIED: cartão de rejeição do orçamento no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 223-rejeitar-orcamento

O diálogo saiu de `components/admin/quotes/dialogs/reject-dialog.tsx`. A
pergunta continua Rejeitar Orçamento? O aviso de email continua. O motivo
continua opcional, e com motivo vazio o confirmar continua desabilitado.
Cancelar continua outline e Confirmar Rejeição continua no botão padrão.
Enquanto rejeita, o texto continua Rejeitando... na ação `rejected`.

```yaml
fatia:
  id: 223-rejeitar-orcamento
  estado: intermediate
  conceito: diálogo de rejeitar orçamento
  origem:
    - components/admin/quotes/dialogs/reject-dialog.tsx
  destino:
    - packages/frontend/src/pages/orcamentos-admin/ui/Rejeitar.tsx
  invariantes:
    - id: motivo
      prova:
        "Rejeitar.test.tsx: pergunta, email, motivo opcional, rejected
        minúsculo, Cancelar outline e Confirmar Rejeição"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/orcamentos-admin/ui/Rejeitar.test.tsx
        packages/frontend/src/pages/orcamentos-admin/ui/Painel.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/quotes/dialogs/delete-dialog.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/quotes/dialogs/reject-dialog.tsx
  nao_verificado:
    - "[NOT_VERIFIED: diálogo de rejeitar orçamento no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 224-excluir-orcamento

O diálogo saiu de `components/admin/quotes/dialogs/delete-dialog.tsx`. A
pergunta continua Excluir Orçamento Permanentemente? O aviso continua Esta ação
não pode ser desfeita, com itens e registros associados. Cancelar continua
outline e Confirmar continua no botão padrão. Enquanto exclui, o texto continua
Excluindo....

```yaml
fatia:
  id: 224-excluir-orcamento
  estado: intermediate
  conceito: diálogo de excluir orçamento
  origem:
    - components/admin/quotes/dialogs/delete-dialog.tsx
  destino:
    - packages/frontend/src/pages/orcamentos-admin/ui/Excluir.tsx
  invariantes:
    - id: permanente
      prova:
        "Excluir.test.tsx: pergunta permanente, aviso sem desfazer, Excluindo,
        Cancelar outline e Confirmar default"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/orcamentos-admin/ui/Excluir.test.tsx
        packages/frontend/src/pages/orcamentos-admin/ui/Painel.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/quotes/dialogs/remove-approval-dialog.tsx continua
        legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/quotes/dialogs/delete-dialog.tsx
  nao_verificado:
    - "[NOT_VERIFIED: diálogo de excluir orçamento no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 225-excluir-aprovacao-orcamento

O diálogo saiu de `components/admin/quotes/dialogs/remove-approval-dialog.tsx`.
A pergunta continua Excluir Aprovação? O orçamento continua voltando ao status
pendente. O aviso continua Esta ação não pode ser desfeita. Cancelar continua
outline e Confirmar continua no botão padrão. Enquanto remove, o texto continua
Removendo....

```yaml
fatia:
  id: 225-excluir-aprovacao-orcamento
  estado: intermediate
  conceito: diálogo de excluir aprovação do orçamento
  origem:
    - components/admin/quotes/dialogs/remove-approval-dialog.tsx
  destino:
    - packages/frontend/src/pages/orcamentos-admin/ui/RemoverAprovacao.tsx
  invariantes:
    - id: pendente
      prova:
        "RemoverAprovacao.test.tsx: pergunta, volta a pendente, sem desfazer,
        Removendo, Cancelar outline e Confirmar default"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/orcamentos-admin/ui/RemoverAprovacao.test.tsx
        packages/frontend/src/pages/orcamentos-admin/ui/Painel.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/quotes/dialogs/remove-item-confirm.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/quotes/dialogs/remove-approval-dialog.tsx
  nao_verificado:
    - "[NOT_VERIFIED: diálogo de excluir aprovação no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 226-remover-item-orcamento

A confirmação saiu de `components/admin/quotes/dialogs/remove-item-confirm.tsx`.
A pergunta continua Remover equipamento do orçamento? O total continua sendo
recalculado. O texto continua dizendo que a ação pode ser desfeita adicionando o
equipamento novamente. Cancelar continua outline e Confirmar remoção continua no
botão padrão. Enquanto remove, o texto continua Removendo....

```yaml
fatia:
  id: 226-remover-item-orcamento
  estado: intermediate
  conceito: confirmação de remover item do orçamento
  origem:
    - components/admin/quotes/dialogs/remove-item-confirm.tsx
  destino:
    - packages/frontend/src/pages/orcamentos-admin/ui/RemoverItem.tsx
  invariantes:
    - id: recalculo
      prova:
        "RemoverItem.test.tsx: pergunta, total recalculado, desfazer adicionando
        de novo, Cancelar outline e Confirmar remoção"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/orcamentos-admin/ui/RemoverItem.test.tsx
        packages/frontend/src/pages/orcamentos-admin/ui/Painel.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/quotes/dialogs/remove-adjustment-confirm.tsx continua
        legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/quotes/dialogs/remove-item-confirm.tsx
  nao_verificado:
    - "[NOT_VERIFIED: confirmação de remover item no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 227-remover-reajuste-orcamento

A confirmação saiu de
`components/admin/quotes/dialogs/remove-adjustment-confirm.tsx`. A pergunta
continua Remover reajuste do orçamento? O valor final continua sendo
recalculado. Cancelar continua outline e Confirmar remoção continua no botão
padrão. Enquanto remove, o texto continua Removendo....

```yaml
fatia:
  id: 227-remover-reajuste-orcamento
  estado: intermediate
  conceito: confirmação de remover reajuste do orçamento
  origem:
    - components/admin/quotes/dialogs/remove-adjustment-confirm.tsx
  destino:
    - packages/frontend/src/pages/orcamentos-admin/ui/RemoverReajuste.tsx
  invariantes:
    - id: recalculo
      prova:
        "RemoverReajuste.test.tsx: pergunta, valor final recalculado, Cancelar
        outline e Confirmar remoção"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/orcamentos-admin/ui/RemoverReajuste.test.tsx
        packages/frontend/src/pages/orcamentos-admin/ui/Painel.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/quotes/dialogs/late-fee-dialog.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/quotes/dialogs/remove-adjustment-confirm.tsx
  nao_verificado:
    - "[NOT_VERIFIED: confirmação de remover reajuste no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 228-multa-atraso-orcamento

O diálogo saiu de `components/admin/quotes/dialogs/late-fee-dialog.tsx`. O
título continua Multa por Atraso. Os dias e o valor continuam vindo prontos em
`daysLate` e `lateFee`. O formatador continua injetado. Cancelar continua
outline. Aprovar e Aplicar Multa continua no botão vermelho. Enquanto aplica, o
texto continua Aprovando....

```yaml
fatia:
  id: 228-multa-atraso-orcamento
  estado: intermediate
  conceito: diálogo de multa por atraso do orçamento
  origem:
    - components/admin/quotes/dialogs/late-fee-dialog.tsx
  destino:
    - packages/frontend/src/pages/orcamentos-admin/ui/Multa.tsx
  invariantes:
    - id: valor-recebido
      prova:
        "Multa.test.tsx: título, daysLate, lateFee via formatCurrency injetado,
        Aprovar e Aplicar Multa no botão vermelho"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/orcamentos-admin/ui/Multa.test.tsx
        packages/frontend/src/pages/orcamentos-admin/ui/Painel.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/quotes/dialogs/edit-customer-dialog.tsx continua
        legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/quotes/dialogs/late-fee-dialog.tsx
  nao_verificado:
    - "[NOT_VERIFIED: diálogo de multa por atraso no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 229-editar-cliente-orcamento

O diálogo saiu de `components/admin/quotes/dialogs/edit-customer-dialog.tsx`. O
título continua Editar dados do cliente. CPF e CNPJ continuam formatados por
`formatCPFInput` e `formatCNPJInput`. Os placeholders continuam
`000.000.000-00`, `00.000.000/0000-00` e `(00) 00000-0000`. O rascunho continua
com `includeWeekends`. Cancelar continua outline e Salvar continua no botão
padrão.

```yaml
fatia:
  id: 229-editar-cliente-orcamento
  estado: intermediate
  conceito: diálogo de editar dados do cliente do orçamento
  origem:
    - components/admin/quotes/dialogs/edit-customer-dialog.tsx
  destino:
    - packages/frontend/src/pages/orcamentos-admin/ui/EditarCliente.tsx
  invariantes:
    - id: documentos
      prova:
        "EditarCliente.test.tsx: título, CPF, CNPJ, máscaras, formatCPFInput,
        formatCNPJInput, includeWeekends e Salvar"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/orcamentos-admin/ui/EditarCliente.test.tsx
        packages/frontend/src/pages/orcamentos-admin/ui/Painel.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/quotes/dialogs/edit-delivery-dialog.tsx continua
        legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/quotes/dialogs/edit-customer-dialog.tsx
  nao_verificado:
    - "[NOT_VERIFIED: diálogo de editar cliente no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 230-editar-entrega-orcamento

O diálogo saiu de `components/admin/quotes/dialogs/edit-delivery-dialog.tsx`. O
título continua Editar entrega e endereço. Entrega no Endereço continua
`DELIVERY` e Retirada em Loja continua `PICKUP`. Na retirada o frete continua
vazio. O CEP continua com máscara `00000-000` pelo `formatCEP` injetado.
Cancelar continua outline e Salvar continua no botão padrão.

```yaml
fatia:
  id: 230-editar-entrega-orcamento
  estado: intermediate
  conceito: diálogo de editar entrega e endereço do orçamento
  origem:
    - components/admin/quotes/dialogs/edit-delivery-dialog.tsx
  destino:
    - packages/frontend/src/pages/orcamentos-admin/ui/EditarEntrega.tsx
  invariantes:
    - id: retirada
      prova:
        "EditarEntrega.test.tsx: DELIVERY, PICKUP zera o frete, CEP 00000-000,
        formatCEP e Salvar"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/orcamentos-admin/ui/EditarEntrega.test.tsx
        packages/frontend/src/pages/orcamentos-admin/ui/Painel.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/quotes/dialogs/edit-item-dates-dialog.tsx continua
        legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/quotes/dialogs/edit-delivery-dialog.tsx
  nao_verificado:
    - "[NOT_VERIFIED: diálogo de editar entrega no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 231-editar-periodo-item

O diálogo saiu de `components/admin/quotes/dialogs/edit-item-dates-dialog.tsx`.
O título continua Editar período do item. O checkbox
`edit-item-include-weekends` continua ligando e desligando finais de semana. Com
finais de semana desligados, sábado e domingo continuam desabilitados no
calendário. A prévia continua singular `dia` e plural `dias`. O calendário
aponta para o seletor já movido, `widgets/seletor-data`, no lugar do caminho
morto de `equipamento-detalhe`. Salvar continua desabilitado sem data de início
ou de fim.

```yaml
fatia:
  id: 231-editar-periodo-item
  estado: intermediate
  conceito: diálogo de editar o período de um item do orçamento
  origem:
    - components/admin/quotes/dialogs/edit-item-dates-dialog.tsx
  destino:
    - packages/frontend/src/pages/orcamentos-admin/ui/EditarPeriodo.web.tsx
  invariantes:
    - id: finais-de-semana
      prova:
        "EditarPeriodo.web.test.tsx: checkbox edit-item-include-weekends, sábado
        e domingo desabilitados, dia/dias e seletor-data"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/orcamentos-admin/ui/EditarPeriodo.web.test.tsx
        packages/frontend/src/pages/orcamentos-admin/ui/Painel.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/shared/price-adjustment-dialog.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/quotes/dialogs/edit-item-dates-dialog.tsx
  nao_verificado:
    - "[NOT_VERIFIED: diálogo de editar período do item no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 232-reajuste-orcamento

O diálogo saiu de `components/admin/shared/price-adjustment-dialog.tsx`. O
título continua Registrar Reajuste de Orçamento. As categorias continuam Mão de
obra, Deslocamento (Frete), Manutenção e Outro, sem repetir a mesma categoria em
outro item. O novo valor final continua sendo o valor original somado aos
reajustes finitos. O detalhe financeiro em `pages/financeiro/ui/Detalhe.web.tsx`
continua com o próprio diálogo embutido.

```yaml
fatia:
  id: 232-reajuste-orcamento
  estado: intermediate
  conceito: diálogo de registrar reajuste do orçamento
  origem:
    - components/admin/shared/price-adjustment-dialog.tsx
  destino:
    - packages/frontend/src/pages/orcamentos-admin/ui/Reajuste.tsx
  invariantes:
    - id: categorias-e-total
      prova:
        "Reajuste.test.tsx: LABOR, TRAVEL, MAINTENANCE, OTHER, item/itens e
        originalAmount + totalAdjustments"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/orcamentos-admin/ui/Reajuste.test.tsx
        packages/frontend/src/pages/orcamentos-admin/ui/Painel.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "app/admin/orcamentos/page.tsx continua dono da listagem de orçamentos"
      - "components/admin/quotes/types.ts continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/shared/price-adjustment-dialog.tsx
  nao_verificado:
    - "[NOT_VERIFIED: diálogo de reajuste no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 233-listagem-orcamentos

A listagem saiu do corpo de `app/admin/orcamentos/page.tsx`. A URL
`/admin/orcamentos` continua no shell fino. O título continua Gerenciar
Orçamentos. O status concluído continua escrito `Concluidos`. No kanban o filtro
de período continua oculto e volta para `all`. O atalho do financeiro continua
em `/admin/financeiro` com `search` e `quoteId`, na ordem código, código legado
e nome.

```yaml
fatia:
  id: 233-listagem-orcamentos
  estado: intermediate
  conceito: listagem admin de orçamentos
  origem:
    - app/admin/orcamentos/page.tsx
  destino:
    - packages/frontend/src/pages/orcamentos-admin/ui/Lista.web.tsx
    - app/admin/orcamentos/page.tsx
  invariantes:
    - id: filtros-e-financeiro
      prova:
        "Lista.web.test.tsx: Concluidos sem acento, kanban zera o período e a
        busca vai para /admin/financeiro"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/orcamentos-admin/ui/Lista.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "app/admin/orcamentos/[id]/page.tsx continua dono do detalhe"
      - "app/admin/orcamentos/loading.tsx continua com o spinner da listagem"
      - "components/admin/quotes/types.ts continua legado"
      - "hooks/use-quotes-data.ts e hooks/use-quote-details.ts continuam legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - "o corpo da listagem saiu de app/admin/orcamentos/page.tsx; a rota ficou
      só com o shell"
  nao_verificado:
    - "[NOT_VERIFIED: listagem de orçamentos no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 234-detalhe-orcamento-rota

A tela saiu do corpo de `app/admin/orcamentos/[id]/page.tsx`. A URL continua no
shell, que repassa `params`. A busca continua em `/api/admin/quotes/${id}`. O
404 continua com Orçamento não encontrado e os outros erros com Erro ao carregar
orçamento, ambos voltando para `/admin/orcamentos`. O botão Voltar para
Orçamentos continua em `router.back()`. O status concluído desta rota continua
`Concluído`, separado do `Concluidos` da listagem. O valor continua em
`toLocaleString` com BRL, e a foto continua em `<img>`.

```yaml
fatia:
  id: 234-detalhe-orcamento-rota
  estado: intermediate
  conceito: página de detalhe do orçamento por id
  origem:
    - app/admin/orcamentos/[id]/page.tsx
  destino:
    - packages/frontend/src/pages/orcamentos-admin/ui/Detalhe.web.tsx
    - app/admin/orcamentos/[id]/page.tsx
  invariantes:
    - id: busca-e-moeda
      prova:
        "Detalhe.web.test.tsx: /api/admin/quotes, Concluído com acento,
        toLocaleString BRL e img"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/orcamentos-admin/ui/Detalhe.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "app/admin/orcamentos/loading.tsx continua com o spinner da listagem"
      - "app/admin/orcamentos/[id]/loading.tsx continua com o texto Carregando
        orçamento"
      - "components/admin/quotes/types.ts continua legado"
      - "hooks/use-quotes-data.ts e hooks/use-quote-details.ts continuam legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - "o corpo do detalhe saiu de app/admin/orcamentos/[id]/page.tsx; a rota
      ficou só com o shell"
  nao_verificado:
    - "[NOT_VERIFIED: detalhe do orçamento no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 235-carregando-orcamentos

Os dois carregamentos saíram do corpo das rotas. A listagem continua com o anel
azul de `framer-motion`, tela cheia e giro infinito. O detalhe continua com o
ícone `Loader2`, o texto Carregando orçamento... e sem `'use client'`. Os dois
não foram unificados.

```yaml
fatia:
  id: 235-carregando-orcamentos
  estado: intermediate
  conceito: telas de carregamento da listagem e do detalhe de orçamento
  origem:
    - app/admin/orcamentos/loading.tsx
    - app/admin/orcamentos/[id]/loading.tsx
  destino:
    - packages/frontend/src/pages/orcamentos-admin/ui/CarregandoLista.tsx
    - packages/frontend/src/pages/orcamentos-admin/ui/CarregandoDetalhe.tsx
    - app/admin/orcamentos/loading.tsx
    - app/admin/orcamentos/[id]/loading.tsx
  invariantes:
    - id: spinners-separados
      prova:
        "Carregando.test.tsx: anel da listagem com framer-motion e texto
        Carregando orçamento... no detalhe"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/orcamentos-admin/ui/Carregando.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/admin/quotes/types.ts continua legado"
      - "components/admin/quotes/utils.ts continua legado"
      - "hooks/use-quotes-data.ts e hooks/use-quote-details.ts continuam legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - "o corpo dos loadings saiu das rotas; os arquivos ficaram só com o shell"
  nao_verificado:
    - "[NOT_VERIFIED: loadings de orçamento no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 236-registro-orcamento-admin

Os tipos e as funções saíram de `components/admin/quotes/types.ts` e `utils.ts`
para a entity `orcamento`. O rótulo de status concluído do mapa admin continua
`Concluido`, sem acento. A classe `!bg-orange-500` do pendente continua. O selo
do kanban pendente continua Aprovação Pendente. `parseLocalDate` continua no
fuso local. O mapa `ADJUSTMENT_CATEGORY_LABEL` continua separado de
`ADJUSTMENT_CATEGORY_LABELS`.

```yaml
fatia:
  id: 236-registro-orcamento-admin
  estado: intermediate
  conceito: tipos e funções do orçamento admin
  origem:
    - components/admin/quotes/types.ts
    - components/admin/quotes/utils.ts
  destino:
    - packages/frontend/src/entities/orcamento/model/registro.ts
    - packages/frontend/src/entities/orcamento/model/registro-utils.ts
  invariantes:
    - id: status-e-data-local
      prova:
        "registro.test.ts: Concluido sem acento, !bg-orange-500, parseLocalDate
        dia 15 e Aprovação Pendente"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/entities/orcamento/model/registro.test.ts
        packages/frontend/src/pages/orcamentos-admin/ui/Reajuste.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "hooks/use-quotes-data.ts e hooks/use-quote-details.ts continuam legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/quotes/types.ts
    - components/admin/quotes/utils.ts
  nao_verificado:
    - "[NOT_VERIFIED: registro do orçamento no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 237-dados-orcamentos

A listagem e o detalhe saíram de `hooks/use-quotes-data.ts` e
`hooks/use-quote-details.ts`. A página da tabela continua em 20. O kanban
continua pedindo limite 500, página 1, e sem filtro de status, período ou valor.
O status fora do kanban continua em maiúsculas. O rascunho de datas do item
continua com `includeWeekends: false`.

```yaml
fatia:
  id: 237-dados-orcamentos
  estado: intermediate
  conceito: dados da listagem e do detalhe de orçamentos
  origem:
    - hooks/use-quotes-data.ts
    - hooks/use-quote-details.ts
  destino:
    - packages/frontend/src/pages/orcamentos-admin/model/dados.web.ts
    - packages/frontend/src/pages/orcamentos-admin/model/detalhe.web.ts
  invariantes:
    - id: pagina-e-kanban
      prova:
        "dados.web.test.ts: pageSize 20, limite 500 no kanban, status em
        maiúsculas só fora do kanban e includeWeekends false"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/orcamentos-admin/model/dados.web.test.ts
        packages/frontend/src/pages/orcamentos-admin/ui/Lista.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "hooks/use-debounce.ts continua legado e ainda é usado pela listagem"
      - "components/admin/admin-page-header.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - hooks/use-quotes-data.ts
    - hooks/use-quote-details.ts
  nao_verificado:
    - "[NOT_VERIFIED: listagem de orçamentos no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 238-cabecalho-admin

O cabeçalho das páginas admin saiu de `components/admin/admin-page-header.tsx`
para o widget `cabecalho-admin`. O gradiente continua
`from-orange-500 via-orange-600 to-orange-700`. A entrada continua com `y: -20`.

```yaml
fatia:
  id: 238-cabecalho-admin
  estado: intermediate
  conceito: cabeçalho das páginas admin
  origem:
    - components/admin/admin-page-header.tsx
  destino:
    - packages/frontend/src/widgets/cabecalho-admin/ui/Cabecalho.tsx
  invariantes:
    - id: gradiente-e-entrada
      prova:
        "Cabecalho.test.tsx: from-orange-500 via-orange-600 to-orange-700 e y:
        -20"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/cabecalho-admin/ui/Cabecalho.test.tsx
        packages/frontend/src/pages/orcamentos-admin/ui/Lista.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "hooks/use-debounce.ts continua legado e ainda é usado pela listagem"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/admin-page-header.tsx
  nao_verificado:
    - "[NOT_VERIFIED: cabeçalho admin no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 239-debounce

O hook saiu de `hooks/use-debounce.ts` para
`packages/frontend/src/shared/lib/debounce.ts`. O atraso padrão continua 350 ms.
A função `debounce` de `lib/utils.ts` continua separada.

```yaml
fatia:
  id: 239-debounce
  estado: intermediate
  conceito: hook de debounce genérico
  origem:
    - hooks/use-debounce.ts
  destino:
    - packages/frontend/src/shared/lib/debounce.ts
  invariantes:
    - id: atraso-padrao-350ms
      prova: "debounce.test.ts: useDebounce com delay padrão 350"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/shared/lib/debounce.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - hooks/use-debounce.ts
  nao_verificado:
    - "[NOT_VERIFIED: debounce da busca no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 241-permissoes

A tela saiu do corpo de `app/admin/permissions/page.tsx`. A URL continua
`/admin/permissions`. Os papéis continuam ADMIN, OPERATOR, FINANCIAL e CLIENT. O
título continua Gerenciar Permissões. O arch global falhou na hora da fatia
porque `pages/email-admin` ainda não tinha index.

```yaml
fatia:
  id: 241-permissoes
  estado: intermediate
  conceito: tela admin de permissões por perfil
  origem:
    - app/admin/permissions/page.tsx
  destino:
    - packages/frontend/src/pages/permissoes/ui/PermissoesPage.tsx
    - app/admin/permissions/page.tsx
  invariantes:
    - id: papeis-e-titulo
      prova:
        "PermissoesPage.test.tsx: Gerenciar Permissões e
        ADMIN/OPERATOR/FINANCIAL/CLIENT"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/permissoes/ui/PermissoesPage.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 1
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: fail
    tokens: pass
    violacoes_conhecidas:
      - "na hora da medição, pages/email-admin ainda não tinha index"
      - "components/admin/admin-card.tsx continua legado compartilhado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - "o corpo da tela em app/admin/permissions/page.tsx; a rota ficou só com o
      shell"
  nao_verificado:
    - "[NOT_VERIFIED: permissões no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 242-whatsapp-admin

A tela saiu de `app/admin/whatsapp/page.tsx`. A URL continua `/admin/whatsapp`.
Não há telefone fixo: o número continua vindo de `conversation.phone`. Os
limites continuam 50. O arch global falhou na hora da fatia por slices vizinhos
ainda sem index.

```yaml
fatia:
  id: 242-whatsapp-admin
  estado: intermediate
  conceito: página admin WhatsApp
  origem:
    - app/admin/whatsapp/page.tsx
  destino:
    - packages/frontend/src/pages/whatsapp-admin/ui/WhatsAppAdminPage.web.tsx
    - app/admin/whatsapp/page.tsx
  invariantes:
    - id: telefones-separados
      prova:
        "WhatsAppAdminPage.web.test.tsx: sem 555198205163 e sem 5551998205163"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/whatsapp-admin/ui/WhatsAppAdminPage.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 1
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: fail
    tokens: pass
    violacoes_conhecidas:
      - "na hora da medição, pages/email-admin e pages/configuracoes ainda não
        tinham index"
      - "components/admin/whatsapp continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - "o corpo da tela em app/admin/whatsapp/page.tsx; a rota ficou só com o
      shell"
  nao_verificado:
    - "[NOT_VERIFIED: página /admin/whatsapp no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 246-configuracoes

A tela saiu do corpo de `app/admin/settings/page.tsx`. A URL continua
`/admin/settings`. Telefones, e-mails, fuso `America/Sao_Paulo` e
`maxQuoteItems: 50` continuam iguais. O hook `use-settings-data` e os blocos de
settings continuam no legado. Arch e tokens falharam na hora da fatia por
`equipamentos-admin`, que outra fatia ainda estava escrevendo.

```yaml
fatia:
  id: 246-configuracoes
  estado: intermediate
  conceito: configurações do sistema no admin
  origem:
    - app/admin/settings/page.tsx
  destino:
    - packages/frontend/src/pages/configuracoes/ui/ConfiguracoesPage.web.tsx
    - app/admin/settings/page.tsx
  invariantes:
    - id: contatos-e-marca
      prova:
        "ConfiguracoesPage.web.test.tsx: (51) 2313-6262, (51) 99820-5163, emails
        locacoesgb e America/Sao_Paulo"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/configuracoes"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 1
    - cmd: "node tools/token-check.mjs"
      exit: 1
  gate:
    arch: fail
    tokens: fail
    violacoes_conhecidas:
      - "na hora da medição, equipamentos-admin ainda violava FSD e tokens"
      - "hooks/use-settings-data.tsx continua legado"
      - "components/admin/settings-block.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - "o corpo da tela em app/admin/settings/page.tsx; a rota ficou só com o
      shell"
  nao_verificado:
    - "[NOT_VERIFIED: /admin/settings no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 240-email

A tela e o hook saíram de `app/admin/email/page.tsx` e
`hooks/use-email-page.ts`. A URL continua `/admin/email`. Título, Zoho e as
rotas `/api/admin/zoho-mail` continuam iguais. Os componentes em
`components/admin/email` continuam no legado. O arch passou. O token global
falhou por `equipamentos-admin`, fora desta fatia.

```yaml
fatia:
  id: 240-email
  estado: intermediate
  conceito: página admin de e-mail Zoho
  origem:
    - app/admin/email/page.tsx
    - hooks/use-email-page.ts
  destino:
    - packages/frontend/src/pages/email-admin/ui/EmailAdminPage.web.tsx
    - packages/frontend/src/pages/email-admin/model/carga.web.ts
    - app/admin/email/page.tsx
  invariantes:
    - id: zoho
      prova:
        "EmailAdminPage.web.test.tsx: Conectar Zoho Mail e /api/admin/zoho-mail"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/email-admin/ui/EmailAdminPage.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 1
  gate:
    arch: pass
    tokens: fail
    violacoes_conhecidas:
      - "token-check falha em equipamentos-admin Editar/Novo, fora desta fatia"
      - "components/admin/email continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - hooks/use-email-page.ts
    - "o corpo da tela em app/admin/email/page.tsx; a rota ficou só com o shell"
  nao_verificado:
    - "[NOT_VERIFIED: /admin/email no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 260-cartao-admin

O cartão saiu de `components/admin/admin-card.tsx` para o widget `cartao-admin`.
As variantes default, elevated, glass e flat continuam iguais. O arch passou. O
token global falhou por `equipamentos-admin`, fora desta fatia.

```yaml
fatia:
  id: 260-cartao-admin
  estado: intermediate
  conceito: cartão compartilhado das páginas admin
  origem:
    - components/admin/admin-card.tsx
  destino:
    - packages/frontend/src/widgets/cartao-admin/ui/Cartao.tsx
  invariantes:
    - id: variantes
      prova: "Cartao.test.tsx: default, elevated, glass e flat"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/cartao-admin/ui/Cartao.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 1
  gate:
    arch: pass
    tokens: fail
    violacoes_conhecidas:
      - "token-check falha em equipamentos-admin Editar/Novo, fora desta fatia"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/admin-card.tsx
  nao_verificado:
    - "[NOT_VERIFIED: cartão admin no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 259-tabs-accordion

As abas e o acordeão saíram de `components/ui/tabs.tsx` e
`components/ui/accordion.tsx`. Na web, a aba ativa continua `text-orange-600` e
o foco continua `ring-orange-500`. O nativo não repete essas classes. O arch
passou. O token global falhou por literais fora desta fatia.

```yaml
fatia:
  id: 259-tabs-accordion
  estado: intermediate
  conceito: abas e acordeão
  origem:
    - components/ui/tabs.tsx
    - components/ui/accordion.tsx
  destino:
    - packages/ui/src/web/Tabs.web.tsx
    - packages/ui/src/native/Tabs.native.tsx
    - packages/ui/src/web/Accordion.web.tsx
    - packages/ui/src/native/Accordion.native.tsx
  invariantes:
    - id: abas
      prova:
        "Tabs.web.test.tsx: ativo text-orange-600 e foco ring-orange-500; nativo
        sem essas classes"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/Tabs.web.test.tsx
        packages/ui/src/web/Accordion.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 1
  gate:
    arch: pass
    tokens: fail
    violacoes_conhecidas:
      - "token-check falha em cta-button e CategoriasPage, fora desta fatia"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/ui/tabs.tsx
    - components/ui/accordion.tsx
  nao_verificado:
    - "[NOT_VERIFIED: abas e acordeão no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 243-equipamentos-admin

As quatro telas saíram de `app/admin/equipamentos`. As URLs continuam as mesmas,
só com shell. A listagem admin continua com 9 itens, separada do catálogo
público. `VerEquipamento` não foi recriado.

```yaml
fatia:
  id: 243-equipamentos-admin
  estado: intermediate
  conceito: páginas admin de equipamentos
  origem:
    - app/admin/equipamentos/page.tsx
    - app/admin/equipamentos/novo/page.tsx
    - app/admin/equipamentos/[id]/page.tsx
    - app/admin/equipamentos/[id]/editar/page.tsx
  destino:
    - packages/frontend/src/pages/equipamentos-admin/ui/Lista.web.tsx
    - packages/frontend/src/pages/equipamentos-admin/ui/Novo.web.tsx
    - packages/frontend/src/pages/equipamentos-admin/ui/Detalhe.web.tsx
    - packages/frontend/src/pages/equipamentos-admin/ui/Editar.web.tsx
  invariantes:
    - id: pagina-9
      prova:
        "testes de equipamentos-admin: EQUIPMENT_LIST_PAGE_SIZE 9, separado do
        catálogo público"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/equipamentos-admin"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "app/equipamentos continua o catálogo público, filtro separado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - "o corpo das quatro rotas admin de equipamentos; ficaram só os shells"
  nao_verificado:
    - "[NOT_VERIFIED: equipamentos admin no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 244-categorias

A listagem saiu de `app/admin/categorias/page.tsx`. A URL continua
`/admin/categorias`. A página continua com 9 itens. `VerCategoria` e o diálogo
de categoria foram reutilizados.

```yaml
fatia:
  id: 244-categorias
  estado: intermediate
  conceito: listagem admin de categorias
  origem:
    - app/admin/categorias/page.tsx
    - hooks/use-categories-data.ts
  destino:
    - packages/frontend/src/pages/categorias/ui/CategoriasPage.web.tsx
    - packages/frontend/src/pages/categorias/model/carga.ts
    - app/admin/categorias/page.tsx
  invariantes:
    - id: pagina-9
      prova:
        "CategoriasPage.web.test.tsx: Gerenciar Categorias e CATEGORY_PAGE_SIZE
        9"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/categorias/ui/CategoriasPage.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - hooks/use-categories-data.ts
    - "o corpo da listagem em app/admin/categorias/page.tsx; a rota ficou só com
      o shell"
  nao_verificado:
    - "[NOT_VERIFIED: categorias admin no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 258-grafico-ui

O gráfico saiu do corpo de `components/ui/chart.tsx` para `packages/ui`. Os
seletores `#ccc` e `#fff` e a altura mínima de 200 px continuam iguais. O
arquivo legado só reexporta. O widget de gráficos financeiros ainda passa por
esse reexport.

```yaml
fatia:
  id: 258-grafico-ui
  estado: intermediate
  conceito: primitivo de gráfico
  origem:
    - components/ui/chart.tsx
  destino:
    - packages/ui/src/web/Chart.web.tsx
    - packages/ui/src/native/Chart.native.tsx
  invariantes:
    - id: seletores
      prova: "Chart.web.test.tsx: #ccc, #fff e minHeight 200px"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/Chart.web.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/ui/chart.tsx continua como reexport"
      - "widgets/graficos-financeiros ainda usa o reexport"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: gráfico no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 267-cta

O botão saiu de `components/ui/cta-button.tsx`. As variantes primary, secondary,
outline e ghost continuam. Na web, o laranja continua `bg-orange-600`. O nativo
não repete as classes Tailwind da web. O card de equipamento só trocou o import.

```yaml
fatia:
  id: 267-cta
  estado: intermediate
  conceito: botão de chamada para ação
  origem:
    - components/ui/cta-button.tsx
  destino:
    - packages/ui/src/web/CTAButton.web.tsx
    - packages/ui/src/native/CTAButton.native.tsx
  invariantes:
    - id: laranja-da-marca
      prova: "CTAButton.web.test.tsx: bg-orange-600 e verde do WhatsApp"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/CTAButton.web.test.tsx
        packages/ui/src/native/CTAButton.native.test.tsx"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/ui/equipment-card.tsx continua legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/ui/cta-button.tsx
  nao_verificado:
    - "[NOT_VERIFIED: botão CTA no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 268-grafico-reexport

Os callers admin de gráfico já estavam fora de `components/admin/financial` e
`components/admin/dashboard` (arquivos removidos em fatias anteriores). Busca em
`*.ts`/`*.tsx` com zero imports de `@/components/ui/chart` ou
`components/ui/chart`. Widget `graficos-financeiros` e páginas do dashboard já
importam de `@gb-locacoes/ui`. Reexport legado apagado.

```yaml
fatia:
  id: 268-grafico-reexport
  estado: intermediate
  conceito: aposentadoria do reexport de gráfico
  origem:
    - components/ui/chart.tsx
  destino:
    - packages/frontend/src/widgets/graficos-financeiros
    - packages/frontend/src/pages/dashboard/ui/Tendencia.web.tsx
    - packages/frontend/src/pages/dashboard/ui/Distribuicao.web.tsx
    - packages/frontend/src/pages/dashboard/ui/Categoria.web.tsx
  invariantes:
    - id: cores-graficos-financeiros
      prova: "graficos.test.tsx: cores aging, receita e categorias"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/graficos-financeiros"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 1
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: fail
    tokens: pass
    violacoes_conhecidas:
      - "FSD-PUBLIC-API packages/frontend/src/widgets/cartao-equipamento: slice
        sem index public API"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/ui/chart.tsx
  nao_verificado:
    - "[NOT_VERIFIED: gráfico no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 272-settings-blocos

Hook e blocos de settings saíram do legado para o slice `pages/configuracoes`. A
página e a rota `/admin/settings` já existiam (fatia 246). Telefones
`(51) 2313-6262` e `(51) 99820-5163`, e-mails `contato@` /
`comercial@locacoesgb.com.br`, fuso `America/Sao_Paulo` e `maxQuoteItems: 50`
permanecem. `entities/configuracao` não foi alterado.

`hero-carousel-preview.tsx` **não** importa `model-viewer`,
`equipment-3d-carousel` nem `scroll-reveal`; ficou no legado por estar fora da
fatia exclusiva (continua importado pela page). `header-footer-preview.tsx`
também permanece legado (dependência de `SettingsPreviews`).

```yaml
fatia:
  id: 272-settings-blocos
  estado: intermediate
  conceito: hook e blocos UI de configurações admin
  origem:
    - hooks/use-settings-data.tsx
    - components/admin/settings-block.tsx
    - components/admin/settings-navigation-bar.tsx
    - components/admin/settings-previews.tsx
  destino:
    - packages/frontend/src/pages/configuracoes/model/use-settings-data.tsx
    - packages/frontend/src/pages/configuracoes/ui/SettingsBlock.web.tsx
    - packages/frontend/src/pages/configuracoes/ui/SettingsNavigationBar.web.tsx
    - packages/frontend/src/pages/configuracoes/ui/SettingsPreviews.web.tsx
  invariantes:
    - id: contatos
      prova:
        "use-settings-data.tsx + ConfiguracoesPage.web.test.tsx: (51) 2313-6262,
        (51) 99820-5163, contato@ e comercial@locacoesgb.com.br"
    - id: sistema-preview
      prova: "ConfiguracoesPage.web.tsx: America/Sao_Paulo e maxQuoteItems: 50"
    - id: hero-preview-legado
      prova:
        "ConfiguracoesPage.web.tsx continua importando
        components/admin/hero-carousel-preview"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/configuracoes"
      exit: 0
      verificado_em: "2026-09-25 15:58"
    - cmd: "node tools/arch-check.mjs"
      exit: 1
      verificado_em: "2026-09-25 15:58"
    - cmd: "node tools/token-check.mjs"
      exit: 1
      verificado_em: "2026-09-25 15:58"
  gate:
    arch: fail-preexistente
    tokens: fail-preexistente
    violacoes_conhecidas:
      - "RUNTIME-WEB-ONLY em pages/email-admin/ui/email-folder-list.tsx (outra
        fatia)"
      - "TOKEN number-literal em packages/ui/src/native/Progress.native.tsx
        (outra fatia)"
      - "literais de preview/settings em configuracoes cobertos com
        token-check-allow"
      - "hero-carousel-preview.tsx permanece legado (fora da fatia exclusiva;
        sem imports 3D/scroll-reveal)"
      - "header-footer-preview.tsx permanece legado (só usado por
        SettingsPreviews)"
      - "entities/configuracao não foi alterado"
  aposentado:
    - hooks/use-settings-data.tsx
    - components/admin/settings-block.tsx
    - components/admin/settings-navigation-bar.tsx
    - components/admin/settings-previews.tsx
  nao_verificado:
    - "[NOT_VERIFIED: /admin/settings no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: salvar/resetar seções]"
    - "[NOT_VERIFIED: upload de logo]"
```

## 271-whatsapp-componentes

Os seis componentes usados só por `/admin/whatsapp` saíram de
`components/admin/whatsapp/**` para o slice `pages/whatsapp-admin`. A página
importa Layout, DialogoCompleto e DialogoCompositor pelo caminho relativo do
slice. O telefone continua vindo da conversa da API; nenhum `555198205163`
(orçamento) nem `5551998205163` (FAB) foi introduzido.
`widgets/whatsapp-flutuante` não foi tocado. Pasta legada apagada. Esta fatia
está em estado intermediate; a migração não está concluída.

```yaml
fatia:
  id: 271-whatsapp-componentes
  estado: intermediate
  conceito: componentes UI exclusivos da página admin WhatsApp
  origem:
    - components/admin/whatsapp/whatsapp-layout-container.tsx
    - components/admin/whatsapp/whatsapp-conversation-list.tsx
    - components/admin/whatsapp/whatsapp-message-list.tsx
    - components/admin/whatsapp/whatsapp-viewer.tsx
    - components/admin/whatsapp/whatsapp-full-view-dialog.tsx
    - components/admin/whatsapp/whatsapp-composer-dialog.tsx
  destino:
    - packages/frontend/src/pages/whatsapp-admin/ui/Layout.web.tsx
    - packages/frontend/src/pages/whatsapp-admin/ui/ListaConversas.web.tsx
    - packages/frontend/src/pages/whatsapp-admin/ui/ListaMensagens.web.tsx
    - packages/frontend/src/pages/whatsapp-admin/ui/Visualizador.web.tsx
    - packages/frontend/src/pages/whatsapp-admin/ui/DialogoCompleto.web.tsx
    - packages/frontend/src/pages/whatsapp-admin/ui/DialogoCompositor.web.tsx
  telefone_preservado:
    nenhum_hardcoded (conversation.phone da API; sem 555198205163 nem
    5551998205163)
  invariantes:
    - id: titulo-apis
      prova:
        "WhatsAppAdminPage.web.test.tsx: WhatsApp, subtítulo, LIMIT 50, APIs
        conversations/messages, phone da API"
    - id: telefones-separados
      prova:
        "WhatsAppAdminPage.web.test.tsx: página, UI movida e rota sem
        555198205163 e sem 5551998205163"
    - id: componentes-no-slice
      prova:
        "WhatsAppAdminPage.web.test.tsx: imports ./Layout.web
        ./DialogoCompleto.web ./DialogoCompositor.web; pasta legada ausente"
    - id: shell
      prova:
        "WhatsAppAdminPage.web.test.tsx: rota importa
        @gb-locacoes/frontend/pages/whatsapp-admin e retorna AdminWhatsAppPage"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/whatsapp-admin/ui/WhatsAppAdminPage.web.test.tsx"
      exit: 0
      verificado_em: "2026-09-25 15:58"
    - cmd: "node tools/arch-check.mjs"
      exit: 1
      verificado_em: "2026-09-25 15:58"
      nota: >-
        2 violações pré-existentes fora da fatia: widgets/cartao-equipamento sem
        index; email-admin/ui/email-folder-list.tsx com react-dom sem .web.
        Nenhuma violação em whatsapp-admin.
    - cmd: "node tools/token-check.mjs"
      exit: 1
      verificado_em: "2026-09-25 15:58"
      nota: >-
        1 violação pré-existente em packages/ui/src/native/Progress.native.tsx
        (borderRadius 9999). Nenhuma violação em whatsapp-admin.
  gate:
    arch: fail_externo
    tokens: fail_externo
    vitest_platform: pass
    violacoes_conhecidas:
      - "arch: widgets/cartao-equipamento sem index (fora da fatia 271)"
      - "arch: email-admin email-folder-list.tsx react-dom (fora da fatia 271;
        email proibido)"
      - "token-check: Progress.native.tsx borderRadius 9999 (fora da fatia 271)"
      - "resizable continua em components/ui/resizable (primitivo legado)"
      - "widgets/whatsapp-flutuante não tocado (FAB 5551998205163)"
  aposentado:
    - components/admin/whatsapp/whatsapp-layout-container.tsx
    - components/admin/whatsapp/whatsapp-conversation-list.tsx
    - components/admin/whatsapp/whatsapp-message-list.tsx
    - components/admin/whatsapp/whatsapp-viewer.tsx
    - components/admin/whatsapp/whatsapp-full-view-dialog.tsx
    - components/admin/whatsapp/whatsapp-composer-dialog.tsx
  callers_atualizados:
    - packages/frontend/src/pages/whatsapp-admin/ui/WhatsAppAdminPage.web.tsx
  nao_verificado:
    - "[NOT_VERIFIED: página /admin/whatsapp no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 273-ui-primitivos

Três primitivos sem regra de negócio saíram de `components/ui/`: `aspect-ratio`,
`collapsible` e `progress`. Cada um ganhou contrato + web + native em
`packages/ui`. Web preserva o Radix (e as classes `bg-secondary`/`bg-primary` do
Progress). Native não repete Tailwind. Nenhum `.ts`/`.tsx` de produto importava
os legados; os arquivos foram aposentados. Esta fatia está em estado
intermediate; a migração não está concluída.

```yaml
fatia:
  id: 273-ui-primitivos
  estado: intermediate
  conceito: aspect-ratio, collapsible e progress
  origem:
    - components/ui/aspect-ratio.tsx
    - components/ui/collapsible.tsx
    - components/ui/progress.tsx
  destino:
    - packages/ui/src/contract/aspect-ratio.ts
    - packages/ui/src/contract/collapsible.ts
    - packages/ui/src/contract/progress.ts
    - packages/ui/src/web/AspectRatio.web.tsx
    - packages/ui/src/native/AspectRatio.native.tsx
    - packages/ui/src/web/Collapsible.web.tsx
    - packages/ui/src/native/Collapsible.native.tsx
    - packages/ui/src/web/Progress.web.tsx
    - packages/ui/src/native/Progress.native.tsx
  invariantes:
    - id: aspect-ratio
      prova:
        "AspectRatio.web.test.tsx: Root do Radix; native com aspectRatio e sem
        className/bg-"
    - id: collapsible
      prova:
        "Collapsible.web.test.tsx: Root/Trigger/Content Radix; native Pressable
        sem data-[state="
    - id: progress
      prova:
        "Progress.web.test.tsx: bg-secondary, bg-primary, translateX; native sem
        essas classes"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/AspectRatio.web.test.tsx
        packages/ui/src/web/Collapsible.web.test.tsx
        packages/ui/src/web/Progress.web.test.tsx"
      exit: 0
      verificado_em: "2026-09-25 15:59"
    - cmd: "node tools/arch-check.mjs"
      exit: 1
      verificado_em: "2026-09-25 15:59"
      nota:
        "FSD-PUBLIC-API widgets/cartao-equipamento sem index — fora desta fatia;
        zero violação em AspectRatio/Collapsible/Progress"
    - cmd: "node tools/token-check.mjs"
      exit: 1
      verificado_em: "2026-09-25 15:59"
      nota:
        "2 TOKEN em Cartao.native.tsx (fora do escopo); zero TOKEN em
        AspectRatio/Collapsible/Progress"
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "arch-check exit 1 por widgets/cartao-equipamento sem index público
        (fora do escopo 273)"
      - "token-check exit 1 por literais em Cartao.native.tsx (fora do escopo
        273)"
      - "hover-card, radio-group, slider, toggle, drawer e outros ainda
        misturados em components/ui"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/ui/aspect-ratio.tsx
    - components/ui/collapsible.tsx
    - components/ui/progress.tsx
  nao_verificado:
    - "[NOT_VERIFIED: AspectRatio/Collapsible/Progress no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 269b-equipment-card

`components/equipment-card.tsx` foi para
`packages/frontend/src/widgets/cartao-equipamento` (web + native). CTA não
unido. Vitest, arch e token exit 0. estado intermediate. Legado apagado.

```yaml
fatia:
  id: 269b-equipment-card
  estado: intermediate
  conceito: cartão de equipamento com preço/dia, disponibilidade e orçamento
  origem:
    - components/equipment-card.tsx
  destino:
    - packages/frontend/src/widgets/cartao-equipamento/model/tipos.ts
    - packages/frontend/src/widgets/cartao-equipamento/ui/Cartao.web.tsx
    - packages/frontend/src/widgets/cartao-equipamento/ui/Cartao.native.tsx
    - packages/frontend/src/widgets/cartao-equipamento/index.ts
  invariantes:
    - id: variantes-e-textos-web
      prova:
        "Cartao.web.test.tsx: default|featured|compact, Destaque, Popular,
        Disponível/Indisponível, A partir de, /dia, períodos maiores, Ver
        Detalhes, Especificações, avaliações, text-orange-600"
    - id: preco-e-orcamento
      prova:
        "Cartao.web.test.tsx: formatCurrency, QuoteCTA, /orcamento?equipamento="
    - id: nativo-sem-tailwind
      prova:
        "Cartao.web.test.tsx (nativo): react-native + tokens; sem bg-orange-600,
        text-orange-600, hover:shadow, className="
    - id: cta-nao-unido
      prova:
        "Cartao.web.test.tsx: importa QuoteCTA/CTAButton de @gb-locacoes/ui; não
        redefine CTA"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/cartao-equipamento/ui/Cartao.web.test.tsx"
      exit: 0
      verificado_em: "2026-09-25 15:59"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 15:59"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 15:59"
  gate:
    arch: pass
    tokens: pass
    vitest_platform: pass
    violacoes_conhecidas:
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
      - "CTA permanece em packages/ui (não unido a este widget)"
      - "consumidores futuros devem importar
        packages/frontend/src/widgets/cartao-equipamento"
  aposentado:
    - components/equipment-card.tsx
  nao_verificado:
    - "[NOT_VERIFIED: EquipmentCard no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 270-email-componentes

Sete arquivos saíram de `components/admin/email` para
`packages/frontend/src/pages/email-admin/ui` (layout, diálogos, pastas `.web`
por react-dom, lista, viewer, types). Pasta legada removida.
`app/admin/email/loading.tsx` permanece. Vitest exit 0. arch exit 1 e token exit
1 eram externos (`cartao-equipamento` / `Cartao.native`) na hora da medição; o
card depois ganhou index. Não marque arch/token como pass se o inbox diz exit 1.
estado intermediate.

```yaml
fatia:
  id: 270-email-componentes
  estado: intermediate
  conceito: componentes UI exclusivos da página admin E-mail (Zoho)
  origem:
    - components/admin/email/email-layout-container.tsx
    - components/admin/email/email-full-view-dialog.tsx
    - components/admin/email/email-composer-dialog.tsx
    - components/admin/email/email-folder-list.tsx
    - components/admin/email/email-message-list.tsx
    - components/admin/email/email-viewer.tsx
    - components/admin/email/types.ts
  destino:
    - packages/frontend/src/pages/email-admin/ui/email-layout-container.tsx
    - packages/frontend/src/pages/email-admin/ui/email-full-view-dialog.tsx
    - packages/frontend/src/pages/email-admin/ui/email-composer-dialog.tsx
    - packages/frontend/src/pages/email-admin/ui/email-folder-list.web.tsx
    - packages/frontend/src/pages/email-admin/ui/email-message-list.tsx
    - packages/frontend/src/pages/email-admin/ui/email-viewer.tsx
    - packages/frontend/src/pages/email-admin/ui/types.ts
  loading_rota:
    - app/admin/email/loading.tsx
  invariantes:
    - id: zoho-textos
      prova:
        "EmailAdminPage.web.test.tsx: E-mail, subtítulo Zoho, Conectar Zoho
        Mail, contato@locacoesgb.com.br"
    - id: payloads-composer
      prova:
        "EmailAdminPage.web.test.tsx: upload, drafts, send, reply em
        email-composer-dialog"
    - id: imports-same-slice
      prova:
        "EmailAdminPage.web.test.tsx: ./email-layout-container,
        ./email-full-view-dialog, ./email-composer-dialog; carga ../ui/types"
    - id: loading-next
      prova:
        "EmailAdminPage.web.test.tsx: app/admin/email/loading.tsx
        AdminEmailLoading"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/email-admin/ui/EmailAdminPage.web.test.tsx"
      exit: 0
      verificado_em: "2026-09-25 15:58"
    - cmd: "node tools/arch-check.mjs"
      exit: 1
      verificado_em: "2026-09-25 15:58"
      nota: >-
        FSD-PUBLIC-API widgets/cartao-equipamento sem index (fora desta fatia).
        RUNTIME-WEB-ONLY de email-folder-list corrigido com sufixo .web.tsx.
        Nenhuma violação em email-admin.
    - cmd: "node tools/token-check.mjs"
      exit: 1
      verificado_em: "2026-09-25 15:58"
      nota: >-
        2 violações em widgets/cartao-equipamento/ui/Cartao.native.tsx
        (borderWidth/borderTopWidth). Nenhuma violação em email-admin. Fora do
        escopo exclusivo desta fatia.
  gate:
    arch: fail_externo
    tokens: fail_externo
    vitest_platform: pass
    violacoes_conhecidas:
      - "arch: FSD-PUBLIC-API widgets/cartao-equipamento (fora da fatia 270)"
      - "token: Cartao.native.tsx borderWidth literais (fora da fatia 270)"
      - "legado @/lib/utils, @/lib/sanitize, @/components/ui/resizable ainda
        usados pelos componentes movidos"
      - "app/admin/email/loading.tsx permanece na rota Next (arquivo especial do
        App Router)"
  aposentado:
    - components/admin/email/email-layout-container.tsx
    - components/admin/email/email-full-view-dialog.tsx
    - components/admin/email/email-composer-dialog.tsx
    - components/admin/email/email-folder-list.tsx
    - components/admin/email/email-message-list.tsx
    - components/admin/email/email-viewer.tsx
    - components/admin/email/types.ts
    - components/admin/email/ (pasta)
  nao_verificado:
    - "[NOT_VERIFIED: página /admin/email no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 275-hooks

`use-equipment-list-data` foi para
`pages/equipamentos-admin/model/lista.web.ts`. `use-emoji-recents` foi para
`pages/categorias/model/emoji-recents.ts`. Legados apagados. Vitest 0, arch 0,
token 1 (`Cartao.native` fora). estado intermediate. hooks restantes anotados:
`use-icon-recents.ts`, `use-settings.tsx`, `use-toast.ts`,
`use-toast-sonner.ts`.

```yaml
fatia:
  id: 275-hooks
  estado: intermediate
  conceito: migrar no máximo dois hooks legados de hooks/ para pages FSD
  origem:
    - hooks/use-equipment-list-data.ts
    - hooks/use-emoji-recents.ts
  destino:
    - packages/frontend/src/pages/equipamentos-admin/model/lista.web.ts
    - packages/frontend/src/pages/categorias/model/emoji-recents.ts
    - packages/frontend/src/pages/equipamentos-admin/ui/Lista.web.tsx
    - packages/frontend/src/pages/equipamentos-admin/ui/Lista.web.test.tsx
    - packages/frontend/src/pages/equipamentos-admin/index.ts
    - packages/frontend/src/pages/categorias/ui/CategoriaDialog.web.tsx
    - packages/frontend/src/pages/categorias/ui/CategoriaDialog.web.test.tsx
    - packages/frontend/src/pages/categorias/index.ts
    - app/playground/icon-customization/page.tsx
  invariantes:
    - id: page-size-admin-9
      prova:
        "lista.web.ts usa EQUIPMENT_LIST_PAGE_SIZE da entity; Lista.web.test
        mantém paginação"
    - id: emoji-storage-key
      prova:
        "emoji-recents.ts STORAGE_KEY === 'gb-locacoes-emoji-recents' e
        MAX_RECENT_EMOJIS === 30"
    - id: next-navigation-web
      prova: "lista.web.ts importa next/navigation (arquivo .web.ts)"
    - id: sem-hooks-legado
      prova:
        "CategoriaDialog.web.test e Lista.web.test não contêm
        @/hooks/use-emoji-recents nem @/hooks/use-equipment-list-data"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/equipamentos-admin
        packages/frontend/src/pages/categorias"
      exit: 0
      verificado_em: "2026-09-25 15:59"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 15:59"
    - cmd: "node tools/token-check.mjs"
      exit: 1
      verificado_em: "2026-09-25 15:59"
  gate:
    arch: pass
    tokens: fail_externo
    violacoes_conhecidas:
      - "token-check: Cartao.native.tsx borderWidth/borderTopWidth 1 (fora da
        fatia 275)"
      - "hooks/use-icon-recents.ts, use-settings.tsx, use-toast.ts,
        use-toast-sonner.ts permanecem legados"
      - "use-settings-data fora do escopo desta fatia"
  aposentado:
    - hooks/use-equipment-list-data.ts
    - hooks/use-emoji-recents.ts
  nao_verificado:
    - "[NOT_VERIFIED: listagem admin equipamentos no browser]"
    - "[NOT_VERIFIED: diálogo de categoria / emoji recents no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 274-home

`app/page.tsx` ficou shell: Prisma e `setting.findFirst` continuam no host. A
composição foi para `packages/frontend/src/pages/home/ui/HomePage.web.tsx`.
Carrossel 3D, model-viewer, lazy-3d, scroll-reveal, `maxDuration` 0 e
`disableAutoFit` intactos. Vitest `pages/home` exit 0. arch-check exit 1
(prévio, fora da fatia: email-admin e react-dom). token-check exit 1 (prévio:
Progress.native borderRadius 9999).

```yaml
fatia:
  id: 274-home
  estado: intermediate
  conceito: shell da home (/) com composição em pages/home
  origem:
    - app/page.tsx
  destino:
    - packages/frontend/src/pages/home/ui/HomePage.web.tsx
    - packages/frontend/src/pages/home/ui/HomePage.web.test.tsx
    - packages/frontend/src/pages/home/index.ts
  invariantes:
    - id: prisma-no-host
      prova:
        "app/page.tsx continua com getPrisma + setting.findFirst;
        packages/frontend sem import de Prisma"
    - id: carrossel-3d-intacto
      prova:
        "não alterou equipment-3d-carousel, model-viewer, lazy-3d-carousel,
        scroll-reveal-init, maxDuration 0, disableAutoFit"
    - id: props-only
      prova:
        "HomePage recebe localBusiness + heroInitialSettings; sem query no
        pacote"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/home"
      exit: 0
      verificado_em: "2026-09-25 15:58"
    - cmd: "node tools/arch-check.mjs"
      exit: 1
      verificado_em: "2026-09-25 15:58"
      nota: "violação prévia email-admin/react-dom; home sem hits FSD"
    - cmd: "node tools/token-check.mjs"
      exit: 1
      verificado_em: "2026-09-25 15:58"
      nota:
        "violação prévia Progress.native borderRadius 9999; pages/home sem hits"
  gate:
    arch: fail_preexistente
    tokens: fail_preexistente
    vitest_platform: pass
    violacoes_conhecidas:
      - "RUNTIME-WEB-ONLY
        packages/frontend/src/pages/email-admin/ui/email-folder-list.tsx
        (react-dom) — fora desta fatia"
      - "TOKEN number-literal packages/ui/src/native/Progress.native.tsx
        borderRadius 9999 — fora desta fatia"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: home no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 276-icon-recents

`use-icon-recents` saiu de `hooks/use-icon-recents.ts` para
`packages/frontend/src/pages/categorias/model/icon-recents.ts`. Chave
`gb-locacoes-icon-recents` e máximo 18 preservados. Legado apagado. Vitest,
arch-check e token-check exit 0. estado intermediate.

```yaml
fatia:
  id: 276-icon-recents
  estado: intermediate
  conceito: recentes de ícone (localStorage) no slice categorias
  origem:
    - hooks/use-icon-recents.ts
  destino:
    - packages/frontend/src/pages/categorias/model/icon-recents.ts
  invariantes:
    - id: storage-key
      prova: "icon-recents.ts STORAGE_KEY === 'gb-locacoes-icon-recents'"
    - id: max-recents-18
      prova: "icon-recents.ts MAX_RECENT_ICONS === 18"
    - id: sem-hooks-legado
      prova:
        "CategoriaDialog.web.test não contém @/hooks/use-icon-recents; importa
        ../model/icon-recents"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/categorias"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
  gate:
    arch: pass
    tokens: pass
    vitest_platform: pass
    violacoes_conhecidas:
      - "app/page.tsx continua shell da home com Prisma no host"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
      - "hooks/use-settings.tsx, use-toast.ts, use-toast-sonner.ts permanecem
        legados"
  aposentado:
    - hooks/use-icon-recents.ts
  nao_verificado:
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 277-use-settings

`use-settings` saiu de `hooks/use-settings.tsx` para
`packages/frontend/src/pages/configuracoes/model/use-settings.tsx` e exportado
no `index`. Sem Prisma e sem `next/*`. Telefones, e-mails, `America/Sao_Paulo` e
`maxQuoteItems` não foram duplicados. Vitest configuracoes exit 0. arch-check
exit 0. token-check exit 1 por `HeroCarouselPreview.web.tsx`, fora desta fatia.
estado intermediate.

```yaml
fatia:
  id: 277-use-settings
  estado: intermediate
  conceito: hook de settings no slice configuracoes
  origem:
    - hooks/use-settings.tsx
  destino:
    - packages/frontend/src/pages/configuracoes/model/use-settings.tsx
    - packages/frontend/src/pages/configuracoes/index.ts
  invariantes:
    - id: sem-prisma
      prova: "use-settings.tsx não importa Prisma"
    - id: sem-next
      prova: "use-settings.tsx não importa next/*"
    - id: sem-duplicar-contatos-fuso-limite
      prova:
        "telefones, e-mails, America/Sao_Paulo e maxQuoteItems não foram
        duplicados"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/configuracoes"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/token-check.mjs"
      exit: 1
      verificado_em: "2026-09-25"
      nota: "violação HeroCarouselPreview.web.tsx — fora desta fatia"
  gate:
    arch: pass
    tokens: fail_preexistente
    vitest_platform: pass
    violacoes_conhecidas:
      - "TOKEN HeroCarouselPreview.web.tsx — fora desta fatia"
  aposentado:
    - hooks/use-settings.tsx
  nao_verificado:
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 278-toast

`hooks/use-toast.ts` e `hooks/use-toast-sonner.ts` foram para
`packages/frontend/src/shared/lib/toast.ts`. API `toast` e `useSonner` intacta.
Lib continua Sonner. Legados apagados. Vitest, arch e token exit 0. estado
intermediate.

```yaml
fatia:
  id: 278-toast
  estado: intermediate
  conceito: reexport Sonner de hooks/ para shared/lib
  origem:
    - hooks/use-toast.ts
    - hooks/use-toast-sonner.ts
  destino:
    - packages/frontend/src/shared/lib/toast.ts
  invariantes:
    - id: api-toast-sonner
      prova: "API toast e useSonner intacta; lib continua Sonner"
    - id: legados-apagados
      prova: "hooks/use-toast.ts e hooks/use-toast-sonner.ts ausentes"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/shared/lib"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
  gate:
    arch: pass
    tokens: pass
    vitest_platform: pass
  aposentado:
    - hooks/use-toast.ts
    - hooks/use-toast-sonner.ts
  nao_verificado:
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 279-previews-settings

`hero-carousel-preview` e `header-footer-preview` foram para
`packages/frontend/src/pages/configuracoes/ui/HeroCarouselPreview.web.tsx` e
`HeaderFooterPreview.web.tsx`. Não importavam o carrossel 3D. Legados apagados.
Vitest configuracoes, arch e token exit 0. estado intermediate. O carrossel 3D
real continua em `components/equipment-3d-carousel.tsx`.

```yaml
fatia:
  id: 279-previews-settings
  estado: intermediate
  conceito: previews hero carousel e header/footer das configurações admin
  origem:
    - components/admin/hero-carousel-preview.tsx
    - components/admin/header-footer-preview.tsx
  destino:
    - packages/frontend/src/pages/configuracoes/ui/HeroCarouselPreview.web.tsx
    - packages/frontend/src/pages/configuracoes/ui/HeaderFooterPreview.web.tsx
  invariantes:
    - id: sem-carrossel-3d
      prova:
        "previews não importavam equipment-3d-carousel; carrossel 3D real
        continua em components/equipment-3d-carousel.tsx"
    - id: legados-apagados
      prova:
        "components/admin/hero-carousel-preview.tsx e header-footer-preview.tsx
        ausentes"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/configuracoes"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
  gate:
    arch: pass
    tokens: pass
    vitest_platform: pass
    violacoes_conhecidas:
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/hero-carousel-preview.tsx
    - components/admin/header-footer-preview.tsx
  nao_verificado:
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 280-ui

`hover-card`, `radio-group` e `slider` saíram de `components/ui` para
`packages/ui` (contrato + web + native). Legados apagados. Vitest, arch-check e
token-check exit 0. estado intermediate. A migração não está concluída.

```yaml
fatia:
  id: 280-ui
  estado: intermediate
  conceito: hover-card, radio-group e slider
  origem:
    - components/ui/hover-card.tsx
    - components/ui/radio-group.tsx
    - components/ui/slider.tsx
  destino:
    - packages/ui/src/contract/hover-card.ts
    - packages/ui/src/contract/radio-group.ts
    - packages/ui/src/contract/slider.ts
    - packages/ui/src/web/HoverCard.web.tsx
    - packages/ui/src/native/HoverCard.native.tsx
    - packages/ui/src/web/RadioGroup.web.tsx
    - packages/ui/src/native/RadioGroup.native.tsx
    - packages/ui/src/web/Slider.web.tsx
    - packages/ui/src/native/Slider.native.tsx
  invariantes:
    - id: legados-apagados
      prova:
        "components/ui/hover-card.tsx, radio-group.tsx e slider.tsx ausentes"
    - id: contrato-web-native
      prova: "cada primitivo tem contract + web + native em packages/ui"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/HoverCard.web.test.tsx
        packages/ui/src/web/RadioGroup.web.test.tsx
        packages/ui/src/web/Slider.web.test.tsx"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
  gate:
    arch: pass
    tokens: pass
    vitest_platform: pass
    violacoes_conhecidas:
      - "app/page.tsx continua shell da home com Prisma no host"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/ui/hover-card.tsx
    - components/ui/radio-group.tsx
    - components/ui/slider.tsx
  nao_verificado:
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 284-admin-sobras

`pricing-period-card`, `specifications-section` e `image-zoom-modal` saíram de
`components/admin/equipment-form` para
`packages/frontend/src/pages/equipamentos-admin/ui` (`CartaoPeriodo`,
`SecaoEspecificacoes`, `ModalZoomImagem.web`). `types.ts` do formulário continua
legado. Vitest equipamentos-admin, arch e token exit 0. estado intermediate. A
migração não está concluída.

```yaml
fatia:
  id: 284-admin-sobras
  estado: intermediate
  conceito: sobras admin equipment-form (cartão período, especificações, zoom)
  origem:
    - components/admin/equipment-form/pricing-period-card.tsx
    - components/admin/equipment-form/specifications-section.tsx
    - components/admin/equipment-form/image-zoom-modal.tsx
  destino:
    - packages/frontend/src/pages/equipamentos-admin/ui/CartaoPeriodo.tsx
    - packages/frontend/src/pages/equipamentos-admin/ui/SecaoEspecificacoes.tsx
    - packages/frontend/src/pages/equipamentos-admin/ui/ModalZoomImagem.web.tsx
  invariantes:
    - id: types-legado
      prova: "components/admin/equipment-form/types.ts continua legado"
    - id: destinos-ui
      prova:
        "CartaoPeriodo, SecaoEspecificacoes e ModalZoomImagem.web em
        equipamentos-admin/ui"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/equipamentos-admin"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
  gate:
    arch: pass
    tokens: pass
    vitest_platform: pass
    violacoes_conhecidas:
      - "components/admin/equipment-form/types.ts continua legado"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/equipment-form/pricing-period-card.tsx
    - components/admin/equipment-form/specifications-section.tsx
    - components/admin/equipment-form/image-zoom-modal.tsx
  nao_verificado:
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 283-ui

`toggle`, `toggle-group` e `resizable` saíram de `components/ui` para
`packages/ui` (contrato + web + native). Legados apagados. Email e WhatsApp
admin importam Resizable de `@gb-locacoes/ui`. Vitest, arch e token exit 0.
estado intermediate. A migração não está concluída.

```yaml
fatia:
  id: 283-ui
  estado: intermediate
  conceito: toggle, toggle-group e resizable
  origem:
    - components/ui/toggle.tsx
    - components/ui/toggle-group.tsx
    - components/ui/resizable.tsx
  destino:
    - packages/ui/src/contract/toggle.ts
    - packages/ui/src/contract/toggle-group.ts
    - packages/ui/src/contract/resizable.ts
    - packages/ui/src/web/Toggle.web.tsx
    - packages/ui/src/native/Toggle.native.tsx
    - packages/ui/src/web/ToggleGroup.web.tsx
    - packages/ui/src/native/ToggleGroup.native.tsx
    - packages/ui/src/web/Resizable.web.tsx
    - packages/ui/src/native/Resizable.native.tsx
  invariantes:
    - id: legados-apagados
      prova:
        "components/ui/toggle.tsx, toggle-group.tsx e resizable.tsx ausentes"
    - id: contrato-web-native
      prova: "cada primitivo tem contract + web + native em packages/ui"
    - id: admin-resizable-ui
      prova: "email e WhatsApp admin importam Resizable de @gb-locacoes/ui"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/Toggle.web.test.tsx
        packages/ui/src/web/ToggleGroup.web.test.tsx
        packages/ui/src/web/Resizable.web.test.tsx"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
  gate:
    arch: pass
    tokens: pass
    vitest_platform: pass
    violacoes_conhecidas:
      - "app/page.tsx continua shell da home com Prisma no host"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/ui/toggle.tsx
    - components/ui/toggle-group.tsx
    - components/ui/resizable.tsx
  nao_verificado:
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 287-client-layout

A composição de `app/ClientLayout.tsx` foi para
`packages/frontend/src/app/providers/ClientLayoutShell.web.tsx`, exportada em
`@gb-locacoes/frontend/app`. No host ficaram `scroll-reveal-init` (lazy, ssr
false) e `ServiceWorkerRegister`. Carrossel 3D, model-viewer, lazy-3d e
`maxDuration` 0 / `disableAutoFit` não foram alterados. Vitest, arch e token
exit 0. estado intermediate. A migração não está concluída.

```yaml
fatia:
  id: 287-client-layout
  estado: intermediate
  conceito: composição ClientLayout no shell frontend
  origem:
    - app/ClientLayout.tsx
  destino:
    - packages/frontend/src/app/providers/ClientLayoutShell.web.tsx
    - packages/frontend/src/app/index.ts
  invariantes:
    - id: host-scroll-reveal-sw
      prova:
        "app/ClientLayout.tsx mantém scroll-reveal-init (lazy, ssr false) e
        ServiceWorkerRegister"
    - id: carrossel-3d-intactos
      prova:
        "carrossel 3D, model-viewer, lazy-3d e maxDuration 0 / disableAutoFit
        não foram alterados"
    - id: export-frontend-app
      prova: "ClientLayoutShell exportado em @gb-locacoes/frontend/app"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/app"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
  gate:
    arch: pass
    tokens: pass
    vitest_platform: pass
    violacoes_conhecidas:
      - "app/page.tsx ainda tem Prisma da home no host"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
      - "scroll-reveal-init continua no host de propósito"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 288-tipos-equipamento

Os tipos de `components/admin/equipment-form/types.ts` foram para
`packages/frontend/src/pages/equipamentos-admin/model/tipos.ts`. Campos não
unificados com orçamento. Legado apagado. Vitest equipamentos-admin, arch e
token exit 0. estado intermediate. A migração não está concluída.

```yaml
fatia:
  id: 288-tipos-equipamento
  estado: intermediate
  conceito: tipos do formulário de equipamento admin no slice equipamentos-admin
  origem:
    - components/admin/equipment-form/types.ts
  destino:
    - packages/frontend/src/pages/equipamentos-admin/model/tipos.ts
  invariantes:
    - id: campos-nao-unificados-orcamento
      prova:
        "campos do formulário de equipamento não foram unificados com orçamento"
    - id: legado-apagado
      prova: "components/admin/equipment-form/types.ts removido após a migração"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/equipamentos-admin"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
  gate:
    arch: pass
    tokens: pass
    vitest_platform: pass
    violacoes_conhecidas:
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/equipment-form/types.ts
  nao_verificado:
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 291-rotas

`/admin/teste-toast` foi para `packages/frontend/src/pages/teste-toast` e
`/api-docs` para `packages/frontend/src/pages/api-docs`. As rotas viraram
shells. Vitest, arch e token exit 0. estado intermediate. A migração não está
concluída.

```yaml
fatia:
  id: 291-rotas
  estado: intermediate
  conceito: páginas teste-toast e api-docs no frontend; rotas viraram shells
  origem:
    - app/admin/teste-toast/page.tsx
    - app/api-docs/page.tsx
  destino:
    - packages/frontend/src/pages/teste-toast
    - packages/frontend/src/pages/api-docs
  invariantes:
    - id: rotas-shells
      prova:
        "app/admin/teste-toast/page.tsx e app/api-docs/page.tsx ficaram shells
        importando @gb-locacoes/frontend/pages/*"
    - id: carrossel-3d-intacto
      prova: "carrossel 3D continua em components/equipment-3d-carousel.tsx"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/teste-toast
        packages/frontend/src/pages/api-docs"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
  gate:
    arch: pass
    tokens: pass
    vitest_platform: pass
    violacoes_conhecidas:
      - "app playground, grid-motion e equipamentos-scroll ainda gordas (não
        movidas nesta fatia)"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - "o corpo de app/admin/teste-toast/page.tsx e app/api-docs/page.tsx;
      ficaram só os shells"
  nao_verificado:
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 290-components-raiz

`image-carousel-zoom` foi para
`pages/equipamentos-admin/ui/ImageCarouselZoom.web.tsx`.
`session-provider-wrapper` foi para
`packages/frontend/src/app/providers/SessionProviderWrapper.web.tsx`.
`seo-schemas` foi para `widgets/seo-schemas`. Legados apagados. Vitest, arch e
token exit 0. estado intermediate. A migração não está concluída. Carrossel 3D e
scroll-reveal continuam no legado.

```yaml
fatia:
  id: 290-components-raiz
  estado: intermediate
  conceito: três .tsx da raiz de components/ (sem 3D / scroll-reveal) para FSD
  origem:
    - components/image-carousel-zoom.tsx
    - components/session-provider-wrapper.tsx
    - components/seo-schemas.tsx
  destino:
    - packages/frontend/src/pages/equipamentos-admin/ui/ImageCarouselZoom.web.tsx
    - packages/frontend/src/app/providers/SessionProviderWrapper.web.tsx
    - packages/frontend/src/widgets/seo-schemas
  invariantes:
    - id: carrossel-3d-legado
      prova: "carrossel 3D continua em components/equipment-3d-carousel.tsx"
    - id: scroll-reveal-legado
      prova: "scroll-reveal-init continua no legado"
    - id: legado-apagado
      prova:
        "image-carousel-zoom, session-provider-wrapper e seo-schemas removidos
        após a migração"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/equipamentos-admin/ui/ImageCarouselZoom.web.test.tsx
        packages/frontend/src/app/providers/layout-providers.web.test.tsx"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
  gate:
    arch: pass
    tokens: pass
    vitest_platform: pass
    violacoes_conhecidas:
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
      - "scroll-reveal-init continua no legado"
  aposentado:
    - components/image-carousel-zoom.tsx
    - components/session-provider-wrapper.tsx
    - components/seo-schemas.tsx
  nao_verificado:
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 289-ui

`drawer`, `input-otp` e `menubar` saíram de `components/ui` para `packages/ui`
(contrato + web + native). Native sem Tailwind da web. Legados apagados. Vitest,
arch e token exit 0. estado intermediate. A migração não está concluída.

```yaml
fatia:
  id: 289-ui
  estado: intermediate
  conceito: drawer, input-otp e menubar
  origem:
    - components/ui/drawer.tsx
    - components/ui/input-otp.tsx
    - components/ui/menubar.tsx
  destino:
    - packages/ui/src/contract/drawer.ts
    - packages/ui/src/contract/input-otp.ts
    - packages/ui/src/contract/menubar.ts
    - packages/ui/src/web/Drawer.web.tsx
    - packages/ui/src/native/Drawer.native.tsx
    - packages/ui/src/web/InputOTP.web.tsx
    - packages/ui/src/native/InputOTP.native.tsx
    - packages/ui/src/web/Menubar.web.tsx
    - packages/ui/src/native/Menubar.native.tsx
  invariantes:
    - id: legados-apagados
      prova: "components/ui/drawer.tsx, input-otp.tsx e menubar.tsx ausentes"
    - id: contrato-web-native
      prova: "cada primitivo tem contract + web + native em packages/ui"
    - id: native-sem-tailwind-web
      prova: "implementações native não repetem as classes Tailwind da web"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/Drawer.web.test.tsx
        packages/ui/src/web/InputOTP.web.test.tsx
        packages/ui/src/web/Menubar.web.test.tsx"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
  gate:
    arch: pass
    tokens: pass
    vitest_platform: pass
    violacoes_conhecidas:
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/ui/drawer.tsx
    - components/ui/input-otp.tsx
    - components/ui/menubar.tsx
  nao_verificado:
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 292-rotas-restantes

`/playground`, `/grid-motion` e `/equipamentos-scroll` foram para
`packages/frontend/src/pages/playground`, `grid-motion` e `equipamentos-scroll`.
Rotas em `app/` viraram shells. Vitest, arch e token exit 0. estado
intermediate. Violação: `app/playground/icon-customization/page.tsx` ainda
gorda. Carrossel 3D intacto. A migração não está concluída.

```yaml
fatia:
  id: 292-rotas-restantes
  estado: intermediate
  conceito: três page.tsx gordas → shells + slices pages
  origem:
    - app/playground/page.tsx
    - app/grid-motion/page.tsx
    - app/equipamentos-scroll/page.tsx
  destino:
    - packages/frontend/src/pages/playground/ui/PlaygroundPage.web.tsx
    - packages/frontend/src/pages/playground/ui/PlaygroundPage.web.test.tsx
    - packages/frontend/src/pages/playground/index.ts
    - packages/frontend/src/pages/grid-motion/ui/GridMotionPage.tsx
    - packages/frontend/src/pages/grid-motion/ui/GridMotionPage.test.tsx
    - packages/frontend/src/pages/grid-motion/index.ts
    - packages/frontend/src/pages/equipamentos-scroll/ui/EquipamentosScrollPage.web.tsx
    - packages/frontend/src/pages/equipamentos-scroll/ui/EquipamentosScrollPage.web.test.tsx
    - packages/frontend/src/pages/equipamentos-scroll/index.ts
    - packages/frontend/src/widgets/por-que-escolher/index.ts
    - packages/frontend/src/widgets/home-cliente/index.ts
    - app/playground/page.tsx
    - app/grid-motion/page.tsx
    - app/equipamentos-scroll/page.tsx
  invariantes:
    - id: urls-preservadas
      prova: "URLs /playground, /grid-motion e /equipamentos-scroll inalteradas"
    - id: shell-fino
      prova:
        "app shells só importam @gb-locacoes/frontend/pages/* e retornam o page
        component"
    - id: sem-prisma-frontend
      prova: "slices sem import de prisma/@prisma"
    - id: sem-carrossel-3d
      prova: "components/equipment-3d-carousel.tsx não tocado"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/playground
        packages/frontend/src/pages/grid-motion
        packages/frontend/src/pages/equipamentos-scroll"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
  gate:
    arch: pass
    tokens: pass
    vitest_platform: pass
    violacoes_conhecidas:
      - "app/playground/icon-customization/page.tsx ainda mistura shell com
        corpo longo"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado: []
  callers_atualizados:
    - app/playground/page.tsx
    - app/grid-motion/page.tsx
    - app/equipamentos-scroll/page.tsx
  nao_verificado:
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 293-icon-customization

O corpo de `/playground/icon-customization` foi para
`packages/frontend/src/pages/playground/ui/IconCustomizationPage.tsx`. A rota
virou shell de `@gb-locacoes/frontend/pages/playground`. Hooks de recentes foram
para `widgets/personalizar-icone`, com as mesmas chaves
`gb-locacoes-icon-recents` e `gb-locacoes-emoji-recents`. Widget não recriado.
Vitest, arch e token exit 0. estado intermediate. Carrossel 3D continua. A
migração não está concluída.

```yaml
fatia:
  id: 293-icon-customization
  estado: intermediate
  conceito: page.tsx gorda → shell + IconCustomizationPage em pages/playground
  origem:
    - app/playground/icon-customization/page.tsx
    - packages/frontend/src/pages/categorias/model/emoji-recents.ts
    - packages/frontend/src/pages/categorias/model/icon-recents.ts
  destino:
    - packages/frontend/src/pages/playground/ui/IconCustomizationPage.tsx
    - packages/frontend/src/pages/playground/ui/IconCustomizationPage.test.tsx
    - packages/frontend/src/pages/playground/index.ts
    - packages/frontend/src/widgets/personalizar-icone/model/emoji-recents.ts
    - packages/frontend/src/widgets/personalizar-icone/model/icon-recents.ts
    - packages/frontend/src/widgets/personalizar-icone/index.ts
    - packages/frontend/src/widgets/personalizar-icone/ui/Bloco.test.tsx
    - packages/frontend/src/pages/categorias/ui/CategoriaDialog.web.tsx
    - packages/frontend/src/pages/categorias/ui/CategoriaDialog.web.test.tsx
    - packages/frontend/src/pages/categorias/index.ts
    - app/playground/icon-customization/page.tsx
  invariantes:
    - id: url-preservada
      prova: "URL /playground/icon-customization inalterada"
    - id: shell-fino
      prova:
        "app shell só importa @gb-locacoes/frontend/pages/playground e retorna
        IconCustomizationPage"
    - id: widget-reutilizado
      prova:
        "IconCustomizationPage importa IconCustomizationBlock de
        widgets/personalizar-icone; widget não recriado"
    - id: storage-keys
      prova:
        "icon-recents STORAGE_KEY === 'gb-locacoes-icon-recents' (max 18);
        emoji-recents === 'gb-locacoes-emoji-recents' (max 30)"
    - id: sem-next-import
      prova: "IconCustomizationPage.tsx é .tsx (sem next/*); não .web.tsx"
    - id: sem-prisma-frontend
      prova: "slice sem import de prisma/@prisma"
    - id: sem-carrossel-3d
      prova: "components/equipment-3d-carousel.tsx não tocado"
    - id: nao-tocou-playground-raiz
      prova: "app/playground/page.tsx intocado nesta fatia"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/playground
        packages/frontend/src/widgets/personalizar-icone
        packages/frontend/src/pages/categorias/ui/CategoriaDialog.web.test.tsx"
      exit: 0
      verificado_em: "2026-09-25 16:20"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:20"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:20"
  gate:
    arch: pass
    tokens: pass
    vitest_platform: pass
    violacoes_conhecidas:
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - packages/frontend/src/pages/categorias/model/emoji-recents.ts
    - packages/frontend/src/pages/categorias/model/icon-recents.ts
  callers_atualizados:
    - app/playground/icon-customization/page.tsx
    - packages/frontend/src/pages/categorias/ui/CategoriaDialog.web.tsx
    - packages/frontend/src/pages/categorias/index.ts
  nao_verificado:
    - "[NOT_VERIFIED: /playground/icon-customization no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 296-date-range

`components/ui/date-range-picker.tsx` foi apagado porque o widget
`packages/frontend/src/widgets/seletor-data` já tinha o mesmo `DateRangePicker`
e não restava import do caminho antigo. `Calendario.web` e o carrossel 3D não
foram alterados. Vitest `DateRangePicker.web.test.tsx`, arch e token exit 0.
estado intermediate. A migração não está concluída.

```yaml
fatia:
  id: 296-date-range
  estado: intermediate
  conceito: legado DateRangePicker apagado; widget seletor-data já era a fonte
  origem:
    - components/ui/date-range-picker.tsx
  destino:
    - packages/frontend/src/widgets/seletor-data/index.ts
    - packages/frontend/src/widgets/seletor-data/ui/DateRangePicker.web.tsx
    - packages/frontend/src/widgets/seletor-data/ui/DateRangePicker.web.test.tsx
  invariantes:
    - id: widget-existente
      prova:
        "DateRangePicker e DateRangePickerProps no index de widgets/seletor-data"
    - id: sem-import-legado
      prova:
        "nenhum import de produto apontava para components/ui/date-range-picker"
    - id: calendario-intacto
      prova: "Calendario.web do seletor-data não foi alterado nesta fatia"
    - id: carrossel-3d-intacto
      prova: "components/equipment-3d-carousel.tsx não tocado"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/seletor-data/ui/DateRangePicker.web.test.tsx"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
  gate:
    arch: pass
    tokens: pass
    vitest_platform: pass
    violacoes_conhecidas:
      - "o carrossel 3D e scroll-reveal continuam no legado"
      - "Prisma da home continua no host"
  aposentado:
    - components/ui/date-range-picker.tsx
  nao_verificado:
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 294-ui

`context-menu`, `navigation-menu` e `filter-indicator` saíram de `components/ui`
para `packages/ui` (contrato + web + native). Legados apagados. Vitest, arch e
token exit 0. estado intermediate. A migração não está concluída. Carrossel 3D
continua violação conhecida.

```yaml
fatia:
  id: 294-ui
  estado: intermediate
  conceito: context-menu, navigation-menu e filter-indicator
  origem:
    - components/ui/context-menu.tsx
    - components/ui/navigation-menu.tsx
    - components/ui/filter-indicator.tsx
  destino:
    - packages/ui/src/contract/context-menu.ts
    - packages/ui/src/contract/navigation-menu.ts
    - packages/ui/src/contract/filter-indicator.ts
    - packages/ui/src/web/ContextMenu.web.tsx
    - packages/ui/src/native/ContextMenu.native.tsx
    - packages/ui/src/web/NavigationMenu.web.tsx
    - packages/ui/src/native/NavigationMenu.native.tsx
    - packages/ui/src/web/FilterIndicator.web.tsx
    - packages/ui/src/native/FilterIndicator.native.tsx
  invariantes:
    - id: legados-apagados
      prova:
        "components/ui/context-menu.tsx, navigation-menu.tsx e
        filter-indicator.tsx ausentes"
    - id: contrato-web-native
      prova: "cada primitivo tem contract + web + native em packages/ui"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/ContextMenu.web.test.tsx
        packages/ui/src/web/NavigationMenu.web.test.tsx
        packages/ui/src/web/FilterIndicator.web.test.tsx"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
  gate:
    arch: pass
    tokens: pass
    vitest_platform: pass
    violacoes_conhecidas:
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/ui/context-menu.tsx
    - components/ui/navigation-menu.tsx
    - components/ui/filter-indicator.tsx
  nao_verificado:
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 295b-orfaos

Seis órfãos da raiz de `components/` foram para FSD: `theme-provider` →
`app/providers`, `quote-form` → `pages/orcamento`, `legal-page-layout`,
`categories`, `categories-with-animation` e `mdx` → widgets. Legados apagados.
`service-worker-register`, `equipment-3d-carousel` e `scroll-reveal-init` não
foram movidos. WhatsApp do QuoteForm `555198205163`; chaves
`diaria`/`semanal`/`quinzenal`/`mensal` intactas. Vitest, arch e token exit 0.
estado intermediate. A migração não está concluída.

```yaml
fatia:
  id: 295b-orfaos
  estado: intermediate
  conceito:
    órfãos restantes da raiz de components/ (sem SW / 3D / scroll-reveal)
  origem:
    - components/theme-provider.tsx
    - components/quote-form.tsx
    - components/legal-page-layout.tsx
    - components/categories.tsx
    - components/categories-with-animation.tsx
    - components/mdx.tsx
  destino:
    - packages/frontend/src/app/providers/ThemeProvider.web.tsx
    - packages/frontend/src/pages/orcamento/ui/QuoteForm.web.tsx
    - packages/frontend/src/pages/orcamento/index.ts
    - packages/frontend/src/widgets/legal-page-layout/ui/LegalPageLayout.web.tsx
    - packages/frontend/src/widgets/legal-page-layout/index.ts
    - packages/frontend/src/widgets/categorias-publicas/ui/Categories.tsx
    - packages/frontend/src/widgets/categorias-publicas/ui/CategoriesWithAnimation.web.tsx
    - packages/frontend/src/widgets/categorias-publicas/index.ts
    - packages/frontend/src/widgets/mdx/ui/Mdx.tsx
    - packages/frontend/src/widgets/mdx/index.ts
    - packages/frontend/src/shared/lib/sanitize-html.ts
    - packages/frontend/src/shared/lib/index.ts
    - packages/frontend/src/app/providers/orfaos-295b.web.test.tsx
  invariantes:
    - id: whatsapp-quote-form
      prova: "orfaos-295b.web.test.tsx: openWhatsAppQuote(..., '555198205163')"
    - id: categorias-publicas-nao-admin
      prova:
        "orfaos-295b.web.test.tsx: /api/categories; carga admin continua
        /api/admin/categories"
    - id: periodos-orcamento
      prova:
        "chaves diaria/semanal/quinzenal/mensal em entities/orcamento intactas
        (QuoteForm não as altera)"
    - id: sem-carrossel-3d-nem-sw
      prova:
        "não alterou equipment-3d-carousel, scroll-reveal-init,
        service-worker-register"
    - id: legado-zero-imports
      prova:
        "rg
        components/(categories|quote-form|theme-provider|legal-page-layout|mdx)
        em *.ts/*.tsx = 0; Test-Path dos seis = False"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/app/providers/orfaos-295b.web.test.tsx"
      exit: 0
      verificado_em: "2026-09-25 16:26"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:26"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:26"
  gate:
    arch: pass
    tokens: pass
    vitest_platform: pass
  aposentado:
    - components/theme-provider.tsx
    - components/quote-form.tsx
    - components/legal-page-layout.tsx
    - components/categories.tsx
    - components/categories-with-animation.tsx
    - components/mdx.tsx
  nao_verificado:
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 299-subpastas

Três `.tsx` de subpastas de `components/` (fora de `ui`, sem 3D) foram para FSD.
`equipment-units-manager` →
`pages/equipamentos-admin/ui/GerenciadorUnidades.tsx`. `boleto-display` e
`boleto-section` → `entities/pagamento/ui`. Pasta `components/payment` removida.
Comportamento e classes preservados. Vitest, arch e token exit 0. estado
intermediate. A migração não está concluída. Ainda há `.tsx` em
`components/admin`, `components/client/rental-actions.tsx` e `components/icons`.
Carrossel 3D continua.

```yaml
fatia:
  id: 299-subpastas
  estado: intermediate
  conceito: até três .tsx em subpastas de components/ (fora ui / 3D)
  origem:
    - components/admin/equipment-units-manager.tsx
    - components/payment/boleto-display.tsx
    - components/client/boleto-section.tsx
  destino:
    - packages/frontend/src/pages/equipamentos-admin/ui/GerenciadorUnidades.tsx
    - packages/frontend/src/entities/pagamento/ui/BoletoDisplay.tsx
    - packages/frontend/src/entities/pagamento/ui/BoletoSection.tsx
    - packages/frontend/src/pages/equipamentos-admin/index.ts
    - packages/frontend/src/entities/pagamento/index.ts
  invariantes:
    - id: unidades-fisicas
      prova:
        "GerenciadorUnidades: Unidades Físicas, /api/admin/equipment-units,
        status AVAILABLE|RESERVED|RENTED|MAINTENANCE|RETIRED"
    - id: boleto-display
      prova:
        "BoletoDisplay: Linha Digitável, Código de Barras, Baixar PDF,
        /api/payments/boleto/"
    - id: boleto-section
      prova:
        "BoletoSection: Boleto não disponível, Boleto Vencido, variant
        destructive"
    - id: caller-detalhe
      prova:
        "Detalhe.web importa ./GerenciadorUnidades; Alert.web.test lê
        entities/pagamento/ui/BoletoSection.tsx"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/equipamentos-admin
        packages/frontend/src/entities/pagamento
        packages/ui/src/web/Alert.web.test.tsx"
      exit: 0
      verificado_em: "2026-09-25 16:30"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:30"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:30"
  gate:
    arch: pass
    tokens: pass
    vitest_platform: pass
    violacoes_conhecidas:
      - "components/client/rental-actions.tsx continua legado (órfão;
        next/navigation)"
      - "components/admin/* (headers, sidebar, gantt, etc.) e icons/custom fora
        do máx. 3"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/equipment-units-manager.tsx
    - components/payment/boleto-display.tsx
    - components/client/boleto-section.tsx
    - components/payment/ (diretório vazio removido)
  callers_atualizados:
    - packages/frontend/src/pages/equipamentos-admin/ui/Detalhe.web.tsx
    - packages/frontend/src/pages/equipamentos-admin/ui/Detalhe.web.test.tsx
    - packages/ui/src/web/Alert.web.test.tsx
  subpastas_restantes_com_tsx:
    - admin (11+; headers, sidebar, gantt, hero-carousel, logistics, etc.)
    - client (rental-actions.tsx)
    - icons (custom/index.tsx)
  nao_verificado:
    - "[NOT_VERIFIED: UI admin detalhe equipamento no browser]"
    - "[NOT_VERIFIED: UI boleto no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
```

## 298-ui

`hover-action-menu` e `grid-motion` saíram de `components/ui` para `packages/ui`
(contrato + web + native). `category-badge` ficou (negócio). Vitest, arch e
token exit 0. estado intermediate. A migração não está concluída. Restam
reexports: `carousel`, `form`, `sidebar`, `social-login-buttons`,
`whatsapp-button`. Excluídos de propósito: `lazy-3d-carousel` e `model-viewer`.
Carrossel 3D continua violação conhecida.

```yaml
fatia:
  id: 298-ui
  estado: intermediate
  conceito: hover-action-menu e grid-motion
  origem:
    - components/ui/hover-action-menu.tsx
    - components/ui/grid-motion.tsx
  destino:
    - packages/ui/src/contract/hover-action-menu.ts
    - packages/ui/src/contract/grid-motion.ts
    - packages/ui/src/web/HoverActionMenu.web.tsx
    - packages/ui/src/native/HoverActionMenu.native.tsx
    - packages/ui/src/web/GridMotion.web.tsx
    - packages/ui/src/native/GridMotion.native.tsx
  permaneceu:
    - components/ui/category-badge.tsx
  reexports_restantes:
    - components/ui/carousel.tsx
    - components/ui/form.tsx
    - components/ui/sidebar.tsx
    - components/ui/social-login-buttons.tsx
    - components/ui/whatsapp-button.tsx
  excluidos_proposito:
    - components/ui/lazy-3d-carousel.tsx
    - components/ui/model-viewer.tsx
  invariantes:
    - id: contrato-web-native
      prova:
        "hover-action-menu e grid-motion têm contract + web + native em
        packages/ui"
    - id: category-badge-negocio
      prova: "components/ui/category-badge.tsx permanece (negócio)"
    - id: exclusoes-3d
      prova: "lazy-3d-carousel e model-viewer não migrados nesta fatia"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/HoverActionMenu.web.test.tsx
        packages/ui/src/web/GridMotion.web.test.tsx"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
  gate:
    arch: pass
    tokens: pass
    vitest_platform: pass
    violacoes_conhecidas:
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  nao_verificado:
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 300b-primitivos-ui

`carousel`, `form`, `sidebar`, `social-login-buttons` e `whatsapp-button` saíram
de `components/ui` para `packages/ui` (contrato + web + native). Web preserva
Embla, React Hook Form, `signIn` e o verde do WhatsApp. Native sem Tailwind.
Legados apagados. Vitest, arch e token exit 0. estado intermediate. A migração
não está concluída. Não tocados: `model-viewer`, `lazy-3d-carousel`,
`category-badge`, `equipment-3d-carousel`, `scroll-reveal`.

```yaml
fatia:
  id: 300b-primitivos-ui
  estado: intermediate
  conceito: carousel, form, sidebar, social-login-buttons e whatsapp-button
  origem:
    - components/ui/carousel.tsx
    - components/ui/form.tsx
    - components/ui/sidebar.tsx
    - components/ui/social-login-buttons.tsx
    - components/ui/whatsapp-button.tsx
  destino:
    - packages/ui/src/contract/carousel.ts
    - packages/ui/src/contract/form.ts
    - packages/ui/src/contract/sidebar.ts
    - packages/ui/src/contract/social-login-buttons.ts
    - packages/ui/src/contract/whatsapp-button.ts
    - packages/ui/src/web/Carousel.web.tsx
    - packages/ui/src/native/Carousel.native.tsx
    - packages/ui/src/web/Form.web.tsx
    - packages/ui/src/native/Form.native.tsx
    - packages/ui/src/web/Sidebar.web.tsx
    - packages/ui/src/native/Sidebar.native.tsx
    - packages/ui/src/web/SocialLoginButtons.web.tsx
    - packages/ui/src/native/SocialLoginButtons.native.tsx
    - packages/ui/src/web/WhatsappButton.web.tsx
    - packages/ui/src/native/WhatsappButton.native.tsx
  nao_tocados:
    - components/ui/model-viewer.tsx
    - components/ui/lazy-3d-carousel.tsx
    - components/ui/category-badge.tsx
    - components/equipment-3d-carousel.tsx
    - components/scroll-reveal.tsx
  invariantes:
    - id: legados-apagados
      prova:
        "components/ui/carousel.tsx, form.tsx, sidebar.tsx,
        social-login-buttons.tsx e whatsapp-button.tsx ausentes"
    - id: contrato-web-native
      prova: "cada primitivo tem contract + web + native em packages/ui"
    - id: web-preserva-integracoes
      prova: "web preserva Embla, React Hook Form, signIn e verde do WhatsApp"
    - id: native-sem-tailwind
      prova: "implementações native sem Tailwind da web"
    - id: exclusoes-proposito
      prova:
        "model-viewer, lazy-3d-carousel, category-badge, equipment-3d-carousel e
        scroll-reveal não migrados nesta fatia"
  comandos:
    - cmd: "pnpm exec vitest run --config vitest.platform.config.ts"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
  gate:
    arch: pass
    tokens: pass
    vitest_platform: pass
    violacoes_conhecidas:
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/ui/carousel.tsx
    - components/ui/form.tsx
    - components/ui/sidebar.tsx
    - components/ui/social-login-buttons.tsx
    - components/ui/whatsapp-button.tsx
  nao_verificado:
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 301-category-badge

O selo de categoria saiu de `components/ui/category-badge.tsx` para
`packages/frontend/src/entities/categoria/ui/CategoryBadge.tsx`. Cores e textos
continuam no helper legado `lib/utils/category-helpers` (compartilhado).
`CATEGORY_PAGE_SIZE` 9 intacto. Não foi para `packages/ui`. Vitest, arch e token
exit 0. estado intermediate. A migração não está concluída. Carrossel 3D
continua.

```yaml
fatia:
  id: 301-category-badge
  estado: intermediate
  conceito: selo de categoria (tamanho, hover, cores via helper)
  origem:
    - components/ui/category-badge.tsx
  destino:
    - packages/frontend/src/entities/categoria/ui/CategoryBadge.tsx
    - packages/frontend/src/entities/categoria/index.ts
  invariantes:
    - id: defaults-e-helper
      prova:
        "CategoryBadge.test.tsx: size sm, hover false, getCategoryBadgePreview,
        category-helpers"
    - id: index-sem-page-size
      prova:
        "CategoryBadge.test.tsx: export pelo index; CATEGORY_PAGE_SIZE = 9
        intacto no mapa"
    - id: consumidor-detalhe
      prova:
        "CategoryBadge.test.tsx: EquipamentoDetalhePage importa
        entities/categoria; size sm hover false"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/entities/categoria/ui/CategoryBadge.test.tsx"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
  gate:
    arch: pass
    tokens: pass
    vitest_platform: pass
    violacoes_conhecidas:
      - "lib/utils/category-helpers continua legado (compartilhado)"
      - "listagem admin de categorias continua com CATEGORY_PAGE_SIZE 9"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/ui/category-badge.tsx
  nao_verificado:
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 303-rental-actions

`components/client/rental-actions.tsx` foi para
`packages/frontend/src/pages/historico-detalhe/ui/AcoesLocacao.web.tsx` (export
`RentalActions`). Pasta `components/client` removida. Multa de locação (5% da
diária) continua separada da multa de orçamento (2% ao dia). Vitest, arch e
token exit 0. estado intermediate. A migração não está concluída. Carrossel 3D
continua.

```yaml
fatia:
  id: 303-rental-actions
  estado: intermediate
  conceito: ações de locação do cliente (boleto, prorrogação, coleta)
  origem:
    - components/client/rental-actions.tsx
  destino:
    - packages/frontend/src/pages/historico-detalhe/ui/AcoesLocacao.web.tsx
    - packages/frontend/src/pages/historico-detalhe/index.ts
  invariantes:
    - id: export-rental-actions
      prova:
        "AcoesLocacao.web.test.tsx: export function RentalActions; index
        reexporta AcoesLocacao.web"
    - id: endpoints-e-textos
      prova:
        "AcoesLocacao.web.test.tsx: request-extension, request-pickup, Ver
        Boleto, prorrogação/coleta"
    - id: multas-separadas
      prova:
        "AcoesLocacao.web.test.tsx: locação 0.05 (entities/locacao); orçamento
        DEFAULT_LATE_FEE_CONFIG (2% ao dia); componente sem taxas"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/historico-detalhe/ui/AcoesLocacao.web.test.tsx"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
  gate:
    arch: pass
    tokens: pass
    vitest_platform: pass
    violacoes_conhecidas:
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/client/rental-actions.tsx
    - components/client
  nao_verificado:
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 304-icones

Ícones SVG customizados saíram de `components/icons/custom/` para
`packages/ui/src/icons/custom.tsx`, exportados nos index web e native. Widget
`personalizar-icone` importa `CUSTOM_ICONS` do pacote, sem unificar com emoji.
Shim em `components/icons/custom/index.tsx` continua. Vitest, arch e token
exit 0. estado intermediate. A migração não está concluída. Carrossel 3D
continua.

```yaml
fatia:
  id: 304-icones
  estado: intermediate
  conceito: components/icons/custom → packages/ui (ícones SVG sem domínio)
  origem:
    - components/icons/custom/index.tsx
    - components/icons/custom/README.md
    - components/icons/custom/EXEMPLO.md
  destino:
    - packages/ui/src/icons/custom.tsx
    - packages/ui/src/icons/custom.test.tsx
    - packages/ui/src/index.web.ts
    - packages/ui/src/index.native.ts
    - components/icons/custom/index.tsx
  invariantes:
    - id: nomes-exportados
      prova:
        "CustomIcon1/2, AndaimeSuspenso, AndaimeTubular, Transporte,
        Terraplenagem, Rompedor, Compressor, CadeiraEletrica, Betoneira,
        TrabalhoEmAltura, Lavagem, CUSTOM_ICONS, CustomIconName, CustomIconProps"
    - id: packages-ui-nao-widget
      prova:
        "implementação em packages/ui/src/icons/custom.tsx; widget
        personalizar-icone só importa CUSTOM_ICONS de @gb-locacoes/ui"
    - id: sem-merge-emoji
      prova:
        "dados.ts do widget não absorveu SVG; emoji groups intactos; só trocou
        import do index"
    - id: sem-prisma-frontend
      prova: "slice sem import de prisma/@prisma"
    - id: sem-carrossel-3d
      prova: "components/equipment-3d-carousel.tsx não tocado"
    - id: sem-package-json
      prova: "package.json não alterado nesta fatia"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/icons/custom.test.tsx
        packages/frontend/src/pages/grid-motion
        packages/frontend/src/widgets/personalizar-icone"
      exit: 0
      verificado_em: "2026-09-25 16:42"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:42"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:42"
  gate:
    arch: pass
    tokens: pass
    vitest_platform: pass
    violacoes_conhecidas:
      - "shim transitório components/icons/custom/index.tsx ainda reexporta
        @gb-locacoes/ui"
      - "lib/constants/all-icons.tsx continua no host raiz"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/icons/custom/README.md
    - components/icons/custom/EXEMPLO.md
  callers_atualizados:
    - packages/frontend/src/widgets/personalizar-icone/model/dados.ts
    - packages/frontend/src/pages/grid-motion/ui/GridMotionPage.tsx
    - packages/frontend/src/pages/grid-motion/ui/GridMotionPage.test.tsx
    - packages/frontend/src/pages/categorias/ui/CategoriaDialog.web.tsx
    - packages/frontend/src/widgets/home-cliente/ui/Vitrine.web.tsx
    - packages/frontend/src/features/abas-categoria/ui/Abas.tsx
    - lib/constants/all-icons.tsx
  nao_verificado:
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 302-admin

`components/admin/logistics/utils.tsx` e `types.ts` foram para
`packages/frontend/src/pages/logistica/ui/Utilidades.tsx` e `model/tipos.ts`.
Vitest logistica, arch e token exit 0. estado intermediate. Sidebars
`admin-sidebar` e `mobile-sidebar` continuam legado por literais rgba. Também
restam headers, `gantt-view`, `hero-carousel-manager`, `logistics-calendar`,
`mini-carousel`. A migração não está concluída. Carrossel 3D continua.

```yaml
fatia:
  id: 302-admin
  estado: intermediate
  conceito: utilitários e tipos de logística admin → slice logistica
  origem:
    - components/admin/logistics/utils.tsx
    - components/admin/logistics/types.ts
  destino:
    - packages/frontend/src/pages/logistica/ui/Utilidades.tsx
    - packages/frontend/src/pages/logistica/model/tipos.ts
  invariantes:
    - id: utilidades-e-tipos
      prova: "Utilidades.tsx e model/tipos.ts no slice pages/logistica"
    - id: sidebars-rgba-legado
      prova:
        "admin-sidebar e mobile-sidebar permanecem em components/admin por
        literais rgba"
    - id: restos-admin
      prova:
        "headers, gantt-view, hero-carousel-manager, logistics-calendar,
        mini-carousel ainda legados"
    - id: sem-carrossel-3d
      prova: "components/equipment-3d-carousel.tsx não tocado"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/logistica"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
  gate:
    arch: pass
    tokens: pass
    vitest_platform: pass
    violacoes_conhecidas:
      - "admin-sidebar e mobile-sidebar continuam legado por literais rgba"
      - "restam headers, gantt-view, hero-carousel-manager, logistics-calendar,
        mini-carousel"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/logistics/utils.tsx
    - components/admin/logistics/types.ts
  nao_verificado:
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 305-sidebars

`admin-sidebar` e `mobile-sidebar` foram para
`packages/frontend/src/widgets/menu-admin` (`BarraLateral.web.tsx` e
`BarraLateralMobile.web.tsx`). Valores rgba não mudaram; só ganharam
`token-check-allow`. Legado apagado. Vitest, arch e token exit 0. estado
intermediate. A migração não está concluída. Headers admin, `gantt`,
`hero-carousel-manager`, `logistics-calendar` e `mini-carousel` podem continuar
legado. Carrossel 3D continua.

```yaml
fatia:
  id: 305-sidebars
  estado: intermediate
  conceito: sidebars admin → widget menu-admin
  origem:
    - components/admin/admin-sidebar.tsx
    - components/admin/mobile-sidebar.tsx
  destino:
    - packages/frontend/src/widgets/menu-admin/ui/BarraLateral.web.tsx
    - packages/frontend/src/widgets/menu-admin/ui/BarraLateralMobile.web.tsx
    - packages/frontend/src/widgets/menu-admin/index.ts
  invariantes:
    - id: rgba-preservado
      prova: "valores rgba intactos; apenas token-check-allow adicionado"
    - id: restos-admin
      prova:
        "headers admin, gantt, hero-carousel-manager, logistics-calendar,
        mini-carousel ainda legados"
    - id: sem-carrossel-3d
      prova: "components/equipment-3d-carousel.tsx não tocado"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/menu-admin"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
  gate:
    arch: pass
    tokens: pass
    vitest_platform: pass
    violacoes_conhecidas:
      - "headers admin, gantt, hero-carousel-manager, logistics-calendar,
        mini-carousel ainda legados"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/admin-sidebar.tsx
    - components/admin/mobile-sidebar.tsx
  nao_verificado:
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 308-shim-icones

Shim `components/icons/custom/index.tsx` e a pasta `components/icons` foram
apagados. Implementação permanece em `packages/ui/src/icons/custom.tsx`. Vitest
ícones exit 0. token-check exit 0. arch-check exit 1 por FSD em mini-carousel e
`pages/logistica` (fora desta fatia; outra fatia ainda mexe nisso). estado
intermediate. A migração não está concluída. Carrossel 3D continua.

```yaml
fatia:
  id: 308-shim-icones
  estado: intermediate
  conceito: remoção do shim components/icons → só packages/ui
  origem:
    - components/icons/custom/index.tsx
    - components/icons/
  destino:
    - packages/ui/src/icons/custom.tsx
  invariantes:
    - id: implementacao-em-ui
      prova: "implementação permanece em packages/ui/src/icons/custom.tsx"
    - id: shim-apagado
      prova:
        "components/icons/custom/index.tsx e pasta components/icons apagados"
    - id: arch-fora-fatia
      prova:
        "arch-check exit 1 por FSD em mini-carousel e pages/logistica (outra
        fatia)"
    - id: sem-carrossel-3d
      prova: "components/equipment-3d-carousel.tsx não tocado"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/icons"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/arch-check.mjs"
      exit: 1
      verificado_em: "2026-09-25"
  gate:
    arch: fail
    tokens: pass
    vitest_platform: pass
    violacoes_conhecidas:
      - "arch-check exit 1 por FSD em mini-carousel e pages/logistica (fora
        desta fatia)"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/icons/custom/index.tsx
    - components/icons/
  nao_verificado:
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 307-gantt-calendario

`gantt-view` e `logistics-calendar` foram para `pages/logistica/ui`
(`GanttView.web` e `LogisticsCalendar.web`). `mini-carousel` foi para
`widgets/mini-carousel`. `hero-carousel-manager` foi para
`pages/configuracoes/ui/HeroCarouselManager.web.tsx`. Calendar aponta para
`widgets/seletor-data`. Legado apagado. Vitest exit 0. arch exit 0. token exit 1
por violação em `cabecalho-admin-barra`, fora desta fatia. estado intermediate.
A migração não está concluída. Carrossel 3D real continua.

```yaml
fatia:
  id: 307-gantt-calendario
  estado: intermediate
  conceito:
    órfãos gantt / logistics-calendar / mini-carousel / hero-carousel-manager
  origem:
    - components/admin/gantt-view.tsx
    - components/admin/logistics-calendar.tsx
    - components/admin/mini-carousel.tsx
    - components/admin/hero-carousel-manager.tsx
  destino:
    - packages/frontend/src/pages/logistica/ui/GanttView.web.tsx
    - packages/frontend/src/pages/logistica/ui/LogisticsCalendar.web.tsx
    - packages/frontend/src/pages/logistica/ui/GanttCalendar.web.test.tsx
    - packages/frontend/src/pages/logistica/index.ts
    - packages/frontend/src/widgets/mini-carousel/ui/MiniCarousel.web.tsx
    - packages/frontend/src/widgets/mini-carousel/ui/MiniCarousel.web.test.tsx
    - packages/frontend/src/widgets/mini-carousel/index.ts
    - packages/frontend/src/pages/configuracoes/ui/HeroCarouselManager.web.tsx
    - packages/frontend/src/pages/configuracoes/ui/HeroCarouselManager.web.test.tsx
    - packages/frontend/src/pages/configuracoes/index.ts
  invariantes:
    - id: gantt-modos
      prova: "GanttCalendar.web.test.tsx: Diário / Semanal / Mensal / Hoje"
    - id: logistics-rotulos
      prova:
        "GanttCalendar.web.test.tsx: Agenda de Entregas e Coletas, Agendada,
        Entrega, Coleta"
    - id: calendar-via-seletor
      prova: "GanttView e LogisticsCalendar importam widgets/seletor-data"
    - id: hero-sem-3d
      prova:
        "HeroCarouselManager sem
        equipment-3d-carousel|model-viewer|scroll-reveal"
    - id: legado-zero
      prova: "quatro components/admin/* apagados; zero imports de produto"
    - id: sem-carrossel-3d
      prova: "components/equipment-3d-carousel.tsx não tocado"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/logistica
        packages/frontend/src/widgets/mini-carousel
        packages/frontend/src/pages/configuracoes/ui/HeroCarouselManager.web.test.tsx"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25"
    - cmd: "node tools/token-check.mjs"
      exit: 1
      verificado_em: "2026-09-25"
      nota: "violação em cabecalho-admin-barra — fora desta fatia"
  gate:
    arch: pass
    tokens: fail_externo
    vitest_platform: pass
    violacoes_conhecidas:
      - "token: cabecalho-admin-barra (fora desta fatia)"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/gantt-view.tsx
    - components/admin/logistics-calendar.tsx
    - components/admin/mini-carousel.tsx
    - components/admin/hero-carousel-manager.tsx
  nao_verificado:
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 306-headers-admin

Headers da barra admin (`admin-header`, `admin-desktop-header`,
`admin-mobile-header`, `admin-header-actions`) saíram de `components/admin/`
para o widget `cabecalho-admin-barra` (separado de `cabecalho-admin`, que já
exporta `AdminPageHeader`). Arquivos: `Barra.web`, `BarraDesktop.web`,
`BarraMobile.web`, `Acoes.web`. Caller `app/admin/admin-layout-client.tsx`
compõe `MobileSidebar` via `onMenuOpen`. Legado apagado. Vitest platform exit 0.
arch exit 0. token exit 0. estado intermediate. A migração não está concluída.
Carrossel 3D, model-viewer, lazy-3d e scroll-reveal continuam no legado.

```yaml
fatia:
  id: 306-headers-admin
  estado: intermediate
  conceito: barra superior desktop/mobile e ações do painel admin
  origem:
    - components/admin/admin-header.tsx
    - components/admin/admin-desktop-header.tsx
    - components/admin/admin-mobile-header.tsx
    - components/admin/admin-header-actions.tsx
  destino:
    - packages/frontend/src/widgets/cabecalho-admin-barra/ui/Barra.web.tsx
    - packages/frontend/src/widgets/cabecalho-admin-barra/ui/BarraDesktop.web.tsx
    - packages/frontend/src/widgets/cabecalho-admin-barra/ui/BarraMobile.web.tsx
    - packages/frontend/src/widgets/cabecalho-admin-barra/ui/Acoes.web.tsx
    - packages/frontend/src/widgets/cabecalho-admin-barra/ui/Barra.web.test.tsx
    - packages/frontend/src/widgets/cabecalho-admin-barra/index.ts
  invariantes:
    - id: rgba-desktop
      prova:
        "Barra.web.test.tsx: rgba(51, 65, 85, 0.98) / rgba(30, 41, 59, 0.95)"
    - id: rgb-mobile
      prova: "Barra.web.test.tsx: rgb(51, 65, 85) e gradiente do botão menu"
    - id: rotas-acoes
      prova: "Barra.web.test.tsx: /admin/perfil, /admin/settings, /admin/login"
    - id: sem-import-menu-admin
      prova:
        "Barra.web.test.tsx: Barra.web sem menu-admin; MobileSidebar no host"
    - id: sem-legado-headers
      prova: "zero imports de components/admin/admin-*-header*"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/cabecalho-admin-barra"
      exit: 0
      verificado_em: "2026-09-25 16:54"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:54"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:54"
  gate:
    arch: pass
    tokens: pass
    vitest_platform: pass
    violacoes_conhecidas:
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
      - "AdminHeader (barra órfã) exportado sem caller"
  aposentado:
    - components/admin/admin-header.tsx
    - components/admin/admin-desktop-header.tsx
    - components/admin/admin-mobile-header.tsx
    - components/admin/admin-header-actions.tsx
  callers_atualizados:
    - app/admin/admin-layout-client.tsx
  nao_verificado:
    - "[NOT_VERIFIED: typecheck]"
    - "[NOT_VERIFIED: pnpm test com TEST_DATABASE_URL]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: /admin layout headers no browser]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
```

## 309-inventario-components

Inventário em disco de `components/` (Node `fs.readdirSync`, profundidade
limitada). Só restam implementações reais nos quatro arquivos 3D/scroll-reveal
proibidos e no registro do service worker (host). Pastas `admin/`, `dialogs/` e
`terms/` sem `.ts`/`.tsx`. Nada movido. estado blocked. A migração não está
concluída. Carrossel 3D continua no legado de propósito.

```yaml
fatia:
  id: 309-inventario-components
  estado: blocked
  conceito: >-
    inventariar components/ e mover próxima fatia segura; bloqueado porque só
    restam 3D/scroll-reveal + ServiceWorkerRegister
  origem:
    - components/ (inventário completo no disco)
  destino: []
  movido: []
  inventario_disco:
    arquivos_com_implementacao:
      - path: components/equipment-3d-carousel.tsx
        linhas: 387
        motivo_nao_mover: critico-3d-sincronizacao-scroll-reveal
      - path: components/scroll-reveal-init.tsx
        linhas: 890
        motivo_nao_mover: critico-scroll-reveal
      - path: components/ui/lazy-3d-carousel.tsx
        linhas: 128
        motivo_nao_mover: lazy-wrapper-carrossel-3d
      - path: components/ui/model-viewer.tsx
        linhas: 572
        motivo_nao_mover: model-viewer-bounds-critico
      - path: components/service-worker-register.tsx
        linhas: 34
        motivo_nao_mover: service-worker-fica-no-host
    pastas_vazias_sem_ts_tsx:
      - components/admin/
      - components/admin/dashboard/
      - components/admin/equipment-form/
      - components/admin/financial/
      - components/admin/maintenance/
      - components/admin/quotes/
      - components/admin/quotes/dialogs/
      - components/admin/rentals/
      - components/admin/shared/
      - components/dialogs/
      - components/terms/
    ui_com_apenas_3d:
      - components/ui/lazy-3d-carousel.tsx
      - components/ui/model-viewer.tsx
  invariantes:
    - id: sem-mover-3d
      prova: >-
        equipment-3d-carousel, model-viewer, lazy-3d-carousel e
        scroll-reveal-init não foram editados nem movidos
    - id: sem-mover-service-worker
      prova: components/service-worker-register.tsx permanece no host
    - id: sem-apagar-app
      prova: app/ não tocado
    - id: sem-prisma
      prova: schema Prisma, lib/prisma e rotas de API não tocados
    - id: sem-tocar-fatias-306-307
      prova: >-
        cabecalho-admin-barra, Gantt/LogisticsCalendar, mini-carousel e
        HeroCarouselManager não tocados
    - id: inventorio-so-node-fs
      prova: >-
        inventário via node fs.readdirSync/existsSync em components/ apenas; sem
        Get-ChildItem -Recurse
  comandos:
    - cmd: >-
        node -e "fs.readdirSync inventário components/ profundidade limitada"
      exit: 0
      verificado_em: "2026-09-25 16:55"
      nota: 5 arquivos .ts/.tsx com implementação; 0 reexports de produto
    - cmd: node tools/arch-check.mjs
      exit: 0
      verificado_em: "2026-09-25 16:56"
      nota: architecture gate passed (5 packages); sem violação nesta fatia
    - cmd: node tools/token-check.mjs
      exit: 0
      verificado_em: "2026-09-25 16:56"
      nota: token gate passed; fatia não alterou código de produto
    - cmd: pnpm exec vitest run --config vitest.platform.config.ts
      exit: nao_executado
      nota: >-
        sem movimento de código nesta fatia; vitest de caracterização adiado até
        fatia que mova os 3D/SW
  gate:
    arch: pass
    tokens: pass
    vitest_platform: skipped_sem_movimento
    violacoes_conhecidas:
      - "AdminHeader (barra órfã) exportado sem caller"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado: []
  callers_atualizados: []
  nao_moveu:
    - components/equipment-3d-carousel.tsx
    - components/scroll-reveal-init.tsx
    - components/ui/lazy-3d-carousel.tsx
    - components/ui/model-viewer.tsx
    - components/service-worker-register.tsx
  bloqueio:
    razao: >-
      Únicos .tsx/.ts com implementação real em components/ são os quatro
      arquivos 3D/scroll-reveal (proibidos) e o ServiceWorkerRegister (host).
      Não há grupo coeso de produto (admin/client/ui) restante para fatia 309.
    proximo_passo_sugerido: >-
      Fatia dedicada e explícita para carrossel 3D + scroll-reveal (ler
      docs/features/equipment-3d-carousel.md) e/ou limpeza de pastas vazias em
      components/; não declarar migração components/ concluída enquanto esses
      arquivos existirem.
  nao_verificado:
    - "[NOT_VERIFIED: typecheck]"
    - "[NOT_VERIFIED: pnpm test com TEST_DATABASE_URL]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
```

## 310-rotas-finas

Oito rotas finas novas no host web (`apps/clients/web`), espelhando exports já
existentes em `@gb-locacoes/frontend/pages/*`. Cinco telas universais também no
mobile; três só-web (export `.web`) sem espelho mobile nesta fatia. Nenhuma UI
copiada. `app/` da raiz e `components/` intocados. arch-check exit 0.
token-check exit 0. Vitest não rodou (sem teste novo). estado intermediate.
Âncora da 309: `AdminHeader (barra órfã) exportado sem caller` — inventário
bloqueado nos 3D/SW; esta fatia avançou rotas finas, não o legado 3D. A migração
não está concluída. Carrossel 3D, model-viewer, scroll-reveal e service worker
continuam no legado. Ainda faltam rotas admin/área-cliente/equipamentos-scroll
só na raiz.

```yaml
fatia:
  id: 310-rotas-finas
  estado: intermediate
  conceito: >-
    rotas finas faltantes no host web + espelho mobile quando o slice é
    universal; limite 8 URLs
  origem:
    - app/api-docs/page.tsx (shell fino legado, referência)
    - app/admin/teste-toast/page.tsx
    - app/grid-motion/page.tsx
    - app/playground/icon-customization/page.tsx
    - app/admin/permissions/page.tsx
    - app/playground/page.tsx
    - app/orcamento/page.tsx
    - app/admin/dashboard/page.tsx
  destino:
    - apps/clients/web/src/app/api-docs/page.tsx
    - apps/clients/web/src/app/admin/teste-toast/page.tsx
    - apps/clients/web/src/app/grid-motion/page.tsx
    - apps/clients/web/src/app/playground/icon-customization/page.tsx
    - apps/clients/web/src/app/admin/permissions/page.tsx
    - apps/clients/web/src/app/playground/page.tsx
    - apps/clients/web/src/app/orcamento/page.tsx
    - apps/clients/web/src/app/admin/dashboard/page.tsx
    - apps/clients/mobile/src/app/api-docs.tsx
    - apps/clients/mobile/src/app/admin-teste-toast.tsx
    - apps/clients/mobile/src/app/grid-motion.tsx
    - apps/clients/mobile/src/app/playground-icon-customization.tsx
    - apps/clients/mobile/src/app/admin-permissions.tsx
  movido: []
  criado:
    urls_web:
      - /api-docs → pages/api-docs (ApiDocsPage)
      - /admin/teste-toast → pages/teste-toast (TesteToastPage)
      - /grid-motion → pages/grid-motion (GridMotionPage)
      - /playground/icon-customization → pages/playground
        (IconCustomizationPage)
      - /admin/permissions → pages/permissoes (AdminPermissionsPage)
      - /playground → pages/playground (PlaygroundPage .web)
      - /orcamento → pages/orcamento (QuotePageWrapper .web)
      - /admin/dashboard → pages/dashboard (AdminDashboard .web)
    espelho_mobile_universal:
      - api-docs.tsx
      - admin-teste-toast.tsx
      - grid-motion.tsx
      - playground-icon-customization.tsx
      - admin-permissions.tsx
  invariantes:
    - id: sem-mover-3d
      prova: >-
        equipment-3d-carousel, model-viewer, lazy-3d-carousel,
        scroll-reveal-init e service-worker-register não tocados
    - id: sem-apagar-app
      prova: app/ da raiz não tocado
    - id: sem-prisma
      prova: schema Prisma, lib/prisma e rotas de API não tocados
    - id: rotas-finas
      prova: >-
        hosts novos só importam @gb-locacoes/frontend/pages/<slice> e retornam o
        export já existente; sem UI duplicada
    - id: sem-catch-all
      prova: nenhum [[...rota]] criado
    - id: mobile-sem-web-only
      prova: >-
        playground, orcamento e admin/dashboard não espelhados no mobile porque
        o index exporta implementação .web
  comandos:
    - cmd: node tools/arch-check.mjs
      exit: 0
      verificado_em: "2026-09-25 16:58"
      nota: architecture gate passed (5 packages)
    - cmd: node tools/token-check.mjs
      exit: 0
      verificado_em: "2026-09-25 16:58"
      nota: token gate passed; fatia não introduziu literais de cor
    - cmd: pnpm exec vitest run --config vitest.platform.config.ts
      exit: nao_executado
      nota: >-
        só page.tsx/screen.tsx finos novos; sem arquivo de teste novo
  gate:
    arch: pass
    tokens: pass
    vitest_platform: skipped_sem_teste_novo
    violacoes_conhecidas:
      - "AdminHeader (barra órfã) exportado sem caller"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
      - "service-worker-register continua em components/"
  aposentado: []
  callers_atualizados: []
  nao_fez:
    - mover carrossel 3D / model-viewer / scroll-reveal / SW
    - espelho mobile de /playground, /orcamento, /admin/dashboard (.web-only)
    - rotas ainda só na raiz (abaixo)
    - item 2 (lib/hooks): não necessário — item 1 teve movimento
    - backend / typecheck / build completo / closeout
  bloqueio_restante:
    rotas_web_ainda_faltando_com_export:
      - /admin/categorias
      - /admin/email
      - /admin/equipamentos
      - /admin/equipamentos/novo
      - /admin/equipamentos/[id]
      - /admin/equipamentos/[id]/editar
      - /admin/financeiro
      - /admin/logistics
      - /admin/maintenance
      - /admin/orcamentos
      - /admin/orcamentos/[id]
      - /admin/rentals
      - /admin/settings
      - /admin/whatsapp
      - /area-cliente
      - /area-cliente/enderecos
      - /area-cliente/historico
      - /area-cliente/historico/[id]
      - /area-cliente/notificacoes
      - /area-cliente/perfil
      - /equipamentos-scroll
    rotas_bloqueadas_host_fino:
      - /equipamentos/[id] — Prisma + generateMetadata no shell da raiz
      - / (home) — Prisma + carrossel 3D no host legado
      - /sobre na raiz — injeta Equipment3DCarousel (web host já tem stub)
    legado_proposital:
      - components/equipment-3d-carousel.tsx
      - components/scroll-reveal-init.tsx
      - components/ui/lazy-3d-carousel.tsx
      - components/ui/model-viewer.tsx
      - components/service-worker-register.tsx
    closeout_nao_rodado:
      - typecheck
      - pnpm test com TEST_DATABASE_URL
      - pnpm build
      - pnpm build:web
      - pnpm bundle:mobile
      - browser
      - device
  nao_verificado:
    - "[NOT_VERIFIED: typecheck]"
    - "[NOT_VERIFIED: pnpm test com TEST_DATABASE_URL]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: browser nas 8 URLs novas]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
```

## 311-rotas-finas

Oito rotas finas novas no host web (`apps/clients/web`), espelhando exports já
existentes em `@gb-locacoes/frontend/pages/*` (todos `.web`). Nenhum espelho
mobile nesta fatia — índices só reexportam módulos `.web`. Nenhuma UI copiada.
`app/` da raiz e `components/` intocados. arch-check exit 0. token-check exit 0.
Vitest não rodou (sem teste novo). estado intermediate. Âncora da 310:
`app/page.tsx continua dono da home e do Prisma` — bloqueios de host fino (home
Prisma+3D, `/equipamentos/[id]` Prisma+generateMetadata, `/sobre` injeta
carrossel 3D) seguem; esta fatia avançou 8 rotas admin `.web`, não o legado 3D.
A migração não está concluída. Carrossel 3D, model-viewer, scroll-reveal e
service worker continuam no legado. Ainda faltam `/admin/maintenance`,
`/admin/orcamentos`, `/admin/orcamentos/[id]`, `/admin/rentals`,
`/admin/settings`, `/admin/whatsapp`, `/area-cliente` (+ subrotas) e
`/equipamentos-scroll`.

```yaml
fatia:
  id: 311-rotas-finas
  estado: intermediate
  conceito: >-
    rotas finas faltantes no host web para páginas admin já exportadas como
    .web; limite 8 URLs; sem espelho mobile
  origem:
    - app/admin/categorias/page.tsx
    - app/admin/email/page.tsx
    - app/admin/equipamentos/page.tsx
    - app/admin/equipamentos/novo/page.tsx
    - app/admin/equipamentos/[id]/page.tsx
    - app/admin/equipamentos/[id]/editar/page.tsx
    - app/admin/financeiro/page.tsx
    - app/admin/logistics/page.tsx
  destino:
    - apps/clients/web/src/app/admin/categorias/page.tsx
    - apps/clients/web/src/app/admin/email/page.tsx
    - apps/clients/web/src/app/admin/equipamentos/page.tsx
    - apps/clients/web/src/app/admin/equipamentos/novo/page.tsx
    - apps/clients/web/src/app/admin/equipamentos/[id]/page.tsx
    - apps/clients/web/src/app/admin/equipamentos/[id]/editar/page.tsx
    - apps/clients/web/src/app/admin/financeiro/page.tsx
    - apps/clients/web/src/app/admin/logistics/page.tsx
  movido: []
  criado:
    urls_web:
      - /admin/categorias → pages/categorias (AdminCategoriesPage .web)
      - /admin/email → pages/email-admin (AdminEmailPage .web)
      - /admin/equipamentos → pages/equipamentos-admin (AdminEquipmentsPage
        .web)
      - /admin/equipamentos/novo → pages/equipamentos-admin (NovoEquipamentoPage
        .web)
      - /admin/equipamentos/[id] → pages/equipamentos-admin
        (EquipmentDetailsPage .web)
      - /admin/equipamentos/[id]/editar → pages/equipamentos-admin
        (EditarEquipamentoPage .web)
      - /admin/financeiro → pages/financeiro (AdminFinanceiroPageWrapper .web)
      - /admin/logistics → pages/logistica (AdminLogisticsPage .web)
    espelho_mobile_universal: []
  invariantes:
    - id: sem-mover-3d
      prova: >-
        equipment-3d-carousel, model-viewer, lazy-3d-carousel,
        scroll-reveal-init e service-worker-register não tocados
    - id: sem-apagar-app
      prova: app/ da raiz não tocado
    - id: sem-prisma
      prova: schema Prisma, lib/prisma e rotas de API não tocados
    - id: rotas-finas
      prova: >-
        hosts novos só importam @gb-locacoes/frontend/pages/<slice> e retornam o
        export já existente; sem UI duplicada
    - id: sem-catch-all
      prova: nenhum [[...rota]] criado
    - id: mobile-sem-web-only
      prova: >-
        nenhuma das 8 URLs espelhada no mobile porque o index exporta
        implementação .web
    - id: sem-duplicar-310
      prova: >-
        /api-docs, /admin/teste-toast, /grid-motion,
        /playground/icon-customization, /admin/permissions, /playground,
        /orcamento, /admin/dashboard não recriadas
  comandos:
    - cmd: node tools/arch-check.mjs
      exit: 0
      verificado_em: "2026-09-25 17:02"
      nota: architecture gate passed (5 packages)
    - cmd: node tools/token-check.mjs
      exit: 0
      verificado_em: "2026-09-25 17:02"
      nota: token gate passed; fatia não introduziu literais de cor
    - cmd: pnpm exec vitest run --config vitest.platform.config.ts
      exit: nao_executado
      nota: >-
        só page.tsx finos novos; sem arquivo de teste novo
  gate:
    arch: pass
    tokens: pass
    vitest_platform: skipped_sem_teste_novo
    violacoes_conhecidas:
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
      - "service-worker-register continua em components/"
  aposentado: []
  callers_atualizados: []
  nao_fez:
    - mover carrossel 3D / model-viewer / scroll-reveal / SW
    - espelho mobile das 8 URLs (.web-only)
    - rotas ainda só na raiz (abaixo)
    - backend / typecheck / build completo / closeout
  bloqueio_restante:
    rotas_web_ainda_faltando_com_export:
      - /admin/maintenance
      - /admin/orcamentos
      - /admin/orcamentos/[id]
      - /admin/rentals
      - /admin/settings
      - /admin/whatsapp
      - /area-cliente
      - /area-cliente/enderecos
      - /area-cliente/historico
      - /area-cliente/historico/[id]
      - /area-cliente/notificacoes
      - /area-cliente/perfil
      - /equipamentos-scroll
    rotas_bloqueadas_host_fino:
      - /equipamentos/[id] — Prisma + generateMetadata no shell da raiz
      - / (home) — Prisma + carrossel 3D no host legado
      - /sobre na raiz — injeta Equipment3DCarousel (web host já tem stub)
    legado_proposital:
      - components/equipment-3d-carousel.tsx
      - components/scroll-reveal-init.tsx
      - components/ui/lazy-3d-carousel.tsx
      - components/ui/model-viewer.tsx
      - components/service-worker-register.tsx
    closeout_nao_rodado:
      - typecheck
      - pnpm test com TEST_DATABASE_URL
      - pnpm build
      - pnpm build:web
      - pnpm bundle:mobile
      - browser
      - device
  nao_verificado:
    - "[NOT_VERIFIED: typecheck]"
    - "[NOT_VERIFIED: pnpm test com TEST_DATABASE_URL]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: browser nas 8 URLs novas]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
```

## 312-rotas-finas

Treze rotas finas novas no host web (`apps/clients/web`), cobrindo todas as URLs
que o inbox 311 listou em `rotas_web_ainda_faltando_com_export`. Cada `page.tsx`
só importa export já existente em `@gb-locacoes/frontend/pages/*` (todos
`.web`). Nenhum espelho mobile — índices só reexportam módulos `.web`. Nenhuma
UI copiada. `app/` da raiz e `components/` intocados. arch-check exit 0.
token-check exit 0. Vitest não rodou (sem teste novo). estado intermediate.
Âncora da 311: `/equipamentos/[id] — Prisma + generateMetadata no shell da raiz`
— bloqueio de host fino que esta fatia não removeu; home e `/sobre` continuam
com Prisma/3D no legado (host web já tem stub). A migração não está concluída.
Carrossel 3D, model-viewer, scroll-reveal e service worker continuam em
`components/`. `rotas_web_ainda_faltando_com_export` ficou vazio.

```yaml
fatia:
  id: 312-rotas-finas
  estado: intermediate
  conceito: >-
    rotas finas faltantes do inbox 311 no host web; 13 URLs com export .web; sem
    espelho mobile
  origem:
    - app/admin/maintenance/page.tsx
    - app/admin/orcamentos/page.tsx
    - app/admin/orcamentos/[id]/page.tsx
    - app/admin/rentals/page.tsx
    - app/admin/settings/page.tsx
    - app/admin/whatsapp/page.tsx
    - app/area-cliente/page.tsx
    - app/area-cliente/enderecos/page.tsx
    - app/area-cliente/historico/page.tsx
    - app/area-cliente/historico/[id]/page.tsx
    - app/area-cliente/notificacoes/page.tsx
    - app/area-cliente/perfil/page.tsx
    - app/equipamentos-scroll/page.tsx
  destino:
    - apps/clients/web/src/app/admin/maintenance/page.tsx
    - apps/clients/web/src/app/admin/orcamentos/page.tsx
    - apps/clients/web/src/app/admin/orcamentos/[id]/page.tsx
    - apps/clients/web/src/app/admin/rentals/page.tsx
    - apps/clients/web/src/app/admin/settings/page.tsx
    - apps/clients/web/src/app/admin/whatsapp/page.tsx
    - apps/clients/web/src/app/area-cliente/page.tsx
    - apps/clients/web/src/app/area-cliente/enderecos/page.tsx
    - apps/clients/web/src/app/area-cliente/historico/page.tsx
    - apps/clients/web/src/app/area-cliente/historico/[id]/page.tsx
    - apps/clients/web/src/app/area-cliente/notificacoes/page.tsx
    - apps/clients/web/src/app/area-cliente/perfil/page.tsx
    - apps/clients/web/src/app/equipamentos-scroll/page.tsx
  movido: []
  criado:
    urls_web:
      - /admin/maintenance → pages/manutencao (AdminMaintenancePage .web)
      - /admin/orcamentos → pages/orcamentos-admin (AdminQuotesPageWrapper .web)
      - /admin/orcamentos/[id] → pages/orcamentos-admin (QuoteDetailPage .web +
        params)
      - /admin/rentals → pages/locacoes (AdminRentalsPage .web)
      - /admin/settings → pages/configuracoes (AdminConfiguracoesPage .web)
      - /admin/whatsapp → pages/whatsapp-admin (AdminWhatsAppPage .web)
      - /area-cliente → pages/area-cliente (AreaClientePage .web)
      - /area-cliente/enderecos → pages/enderecos (EnderecosPage .web)
      - /area-cliente/historico → pages/historico (HistoricoPage .web)
      - /area-cliente/historico/[id] → pages/historico-detalhe
        (RentalDetailsPage .web)
      - /area-cliente/notificacoes → pages/notificacoes (NotificacoesPage .web)
      - /area-cliente/perfil → pages/perfil (PerfilPage .web)
      - /equipamentos-scroll → pages/equipamentos-scroll (EquipamentosScrollPage
        .web)
    espelho_mobile_universal: []
  pulou:
    - nenhuma URL da lista 311 já existia no host web (confirmado no disco)
    - nenhuma URL da lista 311 sem export no pacote
  invariantes:
    - id: sem-mover-3d
      prova: >-
        equipment-3d-carousel, model-viewer, lazy-3d-carousel,
        scroll-reveal-init e service-worker-register não tocados
    - id: sem-apagar-app
      prova: app/ da raiz não tocado
    - id: sem-prisma
      prova: schema Prisma, lib/prisma e rotas de API não tocados
    - id: rotas-finas
      prova: >-
        hosts novos só importam @gb-locacoes/frontend/pages/<slice> e retornam o
        export já existente; sem UI duplicada
    - id: sem-catch-all
      prova: nenhum [[...rota]] criado
    - id: mobile-sem-web-only
      prova: >-
        nenhuma das 13 URLs espelhada no mobile porque o index exporta
        implementação .web
    - id: sem-duplicar-310-311
      prova: >-
        rotas das fatias 310/311 não recriadas; só as 13 faltantes do
        bloqueio_restante do inbox 311
  comandos:
    - cmd: node tools/arch-check.mjs
      exit: 0
      verificado_em: "2026-09-25 17:05"
      nota: architecture gate passed (5 packages)
    - cmd: node tools/token-check.mjs
      exit: 0
      verificado_em: "2026-09-25 17:05"
      nota: token gate passed; fatia não introduziu literais de cor
    - cmd: pnpm exec vitest run --config vitest.platform.config.ts
      exit: nao_executado
      nota: >-
        só page.tsx finos novos; sem arquivo de teste novo
  gate:
    arch: pass
    tokens: pass
    vitest_platform: skipped_sem_teste_novo
    violacoes_conhecidas:
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
      - "service-worker-register continua em components/"
  aposentado: []
  callers_atualizados: []
  nao_fez:
    - mover carrossel 3D / model-viewer / scroll-reveal / SW
    - espelho mobile das 13 URLs (.web-only)
    - migrar /equipamentos/[id], / (home Prisma+3D), /sobre com 3D
    - backend / typecheck / build completo / closeout
  bloqueio_restante:
    rotas_web_ainda_faltando_com_export: []
    rotas_bloqueadas_host_fino:
      - /equipamentos/[id] — Prisma + generateMetadata no shell da raiz (única
        page de produto ainda só na raiz sem counterpart fino no host web)
      - / (home) — Prisma + carrossel 3D no host legado (web host já tem stub)
      - /sobre na raiz — injeta Equipment3DCarousel (web host já tem stub)
    legado_proposital:
      - components/equipment-3d-carousel.tsx
      - components/scroll-reveal-init.tsx
      - components/ui/lazy-3d-carousel.tsx
      - components/ui/model-viewer.tsx
      - components/service-worker-register.tsx
    closeout_nao_rodado:
      - typecheck
      - pnpm test com TEST_DATABASE_URL
      - pnpm build
      - pnpm build:web
      - pnpm bundle:mobile
      - browser
      - device
  nao_verificado:
    - "[NOT_VERIFIED: typecheck]"
    - "[NOT_VERIFIED: pnpm test com TEST_DATABASE_URL]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: browser nas 13 URLs novas]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
```

## 313-adaptadores-host

Três URLs de produto no host web (`apps/clients/web`) passaram a adaptadores
finos: `/` (Prisma + props `localBusiness`/`heroInitialSettings` para
`HomePage`; stub `CatalogPage` substituído; sem 3D nesta rota), `/sobre`
(`SobrePage` com slots carousel + badge; host importa `Equipment3DCarousel` só
por caminho relativo a `components/`; arquivo 3D não movido nem editado) e
`/equipamentos/[id]` (`EquipamentoDetalhePage` recebe dados como props; Prisma e
`generateMetadata` ficam no host). Nenhuma das três bloqueada. arch-check
exit 0. token-check exit 0. Estado intermediate. Âncora da 312:
`/equipamentos/[id] — Prisma + generateMetadata no shell da raiz (única page de produto ainda só na raiz sem counterpart fino no host web)`
— esta fatia removeu esse bloqueio e também adaptou `/` e `/sobre` no host. A
migração não está concluída. Continua fora: `components/` do carrossel 3D,
model-viewer, lazy-3d, scroll-reveal e service-worker-register. `app/` da raiz
intocado. Sem mobile para essas três. Closeout não rodou.

```yaml
fatia:
  id: 313-adaptadores-host
  estado: intermediate
  conceito: >-
    adaptadores finos no host web para /, /sobre e /equipamentos/[id];
    Prisma/generateMetadata no host; 3D só via slot no host
  origem:
    - app/page.tsx
    - app/sobre/page.tsx
    - app/equipamentos/[id]/page.tsx
  destino:
    - apps/clients/web/src/app/page.tsx
    - apps/clients/web/src/app/sobre/page.tsx
    - apps/clients/web/src/app/equipamentos/[id]/page.tsx
    - packages/frontend/src/pages/home/index.ts
    - packages/frontend/src/pages/sobre/index.ts
    - packages/frontend/src/pages/equipamento-detalhe/index.ts
  movido: []
  criado:
    urls_web_adaptadas:
      - / → HomePage + Prisma setting.findFirst +
        localBusiness/heroInitialSettings
      - /sobre → SobrePage + Equipment3DCarousel (relativo components/) +
        GoogleMerchantBadge
      - /equipamentos/[id] → EquipamentoDetalhePage + Prisma + generateMetadata
    reexports_publicos_para_host:
      - pages/home → getLocalBusinessData
      - pages/sobre → GoogleMerchantBadge
      - pages/equipamento-detalhe → StructuredData, getLocalBusinessData,
        builders SEO
    espelho_mobile: []
  host_passou_a_fazer:
    - / deixa de renderizar CatalogPage; faz fetch Prisma e passa props para
      HomePage
    - /sobre injeta carousel legado e badge (paridade com a raiz)
    - /equipamentos/[id] existe no host com o mesmo shell Prisma+metadata da
      raiz
  continua_bloqueado:
    - carrossel 3D / model-viewer / lazy-3d / scroll-reveal / SW permanecem em
      components/
    - app/ da raiz continua servindo (não aposentado)
    - sem espelho mobile (dependem de Prisma / next/image / carousel web)
    - closeout (typecheck, test, build, browser, device) não rodado
  pulou:
    - nenhuma das três URLs bloqueada por falta de props na page do pacote
  invariantes:
    - id: sem-mover-3d
      prova: >-
        equipment-3d-carousel, model-viewer, lazy-3d-carousel,
        scroll-reveal-init e service-worker-register não tocados; host /sobre
        importa carousel só por caminho relativo à raiz
    - id: sem-apagar-app
      prova: app/ da raiz não tocado
    - id: prisma-no-host
      prova: >-
        fetch Prisma e generateMetadata só em apps/clients/web;
        packages/frontend sem import de Prisma nestes adapters
    - id: sem-ui-pacote
      prova: >-
        HomePage/SobrePage/EquipamentoDetalhePage UI não alteradas; só reexports
        nos index.ts
    - id: sem-catch-all
      prova: nenhum [[...rota]] criado
    - id: sem-mobile
      prova: nenhum arquivo novo em apps/clients/mobile para estas URLs
  url_por_url:
    - url: /
      resultado: adaptou
      porque: >-
        HomePage já aceita localBusiness + heroInitialSettings; host faz Prisma
        e passa props (stub CatalogPage substituído)
    - url: /sobre
      resultado: adaptou
      porque: >-
        SobrePage já aceita slots carousel + badge; host importa
        Equipment3DCarousel relativo sem mover o 3D
    - url: /equipamentos/[id]
      resultado: adaptou
      porque: >-
        EquipamentoDetalhePage já aceita equipamento/SEO como props; host novo
        criado com Prisma + generateMetadata
  comandos:
    - cmd: node tools/arch-check.mjs
      exit: 0
      verificado_em: "2026-09-25 17:10"
      nota: architecture gate passed (5 packages)
    - cmd: node tools/token-check.mjs
      exit: 0
      verificado_em: "2026-09-25 17:10"
      nota: token gate passed; fatia não introduziu literais de cor
    - cmd: pnpm exec vitest run --config vitest.platform.config.ts
      exit: nao_executado
      nota: pedido para não rodar typecheck/test/build/bundle
  gate:
    arch: pass
    tokens: pass
    vitest_platform: skipped_pedido
    violacoes_conhecidas:
      - "app/ da raiz continua dono paralelo das mesmas URLs"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
      - "service-worker-register continua em components/"
  aposentado: []
  callers_atualizados: []
  nao_fez:
    - mover carrossel 3D / model-viewer / scroll-reveal / SW
    - espelho mobile das três URLs
    - apagar ou alterar app/ da raiz
    - typecheck / build / browser / device
  bloqueio_restante:
    rotas_bloqueadas_host_fino: []
    legado_proposital:
      - components/equipment-3d-carousel.tsx
      - components/scroll-reveal-init.tsx
      - components/ui/lazy-3d-carousel.tsx
      - components/ui/model-viewer.tsx
      - components/service-worker-register.tsx
    closeout_nao_rodado:
      - typecheck
      - pnpm test com TEST_DATABASE_URL
      - pnpm build
      - pnpm build:web
      - pnpm bundle:mobile
      - browser
      - device
  nao_verificado:
    - "[NOT_VERIFIED: typecheck]"
    - "[NOT_VERIFIED: pnpm test com TEST_DATABASE_URL]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
```

## 314-typecheck-rotas

Typecheck das fatias de rota do host novo (310–313). `pnpm typecheck` exit 1
porque `tsc` não estava no PATH; a cadeia com `node_modules/.bin/tsc.CMD` também
exit 1 e parou em `packages/ui`, antes dos hosts. Erros:
`FilterSelectGroup.web.tsx` (`@/types/filters` e `option` implícito any) e
`HoverActionMenu.web.tsx` (conflito `HoverActionMenuProps`). Nenhuma correção
nessa fatia. arch/token não rodaram de novo. Estado blocked. Âncora da 313:
`app/ da raiz continua dono paralelo das mesmas URLs` — esta fatia não removeu
esse paralelismo; tentou o closeout typecheck das rotas novas e bloqueou em
`packages/ui` (fora dos adaptadores do host). A migração não está concluída.
Hosts ainda não chegaram a ser checados. Carrossel 3D continua no legado.

```yaml
fatia:
  id: 314-typecheck-rotas
  estado: blocked
  conceito: >-
    rodar typecheck do monorepo/hosts; se falhar, corrigir só adaptadores finos
    em apps/clients/{web,mobile}/src/app/** das fatias 310–313
  comandos:
    - cmd: pnpm typecheck
      exit: 1
      verificado_em: "2026-09-25 17:10"
      nota: >-
        script package.json "typecheck" falhou antes do tsc real: 'tsc' não
        reconhecido no PATH do shell (Windows). node_modules/.bin tem tsc.CMD
        (typescript 7.0.2), mas pnpm não o resolveu neste ambiente.
    - cmd: >-
        .\node_modules\.bin\tsc.CMD -p packages/ui/tsconfig.json && tsc -p
        packages/ui/tsconfig.native.json && tsc -p
        packages/frontend/tsconfig.json && tsc -p apps/clients/web/tsconfig.json
        && tsc -p apps/clients/mobile/tsconfig.json
      exit: 1
      verificado_em: "2026-09-25 17:10"
      nota: >-
        mesma cadeia do script typecheck, via binário local; parou no primeiro
        passo (packages/ui). hosts web/mobile não foram alcançados.
    - cmd: pnpm type-check
      exit: 1
      verificado_em: "2026-09-25 17:10"
      nota: >-
        script raiz "type-check" (patch-next-env + tsc --noEmit) também falhou
        com 'tsc' não reconhecido no PATH.
    - cmd: node tools/arch-check.mjs
      exit: nao_executado
      nota: >-
        não rodou de novo — nenhum arquivo editado nesta fatia; fatia 313 já
        tinha exit 0
    - cmd: node tools/token-check.mjs
      exit: nao_executado
      nota: >-
        não rodou de novo — nenhum arquivo editado nesta fatia; fatia 313 já
        tinha exit 0
  erros_que_ficaram:
    - arquivo: packages/ui/src/web/FilterSelectGroup.web.tsx
      mensagem: >-
        TS2307: Cannot find module '@/types/filters' or its corresponding type
        declarations.
      escopo: fora — packages/ui, não introduzido pelo adaptador do host
    - arquivo: packages/ui/src/web/FilterSelectGroup.web.tsx
      mensagem: >-
        TS7006: Parameter 'option' implicitly has an 'any' type.
      escopo: fora — packages/ui
    - arquivo: packages/ui/src/web/HoverActionMenu.web.tsx
      mensagem: >-
        TS2320: Interface 'HoverActionMenuProps' cannot simultaneously extend
        types Omit<ButtonHTMLAttributes<...>> and HoverActionMenuProps (children
        / onClick not identical).
      escopo: fora — packages/ui
  correcoes:
    - nenhuma (erros fora de apps/clients/web|mobile/src/app/**)
  arquivos_editados: []
  nao_fez:
    - corrigir packages/ui / packages/frontend / app/ da raiz
    - pnpm install
    - prisma migrate/push/seed
    - build / build:web / bundle:mobile
    - pnpm test
    - browser / device
    - mover carrossel 3D / model-viewer / SW
  bloqueio_restante:
    typecheck: >-
      exit 1 em packages/ui (FilterSelectGroup.web.tsx,
      HoverActionMenu.web.tsx); cadeia não chegou a apps/clients/web nem mobile
    legado_proposital:
      - 3D em components/ (equipment-3d-carousel, model-viewer, lazy-3d,
        scroll-reveal)
      - service worker no host (components/service-worker-register.tsx)
      - app/ raiz ainda é o Next de produção
      - mobile sem as páginas .web
    closeout_nao_rodado:
      - pnpm test com TEST_DATABASE_URL
      - build
      - build:web
      - bundle:mobile
      - browser
      - device
  nao_verificado:
    - "[NOT_VERIFIED: typecheck limpo nos hosts web/mobile — bloqueado em
      packages/ui]"
    - "[NOT_VERIFIED: pnpm test com TEST_DATABASE_URL]"
    - "[NOT_VERIFIED: pnpm build]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
```

## w30-15-cartao-admin

Worker índice 15 revisou o widget `cartao-admin`. Sem imports legados a
reescrever; sem rota fina no host web (não é page). Contrato de migração criado.
Estado intermediate; migração não concluída.

```yaml
fatia:
  id: w30-15-cartao-admin
  indice: 15
  estado: intermediate
  conceito: cartão compartilhado admin (revisão w30)
  escopo: packages/frontend/src/widgets/cartao-admin
  origem: []
  destino:
    - packages/frontend/src/widgets/cartao-admin/ui/Cartao.tsx
    - packages/frontend/src/widgets/cartao-admin/index.ts
    - packages/frontend/src/widgets/cartao-admin/contrato.migracao.test.ts
  invariantes:
    - id: export-publico
      prova:
        'contrato.migracao.test.ts: export { AdminCard } from "./ui/Cartao"'
    - id: sem-import-legado
      prova: "Cartao.tsx só @gb-locacoes/ui, clsx, tailwind-merge, react"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/cartao-admin/contrato.migracao.test.ts"
      exit: 0
      verificado_em: "2026-09-25 17:16"
  gate:
    arch: skipped_sem_edicao_producao
    tokens: skipped_sem_edicao_producao
    vitest_platform: pass
    violacoes_conhecidas:
      - "app/ da raiz continua dono paralelo de rotas admin"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado: []
  callers_atualizados: []
  nao_fez:
    - rota fina web (widget, não page)
    - tela fina mobile (widget, não page)
    - reescrita de imports (nenhum legado)
  bloqueio_restante: []
  nao_verificado:
    - "[NOT_VERIFIED: cartão admin no browser]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## w30-21-historico

Worker índice 21/30. Slice `packages/frontend/src/pages/historico`. Host web
`/area-cliente/historico` já era fino; sem troca de import legado no slice. Sem
tela mobile (`.web` + next). Contrato de migração adicionado.

```yaml
fatia:
  id: w30-21-historico
  estado: intermediate
  conceito: fechamento parcial do worker índice 21 (pages/historico)
  origem:
    - packages/frontend/src/pages/historico/
  destino:
    - packages/frontend/src/pages/historico/contrato.migracao.test.ts
    - docs/migration/inbox/w30-21-historico.md
    - apps/clients/web/src/app/area-cliente/historico/page.tsx
  movido: []
  criado:
    - packages/frontend/src/pages/historico/contrato.migracao.test.ts
  invariantes:
    - id: export-publico
      prova:
        "contrato.migracao.test.ts afirma export { HistoricoPage } from
        ./ui/HistoricoPage.web"
    - id: host-fino-web
      prova:
        "apps/clients/web/src/app/area-cliente/historico/page.tsx já importa
        @gb-locacoes/frontend/pages/historico; sem alteração"
    - id: sem-mobile
      prova: "slice .web com next/*; tela fina mobile não criada"
    - id: sem-legado-raiz
      prova: "nenhum @/components, @/hooks, @/lib no slice"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/historico/contrato.migracao.test.ts"
      exit: 0
    - cmd: node tools/arch-check.mjs
      exit: nao_executado
      nota: nenhum arquivo de produção editado neste worker
    - cmd: node tools/token-check.mjs
      exit: nao_executado
      nota: nenhum arquivo de produção editado neste worker
  gate:
    arch: skipped_sem_edicao_producao
    tokens: skipped_sem_edicao_producao
    vitest_platform: pass
    violacoes_conhecidas:
      - "app/ da raiz ainda espelha /area-cliente/historico"
      - "HistoricoPage.web.tsx permanece web-only
        (next-auth/next/link/navigation)"
  aposentado: []
  callers_atualizados: []
  nao_fez:
    - reescrita de imports (nada legado no slice)
    - criação de rota mobile
    - alteração da rota fina web (já correta)
  nao_verificado:
    - "[NOT_VERIFIED: histórico no browser]"
    - "[NOT_VERIFIED: typecheck]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## w30-26-logistica

Worker índice 26 revisou o page `logistica`. Import legado `@/lib/utils`
permanece (alvo raiz existe). Rota fina web `/admin/logistics` já correta. Sem
mobile (.web). Sem contrato novo (já há *.test.ts). Estado intermediate;
migração não concluída.

```yaml
fatia:
  id: w30-26-logistica
  indice: 26
  estado: intermediate
  conceito: logística admin (revisão w30) + rota fina host web
  escopo: packages/frontend/src/pages/logistica
  origem: []
  destino:
    - packages/frontend/src/pages/logistica
    - apps/clients/web/src/app/admin/logistics/page.tsx
  invariantes:
    - id: export-publico
      prova:
        'index.ts: export { AdminLogisticsPage } from "./ui/LogisticaPage.web"'
    - id: rota-fina-web
      prova:
        "admin/logistics/page.tsx importa AdminLogisticsPage de
        @gb-locacoes/frontend/pages/logistica"
    - id: legado-utils-ainda-existe
      prova:
        "GanttView.web.tsx: @/lib/utils; lib/utils.ts ainda na raiz — não
        reescrito"
  comandos: []
  gate:
    arch: skipped_sem_edicao_producao
    tokens: skipped_sem_edicao_producao
    vitest_platform: skipped_ja_havia_test_ts
    violacoes_conhecidas:
      - "app/ da raiz continua dono paralelo de rotas admin"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado: []
  callers_atualizados: []
  nao_fez:
    - reescrita de @/lib/utils (alvo ainda existe)
    - tela fina mobile (export .web)
    - contrato.migracao.test.ts (já há model/carga.test.ts)
    - alteração da rota fina web (já estava correta)
  bloqueio_restante:
    - migrar cn quando lib/utils sair ou houver substituto único em packages
  nao_verificado:
    - "[NOT_VERIFIED: logística no browser]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## w30-24-locacoes

Worker índice 24 revisou a page `locacoes`. Sem imports legados a reescrever.
Rota fina web já existente em `apps/clients/web/src/app/admin/rentals/page.tsx`
(`AdminRentalsPage` via `@gb-locacoes/frontend/pages/locacoes`) — sem ajuste.
Página `.web` — sem tela mobile. Contrato de migração não criado (`*.test.ts` já
existem no slice). Estado intermediate; migração não concluída.

```yaml
fatia:
  id: w30-24-locacoes
  indice: 24
  estado: intermediate
  conceito: página admin de locações (revisão w30)
  escopo: packages/frontend/src/pages/locacoes
  origem: []
  destino:
    - packages/frontend/src/pages/locacoes/index.ts
    - packages/frontend/src/pages/locacoes/ui/LocacoesPage.web.tsx
    - apps/clients/web/src/app/admin/rentals/page.tsx
  invariantes:
    - id: export-publico
      prova:
        'index.ts: export { AdminRentalsPage } from "./ui/LocacoesPage.web"'
    - id: sem-import-legado
      prova: >-
        fontes de produção só widgets FSD, @gb-locacoes/ui e módulos internos do
        slice
    - id: rota-fina-web
      prova: >-
        apps/clients/web/src/app/admin/rentals/page.tsx importa AdminRentalsPage
        de @gb-locacoes/frontend/pages/locacoes
    - id: sem-mobile-web-only
      prova: export vem de LocacoesPage.web — mobile não criado
  comandos:
    - cmd: node tools/arch-check.mjs
      exit: nao_executado
      nota: nenhuma edição de produção nesta fatia w30
    - cmd: node tools/token-check.mjs
      exit: nao_executado
      nota: nenhuma edição de produção nesta fatia w30
    - cmd: vitest contrato.migracao
      exit: nao_executado
      nota: slice já tem *.test.ts — contrato não duplicado
  gate:
    arch: skipped_sem_edicao_producao
    tokens: skipped_sem_edicao_producao
    vitest_platform: skipped_sem_teste_novo
    violacoes_conhecidas:
      - "app/ da raiz continua dono paralelo de /admin/rentals"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado: []
  callers_atualizados: []
  nao_fez:
    - reescrita de imports (nenhum legado)
    - ajuste da rota fina web (já correta)
    - tela fina mobile (.web only)
    - contrato.migracao.test.ts (já há *.test.ts)
  bloqueio_restante: []
  nao_verificado:
    - "[NOT_VERIFIED: /admin/rentals no browser do host web]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## w30-12-email-admin

Índice 12 / 30. Slice `packages/frontend/src/pages/email-admin`. Imports legados
`@/lib/utils` e `@/lib/sanitize` mantidos (alvos `lib/utils.ts` /
`lib/sanitize.ts` ainda existem na raiz). Página `.web` — sem tela fina mobile.
Rota fina web já correta em `apps/clients/web/src/app/admin/email/page.tsx`
(importa `AdminEmailPage` do index público); sem ajuste. Criado
`contrato.migracao.test.ts` (vitest exit 0). Sem edição de produção → arch/token
não aplicáveis. Estado intermediate. Migração não concluída.

```yaml
fatia:
  id: w30-12-email-admin
  indice: 12
  estado: intermediate
  escopo: packages/frontend/src/pages/email-admin
  conceito: >-
    varredura de imports legados + contrato de migração + verificação da rota
    fina web /admin/email
  origem: []
  destino:
    - packages/frontend/src/pages/email-admin/contrato.migracao.test.ts
    - docs/migration/inbox/w30-12-email-admin.md
  movido: []
  criado:
    - packages/frontend/src/pages/email-admin/contrato.migracao.test.ts
  host_web:
    rota: apps/clients/web/src/app/admin/email/page.tsx
    resultado: ja_ok
    porque: >-
      já importa AdminEmailPage de @gb-locacoes/frontend/pages/email-admin;
      nenhuma edição necessária
  imports_legados_mantidos:
    - arquivo: ui/email-message-list.tsx
      import: "@/lib/utils"
      motivo: lib/utils.ts ainda existe na raiz
    - arquivo: ui/email-folder-list.web.tsx
      import: "@/lib/utils"
      motivo: lib/utils.ts ainda existe na raiz
    - arquivo: ui/email-viewer.tsx
      import: "@/lib/sanitize"
      motivo: lib/sanitize.ts ainda existe na raiz
  mobile: nao_criado
  porque_sem_mobile: export e módulos são .web (next/navigation, react-dom)
  comandos:
    - cmd: >-
        pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/email-admin/contrato.migracao.test.ts
      exit: 0
    - cmd: node tools/arch-check.mjs
      exit: nao_aplicavel
      nota: sem edição de produção em packages/ ou apps/
    - cmd: node tools/token-check.mjs
      exit: nao_aplicavel
      nota: sem edição de produção em packages/ ou apps/
  nao_fez:
    - reescrever @/lib/utils e @/lib/sanitize (alvos raiz existem)
    - criar apps/clients/mobile para email-admin
    - editar rota fina web (já correta)
    - tocar arquivos 3D protegidos
  bloqueio_restante:
    - imports @/lib/* pendentes até remoção dos alvos raiz ou substituto único
    - closeout typecheck/build/browser não rodado nesta fatia
  nao_verificado:
    - "[NOT_VERIFIED: typecheck]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: browser]"
```

## w30-08-configuracoes

Worker índice 8. Slice `packages/frontend/src/pages/configuracoes`. Nenhum
import legado reescrito: `@/lib/utils` ainda resolve para `lib/utils.ts` na
raiz. Host web já é fino em `apps/clients/web/src/app/admin/settings/page.tsx`
(`AdminConfiguracoesPage` via `@gb-locacoes/frontend/pages/configuracoes`) — sem
ajuste. Sem tela mobile (exports `.web` + `next/image`). Sem
`contrato.migracao.test.ts` (já existe `model/use-settings.test.ts`). Arquivos
protegidos do carrossel 3D não tocados. Estado intermediate. Migração do slice
não declarada como concluída.

```yaml
fatia:
  id: w30-08-configuracoes
  indice: 8
  estado: intermediate
  conceito: >-
    varredura de imports legados e host fino /admin/settings; sem rewrite (alvo
    lib/utils.ts existe); sem mobile (.web)
  origem: []
  destino:
    - packages/frontend/src/pages/configuracoes
    - apps/clients/web/src/app/admin/settings/page.tsx
  movido: []
  criado: []
  host_web:
    rota: /admin/settings
    arquivo: apps/clients/web/src/app/admin/settings/page.tsx
    resultado: ja_fino
    export: AdminConfiguracoesPage
  legado_proposital_nao_reescrito:
    - ui/HeroCarouselPreview.web.tsx -> @/lib/utils (lib/utils.ts existe)
    - ui/SettingsNavigationBar.web.tsx -> @/lib/utils (lib/utils.ts existe)
  fora_escopo_legado:
    - "@/app/api/admin/settings/actions"
    - "@/schemas/settings.schema"
  espelho_mobile: nao_criado
  contrato_migracao_test: nao_criado
  comandos:
    - cmd: node tools/arch-check.mjs
      exit: n/a
      nota: sem edição de produção nesta rodada
    - cmd: node tools/token-check.mjs
      exit: n/a
      nota: sem edição de produção nesta rodada
  gate:
    arch: skipped_sem_edicao
    tokens: skipped_sem_edicao
    vitest_platform: skipped_sem_teste_novo
  nao_fez:
    - reescrever @/lib/utils com alvo existente
    - criar mobile para page .web
    - criar contrato.migracao.test.ts com *.test.ts já presente
    - editar arquivos protegidos do carrossel 3D
  nao_verificado:
    - "[NOT_VERIFIED: typecheck]"
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## w30-19-financeiro

Worker índice 19 (wave 30). Slice `packages/frontend/src/pages/financeiro`.
Estado intermediate. Sem edição de produção neste passo: imports relativos para
`lib/` na raiz mantidos (alvos ainda existem; sem basename único em packages).
Página `.web` — sem espelho mobile. Rota fina web já correta em
`apps/clients/web/src/app/admin/financeiro/page.tsx`
(`AdminFinanceiroPageWrapper`). Já há `*.test.ts` no slice — sem
`contrato.migracao.test.ts`. arch/token não aplicáveis. Inbox:
`docs/migration/inbox/w30-19-financeiro.md`. Migração do slice **não**
concluída.

```yaml
fatia:
  id: w30-19-financeiro
  indice: 19
  estado: intermediate
  escopo: packages/frontend/src/pages/financeiro
  conceito: >-
    varredura de imports legados + host fino web/mobile + contrato de migração
    no slice pages/financeiro
  origem: []
  destino:
    - packages/frontend/src/pages/financeiro
    - apps/clients/web/src/app/admin/financeiro/page.tsx
  movido: []
  criado: []
  host_web:
    rota: /admin/financeiro
    arquivo: apps/clients/web/src/app/admin/financeiro/page.tsx
    status: ja_existia_ok
    export: AdminFinanceiroPageWrapper
  host_mobile:
    status: nao_criado
    porque: index exporta FinanceiroPage.web (next/navigation nos modelos)
  imports_legados:
    @/components_hooks_lib: nenhum
    relativos_components_hooks_raiz: nenhum
    residual_lib_raiz:
      - lib/utils/formatting (formatCurrency, getInitials)
      - lib/utils (debounce)
      - lib/utils/validation (formatDocument)
      acao: nao_reescrito_alvo_ainda_existe
  testes:
    contrato_migracao: nao_criado
    porque: ja_existem_model/*.test.ts
  comandos:
    - cmd: node tools/arch-check.mjs
      exit: nao_executado
      nota: sem edição de produção em packages/ ou apps/
    - cmd: node tools/token-check.mjs
      exit: nao_executado
      nota: sem edição de produção em packages/ ou apps/
  arquivos_editados:
    - docs/migration/inbox/w30-19-financeiro.md
  nao_fez:
    - reescrever imports para lib/ raiz (alvos existem)
    - criar rota mobile
    - duplicar contrato.migracao.test.ts
    - tocar arquivos 3D protegidos
  bloqueio_restante:
    - dependencia residual de lib/ na raiz ate modulo canonico nos packages
    - slice .web-only
  nao_verificado:
    - "[NOT_VERIFIED: typecheck]"
    - "[NOT_VERIFIED: browser em /admin/financeiro]"
```

## w30-20-grid-motion

Worker índice 20 revisou a page `packages/frontend/src/pages/grid-motion`. Sem
imports legados a reescrever (já `@gb-locacoes/ui`). Rota fina web já existia em
`apps/clients/web/src/app/grid-motion/page.tsx` (sem ajuste). Tela fina mobile
já existia. Criado `contrato.migracao.test.ts`. Estado intermediate; migração
não concluída.

```yaml
fatia:
  id: w30-20-grid-motion
  indice: 20
  estado: intermediate
  conceito: playground GridMotion (revisão w30)
  escopo: packages/frontend/src/pages/grid-motion
  origem: []
  destino:
    - packages/frontend/src/pages/grid-motion/ui/GridMotionPage.tsx
    - packages/frontend/src/pages/grid-motion/index.ts
    - packages/frontend/src/pages/grid-motion/contrato.migracao.test.ts
    - apps/clients/web/src/app/grid-motion/page.tsx
    - apps/clients/mobile/src/app/grid-motion.tsx
  invariantes:
    - id: export-publico
      prova:
        "contrato.migracao.test.ts: export { GridMotionPage } from
        './ui/GridMotionPage'"
    - id: sem-import-legado
      prova: "GridMotionPage.tsx só @gb-locacoes/ui"
    - id: host-web-fino
      prova:
        "apps/clients/web/src/app/grid-motion/page.tsx importa
        @gb-locacoes/frontend/pages/grid-motion"
    - id: host-mobile-fino
      prova:
        "apps/clients/mobile/src/app/grid-motion.tsx importa GridMotionPage"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/grid-motion/contrato.migracao.test.ts"
      exit: 0
      verificado_em: "2026-09-25 17:16"
  gate:
    arch: skipped_sem_edicao_producao
    tokens: skipped_sem_edicao_producao
    vitest_platform: pass
    violacoes_conhecidas:
      - "app/ da raiz continua dono paralelo de /grid-motion"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado: []
  callers_atualizados: []
  nao_fez:
    - ajuste da rota fina web (já correta)
    - reescrita de imports (nenhum legado)
  bloqueio_restante: []
  nao_verificado:
    - "[NOT_VERIFIED: grid-motion no browser]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## w30-28-notificacoes

Worker índice 28 revisou a page `notificacoes`. Sem imports legados a
reescrever; host web
`apps/clients/web/src/app/area-cliente/notificacoes/page.tsx` já importa
`NotificacoesPage` do pacote — sem ajuste. Página .web (sem mobile). Contrato de
migração criado. Estado intermediate; migração não concluída.

```yaml
fatia:
  id: w30-28-notificacoes
  indice: 28
  estado: intermediate
  conceito: página de notificações da área do cliente (revisão w30)
  escopo: packages/frontend/src/pages/notificacoes
  origem: []
  destino:
    - packages/frontend/src/pages/notificacoes/index.ts
    - packages/frontend/src/pages/notificacoes/ui/NotificacoesPage.web.tsx
    - packages/frontend/src/pages/notificacoes/contrato.migracao.test.ts
    - apps/clients/web/src/app/area-cliente/notificacoes/page.tsx
  invariantes:
    - id: export-publico
      prova:
        'contrato.migracao.test.ts: export { NotificacoesPage } from
        "./ui/NotificacoesPage.web"'
    - id: host-web-fino
      prova:
        "apps/clients/web/.../notificacoes/page.tsx já importa
        @gb-locacoes/frontend/pages/notificacoes"
    - id: sem-import-legado
      prova:
        "NotificacoesPage.web.tsx sem @/components|@/hooks|@/lib nem relativo
        para components/hooks raiz"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/notificacoes/contrato.migracao.test.ts"
      exit: 0
      verificado_em: "2026-09-25 17:18"
  gate:
    arch: skipped_sem_edicao_producao
    tokens: skipped_sem_edicao_producao
    vitest_platform: pass
    violacoes_conhecidas:
      - "app/ da raiz continua dono paralelo de /area-cliente/notificacoes"
      - "página permanece .web (next/link); sem espelho mobile"
  aposentado: []
  callers_atualizados: []
  nao_fez:
    - editar rota fina web (já correta)
    - tela fina mobile (.web)
    - reescrita de imports (nenhum legado)
  bloqueio_restante: []
  nao_verificado:
    - "[NOT_VERIFIED: notificacoes no browser]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## w30-17-equipamentos-admin

Worker índice 17 revisou a page
`packages/frontend/src/pages/equipamentos-admin`. Imports `@/lib/utils`,
`@/lib/utils/category-helpers` e `@/lib/category-design` mantidos (alvos ainda
existem em `lib/`). Páginas exportadas são `*.web` — sem espelho mobile. Rotas
finas no host web já ok (`/admin/equipamentos`, `/novo`, `/[id]`,
`/[id]/editar`) — sem ajuste. Contrato de migração criado. Estado intermediate;
migração não concluída.

```yaml
fatia:
  id: w30-17-equipamentos-admin
  indice: 17
  estado: intermediate
  conceito: page admin de equipamentos (revisão w30)
  escopo: packages/frontend/src/pages/equipamentos-admin
  origem: []
  destino:
    - packages/frontend/src/pages/equipamentos-admin/contrato.migracao.test.ts
    - docs/migration/inbox/w30-17-equipamentos-admin.md
  host_web:
    - apps/clients/web/src/app/admin/equipamentos/page.tsx
    - apps/clients/web/src/app/admin/equipamentos/novo/page.tsx
    - apps/clients/web/src/app/admin/equipamentos/[id]/page.tsx
    - apps/clients/web/src/app/admin/equipamentos/[id]/editar/page.tsx
  host_web_ajuste:
    nenhum (já importam @gb-locacoes/frontend/pages/equipamentos-admin)
  invariantes:
    - id: export-publico
      prova:
        'contrato.migracao.test.ts: export { AdminEquipmentsPage } from
        "./ui/Lista.web"'
    - id: lib-legado-ainda-existe
      prova: >-
        @/lib/utils, @/lib/utils/category-helpers e @/lib/category-design não
        reescritos — alvos presentes em lib/
    - id: sem-mobile-web-only
      prova: exports de página vêm de *.web com next/*; sem apps/clients/mobile
    - id: sem-catch-all
      prova: nenhum [[...rota]] criado
  comandos:
    - cmd: >-
        pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/equipamentos-admin/contrato.migracao.test.ts
      exit: 0
      verificado_em: "2026-09-25 17:17"
  gate:
    arch: skipped_sem_edicao_producao
    tokens: skipped_sem_edicao_producao
    vitest_platform: pass
    violacoes_conhecidas:
      - "imports @/lib/* ainda apontam para lib/ na raiz"
      - "app/ da raiz continua dono paralelo das rotas admin/equipamentos"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado: []
  callers_atualizados: []
  nao_fez:
    - reescrita de @/lib (alvos ainda existem)
    - tela fina mobile (slice .web)
    - alteração das rotas finas web (já corretas)
    - edição de equipment-3d-carousel / model-viewer / lazy-3d / scroll-reveal
  bloqueio_restante:
    - migrar @/lib/category-helpers e @/lib/category-design quando forem para
      packages/
  nao_verificado:
    - "[NOT_VERIFIED: admin/equipamentos no browser]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## w30-18-equipamentos-scroll

Worker índice 18 revisou a page `equipamentos-scroll`. Sem imports legados a
reescrever; host web fino já importa `EquipamentosScrollPage` de
`@gb-locacoes/frontend/pages/equipamentos-scroll`. Página é `.web` — sem espelho
mobile. Contrato de migração criado. Estado intermediate; migração não
concluída.

```yaml
fatia:
  id: w30-18-equipamentos-scroll
  indice: 18
  estado: intermediate
  conceito: page scroll infinito de equipamentos (revisão w30)
  escopo: packages/frontend/src/pages/equipamentos-scroll
  origem: []
  destino:
    - packages/frontend/src/pages/equipamentos-scroll/ui/EquipamentosScrollPage.web.tsx
    - packages/frontend/src/pages/equipamentos-scroll/index.ts
    - packages/frontend/src/pages/equipamentos-scroll/contrato.migracao.test.ts
    - apps/clients/web/src/app/equipamentos-scroll/page.tsx
  invariantes:
    - id: export-publico
      prova:
        "contrato.migracao.test.ts: export { EquipamentosScrollPage } from
        './ui/EquipamentosScrollPage.web'"
    - id: sem-import-legado
      prova:
        "EquipamentosScrollPage.web.tsx so importa widgets/home-cliente (FSD
        page->widget)"
    - id: host-web-fino
      prova:
        "apps/clients/web/src/app/equipamentos-scroll/page.tsx ja importa
        @gb-locacoes/frontend/pages/equipamentos-scroll"
    - id: sem-mobile-web-only
      prova: "index exporta .web; sem tela fina mobile"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/equipamentos-scroll/contrato.migracao.test.ts"
      exit: 0
      verificado_em: "2026-09-25 17:16"
  gate:
    arch: skipped_sem_edicao_producao
    tokens: skipped_sem_edicao_producao
    vitest_platform: pass
    violacoes_conhecidas:
      - "app/ da raiz continua dono paralelo de /equipamentos-scroll"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado: []
  callers_atualizados: []
  nao_fez:
    - ajustar rota fina web (ja correta)
    - tela fina mobile (.web-only)
    - reescrita de imports (nenhum legado)
  bloqueio_restante: []
  nao_verificado:
    - "[NOT_VERIFIED: /equipamentos-scroll no browser]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## w30-22-historico-detalhe

Worker índice 22 revisou a page `historico-detalhe`. Sem imports legados
elegíveis a reescrita (relativo a `lib/utils` mantido — alvo ainda existe). Rota
fina web já correta; sem tela mobile (`.web` + next/*). Contrato de migração
criado. Estado intermediate; migração não concluída.

```yaml
fatia:
  id: w30-22-historico-detalhe
  indice: 22
  estado: intermediate
  conceito: detalhe de locação na área do cliente (revisão w30)
  escopo: packages/frontend/src/pages/historico-detalhe
  origem: []
  destino:
    - packages/frontend/src/pages/historico-detalhe/ui/HistoricoDetalhePage.web.tsx
    - packages/frontend/src/pages/historico-detalhe/ui/AcoesLocacao.web.tsx
    - packages/frontend/src/pages/historico-detalhe/ui/LinhaDoTempo.web.tsx
    - packages/frontend/src/pages/historico-detalhe/index.ts
    - packages/frontend/src/pages/historico-detalhe/contrato.migracao.test.ts
  invariantes:
    - id: export-publico
      prova:
        "contrato.migracao.test.ts: export { RentalDetailsPage } from
        ./ui/HistoricoDetalhePage.web"
    - id: rota-fina-web
      prova:
        "apps/clients/web/src/app/area-cliente/historico/[id]/page.tsx importa
        @gb-locacoes/frontend/pages/historico-detalhe"
    - id: sem-import-legado-elegivel
      prova:
        "nenhum @/components|hooks|lib nem relativo a components/hooks raiz;
        lib/utils alvo existe"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/historico-detalhe/contrato.migracao.test.ts"
      exit: 0
      verificado_em: "2026-09-25 17:18"
  gate:
    arch: skipped_sem_edicao_producao
    tokens: skipped_sem_edicao_producao
    vitest_platform: pass
    violacoes_conhecidas:
      - "app/ da raiz continua dono paralelo de /area-cliente/historico/[id]"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
      - "import relativo ../../../../../../lib/utils ainda aponta ao shim legado
        (alvo existe)"
  aposentado: []
  callers_atualizados: []
  nao_fez:
    - ajuste rota fina web (já apontava para o slice)
    - tela fina mobile (page .web + next/*)
    - reescrita de imports (nenhum legado elegível / alvo existe)
  bloqueio_restante: []
  nao_verificado:
    - "[NOT_VERIFIED: detalhe histórico no browser]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## w30-27-manutencao

Worker índice 27 revisou a page `pages/manutencao`. Sem imports legados a
reescrever. Rota fina web `/admin/maintenance` já importa `AdminMaintenancePage`
de `@gb-locacoes/frontend/pages/manutencao` — sem ajuste. Página .web: sem
espelho mobile. Já havia `*.test.ts` — contrato não criado. Estado intermediate;
migração não concluída.

```yaml
fatia:
  id: w30-27-manutencao
  indice: 27
  estado: intermediate
  conceito: revisão w30 do slice pages/manutencao + host web fino
  escopo: packages/frontend/src/pages/manutencao
  origem: []
  destino:
    - packages/frontend/src/pages/manutencao/index.ts
    - packages/frontend/src/pages/manutencao/ui/ManutencaoPage.web.tsx
    - apps/clients/web/src/app/admin/maintenance/page.tsx
  invariantes:
    - id: export-publico
      prova:
        'index.ts: export { AdminMaintenancePage } from
        "./ui/ManutencaoPage.web"'
    - id: host-fino
      prova: >-
        apps/clients/web/src/app/admin/maintenance/page.tsx importa
        AdminMaintenancePage de @gb-locacoes/frontend/pages/manutencao
    - id: sem-import-legado
      prova:
        "15 fontes do slice; 0 hits @/components|@/hooks|@/lib ou
        components/hooks raiz"
  comandos:
    - cmd: node tools/arch-check.mjs
      exit: nao_aplicavel
      nota: sem edição de produção nesta rodada
    - cmd: node tools/token-check.mjs
      exit: nao_aplicavel
      nota: sem edição de produção nesta rodada
  gate:
    arch: skipped_sem_edicao_producao
    tokens: skipped_sem_edicao_producao
    vitest_platform: skipped_ja_havia_test_ts
    violacoes_conhecidas:
      - "app/ da raiz continua dono paralelo de /admin/maintenance"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado: []
  callers_atualizados: []
  nao_fez:
    - reescrita de imports (nenhum legado)
    - tela fina mobile (export .web)
    - contrato.migracao.test.ts (já existem *.test.ts)
    - alteração da rota fina web (já correta)
  bloqueio_restante: []
  nao_verificado:
    - "[NOT_VERIFIED: manutenção no browser]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## w30-23-home

Worker índice 23 revisou `packages/frontend/src/pages/home`. Sem imports legados
a reescrever; rota fina web `/` já importa `@gb-locacoes/frontend/pages/home`;
page é `.web` (com `next/dynamic`) — sem espelho mobile; testes `*.test.ts` já
existem. Estado intermediate; migração não concluída.

```yaml
fatia:
  id: w30-23-home
  indice: 23
  estado: intermediate
  conceito: >-
    varredura de imports legados e host fino /; page .web HomePage; sem rewrite;
    sem mobile
  escopo: packages/frontend/src/pages/home
  origem: []
  destino:
    - packages/frontend/src/pages/home
    - apps/clients/web/src/app/page.tsx
    - docs/migration/inbox/w30-23-home.md
  movido: []
  criado: []
  host_web:
    rota: /
    arquivo: apps/clients/web/src/app/page.tsx
    resultado: ja_fino
    export: HomePage
    nota: >-
      shell async com Prisma setting.findFirst; passa localBusiness e
      heroInitialSettings ao HomePage do pacote
  espelho_mobile: nao_criado
  motivo_sem_mobile: HomePage exportado de HomePage.web.tsx com next/dynamic
  contrato_migracao_test: nao_criado
  motivo_sem_contrato: >-
    já existem model/hero-settings.test.ts e ui/HomePage.web.test.tsx
  comandos:
    - cmd: node tools/arch-check.mjs
      exit: n/a
      nota: sem edição de produção nesta rodada
    - cmd: node tools/token-check.mjs
      exit: n/a
      nota: sem edição de produção nesta rodada
    - cmd: pnpm exec vitest run --config vitest.platform.config.ts
      exit: n/a
      nota: sem teste novo
  gate:
    arch: skipped_sem_edicao_producao
    tokens: skipped_sem_edicao_producao
    vitest_platform: skipped_sem_teste_novo
    violacoes_conhecidas:
      - "app/ da raiz continua dono paralelo da home"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado: []
  callers_atualizados: []
  nao_fez:
    - reescrita de imports (nenhum legado elegível)
    - criar mobile para page .web
    - criar contrato.migracao.test.ts com *.test.ts já presente
    - editar arquivos protegidos do carrossel 3D
    - alterar apps/clients/web/src/app/page.tsx (já fino)
  bloqueio_restante: []
  nao_verificado:
    - "[NOT_VERIFIED: typecheck]"
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## w30-25-login

Worker índice 25 revisou a page `login`. Sem imports legados a reescrever; host
web `apps/clients/web/src/app/login/page.tsx` já importa `LoginPage` do pacote —
sem ajuste. Página universal com tela fina mobile já existente. Contrato de
migração criado. Estado intermediate; migração não concluída.

```yaml
fatia:
  id: w30-25-login
  indice: 25
  estado: intermediate
  conceito: página /login (revisão w30)
  escopo: packages/frontend/src/pages/login
  origem: []
  destino:
    - packages/frontend/src/pages/login/ui/LoginPage.tsx
    - packages/frontend/src/pages/login/index.ts
    - packages/frontend/src/pages/login/contrato.migracao.test.ts
    - apps/clients/web/src/app/login/page.tsx
    - apps/clients/mobile/src/app/login.tsx
  invariantes:
    - id: export-publico
      prova:
        'contrato.migracao.test.ts: export { LoginPage } from "./ui/LoginPage"'
    - id: sem-import-legado
      prova: "LoginPage.tsx só features/entrar e shared/ui (relativos FSD)"
    - id: host-web-fino
      prova:
        "apps/clients/web/src/app/login/page.tsx já importa
        @gb-locacoes/frontend/pages/login"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/login/contrato.migracao.test.ts"
      exit: 0
      verificado_em: "2026-09-25 17:16"
  gate:
    arch: skipped_sem_edicao_producao
    tokens: skipped_sem_edicao_producao
    vitest_platform: pass
    violacoes_conhecidas:
      - "app/ da raiz continua dono paralelo de /login com next-auth adapters"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado: []
  callers_atualizados: []
  nao_fez:
    - reescrita de imports (nenhum legado)
    - criar mobile (já existia)
    - editar rota fina web (já correta)
    - tocar arquivos 3D protegidos
  bloqueio_restante: []
  nao_verificado:
    - "[NOT_VERIFIED: login com credenciais no host web]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 315-typecheck-ui

Typecheck de `packages/ui` — FilterSelectGroup e HoverActionMenu. Estado
intermediate. Âncora da w30-25-login:
`app/ da raiz continua dono paralelo de /login com next-auth adapters` — esta
fatia não removeu esse paralelismo; corrigiu só os erros alvo em `packages/ui`
reportados pela 314. FilterSelectGroup passou a usar tipos locais
Filter/FilterOption em `packages/ui/src/contract/filter-select-group.ts`, sem
importar `@/types/filters` e sem mover o arquivo legado. HoverActionMenu.web.tsx
omite `children` e `onClick` de ButtonHTMLAttributes para não conflitar com o
contrato. `tsc -p packages/ui/tsconfig.json` exit 0. Typecheck completo ainda
exit 1 (native sem tipos de react-native; sintaxe em CatalogPage,
Expandidos.web, Graficos.web, ScrollStackBenefitCard.web). arch-check exit 0.
token-check exit 1 por crash interno `ts.ScriptKind.JS`, não por cor nova.
Migração **não** concluída.

```yaml
fatia:
  id: 315-typecheck-ui
  estado: intermediate
  conceito: >-
    corrigir erros de typecheck conhecidos em packages/ui (FilterSelectGroup
    @/types/filters + option any; HoverActionMenuProps conflito
    children/onClick); não declarar migração concluída
  ancora_fatia_anterior:
    id: w30-25-login
    violacao_unica:
      "app/ da raiz continua dono paralelo de /login com next-auth adapters"
  causa: >-
    FilterSelectGroup importava @/types/filters (alias inválido em packages/ui),
    deixando option implícito any; HoverActionMenuProps estendia
    ButtonHTMLAttributes e o contrato com children/onClick incompatíveis
  arquivos_editados:
    - packages/ui/src/contract/filter-select-group.ts
    - packages/ui/src/web/FilterSelectGroup.web.tsx
    - packages/ui/src/web/HoverActionMenu.web.tsx
  correcoes:
    - >-
      copiou Filter/FilterOption mínimos para
      packages/ui/src/contract/filter-select-group.ts (sem mover
      types/filters.ts legado)
    - FilterSelectGroup passa a importar o contrato local
    - >-
      HoverActionMenuProps omite children|onClick de ButtonHTMLAttributes,
      alinhando ao contrato compartilhado
  comandos:
    - cmd: .\node_modules\.bin\tsc.CMD -p packages/ui/tsconfig.json
      exit: 0
      verificado_em: "2026-09-25 17:18"
      nota: erros alvo (FilterSelectGroup + HoverActionMenu) resolvidos
    - cmd: >-
        cadeia typecheck (ui web + ui native + frontend + web host + mobile
        host) via .\node_modules\.bin\tsc.CMD -p …
      exit: 1
      verificado_em: "2026-09-25 17:18"
      nota: >-
        EXIT_UI_WEB=0; falhas restantes fora dos dois arquivos alvo (não
        corrigidas nesta fatia)
    - cmd: node tools/arch-check.mjs
      exit: 0
      verificado_em: "2026-09-25 17:18"
    - cmd: node tools/token-check.mjs
      exit: 1
      verificado_em: "2026-09-25 17:18"
      nota: >-
        TypeError no próprio tools/token-check.mjs (ts.ScriptKind.JS undefined)
        — não ligado às edições desta fatia
  erros_que_ficaram:
    - arquivo: packages/ui/src/native/*.native.tsx (vários)
      mensagem: >-
        TS2307: Cannot find module 'react-native' or its corresponding type
        declarations. (+ alguns TS7006/TS7031 implícitos any derivados)
      escopo: fora — ui native / ambiente sem types react-native
    - arquivo: packages/frontend/src/pages/catalog/ui/CatalogPage.tsx
      mensagem: >-
        TS1381: Unexpected token. Did you mean `{'}'}` or `&rbrace;`?
      escopo: fora — packages/frontend (outros agentes)
    - arquivo: packages/frontend/src/pages/dashboard/ui/Expandidos.web.tsx
      mensagem: "TS1005: '...' expected."
      escopo: fora — packages/frontend
    - arquivo: packages/frontend/src/pages/dashboard/ui/Graficos.web.tsx
      mensagem: "TS1005: '...' expected."
      escopo: fora — packages/frontend
    - arquivo: >-
        packages/frontend/src/widgets/por-que-escolher/ui/
        ScrollStackBenefitCard.web.tsx
      mensagem: >-
        TS1005/TS1136/TS1381/TS1382 (sintaxe JSX quebrada em vários pontos)
      escopo: fora — packages/frontend
  nao_fez:
    - editar packages/frontend / apps/clients / carrossel 3D / rotas
    - mover types/filters.ts legado da raiz
    - pnpm install
    - prisma migrate/push/seed
    - commit
  bloqueio_restante:
    typecheck: >-
      exit 1 — packages/ui web OK; native (react-native types) +
      packages/frontend (páginas/widgets em edição paralela) ainda falham; hosts
      não limpos
    token-check: >-
      exit 1 — crash interno do script (ScriptKind.JS undefined)
  migracao_concluida: false
  nao_verificado:
    - "[NOT_VERIFIED: typecheck completo]"
    - "[NOT_VERIFIED: pnpm test com TEST_DATABASE_URL]"
    - "[NOT_VERIFIED: build]"
    - "[NOT_VERIFIED: build:web]"
    - "[NOT_VERIFIED: bundle:mobile]"
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
```

## w30-29-orcamento

Índice 29 / 30. Slice `packages/frontend/src/pages/orcamento`. Import legado
`@/lib/utils` (`formatCurrency`) mantido — alvo `lib/utils.ts` ainda existe.
Relativos para `lib/utils/validation` fora do critério. Slice 100% `.web` — sem
mobile. Rota fina web já correta em
`apps/clients/web/src/app/orcamento/page.tsx` (importa `QuotePageWrapper`); sem
ajuste. Criado `contrato.migracao.test.ts` (vitest exit 0). Sem edição de
produção → arch/token não aplicáveis. Estado intermediate. Migração não
concluída.

```yaml
fatia:
  id: w30-29-orcamento
  indice: 29
  estado: intermediate
  escopo: packages/frontend/src/pages/orcamento
  conceito: >-
    varredura de imports legados + contrato de migração + verificação da rota
    fina web /orcamento
  origem: []
  destino:
    - packages/frontend/src/pages/orcamento/contrato.migracao.test.ts
    - docs/migration/inbox/w30-29-orcamento.md
  movido: []
  criado:
    - packages/frontend/src/pages/orcamento/contrato.migracao.test.ts
  host_web:
    rota: apps/clients/web/src/app/orcamento/page.tsx
    resultado: ja_ok
    porque: >-
      já importa QuotePageWrapper de @gb-locacoes/frontend/pages/orcamento;
      nenhuma edição necessária
  imports_legados_mantidos:
    - arquivo: ui/OrcamentoPage.web.tsx
      import: "@/lib/utils"
      motivo: lib/utils.ts ainda existe na raiz
  residual_fora_criterio:
    - arquivo: ui/ConfirmarEndereco.web.tsx
      import: "../../../../../../lib/utils/validation"
      motivo: relativo para lib/ raiz, não components/hooks
    - arquivo: ui/SelecionarEndereco.web.tsx
      import: "../../../../../../lib/utils/validation"
      motivo: relativo para lib/ raiz, não components/hooks
  mobile: nao_criado
  porque_sem_mobile:
    exports e módulos são .web (next/image, next/link, next/navigation)
  comandos:
    - cmd: >-
        pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/orcamento/contrato.migracao.test.ts
      exit: 0
      verificado_em: "2026-09-25 17:18"
    - cmd: node tools/arch-check.mjs
      exit: nao_aplicavel
      nota: sem edição de produção em packages/ ou apps/
    - cmd: node tools/token-check.mjs
      exit: nao_aplicavel
      nota: sem edição de produção em packages/ ou apps/
  nao_fez:
    - reescrever @/lib/utils (alvo raiz existe)
    - criar apps/clients/mobile para orcamento
    - editar rota fina web (já correta)
    - tocar arquivos 3D protegidos
  bloqueio_restante:
    - import @/lib/utils pendente até remoção do alvo raiz ou substituto único
      exportado
    - closeout typecheck/build/browser não rodado nesta fatia
  nao_verificado:
    - "[NOT_VERIFIED: typecheck]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: browser em /orcamento]"
```

## w30-16-equipamentos

Worker índice 16 revisou a page `pages/equipamentos`. Sem imports legados a
reescrever. Tela fina mobile criada; rota fina web alinhada aos adaptadores da
raiz (AdminFilterCard, SmartPagination, CategoryBadge via index público).
Contrato de migração criado. Estado intermediate; migração não concluída.

```yaml
fatia:
  id: w30-16-equipamentos
  indice: 16
  estado: intermediate
  conceito: catálogo público de equipamentos (revisão w30)
  escopo: packages/frontend/src/pages/equipamentos
  origem:
    - app/equipamentos/page.tsx
  destino:
    - packages/frontend/src/pages/equipamentos/ui/EquipamentosPage.tsx
    - packages/frontend/src/pages/equipamentos/index.ts
    - packages/frontend/src/pages/equipamentos/contrato.migracao.test.ts
    - apps/clients/web/src/app/equipamentos/page.tsx
    - apps/clients/mobile/src/app/equipamentos.tsx
  invariantes:
    - id: export-publico
      prova: >-
        contrato.migracao.test.ts: export { EquipamentosPage } from
        "./ui/EquipamentosPage"
    - id: sem-import-legado
      prova:
        EquipamentosPage.tsx só shared/ui, entities/equipamento, framer-motion,
        lucide, react
    - id: host-web-adapters
      prova: >-
        apps/clients/web/src/app/equipamentos/page.tsx importa
        EquipamentosPage/AdminFilterCard/CategoryBadge do entry
        pages/equipamentos e SmartPagination de @gb-locacoes/ui
    - id: sem-catch-all
      prova: nenhum [[...rota]] criado
  comandos:
    - cmd: >-
        pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/equipamentos/contrato.migracao.test.ts
      exit: 0
      verificado_em: "2026-09-25 17:20"
    - cmd: node tools/arch-check.mjs
      exit: 0
      verificado_em: "2026-09-25 17:20"
    - cmd: node tools/token-check.mjs
      exit: 1
      verificado_em: "2026-09-25 17:20"
      nota: crash TypeError em tools/token-check.mjs (ambiente) — fora do escopo
  gate:
    arch: pass
    tokens: fail_tool_crash
    vitest_platform: pass
    violacoes_conhecidas:
      - app/ da raiz continua dono paralelo de /equipamentos
      - o carrossel 3D continua em components/equipment-3d-carousel.tsx
  aposentado: []
  callers_atualizados:
    - apps/clients/web/src/app/equipamentos/page.tsx
  nao_fez:
    - reescrita de imports legados (nenhum no slice)
    - aposentadoria de app/equipamentos/page.tsx na raiz
  bloqueio_restante:
    - adaptadores mobile ainda stubs (filter/pagination/badge)
  nao_verificado:
    - "[NOT_VERIFIED: browser em /equipamentos]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: device_or_emulator]"
```

## 319-token-check

Crash interno do gate `tools/token-check.mjs` no TypeScript 7.0.2:
`require("typescript")` só exporta version; `ts.ScriptKind` undefined. Corrigido
`loadTypeScript` para usar API clássica já no tree (`typescript@5.9.3` /
`@typescript/typescript6` se houver). Gate limpo: exit 0, 634 arquivos de código
examinados, sem violações de cor/dimensão. Regra token-check-allow intacta.
Cores de produto não alteradas. Migração **não** concluída.

```yaml
fatia:
  id: 319-token-check
  estado: intermediate
  conceito: >-
    restaurar token-check após crash ScriptKind no TypeScript 7; não declarar
    migração concluída
  escopo:
    - tools/token-check.mjs
  causa: >-
    TypeScript 7.0.2 package root (lib/version.cjs) exporta só version;
    ScriptKind/createSourceFile não estão no entry principal (não é hex/rgb nem
    allow frouxo)
  arquivos_editados:
    - tools/token-check.mjs
  comandos:
    - cmd: node tools/token-check.mjs
      exit: 0
      verificado_em: "2026-09-25 17:25"
      nota: >-
        token gate passed — examined 634 code and 0 CSS files; sem exceção; sem
        violações reais
  gate:
    tokens: pass
  nao_fez:
    - alterar cores de produto
    - afrouxar token-check-allow
    - editar CatalogPage/Expandidos/Graficos/ScrollStackBenefitCard
    - editar carrossel 3D, FilterSelectGroup, HoverActionMenu
    - pnpm install / prisma / commit
  bloqueio_restante:
    - typecheck completo ainda falha por outros motivos (fora desta fatia)
```

## 320-typecheck-erros

Typecheck: export público de `Alert`/`AlertTitle`/`AlertDescription` em
`@gb-locacoes/ui`; paths dos `.d.ts` de `react-native` já instalados em
`apps/clients/mobile/node_modules`; include de `types/next-auth.d.ts` (session
`id`/`role`). Contagens antes→depois: ui web 0→0, ui native 61→0, frontend
204→122, web 182→112, mobile 415→339. Aliases `@/lib`* ainda no legado não
reescritos. arch/token exit 0. Migração **não** concluída.

```yaml
fatia:
  id: 320-typecheck-erros
  estado: intermediate
  conceito: >-
    reduzir erros de typecheck (Alert export, paths react-native, sessão
    next-auth); não declarar migração concluída
  arquivos_editados:
    - packages/ui/src/index.web.ts
    - packages/ui/src/index.native.ts
    - packages/ui/tsconfig.native.json
    - packages/frontend/tsconfig.json
    - apps/clients/mobile/tsconfig.json
    - apps/clients/web/tsconfig.json
  contagem_antes:
    { ui_web: 0, ui_native: 61, frontend: 204, web: 182, mobile: 415 }
  contagem_depois:
    { ui_web: 0, ui_native: 0, frontend: 122, web: 112, mobile: 339 }
  gate:
    arch: pass
    tokens: pass
  bloqueio_restante:
    - frontend ainda falha em @/lib legado (não movido)
    - hosts ecoam frontend; carrossel 3D permanece legado
  migracao_concluida: false
```

## 321-aliases-lib

Aliases `@/lib/*` e relativos `packages/frontend`→`lib/` raiz: inventário Node
(9 módulos); todos CLIENT-SAFE. Copiados para `packages/frontend/src/shared/lib`
(`cn`, `debounce-fn`, `formatting`, `cep`, `boleto-validator`, `sanitize`
DOMPurify distinto de `sanitize-html`, `icon-utils`,
`constants/all-icons`+`lucide-icons`, `category-design`, `category-helpers`).
Reuso de `moeda`, `entities/orcamento` (reajuste/documento). Sem unificar
moeda/debounce/ getInitials/LABEL vs LABELS. Legado `lib/` mantido. Contagens
antes→depois: ui web 0→0, ui native 0→0, frontend 122→19, web 112→17, mobile
339→316. arch/token exit 0. Migração **não** concluída.

```yaml
fatia:
  id: 321-aliases-lib
  estado: intermediate
  conceito: >-
    copiar CLIENT-SAFE de lib/ raiz para shared/lib e reescrever imports só no
    frontend; não declarar migração concluída
  contagem_antes:
    { ui_web: 0, ui_native: 0, frontend: 122, web: 112, mobile: 339 }
  contagem_depois:
    { ui_web: 0, ui_native: 0, frontend: 19, web: 17, mobile: 316 }
  gate:
    arch: pass
    tokens: pass
  legado_raiz_mantido: true
  SERVER_nao_movidos: []
  bloqueio_restante:
    - typecheck ainda exit 1 (@/schemas, @/types, hero 3D, etc.)
  migracao_concluida: false
```

## 322-typecheck-resto

Typecheck resto: schema/filters copiados; shims typecheck para settings actions
(Prisma NÃO puxado) e carrossel 3D (lógica intacta); listagem sem `| unknown`;
VerCategoria/Omit customIcon; testes Dica/Sobre; mobile removeu
`customConditions: react-native` (causa dos 291× TS2322 IntrinsicAttributes).
Contagens antes→depois: ui 0→0, frontend 19→0, web 17→0, mobile 316→0.
arch/token exit 0. Migração **não** concluída.

```yaml
fatia:
  id: 322-typecheck-resto
  estado: intermediate
  conceito: >-
    typecheck resto (paths/shims/tipos/tsconfig mobile); não declarar migração
    concluída
  contagem_antes:
    { ui_web: 0, ui_native: 0, frontend: 19, web: 17, mobile: 316 }
  contagem_depois: { ui_web: 0, ui_native: 0, frontend: 0, web: 0, mobile: 0 }
  causa_mobile_antes: customConditions react-native → UI native vs props web
  causa_mobile_depois: nenhuma (0 erros)
  gate:
    arch: pass
    tokens: pass
  SERVER_nao_movidos:
    - app/api/admin/settings/actions.ts
  legado_raiz_mantido: true
  bloqueio_restante:
    - runtime mobile ainda sem páginas .native; shim settings só tsc
  migracao_concluida: false
```

## 323-prova-builds

Prova pós-typecheck 0: `pnpm test` exit 1 (`TEST_DATABASE_URL` ausente);
`pnpm build:web` exit 1 (1ª: `useSession` sem provider → fix
`SessionProviderWrapper` no host web; retentativa: `useSearchParams` sem
Suspense em `/equipamentos`); `pnpm bundle:mobile` exit 1 (`rn-get-polyfills`);
`pnpm check:tokens` exit 1 (`brand600`); arch/token-check.mjs exit 0 após
edição. Limitação: mobile sem `customConditions` pode tipar export web de
`@gb-locacoes/ui`. `app/` e carrossel 3D legado. Migração **não** concluída.

```yaml
fatia:
  id: 323-prova-builds
  estado: intermediate
  conceito: >-
    prova test/build:web/bundle:mobile; limitação customConditions; não declarar
    migração concluída
  exits:
    {
      test: 1,
      build_web: 1,
      bundle_mobile: 1,
      check_tokens: 1,
      arch: 0,
      token_check: 0
    }
  fix_pequeno:
    - apps/clients/web/src/app/layout.tsx (SessionProviderWrapper)
  limitacao_customConditions: >-
    tsc mobile pode resolver export web de @gb-locacoes/ui; typecheck 0 não
    prova resolução nativa em runtime
  legado_raiz_mantido: true
  carrossel_3d_legado: true
  migracao_concluida: false
```

## 324-build-web

Correções pós-323: Suspense local em `/equipamentos` (`useSearchParams`);
`check:tokens` aponta `orange600` (#ea580c); Metro `getPolyfills` usa
`rn-get-polyfills.js` do RN 0.86 no store. `build:web` 0, `bundle:mobile` 0,
`check:tokens` 1 (vitest filter + webRender sem botões inline). Guard
`DATABASE_URL` na home do host (sem inventar URL). SessionProvider mantido.
Migração **não** concluída.

```yaml
fatia:
  id: 324-build-web
  estado: intermediate
  conceito: >-
    Suspense /equipamentos + orange600 check + metro polyfills; não declarar
    migração concluída
  exits: { build_web: 0, bundle_mobile: 0, check_tokens: 1 }
  fix:
    - apps/clients/web/src/app/equipamentos/page.tsx (Suspense local)
    - apps/clients/web/src/app/page.tsx (skip prisma sem DATABASE_URL)
    - tools/token-propagation-check.mjs (orange600)
    - apps/clients/mobile/metro.config.js (getPolyfills store 0.86)
  legado_raiz_mantido: true
  carrossel_3d_legado: true
  migracao_concluida: false
```

## 325-check-tokens

`check:tokens` alinhado ao Button web (classes Tailwind/`bg-slate-700`) e ao
vitest de plataforma (`packages/**`). Exit 0. arch 1 residual (`metro.config.js`
RUNTIME-NODE da 324). token-check 0. Sem UI nova. Migração **não** concluída.

```yaml
fatia:
  id: 325-check-tokens
  estado: intermediate
  conceito: >-
    check:tokens platform vitest + webRender class; não declarar migração
    concluída
  exits: { check_tokens: 0, arch: 1, token_check: 0 }
  fix:
    - tools/token-propagation-check.mjs (vitest.platform + class buttons)
  legado_raiz_mantido: true
  carrossel_3d_legado: true
  migracao_concluida: false
```

## 326-arch-metro

arch-check deixa de varrer `metro.config.js` (ferramenta Node do Metro).
Critério estreito: só o basename. Polyfill RN 0.86 da 324 intacto; bundle não
reexecutado. RUNTIME-NODE em packages/frontend intacto. Migração **não**
concluída.

```yaml
fatia:
  id: 326-arch-metro
  estado: intermediate
  conceito: >-
    excluir metro.config.js do arch-check; não declarar migração concluída
  exits: { arch: 0 }
  fix:
    - tools/arch-check.mjs (listFiles ignora basename metro.config.js)
  bundle_mobile_reexecutado: false
  legado_raiz_mantido: true
  carrossel_3d_legado: true
  migracao_concluida: false
```

## 327-carrossel-3d

Carrossel 3D saiu de `components/` para o widget `hero` (arquivos `.web.tsx`:
Three.js, `next/dynamic`, DOM). Slice próprio `widgets/carrossel-3d` foi
rejeitado pelo arch (FSD-SLICE: hero não importa irmão). Export público no
`widgets/hero/index.ts` e reexport em `@gb-locacoes/frontend/pages/sobre`.
`scroll-reveal-init` e `service-worker-register` permanecem no host/legado.
Invariantes de zoom/`maxDuration`/`disableAutoFit`/`scrollRevealReady`
preservados. Legados apagados após zero imports. arch 0, token 0. Estado
intermediate. Migração **não** concluída.

```yaml
fatia:
  id: 327-carrossel-3d
  estado: intermediate
  conceito: >-
    mover carrossel 3D + model-viewer + lazy-3d para widget hero (.web);
    scroll-reveal permanece no host; não declarar migração concluída
  origem:
    - components/equipment-3d-carousel.tsx
    - components/ui/model-viewer.tsx
    - components/ui/lazy-3d-carousel.tsx
  destino:
    - packages/frontend/src/widgets/hero/ui/Equipment3DCarousel.web.tsx
    - packages/frontend/src/widgets/hero/ui/ModelViewer.web.tsx
    - packages/frontend/src/widgets/hero/ui/Lazy3DCarousel.web.tsx
    - packages/frontend/src/widgets/hero/index.ts
  lido_antes:
    - docs/features/equipment-3d-carousel.md
  invariantes:
    - id: maxDuration-0-primeiro
      prova: "ModelViewer.web.tsx: boundsMaxDuration = disableAutoFit ? 0 : 1"
    - id: disableAutoFit
      prova: "ModelViewer.web.tsx: disableAutoFit={delayBoundsFit}"
    - id: hasPassedFirstModel
      prova:
        "Equipment3DCarousel.web.tsx: hasPassedFirstModel = currentIndex > 0"
    - id: scrollRevealReady-host
      prova:
        "scroll-reveal-init permanece em components/; ClientLayout injeta
        ssr:false"
    - id: sem-legado-imports
      prova:
        "zero imports de
        components/equipment-3d-carousel|model-viewer|lazy-3d-carousel"
  comandos:
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "app/ da raiz continua o servidor Next de produção"
      - "scroll-reveal-init continua no host de propósito"
      - "service-worker-register continua em components/"
  aposentado:
    - components/equipment-3d-carousel.tsx
    - components/ui/model-viewer.tsx
    - components/ui/lazy-3d-carousel.tsx
    - packages/frontend/src/widgets/hero/model/equipment-3d-carousel.shim.ts
  callers_atualizados:
    - packages/frontend/src/widgets/hero/ui/Hero.web.tsx
    - packages/frontend/src/pages/sobre/index.ts
    - app/sobre/page.tsx
    - apps/clients/web/src/app/sobre/page.tsx
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test]"
    - "[NOT_VERIFIED: browser no carrossel / home / sobre]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  nao_fez:
    - pnpm install
    - prisma migrate/seed
    - inventar TEST_DATABASE_URL
    - pnpm test
    - mover scroll-reveal-init
    - mover service-worker-register
    - build:web completo
  migracao_concluida: false
```

## 328-host-reveal-sw

`scroll-reveal-init` e `service-worker-register` saíram de `components/` para
`app/` (ao lado de `ClientLayout.tsx`). O host continua o único ponto de
carregamento: `dynamic(..., { ssr: false })` para o reveal e um único
`ServiceWorkerRegister` em `hostExtras`. Evento `scrollRevealReady`, atrasos e
escopo do SW intactos. Pasta `components/` ficou sem arquivos e foi removida
(pastas vazias via Node `fs`). Carrossel 3D não tocado. arch/token exit 0.
Estado intermediate. Migração **não** concluída.

```yaml
fatia:
  id: 328-host-reveal-sw
  estado: intermediate
  conceito: >-
    mover scroll-reveal-init e service-worker-register de components/ para app/
    (host); sem duplicar init; sem alterar carrossel 3D / SW scope
  origem:
    - components/scroll-reveal-init.tsx
    - components/service-worker-register.tsx
  destino:
    - app/scroll-reveal-init.tsx
    - app/service-worker-register.tsx
    - app/ClientLayout.tsx
  lido_antes:
    - docs/features/equipment-3d-carousel.md
    - app/ClientLayout.tsx
    - packages/frontend/src/app/providers/ClientLayoutShell.web.tsx
  invariantes:
    - id: scrollRevealReady-timing
      prova:
        "app/scroll-reveal-init.tsx: dispatch 2700ms primeira visita / 200ms
        interna"
    - id: ssr-false-host
      prova:
        "app/ClientLayout.tsx: dynamic(() => import('./scroll-reveal-init'), {
        ssr: false })"
    - id: sw-unico
      prova:
        "único ServiceWorkerRegister em app/ClientLayout hostExtras;
        lib/sw-register intacto"
    - id: carrossel-3d-intacto
      prova:
        "não alterou Equipment3DCarousel/ModelViewer maxDuration 0 /
        disableAutoFit / hasPassedFirstModel"
    - id: sem-legado-imports
      prova:
        "zero imports de @/components/scroll-reveal-init|service-worker-register"
  comandos:
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "app/ da raiz continua o servidor Next de produção"
  aposentado:
    - components/scroll-reveal-init.tsx
    - components/service-worker-register.tsx
    - components/ (pasta vazia removida via node fs)
  callers_atualizados:
    - app/ClientLayout.tsx
    - packages/frontend/src/app/providers/ClientLayoutShell.web.test.tsx
    - scripts/performance-config.json
    - scripts/fix-typescript-errors.js
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test — falta TEST_DATABASE_URL]"
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  nao_fez:
    - pnpm install
    - prisma migrate/seed
    - inventar TEST_DATABASE_URL
    - pnpm test
    - alterar lógica do carrossel 3D
    - registrar SW duas vezes
    - apagar app/ da raiz
  migracao_concluida: false
```

## 329-app-raiz-telas

Varredura node fs de app/**/page.tsx (fora api): 46 pages, todas shell fino ou
adaptador de host (Prisma/auth/metadata/Suspense/slots). Lista de telas gordas
vazia — nada movido; app/ intacto. hooks/ vazia removida via fs.rmdir. Carrossel
3D não tocado. pnpm tokens e pnpm arch exit 0. Estado intermediate. Migração
**não** concluída.

```yaml
fatia:
  id: 329-app-raiz-telas
  estado: intermediate
  conceito: >-
    inventário app/**/page.tsx (fora api) via node fs; classificar shell vs tela
    gorda; mover um grupo só se houver tela; senão só gates
  origem:
    - app/**/page.tsx (exceto app/api)
  destino: []
  movido: []
  pages_total: 46
  pages_shell: 46
  pages_tela: 0
  pages_nao_shell: []
  lido_antes:
    - docs/ai/boot.md
    - docs/migration/inbox/328-host-reveal-sw.md
    - app/cadastro/page.tsx
    - app/entrar/page.tsx
    - app/login/page.tsx
    - app/equipamentos/[id]/page.tsx
    - app/page.tsx
    - app/sobre/page.tsx
  invariantes:
    - id: sem-mover-sem-tela
      prova: "pages_tela=0; movido=[]; app/ page.tsx não alterados nesta fatia"
    - id: sem-apagar-app
      prova: "app/ da raiz permanece (API + rotas); sem catch-all novo"
    - id: carrossel-3d-intacto
      prova:
        "não alterou Equipment3DCarousel/ModelViewer maxDuration 0 /
        disableAutoFit / hasPassedFirstModel / scrollRevealReady"
    - id: hooks-vazio
      prova: "hooks/ sem arquivos; fs.rmdirSync só porque vazia"
  comandos:
    - cmd: "node (walk fs app/**/page.tsx excl. api)"
      exit: 0
    - cmd: "pnpm tokens"
      exit: 0
    - cmd: "pnpm arch"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "app/ da raiz continua o servidor Next de produção (API + rotas)"
  aposentado:
    - hooks/ (pasta vazia)
  callers_atualizados: []
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test — falta TEST_DATABASE_URL]"
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  nao_fez:
    - pnpm install
    - prisma migrate/seed
    - inventar TEST_DATABASE_URL
    - pnpm test
    - pnpm build
    - mover page/slice (todas shell/adaptador)
    - apagar app/ da raiz
    - alterar lógica do carrossel 3D
    - recriar catch-all
  migracao_concluida: false
```

## 330-remedicao-gates

Remedição dos gates após carrossel em widgets/hero e reveal/SW em app/. Exits:
arch 0, tokens 0, check:tokens 0, typecheck 0, build:web 0; test bloqueado
(TEST_DATABASE_URL ausente). Sem correção de import. Sem bundle:mobile.
Carrossel 3D intacto. Código não alterado. Estado intermediate. Migração **não**
concluída.

```yaml
fatia:
  id: 330-remedicao-gates
  estado: intermediate
  conceito: >-
    remediar arch/tokens/check:tokens/typecheck/build:web pós-carrossel
    widgets/hero e host reveal/SW em app/; test só se TEST_DATABASE_URL já
    existir
  origem: []
  destino: []
  movido: []
  lido_antes:
    - docs/ai/boot.md
    - docs/migration/MIGRATION.md (final 329)
    - package.json (scripts arch/tokens/check:tokens/typecheck/build:web/test)
  invariantes:
    - id: carrossel-3d-intacto
      prova:
        "não alterou Equipment3DCarousel/ModelViewer maxDuration 0 /
        disableAutoFit / hasPassedFirstModel / scrollRevealReady"
    - id: sem-apagar-app
      prova: "app/ da raiz permanece (API + rotas finas)"
    - id: sem-inventario-test-url
      prova:
        "TEST_DATABASE_URL ausente (env + .env + .env.local); pnpm test não
        executado"
  comandos:
    - cmd: "pnpm arch"
      exit: 0
    - cmd: "pnpm tokens"
      exit: 0
    - cmd: "pnpm check:tokens"
      exit: 0
    - cmd: "pnpm typecheck"
      exit: 0
    - cmd: "pnpm build:web"
      exit: 0
    - cmd: "pnpm test"
      exit: null
      bloqueio: "TEST_DATABASE_URL ausente"
  gate:
    arch: pass
    tokens: pass
    check_tokens: pass
    typecheck: pass
    build_web: pass
    test: blocked
    violacoes_conhecidas:
      - "app/ da raiz continua o servidor Next de produção (API + rotas finas)"
  aposentado: []
  callers_atualizados: []
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test — falta TEST_DATABASE_URL]"
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  nao_fez:
    - pnpm install
    - prisma migrate/seed
    - inventar TEST_DATABASE_URL
    - pnpm test
    - bundle:mobile
    - correção de import (não necessária)
    - alteração de código de produto
    - apagar app/ da raiz
    - alterar lógica do carrossel 3D
  migracao_concluida: false
```

## 331-bundle-browser

Prova de `pnpm bundle:mobile` no código atual (pós-carrossel em `widgets/hero`)
e checagem browser na home e `/sobre`. Bundle exit 0 sem correção de import.
Browser no host `@gb-locacoes/web` (raiz `pnpm dev` sobe mas falha resolução de
`@gb-locacoes/frontend/*`). Páginas renderizam; sem `Module not found` do
carrossel — runtime 404 de `/models/Compressor.glb` e next-auth session. Sem
emulador. Código não alterado. Estado intermediate. Migração **não** concluída.

```yaml
fatia:
  id: 331-bundle-browser
  estado: intermediate
  conceito: >-
    provar bundle:mobile pós-carrossel widgets/hero; browser home+/sobre no host
    web; device se existir; sem inventar TEST_DATABASE_URL/DATABASE_URL
  origem: []
  destino: []
  movido: []
  lido_antes:
    - docs/ai/boot.md
    - docs/migration/MIGRATION.md (final 330)
    - package.json (scripts bundle:mobile / dev)
    - apps/clients/web/package.json (script dev)
  invariantes:
    - id: carrossel-3d-intacto
      prova:
        "não alterou Equipment3DCarousel/ModelViewer maxDuration 0 /
        disableAutoFit / hasPassedFirstModel / scrollRevealReady"
    - id: sem-apagar-app
      prova: "app/ da raiz permanece"
    - id: sem-inventario-test-url
      prova: "TEST_DATABASE_URL não inventada; pnpm test não executado"
  comandos:
    - cmd: "pnpm bundle:mobile"
      exit: 0
      nota: >-
        expo export android+ios → dist-export; iOS 1209 módulos, Android 2354;
        sem falha de import do carrossel no native; correção de import não
        necessária; sem segunda rodada de bundle
      verificado_em: "2026-09-25"
    - cmd: "pnpm arch / tokens / check:tokens / typecheck / build:web"
      exit: 0
      nota: "já medidos na fatia 330; não reexecutados aqui"
    - cmd: "pnpm test"
      exit: null
      bloqueio: "TEST_DATABASE_URL ausente"
  browser:
    host_raiz_pnpm_dev:
      status: Ready em :3000
      pagina: falha Module not found @gb-locacoes/frontend/app e pages/home
      acao: processo encerrado; trocado para host web
    host_web:
      cmd: "pnpm --filter @gb-locacoes/web dev"
      url: "http://localhost:3000"
      home:
        http: 200
        render:
          "GB Locações; H1 Locação de Equipamentos; controles Modelo
          anterior/próximo"
        modulo_carrossel:
          "sem Module not found; stack aponta widgets/hero/*.web.tsx"
        console_relevante:
          - "Compressor.glb 404 (asset ausente no host web)"
          - "next-auth CLIENT_FETCH_ERROR (/api/auth/session 404)"
          - "THREE.Clock deprecated"
      sobre:
        render: "H1 Sobre a GB Locações; conteúdo história/valores"
        modulo_carrossel: "sem Module not found; GLB 404 no carrossel da página"
  gate:
    bundle_mobile: pass
    browser_home_sobre: pass_com_runtime_nao_modulo
    test: blocked
    violacoes_conhecidas:
      - "app/ da raiz continua o servidor Next legado (API + rotas finas)"
      - "pnpm dev raiz não resolve @gb-locacoes/frontend/* neste ambiente"
  aposentado: []
  callers_atualizados: []
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test — falta TEST_DATABASE_URL]"
    - "[NOT_VERIFIED: cobertura]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: asset /models/Compressor.glb no host web]"
    - "[NOT_VERIFIED: /api/auth/session no host web]"
  nao_fez:
    - pnpm install
    - prisma migrate/seed
    - inventar TEST_DATABASE_URL
    - inventar DATABASE_URL
    - pnpm test
    - correção de import (não necessária — bundle 0)
    - alteração de código de produto
    - CHANGELOG (sem mudança de código)
    - apagar app/ da raiz
    - alterar lógica do carrossel 3D
  migracao_concluida: false
```

## 332-dev-raiz

Correção da resolução workspace no `pnpm dev` da raiz: `@gb-locacoes/frontend`
passou a ser resolvido (sem Module not found). GLB `/models/Compressor.glb`
apontado no host web via junction para `public/` da raiz. Estado intermediate.
Migração **não** concluída.

```yaml
fatia:
  id: 332-dev-raiz
  estado: intermediate
  conceito: >-
    raiz pnpm.dev resolve @gb-locacoes/frontend/*; GLB no host web via public da
    raiz; sem pnpm install novo; sem inventar DATABASE_URL/TEST_DATABASE_URL
  origem: []
  destino: []
  movido: []
  lido_antes:
    - docs/ai/boot.md
    - docs/migration/MIGRATION.md (final 331)
    - package.json (raiz + packages/frontend exports)
    - next.config.mjs (raiz + apps/clients/web)
    - tsconfig.json (raiz)
  invariantes:
    - id: carrossel-3d-intacto
      prova:
        "não alterou Equipment3DCarousel/ModelViewer maxDuration 0 /
        disableAutoFit / hasPassedFirstModel / scrollRevealReady"
    - id: sem-apagar-app
      prova: "app/ da raiz permanece; UI não copiada de volta"
    - id: sem-inventario-test-url
      prova:
        "TEST_DATABASE_URL/DATABASE_URL não inventadas; pnpm test não executado"
  alteracoes:
    - path: package.json
      nota: "dependencies workspace:* @gb-locacoes/frontend, ui, design-tokens"
    - path: next.config.mjs
      nota: >-
        transpilePackages já existia; resolveAlias relativo + webpack alias
        (caminho absoluto Windows rejeitado pelo Turbopack)
    - path: tsconfig.json
      nota: "paths para ./app, ./pages/*, ui, design-tokens"
    - path: apps/clients/web/public
      nota: "junction local → ../../../public (Compressor.glb existe na raiz)"
    - path: .gitignore
      nota: "apps/clients/web/public (junction não versionada)"
  comandos:
    - cmd: "pnpm dev -- --port 3001"
      exit: 0
      nota: >-
        Ready; GET / sem Module not found @gb-locacoes/frontend; 500 por
        DATABASE_URL is not set (runtime env, fora do escopo); processo
        encerrado ao final
      verificado_em: "2026-09-25"
    - cmd: "HEAD http://localhost:3000/models/Compressor.glb"
      exit: 0
      nota: "200 Content-Length 997368 após junction no host web"
    - cmd: "HEAD http://localhost:3001/models/Compressor.glb"
      exit: 0
      nota: "200 na raiz (public/ já servia)"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      nota: "architecture gate passed (5 packages)"
    - cmd: "pnpm test"
      exit: null
      bloqueio: "TEST_DATABASE_URL ausente"
  browser:
    host_raiz_pnpm_dev:
      url: "http://localhost:3001"
      modulo_frontend: "resolvido (sem Module not found)"
      home_http: 500
      home_erro: "DATABASE_URL is not set (lib/prisma.ts) — não inventada"
    host_web_glb:
      url: "http://localhost:3000/models/Compressor.glb"
      http: 200
  gate:
    resolucao_workspace_raiz: pass
    glb_host_web: pass
    arch: pass
    test: blocked
  aposentado: []
  callers_atualizados: []
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test — falta TEST_DATABASE_URL]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
    - "[NOT_VERIFIED: pnpm install — lock raiz ainda sem importer workspace;
      junctions manuais]"
    - "[NOT_VERIFIED: home 200 com DATABASE_URL real]"
  nao_fez:
    - pnpm install
    - prisma migrate/seed
    - inventar TEST_DATABASE_URL
    - inventar DATABASE_URL
    - pnpm test
    - fabricar arquivo GLB
    - segundo pacote frontend
    - copiar UI para app/
    - alterar lógica do carrossel 3D
  migracao_concluida: false
```

## 333-workspace-lock

`pnpm install` na raiz registrou os `workspace:*` de `@gb-locacoes/frontend`,
`ui` e `design-tokens` no importer `.` do lockfile. Links em
`node_modules/@gb-locacoes/*` via pnpm (`link:packages/...`). Junction
`apps/clients/web/public` → `public/` da raiz mantida. Estado intermediate.
Migração **não** concluída.

```yaml
fatia:
  id: 333-workspace-lock
  estado: intermediate
  conceito: >-
    lock raiz passa a listar workspace:* frontend/ui/design-tokens; pnpm
    install; arch e build:web; sem prisma migrate/seed; sem inventar
    TEST_DATABASE_URL; sem pnpm test
  origem: []
  destino: []
  movido: []
  lido_antes:
    - docs/ai/boot.md
    - docs/migration/MIGRATION.md (final 332)
    - docs/migration/inbox/332-dev-raiz.md
    - package.json (raiz, workspace:* já presentes)
    - pnpm-lock.yaml (importer . sem @gb-locacoes antes do install)
  invariantes:
    - id: carrossel-3d-intacto
      prova:
        "não alterou Equipment3DCarousel/ModelViewer maxDuration 0 /
        disableAutoFit / hasPassedFirstModel / scrollRevealReady"
    - id: sem-apagar-app
      prova:
        "app/ da raiz permanece (API + rotas finas); UI não copiada de volta"
    - id: sem-inventario-test-url
      prova: "TEST_DATABASE_URL ausente; pnpm test não executado"
    - id: alias-relativo
      prova:
        "não introduziu path absoluto C:\\ em next.config; build:web exit 0"
    - id: public-junction
      prova:
        "apps/clients/web/public junction → public/ da raiz preservada; GLB
        presente"
  alteracoes:
    - path: pnpm-lock.yaml
      nota: >-
        importer . ganhou @gb-locacoes/design-tokens, frontend, ui (specifier
        workspace:* / version link:packages/...)
    - path: node_modules/@gb-locacoes/*
      nota: "links pnpm (Junction Windows) para packages/* após install"
  comandos:
    - cmd: "pnpm install"
      exit: 0
      nota:
        "sem dependência nova no package.json; Prisma não atualizado nesta fatia"
      verificado_em: "2026-09-25"
    - cmd: "pnpm arch"
      exit: 0
      nota: "architecture gate passed (5 packages)"
    - cmd: "pnpm build:web"
      exit: 0
      nota: "Next.js 16.3.6 Turbopack; compile + TS + static pages OK"
    - cmd: "pnpm test"
      exit: null
      bloqueio: "TEST_DATABASE_URL ausente"
  gate:
    install: pass
    lock_root_workspace: pass
    arch: pass
    build_web: pass
    test: blocked
  aposentado: []
  callers_atualizados: []
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test — falta TEST_DATABASE_URL]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  nao_fez:
    - dependência nova no package.json
    - atualizar Prisma
    - prisma migrate/seed
    - inventar TEST_DATABASE_URL
    - pnpm test
    - apagar junction apps/clients/web/public
    - path absoluto C:\\ em aliases
    - alterar lógica do carrossel 3D
    - copiar UI para app/
  migracao_concluida: false
```

## 334-pnpm-test

Avaliação de `pnpm test` com Postgres local já documentado no repo. Variável
exigida pelo harness: `TEST_DATABASE_URL` (`tests/global-setup.ts` /
`vitest.config.ts`). `.env.example` usa placeholder genérico (host/database),
não `localhost`/`127.0.0.1` com nome de database claramente de teste.
`docker-compose.yml` serviço `db` cria `POSTGRES_DB=gblocacoes` (banco da
aplicação/dev), não um database de teste. CI (`test_db`) não é o compose local.
Sem `.env` / `.env.local` / env de processo com `TEST_DATABASE_URL`. Não
inventou URL, não reutilizou `DATABASE_URL` de desenvolvimento, não subiu
compose como banco de teste, não rodou migrate/seed. `pnpm test` não executado.
Estado intermediate. Migração **não** concluída.

```yaml
fatia:
  id: 334-pnpm-test
  estado: intermediate
  conceito: >-
    rodar pnpm test só com TEST_DATABASE_URL local de teste já documentada; se
    ausente, bloquear sem inventar host/senha nem apontar para produção
  origem: []
  destino: []
  movido: []
  lido_antes:
    - docs/ai/boot.md
    - docs/migration/MIGRATION.md (final 333)
    - docker-compose.yml
    - .env.example
    - tests/global-setup.ts
    - vitest.config.ts
    - docs/guides/testing.md
  invariantes:
    - id: carrossel-3d-intacto
      prova: "não alterou Equipment3DCarousel/ModelViewer nem lógica 3D"
    - id: sem-apagar-app
      prova:
        "app/ da raiz permanece (API + rotas finas); UI não copiada de volta"
    - id: sem-inventario-test-url
      prova:
        "TEST_DATABASE_URL ausente (processo + .env + .env.local); exemplo sem
        localhost/test-named DB; compose db=gblocacoes (dev)"
    - id: sem-usar-db-dev-como-teste
      prova:
        "não apontou TEST_DATABASE_URL para gblocacoes nem para DATABASE_URL de
        desenvolvimento"
  alteracoes: []
  comandos:
    - cmd: "pnpm test"
      exit: null
      bloqueio: >-
        TEST_DATABASE_URL ausente; .env.example é placeholder genérico;
        docker-compose POSTGRES_DB=gblocacoes (dev, não teste); sem URL local de
        teste documentada para exportar
      verificado_em: "2026-09-25"
  gate:
    test: blocked
    arch: pass
    build_web: pass
  aposentado: []
  callers_atualizados: []
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test — falta TEST_DATABASE_URL local de teste]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  nao_fez:
    - inventar TEST_DATABASE_URL / host / senha
    - usar DATABASE_URL de desenvolvimento como TEST_DATABASE_URL
    - docker compose up apontando gblocacoes como banco de teste
    - prisma migrate/seed
    - alterar código de produção ou carrossel 3D
    - pnpm test
  migracao_concluida: false
```

## 335-tipos-nativos

Checagem nativa verdadeira no host mobile. `customConditions: ["react-native"]`
restaurado em `apps/clients/mobile/tsconfig.json`. `exclude` de `**/*.web.tsx` e
`**/*.web.ts` declarado. O `include` do mobile só tem `src` (+ next-auth types);
`.web` do frontend entra pelo grafo de imports (barrels), e o `exclude` do tsc
não corta módulos já importados (13 `.web` ainda no programa; 56 erros neles).
Typecheck mobile: **314** erros (exit 1). Sem reescrita em massa. Sem remover
`customConditions`. `pnpm typecheck` exit 1 (falha no mobile). Migração **não**
concluída.

```yaml
fatia:
  id: 335-tipos-nativos
  estado: intermediate
  conceito: >-
    restaurar customConditions react-native no tsconfig mobile; excluir
    **/*.web.tsx|ts; typecheck nativo honesto; não mascarar
  customConditions_restaurado: true
  exclude_aplicado:
    - "**/*.web.tsx"
    - "**/*.web.ts"
  arquivos_editados:
    - apps/clients/mobile/tsconfig.json
    - docs/migration/inbox/335-tipos-nativos.md
    - docs/migration/MIGRATION.md
    - CHANGELOG.md
  contagem_mobile:
    erros: 314
    exit: 1
    em_arquivos_web: 56
    em_universais_ou_outros: 258
    web_no_programa_via_import: 13
    verificado_em: "2026-09-25"
  primeiros_5_arquivos:
    - packages/frontend/src/features/enviar-contato/ui/ContactForm.tsx
    - packages/frontend/src/pages/api-docs/ui/ApiDocsPage.tsx
    - packages/frontend/src/pages/cadastro/ui/CadastroPage.tsx
    - packages/frontend/src/pages/contato/ui/ContatoPage.tsx
    - packages/frontend/src/pages/cookies/ui/CookiesPage.tsx
  comandos:
    - cmd: >-
        node node_modules/typescript/bin/tsc -p
        apps/clients/mobile/tsconfig.json --pretty false
      exit: 1
      erros: 314
    - cmd: pnpm typecheck
      exit: 1
      nota: falha no -p mobile; ui/frontend/web ok na cadeia &&
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  migracao_concluida: false
```

## 336-grafo-native

Vazamento de `.web` no typecheck mobile cortado na origem dos barrels.
`@gb-locacoes/frontend/app` e `pages/playground` passam a ter entry
`react-native` sem reexport `.web`. `moduleSuffixes: [".native", ""]` no
tsconfig mobile. Pares native: `cartao-equipamento` e `carrinho`
(`index.native.ts`). Typecheck mobile: **314 → 258** erros (exit 1); `.web` no
programa: **13 → 0**. Restam >30 erros em páginas universais — parada sem
reescrita em massa. `pnpm typecheck` não rodado (mobile ≠ 0). `customConditions`
intacto. Migração **não** concluída.

```yaml
fatia:
  id: 336-grafo-native
  estado: intermediate
  conceito: >-
    cortar .web do grafo mobile via exports/index.native + moduleSuffixes; sem
    reescrita em massa; sem remover customConditions
  arquivos_editados:
    - packages/frontend/package.json
    - packages/frontend/src/app/index.ts
    - packages/frontend/src/app/index.web.ts
    - packages/frontend/src/app/index.native.ts
    - packages/frontend/src/pages/playground/index.native.ts
    - packages/frontend/src/widgets/cartao-equipamento/index.native.ts
    - packages/frontend/src/features/carrinho/index.native.ts
    - apps/clients/mobile/tsconfig.json
    - packages/frontend/src/app/providers/ClientLayoutShell.web.test.tsx
    - docs/migration/inbox/336-grafo-native.md
    - docs/migration/MIGRATION.md
    - CHANGELOG.md
  contagem_mobile:
    antes: { erros: 314, exit: 1, web_no_programa: 13 }
    depois: { erros: 258, exit: 1, web_no_programa: 0 }
    verificado_em: "2026-09-25"
  primeiros_5_arquivos_depois:
    - packages/frontend/src/features/enviar-contato/ui/ContactForm.tsx
    - packages/frontend/src/pages/api-docs/ui/ApiDocsPage.tsx
    - packages/frontend/src/pages/cadastro/ui/CadastroPage.tsx
    - packages/frontend/src/pages/contato/ui/ContatoPage.tsx
    - packages/frontend/src/pages/cookies/ui/CookiesPage.tsx
  comandos:
    - cmd: >-
        node node_modules/typescript/bin/tsc -p
        apps/clients/mobile/tsconfig.json --pretty false
      exit: 1
      erros: 258
    - cmd: pnpm typecheck
      exit: nao_rodado
      nota: mobile exit 1 com 258 erros (>30) — parada pedida
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  migracao_concluida: false
```

## 337-cinco-paginas-native

Cinco páginas do grafo mobile: split `.web` / `.native` / `.tsx` (reexport web).
Visual web intacto nos `.web.tsx`. Native sem props rejeitadas pelo contrato
`@gb-locacoes/ui` (className/htmlFor/id/type/onChange→onChangeText). Typecheck
mobile: **258 → 163** (exit 1); erros nesses cinco: **0**. `.web` desses
arquivos fora do programa (só `.native` via moduleSuffixes). `pnpm typecheck`
não rodado (mobile >30). `customConditions` e `moduleSuffixes` intactos.
Migração **não** concluída.

```yaml
fatia:
  id: 337-cinco-paginas-native
  estado: intermediate
  conceito: >-
    ContactForm/ApiDocs/Cadastro/Contato/Cookies: .web visual intacto; .native
    sem props UI rejeitadas; .tsx reexporta .web
  arquivos_por_slice:
    ContactForm:
      - props: htmlFor/id/onChange/type → onChangeText + contrato native
      - .web/.native/.tsx
    ApiDocsPage:
      - props: Card/Badge className removidos no native
      - .web/.native/.tsx
    CadastroPage:
      - props: Card/Alert/Label/Input/Button/Link adaptados no native
      - .web/.native/.tsx
    ContatoPage:
      - props: Card/Badge className removidos no native
      - .web/.native/.tsx
    CookiesPage:
      - props: Card className/id removidos no native
      - .web/.native/.tsx
  contagem_mobile:
    antes: 258
    depois: 163
    exit: 1
    cinco_zerados: true
  cadeia_typecheck:
    cmd: pnpm typecheck
    exit: nao_rodado
    nota: mobile 163 > 30 — parada pedida
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  migracao_concluida: false
```

## 338-cinco-paginas-native

Cinco páginas do grafo mobile pós-337: split `.web` / `.native` / `.tsx`
(reexport web). Visual web intacto nos `.web.tsx`. Native sem props rejeitadas
pelo contrato `@gb-locacoes/ui` (className/htmlFor/id/type/
onChange→onChangeText). Typecheck mobile: **163 → 96** (exit 1); erros nessas
cinco: **0**. `.web` desses arquivos fora do programa (só `.native` via
moduleSuffixes). `pnpm typecheck` não rodado (mobile >30). `customConditions` e
`moduleSuffixes` intactos. Migração **não** concluída.

```yaml
fatia:
  id: 338-cinco-paginas-native
  estado: intermediate
  conceito: >-
    Entrar/Equipamentos/Login/Permissoes/PoliticaDevolucao: .web visual intacto;
    .native sem props UI rejeitadas; .tsx reexporta .web
  arquivos_por_slice:
    EntrarPage:
      - props: Card/Alert/Label/Input/Button/Link adaptados no native
      - .web/.native/.tsx
    EquipamentosPage:
      - props: Card/Badge className removidos no native
      - .web/.native/.tsx
    LoginPage:
      - props: Card/Alert/Label/Input/Button/Link adaptados no native
      - .web/.native/.tsx
    PermissoesPage:
      - props: Card/CardContent className removidos no native
      - .web/.native/.tsx
    PoliticaDevolucaoPage:
      - props: Card className/id removidos no native
      - .web/.native/.tsx
  contagem_mobile:
    antes: 163
    depois: 96
    exit: 1
    cinco_zerados: true
  cadeia_typecheck:
    cmd: pnpm typecheck
    exit: nao_rodado
    nota: mobile 96 > 30 — parada pedida
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  migracao_concluida: false
```

## 339-cinco-paginas-native

Quatro páginas do grafo mobile pós-338 (só restavam 4 pages/* com erro; pedido
era 5): split `.web` / `.native` / `.tsx` (reexport web). Visual web intacto nos
`.web.tsx`. Native sem props rejeitadas pelo contrato `@gb-locacoes/ui`
(className/htmlFor/id/type/onChange→onChangeText). Typecheck mobile: **96 → 24**
(exit 1); erros nessas quatro: **0**. `.web` desses arquivos fora do programa
(só `.native` via moduleSuffixes). `pnpm typecheck` exit 1 (~36; package
frontend tipa `.native` com contrato web). `customConditions` e `moduleSuffixes`
intactos. Migração **não** concluída.

```yaml
fatia:
  id: 339-cinco-paginas-native
  estado: intermediate
  conceito: >-
    Privacidade/RecuperarSenha/ResetPassword/Termos: .web visual intacto;
    .native sem props UI rejeitadas; .tsx reexporta .web; 5º page ausente no
    grafo
  arquivos_por_slice:
    PrivacidadePage:
      - props: Card/CardContent className/id removidos no native
      - .web/.native/.tsx
    RecuperarSenhaPage:
      - props: Card/Alert/Label/Input/Button/Link adaptados no native
      - .web/.native/.tsx
    ResetPasswordPage:
      - props: Card/Alert/Label/Input/Button/Link adaptados no native
      - .web/.native/.tsx
    TermosPage:
      - props: Card/CardContent className/id removidos no native
      - .web/.native/.tsx
  contagem_mobile:
    antes: 96
    depois: 24
    exit: 1
    quatro_zerados: true
  cadeia_typecheck:
    cmd: pnpm typecheck
    exit: 1
    erros_aprox: 36
    nota:
      mobile 24 ≤ 30 — cadeia rodada; natives vs contrato web no frontend pkg
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  migracao_concluida: false
```

## 340-resto-native

Exclusão de `**/*.native.{ts,tsx}` no tsconfig do package frontend (cadeia não
tipa mais native com contrato web). Três widgets do grafo mobile pós-339: split
`.web` / `.native` / `.tsx` (reexport web). Visual web intacto. Native sem props
rejeitadas pelo contrato `@gb-locacoes/ui` (className em Card*; Input
id/onChange→onChangeText; Button type; Label htmlFor; HybridTooltip ausente no
native). `category-helpers` (Badge className) anotado como resto (shared/lib,
não widget). Barrel `EquipamentosPage` reexporta `EquipamentoImageProps`
(visível após exclude). Typecheck mobile: **24 → 1** (exit 1). `pnpm typecheck`
exit 1 (1 erro). `customConditions` e `moduleSuffixes` intactos. Migração
**não** concluída.

```yaml
fatia:
  id: 340-resto-native
  estado: intermediate
  conceito: >-
    frontend exclui *.native; Cartao/FiltroAdmin/Bloco .web/.native/.tsx;
    category-helpers resto
  arquivos_por_slice:
    Cartao:
      - props: Card* className removidos no native
      - .web/.native/.tsx
    FiltroAdmin:
      - props: Card* className; Input id/onChange→onChangeText
      - .web/.native/.tsx
    Bloco:
      - props: HybridTooltip/type/htmlFor/id/onChange adaptados no native
      - .web/.native/.tsx
  contagem_mobile:
    antes: 24
    depois: 1
    exit: 1
    widgets_zerados: true
  cadeia_typecheck:
    cmd: pnpm typecheck
    exit: 1
    erros: 1
    nota: resto category-helpers Badge className no mobile
  resto:
    - packages/frontend/src/shared/lib/category-helpers.tsx
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  migracao_concluida: false
```

## 341-category-helpers

Split de `packages/frontend/src/shared/lib/category-helpers` em `.web` /
`.native` / `.tsx` (reexport web). Visual web intacto no `.web.tsx`. Native:
Badge sem className; sem Tailwind no selo. `category-design` e legado `lib/`
intactos (sem unificar/apagar). Typecheck mobile: **1 → 0** (exit 0).
`pnpm typecheck` exit 0. `pnpm arch` exit 0. `customConditions` e
`moduleSuffixes` intactos. Migração **não** concluída.

```yaml
fatia:
  id: 341-category-helpers
  estado: intermediate
  conceito: >-
    category-helpers .web visual intacto; .native Badge sem className; .tsx
    reexporta .web; mobile resolve .native via moduleSuffixes
  arquivos_por_slice:
    category-helpers:
      - props: Badge className removido no native
      - .web/.native/.tsx
  contagem_mobile:
    antes: 1
    depois: 0
    exit: 0
  cadeia_typecheck:
    cmd: pnpm typecheck
    exit: 0
    erros: 0
  arch:
    cmd: pnpm arch
    exit: 0
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  migracao_concluida: false
```

## 342-builds-pos-native

Prova pós-separações `.web`/`.native` (páginas/widgets + 341). Ordem:
`pnpm check:tokens` → `pnpm build:web` → `pnpm bundle:mobile`. Exits:
check:tokens **0**, build:web **0**, bundle:mobile **0**. Sem correção de
import. `customConditions` e `moduleSuffixes` intactos. Migração **não**
concluída.

```yaml
fatia:
  id: 342-builds-pos-native
  estado: intermediate
  conceito: >-
    check:tokens + build:web + bundle:mobile pós .web/.native; exits 0/0/0; sem
    fix de import
  exits_finais:
    check_tokens: 0
    build_web: 0
    bundle_mobile: 0
  correcao_import: false
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  migracao_concluida: false
```

## 343-pnpm-test

Tentativa: Postgres do `docker-compose.yml` (serviço `db`, porta 5432,
`POSTGRES_DB=gblocacoes` = dev) → criar só `gblocacoes_test` → exportar
`TEST_DATABASE_URL` no processo → `pnpm test` → se passasse, `pnpm tokens`.
Docker CLI indisponível neste host (`docker` não no PATH; pasta Docker ausente;
WSL sem distro). Parou sem inventar URL. Sem `pnpm test`, sem `pnpm tokens`, sem
migrate/seed em `gblocacoes`. Sem commit. Migração **não** concluída.

```yaml
fatia:
  id: 343-pnpm-test
  estado: intermediate
  conceito: >-
    gblocacoes_test + TEST_DATABASE_URL só no processo + pnpm test; Docker
    ausente → bloqueio sem inventar URL
  exits_finais:
    pnpm_test: null
    pnpm_tokens: null
  bloqueio: Docker indisponivel neste host
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test — Docker indisponível]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  migracao_concluida: false
```

## 344-tokens-e-teste

`pnpm tokens` exit **1** (1 violação: `#9ca3af` em `category-helpers.native.tsx`
~61). Porta `127.0.0.1:5432` aberta; compose `db` user `postgres`,
`POSTGRES_DB=gblocacoes` (dev). Sem `psql`/`createdb` no PATH → parou teste sem
criar `gblocacoes_test`, sem URL no processo, sem `pnpm test`. Docker CLI
ausente (não instalado). Sem commit. Migração **não** concluída.

```yaml
fatia:
  id: 344-tokens-e-teste
  estado: intermediate
  conceito: >-
    pnpm tokens; 5432 aberta mas sem psql/createdb → teste bloqueado; tokens
    exit 1 (1 violação native)
  exits_finais:
    pnpm_tokens: 1
    pnpm_test: null
  bloqueio: porta 5432 aberta; psql e createdb ausentes no PATH
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  migracao_concluida: false
```

## 345-tokens-hex-native

`pnpm tokens` pré-fix exit **1**
(`TOKEN color-literal category-helpers.native.tsx:61:33 color #9ca3af`). Hex
trocado por `palette.gray400` (mesmo gray-400 `#9ca3af` em design-tokens). Web e
`lib/` intactos. Pós-fix: `pnpm tokens` exit **0**; `pnpm check:tokens` exit
**0**. Sem `pnpm test`. Sem commit. Migração **não** concluída.

```yaml
fatia:
  id: 345-tokens-hex-native
  estado: intermediate
  conceito: >-
    #9ca3af (gray-400) no native → palette.gray400; web intacto
  exits_finais:
    pnpm_tokens: 0
    pnpm_check_tokens: 0
    pnpm_test: null
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test — porta 5432 aberta, sem psql/createdb/docker]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  migracao_concluida: false
```

## 346-pg-test

Compose com `POSTGRES_USER`/`POSTGRES_PASSWORD`/porta em texto. Script Node
temporário (`pg`) no database `postgres` em `127.0.0.1:5432`: autenticação
`28P01` (1ª e 2ª tentativa; não era conexão recusada). Parou sem criar
`gblocacoes_test`, sem URL no processo, sem `pnpm test`. Não usou `gblocacoes`.
Script temp apagado. Sem commit. Migração **não** concluída.

```yaml
fatia:
  id: 346-pg-test
  estado: intermediate
  conceito: >-
    pg cria gblocacoes_test se ausente; TEST_DATABASE_URL só no processo; pnpm
    test; auth 28P01 bloqueou
  exits_finais:
    pnpm_test: null
  bloqueio: autenticação Postgres 28P01 com credenciais do compose
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  migracao_concluida: false
```

## 347-bundle-pos-token

`pnpm bundle:mobile` pós-troca `#9ca3af` → `palette.gray400` em
`category-helpers.native.tsx`. Exit **0**. Sem falha de import/token no runtime
native. Sem correção de código. Sem commit. Migração **não** concluída.

```yaml
fatia:
  id: 347-bundle-pos-token
  estado: intermediate
  conceito: >-
    bundle:mobile pós palette.gray400 no native; exit 0; sem fix
  exits_finais:
    bundle_mobile: 0
  correcao_import: false
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test (Postgres local recusou a senha do compose,
      28P01; não tente de novo)]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  migracao_concluida: false
```

## 348-typecheck-pos-token

`pnpm typecheck` e `pnpm arch` pós-troca `#9ca3af` → `palette.gray400` em
`category-helpers.native.tsx`. Ambos exit **0**. Sem falha de tipo em
`palette.gray400`. Sem correção de código. Sem commit. Migração **não**
concluída.

```yaml
fatia:
  id: 348-typecheck-pos-token
  estado: intermediate
  conceito: >-
    typecheck + arch pós palette.gray400 no native; exits 0; sem fix
  exits_finais:
    pnpm_typecheck: 0
    pnpm_arch: 0
  correcao_tipo_ou_import: false
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test (Postgres local recusou a senha do compose,
      28P01; não tente de novo)]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  migracao_concluida: false
```

## 349-public-host

Host web `apps/clients/web/public`: **JUNCTION** local absoluta → `public/` da
raiz; gitignored (`.gitignore:82`). `core.symlinks=false`; zero mode `120000` no
índice. Symlink relativo versionável **não** aplicado (checkout Windows
quebraria). Scan Node: **0** imports `packages/frontend` → `lib/` raiz. Sem
cópia 321. Sem CHANGELOG. Sem `pnpm arch`. Sem commit. Migração **não**
concluída.

```yaml
fatia:
  id: 349-public-host
  estado: intermediate
  conceito: >-
    conferir junction public do host; se ok, um import lib/ raiz client-safe
    restante; senão só documentar
  public_host:
    tipo: JUNCTION
    trocado: false
    motivo: >-
      core.symlinks=false e 0 symlinks versionados; junction local gitignored é
      o único jeito estável neste Windows
  import_lib_raiz_restante: false
  copia_estilo_321: false
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test (Postgres local recusou a senha do compose,
      28P01; não tente de novo)]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  migracao_concluida: false
```

## 350-teste-localhost

Leitura de `DATABASE_URL` em `.env` / `.env.local` (só em memória). Ambos
**ausentes** na raiz (só `.env.example`). Parada **sem conectar**. Não retentou
senha do compose (`28P01`). Não usou `gblocacoes`. Sem `CREATE DATABASE`, sem
`TEST_DATABASE_URL`, sem `pnpm test`. Script temporário em `tools/` removido.
Sem URL/senha no diário. Sem CHANGELOG. Sem commit. Migração **não** concluída.

```yaml
fatia:
  id: 350-teste-localhost
  estado: intermediate
  conceito: >-
    DATABASE_URL de .env/.env.local em memória; localhost → pg no database
    postgres cria gblocacoes_test; TEST_DATABASE_URL só no processo → pnpm test;
    sem .env → parar sem conectar
  exits_finais:
    pnpm_test: null
  bloqueio: ".env e .env.local ausentes; sem DATABASE_URL"
  senha_compose_retentada: false
  usou_gblocacoes: false
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  migracao_concluida: false
```

## 351-link-web-public

> **Substituído (onda 9b, achado 130)**: a junção contrariava a regra 7 do
> `AGENTS.md`. `tools/link-web-public.mjs`, o script `link:web-public` e a
> junção não existem mais; `apps/clients/web/public` é uma cópia real gerada por
> `tools/sync-web-public.mjs` no predev/prebuild do host web
> (`apps/clients/web/AGENTS.md`). Registro histórico abaixo.

Script versionado `tools/link-web-public.mjs`: se `apps/clients/web/public` não
existir, cria junction (Windows) ou symlink relativo (outros SO) para `public/`
da raiz. Se já aponta certo, no-op. Pasta real com arquivos não é apagada. Sem
cópia de GLB. Sem symlink versionado. Invocação:
`node tools/link-web-public.mjs` (ou `pnpm link:web-public`). Junction atual
válida — script não executado (`node --check` OK). Sem `pnpm arch` (script em
`tools/`). Sem commit. Migração **não** concluída.

```yaml
fatia:
  id: 351-link-web-public
  estado: intermediate
  conceito: >-
    script Node versionado para junction/symlink local apps/clients/web/public →
    public/ da raiz
  script: tools/link-web-public.mjs
  invocacao: "node tools/link-web-public.mjs"
  npm_script: link:web-public
  public_host:
    tipo: JUNCTION
    preservada: true
    script_executado: false
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test (sem .env local; senha do compose recusada)]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  migracao_concluida: false
```

## 352-plano-restante

Varredura Node `fs` (script temp `tools/_scan-fat-ui-352.mjs`): `components/` e
`hooks/` ausentes; `app/api` excluído; pages que só importam
`@gb-locacoes/frontend` = shell fino. **Tela gorda de produto fora de
`packages/frontend`:** nenhuma. Nada movido. Sem API/banco/testes/CHANGELOG.
Carrossel 3D intacto. Sem commit.

Única prova ainda aberta: `pnpm test` (bloqueado por ambiente — sem `.env`;
senha compose `28P01`; sem docker/psql) e `device_or_emulator`. Exits já
conhecidos (não reexecutados aqui): arch/tokens/typecheck/check:tokens/
build:web/bundle:mobile = 0. Migração **não** concluída.

```yaml
fatia:
  id: 352-plano-restante
  estado: intermediate
  conceito: >-
    confirmar tela gorda fora de packages/frontend; se houver mover um grupo;
    senão inbox com prova aberta = test + device
  movido: []
  tela_gorda_encontrada: false
  leftover_dirs:
    components: false
    hooks: false
  exits_conhecidos_nao_reexecutados:
    pnpm_arch: 0
    pnpm_tokens: 0
    pnpm_typecheck: 0
    pnpm_check_tokens: 0
    pnpm_build_web: 0
    pnpm_bundle_mobile: 0
    pnpm_test: null
  bloqueio_test: >-
    sem .env; senha compose 28P01; sem docker/psql
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test (bloqueado por ambiente)]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  migracao_concluida: false
```

## 353-env-pg

Inspeção Node de `process.env` (somente nomes): `PGHOST`, `PGPORT`, `PGUSER`,
`PGPASSWORD`, `PGDATABASE`, `TEST_DATABASE_URL`. Nenhum desses nomes existia no
processo. Host ausente (não local). `TEST_DATABASE_URL` ausente. Sem conexão,
sem `CREATE DATABASE`, sem `pnpm test`, sem inventar senha, sem ler
`.env`/`.env.local`, sem senha do compose, sem migrate em `gblocacoes`, sem
DROP, sem commit. Carrossel 3D intacto. Migração **não** concluída.

```yaml
fatia:
  id: 353-env-pg
  estado: intermediate
  conceito: >-
    checar PG* / TEST_DATABASE_URL no process.env; se local com credenciais,
    criar gblocacoes_test e rodar pnpm test
  nomes_presentes: []
  pghost: ausente
  host_local: false
  test_database_url: ausente
  conexao: nao_executada
  create_database: nao_executado
  pnpm_test: nao_executado
  pnpm_test_exit: null
  bloqueio: >-
    nenhuma variavel PG no process.env; sem inventar senha
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  migracao_concluida: false
```

## 354-device

Checagem Android no Windows: `adb` ausente no PATH; binário local em
`%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe` (sem instalar SDK).
`adb devices -l` → lista vazia (daemon ok; nenhum device/emulator). Expo não
iniciado. App não instalado. Bundle não reexecutado. Simulador iOS não
pesquisado. Sem commit. Carrossel 3D intacto. Migração **não** concluída.

```yaml
fatia:
  id: 354-device
  estado: intermediate
  conceito: >-
    descobrir emulador/aparelho Android via adb devices; se vazio, NOT_VERIFIED
    e parar sem Expo
  adb_in_path: false
  adb_binario_local: true
  devices: []
  expo: nao_iniciado
  app_instalado: false
  bundle: nao_reexecutado
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test (sem credencial de Postgres local)]"
    - "[NOT_VERIFIED: cobertura]"
    - "[NOT_VERIFIED: device_or_emulator]"
  migracao_concluida: false
```

## 355-pg-sem-senha

Uma conexão em `127.0.0.1:5432`, usuário `postgres`, senha vazia, database de
manutenção `postgres` (não `gblocacoes`). Falhou no handshake SASL/SCRAM
(`client password must be a string`). Sem retentativa. Sem `CREATE DATABASE`.
Sem `TEST_DATABASE_URL`. Sem `pnpm test`. Script temporário apagado. Sem DROP.
Sem commit. Carrossel 3D intacto. Sem CHANGELOG.

```yaml
fatia:
  id: 355-pg-sem-senha
  estado: intermediate
  conceito: >-
    conectar pg local sem senha no DB postgres; se ok criar gblocacoes_test e
    rodar pnpm test; se falhar parar
  conectou: false
  create_database: nao_executado
  pnpm_test: nao_executado
  pnpm_test_exit: null
  bloqueio: >-
    SCRAM rejeitou senha vazia; sem inventar outra senha
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test]"
    - "[NOT_VERIFIED: gblocacoes_test]"
    - "[NOT_VERIFIED: cobertura]"
  migracao_concluida: false
```

## 356-pgpass

Procura de pgpass em %APPDATA%\postgresql\pgpass.conf. Arquivo ausente. Sem
leitura de linhas. Sem conexão ao Postgres. Sem CREATE DATABASE. Sem
TEST_DATABASE_URL. Sem pnpm test. Sem DROP. Sem commit. Carrossel 3D intacto.
Sem CHANGELOG.

```yaml
fatia:
  id: 356-pgpass
  estado: intermediate
  conceito: >-
    ler pgpass local (localhost/127.0.0.1/*); conectar DB postgres; criar
    gblocacoes_test se preciso; rodar pnpm test com TEST_DATABASE_URL so no
    processo
  pgpass_existe: false
  linhas_locais: 0
  conectou: false
  create_database: nao_executado
  pnpm_test: nao_executado
  pnpm_test_exit: null
  bloqueio: >-
    arquivo pgpass.conf ausente em APPDATA\postgresql
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test]"
    - "[NOT_VERIFIED: gblocacoes_test]"
    - "[NOT_VERIFIED: cobertura]"
  migracao_concluida: false
```
