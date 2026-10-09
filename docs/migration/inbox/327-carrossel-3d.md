# 327-carrossel-3d

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
