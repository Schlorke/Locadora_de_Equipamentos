# 292-rotas-restantes

Corpo de `/playground`, `/grid-motion` e `/equipamentos-scroll` foi para slices
`pages/playground`, `pages/grid-motion` e `pages/equipamentos-scroll`. Rotas
viraram shells finos. Playground e equipamentos-scroll em `.web` (widgets web).
Grid-motion universal (sem `next/*`). Sem Prisma no frontend. Carrossel 3D
intocado. Estado intermediate.

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
    - id: nao-tocou-home-shells
      prova:
        "app/page.tsx, app/ClientLayout.tsx, app/admin/teste-toast, app/api-docs
        intocados nesta fatia"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/playground
        packages/frontend/src/pages/grid-motion
        packages/frontend/src/pages/equipamentos-scroll"
      exit: 0
      verificado_em: "2026-09-25 16:16"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:16"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:16"
  gate:
    arch: pass
    tokens: pass
    vitest_platform: pass
    violacoes_conhecidas:
      - "app/playground/icon-customization/page.tsx ainda mistura shell com
        corpo longo"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado: []
  callers_atualizados:
    - app/playground/page.tsx
    - app/grid-motion/page.tsx
    - app/equipamentos-scroll/page.tsx
  nao_verificado:
    - "[NOT_VERIFIED: /playground no browser]"
    - "[NOT_VERIFIED: /grid-motion no browser]"
    - "[NOT_VERIFIED: /equipamentos-scroll no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```
