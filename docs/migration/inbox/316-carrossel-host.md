# 316-carrossel-host

Revisão do carrossel 3D (arquivos exclusivos desta fatia) e das rotas do host
web que ainda pudessem não ser adaptadores finos. **Nenhum arquivo de código foi
editado**: otimizações permitidas (preload, lazy, memo, frameloop dinâmico, rAF)
já estão no lugar; qualquer mudança adicional arriscaria o comportamento
observável (zoom do primeiro modelo / `scrollRevealReady`). Rotas de produto com
Prisma/3D (`/`, `/sobre`, `/equipamentos/[id]`) já eram adaptadores finos (fatia
313). Demais `page.tsx` do host já são reexports finos. `CHANGELOG.md` e
`MIGRATION.md` intocados (sem mudança de código). Estado **blocked** nesta fatia
(nada seguro a mover/otimizar sem risco). Migração **não** concluída.

```yaml
fatia:
  id: 316-carrossel-host
  estado: blocked
  conceito: >-
    revisar carrossel 3D (otimização segura sem mudar comportamento) e page.tsx
    do host que ainda não fossem adaptadores finos; nada seguro a editar
  origem:
    - components/equipment-3d-carousel.tsx
    - components/ui/model-viewer.tsx
    - components/ui/lazy-3d-carousel.tsx
    - components/scroll-reveal-init.tsx
    - apps/clients/web/src/app/**/page.tsx
  destino: []
  movido: []
  criado: []
  carrossel_revisao:
    lido_antes:
      - docs/features/equipment-3d-carousel.md
    arquivos_intocados:
      - path: components/equipment-3d-carousel.tsx
        ja_tem:
          memo, useMemo, hasPassedFirstModel = currentIndex > 0,
          delayBoundsFit={!hasPassedFirstModel}, isRevealComplete
        porque_nao_editar: >-
          otimização segura já presente; alterar timing/estrutura muda
          comportamento observável
      - path: components/ui/model-viewer.tsx
        ja_tem: >-
          useGLTF.preload, frameloop always|demand, shadows=false,
          disableAutoFit={delayBoundsFit}, boundsMaxDuration = disableAutoFit ?
          0 : 1, ModelWrapper aguarda scrollReveal
        porque_nao_editar: >-
          maxDuration={0}/disableAutoFit/scrollRevealReady são invariantes; sem
          ganho seguro sem risco de zoom no 1º modelo
      - path: components/ui/lazy-3d-carousel.tsx
        ja_tem: dynamic(ssr:false) + IntersectionObserver (rootMargin 200px)
        porque_nao_editar: lazy agressivo já reduz bundle inicial ~430KB
      - path: components/scroll-reveal-init.tsx
        ja_tem: >-
          dispatchEvent('scrollRevealReady') (2700ms 1ª visita / 200ms interna),
          rAF batching, requestIdleCallback
        porque_nao_editar: >-
          timing do evento é contrato com o carrossel; não mexer
    invariantes_preservados_por_nao_editar:
      - maxDuration={0} no primeiro modelo (via disableAutoFit)
      - disableAutoFit={delayBoundsFit}
      - evento scrollRevealReady
      - hasPassedFirstModel = currentIndex > 0
      - primeiro modelo sem zoom visível
  rotas_host_revisao:
    ja_finos_produto_prisma_3d:
      - url: /
        prova: >-
          apps/clients/web/src/app/page.tsx — Prisma setting + props HomePage
          (fatia 313)
      - url: /sobre
        prova: >-
          apps/clients/web/src/app/sobre/page.tsx — slot Equipment3DCarousel
          relativo + GoogleMerchantBadge (fatia 313)
      - url: /equipamentos/[id]
        prova: >-
          apps/clients/web/src/app/equipamentos/[id]/page.tsx — Prisma +
          generateMetadata + EquipamentoDetalhePage (fatia 313)
    demais_page_tsx:
      resultado: ja_finos
      nota: >-
        maioria ~4 linhas reexport @gb-locacoes/frontend/pages/*; /equipamentos
        injeta Image/Link (adaptador fino, não UI)
    nao_fez_rotas:
      - nao recriar catch-all
      - nao duplicar rota ja fina
      - nao mudar URL, texto, preco
      - app/ da raiz intocado (ajuste so seria de rota fina; ja paridade)
  invariantes:
    - id: sem-mover-3d
      prova: >-
        equipment-3d-carousel, model-viewer, lazy-3d-carousel e
        scroll-reveal-init não editados nem movidos
    - id: sem-apagar-app
      prova: app/ da raiz não tocado
    - id: sem-prisma-migrate
      prova: sem prisma migrate/push/seed; sem pnpm install
    - id: sem-catch-all
      prova: nenhum [[...rota]] criado
    - id: sem-changelog-sem-codigo
      prova: CHANGELOG.md e MIGRATION.md intocados (sem mudança de código)
  comandos:
    - cmd: node tools/arch-check.mjs
      exit: nao_executado
      nota: só se editar packages/ ou apps/ — nenhum editado
    - cmd: node tools/token-check.mjs
      exit: nao_executado
      nota: só se editar packages/ ou apps/ — nenhum editado
  gate:
    arch: skipped_sem_edicao
    tokens: skipped_sem_edicao
    vitest_platform: skipped_sem_edicao
    violacoes_conhecidas:
      - "app/ da raiz continua dono paralelo das mesmas URLs"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
      - "service-worker-register continua em components/"
  aposentado: []
  callers_atualizados: []
  nao_fez:
    - editar os 4 arquivos do carrossel/scroll-reveal
    - ajustar page.tsx do host (já finos)
    - editar docs/migration/MIGRATION.md
    - editar CHANGELOG.md
    - arch-check / token-check
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
    - "[NOT_VERIFIED: pnpm build]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: browser no carrossel / home / sobre]"
    - "[NOT_VERIFIED: device_or_emulator]"
```
