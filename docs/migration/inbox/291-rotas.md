# 291-rotas

Corpo de `/admin/teste-toast` e `/api-docs` foi para slices `pages/teste-toast`
e `pages/api-docs`. Rotas viraram shells finos. Sem `next/*` (universal `.tsx`).
Fetch de OpenAPI permanece no cliente via `fetch('/openapi.json')` (sem Prisma).
Carrossel 3D intocado. Estado intermediate.

```yaml
fatia:
  id: 291-rotas
  estado: intermediate
  conceito: duas page.tsx gordas → shells + slices pages
  origem:
    - app/admin/teste-toast/page.tsx
    - app/api-docs/page.tsx
  destino:
    - packages/frontend/src/pages/teste-toast/ui/TesteToastPage.tsx
    - packages/frontend/src/pages/teste-toast/ui/TesteToastPage.test.tsx
    - packages/frontend/src/pages/teste-toast/index.ts
    - packages/frontend/src/pages/api-docs/ui/ApiDocsPage.tsx
    - packages/frontend/src/pages/api-docs/ui/ApiDocsPage.test.tsx
    - packages/frontend/src/pages/api-docs/index.ts
    - app/admin/teste-toast/page.tsx
    - app/api-docs/page.tsx
  invariantes:
    - id: urls-preservadas
      prova: "URLs /admin/teste-toast e /api-docs inalteradas"
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
        packages/frontend/src/pages/teste-toast
        packages/frontend/src/pages/api-docs"
      exit: 0
      verificado_em: "2026-09-25 16:13"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:13"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:13"
  gate:
    arch: pass
    tokens: pass
    vitest_platform: pass
    violacoes_conhecidas:
      - "app/playground/page.tsx, app/grid-motion/page.tsx e
        app/equipamentos-scroll/page.tsx ainda têm corpo (fora do máximo de 2)"
      - "app/playground/icon-customization/page.tsx ainda mistura shell com
        corpo longo"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado: []
  callers_atualizados:
    - app/admin/teste-toast/page.tsx
    - app/api-docs/page.tsx
  nao_verificado:
    - "[NOT_VERIFIED: /admin/teste-toast no browser]"
    - "[NOT_VERIFIED: /api-docs no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```
