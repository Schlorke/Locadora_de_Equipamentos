# 325-check-tokens

Alinha `pnpm check:tokens` ao Button web real (Tailwind/`bg-slate-700`) e ao
include do vitest de plataforma. Sem commit, sem `pnpm install`, sem Prisma
migrate/seed. Sem inventar `TEST_DATABASE_URL`. Sem botão novo na UI. Sem mexer
em carrossel 3D, Suspense global, SessionProviderWrapper ou guard de
DATABASE_URL. Migração **não** concluída.

```yaml
fatia:
  id: 325
  estado: intermediate
  conceito: >-
    check:tokens styleResolution via vitest.platform; webRender por class
    Tailwind do Button existente; não declarar migração concluída
  arquivos_editados:
    - tools/token-propagation-check.mjs (vitest --config
      vitest.platform.config.ts; webRender conta <button class="… bg-slate-700
      …"> em index/catalog; sem inline style)
    - docs/migration/inbox/325-check-tokens.md
    - docs/migration/MIGRATION.md
    - CHANGELOG.md
  nao_editado:
    - packages/ui/src/web/Button.web.tsx
    - packages/ui/src/native/Button.native.tsx
    - apps/clients/web/src/app/**
    - components/equipment-3d-carousel.tsx
    - app/ (raiz legado)
  comandos:
    - cmd: pnpm check:tokens
      exit: 0
      nota: >-
        styleResolution true; webRender buttons=9 primaryButtons=4 ok;
        mobileExport android+ios true; previous=#ea580c sentinel=#12A457
      verificado_em: "2026-09-25 18:05"
    - cmd: node tools/arch-check.mjs
      exit: 1
      nota: >-
        2× RUNTIME-NODE em apps/clients/mobile/metro.config.js (node:fs /
        node:path) — residual da fatia 324 getPolyfills
      verificado_em: "2026-09-25 18:06"
    - cmd: node tools/token-check.mjs
      exit: 0
      verificado_em: "2026-09-25 18:06"
  exits_finais:
    check_tokens: 0
    arch: 1
    token_check: 0
  bloqueio_restante:
    - arch RUNTIME-NODE metro.config.js (324 getPolyfills)
    - junction mobile → RN 0.87.1 vs package.json 0.86.3
    - TEST_DATABASE_URL ausente bloqueia vitest raiz
    - customConditions ausente: typecheck mobile ≠ proof native export
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test]"
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  legado_raiz_mantido: true
  carrossel_3d_legado: true
  migracao_concluida: false
```
