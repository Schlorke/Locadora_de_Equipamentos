# 313-adaptadores-host

Três URLs de produto que ainda não eram adaptadores finos no host
`apps/clients/web` passaram a espelhar o shell da raiz: `/` (Prisma + props para
`HomePage`), `/sobre` (slot do carrossel 3D legado + badge) e
`/equipamentos/[id]` (Prisma + `generateMetadata` + props para
`EquipamentoDetalhePage`). Helpers de host (`getLocalBusinessData`, SEO,
`StructuredData`, `GoogleMerchantBadge`) foram só reexportados nos
`pages/*/index.ts` — sem mudar UI do pacote. Carrossel 3D continua em
`components/`; import relativo só no arquivo de rota do host. Sem espelho
mobile. `app/` da raiz intocado. Estado **intermediate**.

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
    - editar docs/migration/MIGRATION.md ou CHANGELOG.md
    - typecheck / build / browser / device
  bloqueio_restante:
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
    - "[NOT_VERIFIED: browser nas 3 URLs]"
    - "[NOT_VERIFIED: device_or_emulator]"
```
