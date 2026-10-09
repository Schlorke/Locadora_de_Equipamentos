# 287-client-layout

**Estado: concluído.** Composição de chrome (Header, Footer, WhatsAppFAB,
Toaster, theme-color, supressão Three.js/Zustand) saiu de `app/ClientLayout.tsx`
para `packages/frontend/src/app/providers/ClientLayoutShell.web.tsx`. O host
permanece shell fino: `scroll-reveal-init` (lazy) + `ServiceWorkerRegister`.
Carrossel 3D / model-viewer / lazy-3d / scroll-reveal / `maxDuration={0}` /
`disableAutoFit` **não** foram tocados. Sem Prisma no frontend.

## Host (`app/ClientLayout.tsx`)

- `dynamic(() => import('@/components/scroll-reveal-init'), { ssr: false })`
- `ServiceWorkerRegister`
- Render:
  `<ClientLayoutShell publicExtras={…} hostExtras={…}>{children}</ClientLayoutShell>`

## Pacote (`app/providers`)

- `ClientLayoutShell.web.tsx` — chrome público + admin theme sync + console
  patch
- Export público via `@gb-locacoes/frontend/app`
- `Header` passou a ser exportado por `widgets/cabecalho/index.ts` (API pública
  FSD)

```yaml
fatia:
  id: 287-client-layout
  estado: concluido
  conceito: shell ClientLayout com composição em app/providers
  origem:
    - app/ClientLayout.tsx
  destino:
    - packages/frontend/src/app/providers/ClientLayoutShell.web.tsx
    - packages/frontend/src/app/providers/ClientLayoutShell.web.test.tsx
    - packages/frontend/src/app/index.ts
    - packages/frontend/src/widgets/cabecalho/index.ts
  invariantes:
    - id: scroll-reveal-no-host
      prova:
        "app/ClientLayout.tsx importa @/components/scroll-reveal-init; shell
        recebe via publicExtras"
    - id: carrossel-3d-intacto
      prova:
        "não alterou equipment-3d-carousel, model-viewer, lazy-3d-carousel,
        scroll-reveal-init, maxDuration 0, disableAutoFit"
    - id: prisma-fora
      prova: "ClientLayoutShell sem prisma; host sem prisma"
    - id: chrome-no-pacote
      prova:
        "shell compõe Header/Footer/WhatsAppFAB/Toaster; host sem esses imports"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/app/providers/ClientLayoutShell.web.test.tsx"
      exit: 0
      verificado_em: "2026-09-25 16:08"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:08"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:08"
  gate:
    arch: pass
    tokens: pass
    vitest_platform: pass
    violacoes_conhecidas: []
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: ClientLayout no browser]"
    - "[NOT_VERIFIED: sincronização scrollRevealReady + carrossel 3D em runtime]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
```
