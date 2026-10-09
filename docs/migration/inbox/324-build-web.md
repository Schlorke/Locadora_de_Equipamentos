# 324-build-web

Correções das falhas de prova 323 (Suspense `/equipamentos`, `brand600`,
`rn-get-polyfills`). Sem commit, sem `pnpm install`, sem Prisma migrate/seed.
Sem inventar `TEST_DATABASE_URL`. Sem Suspense global no layout do host.
`SessionProviderWrapper` mantido. Carrossel 3D e `customConditions` intactos.
Migração **não** concluída.

```yaml
fatia:
  id: 324
  estado: intermediate
  conceito: >-
    corrigir build:web Suspense /equipamentos; check:tokens orange600;
    bundle:mobile rn-get-polyfills via metro; não declarar migração concluída
  arquivos_editados:
    - apps/clients/web/src/app/equipamentos/page.tsx
      (Suspense local em volta de useSearchParams; URL/filtros/textos)
    - apps/clients/web/src/app/page.tsx
      (não importa prisma se DATABASE_URL ausente — desbloqueou
      prerender de / após Suspense; sem inventar URL nem subir banco)
    - tools/token-propagation-check.mjs
      (regex brand600 → orange600; valor #ea580c inalterado)
    - apps/clients/mobile/metro.config.js
      (getPolyfills: arquivo rn-get-polyfills.js do RN 0.86 no store
      pnpm quando o link resolve 0.87 sem o arquivo; sem pacote novo)
    - docs/migration/inbox/324-build-web.md
    - docs/migration/MIGRATION.md
    - CHANGELOG.md
  nao_editado:
    - apps/clients/web/src/app/layout.tsx (SessionProviderWrapper permanece)
    - components/equipment-3d-carousel.tsx
    - tools/token-check.mjs
    - apps/clients/mobile/tsconfig.json (customConditions permanece ausente)
    - app/ (raiz legado)
  comandos:
    - cmd: pnpm build:web
      exit: 0
      nota: >-
        1ª tentativa exit 1 em / por DATABASE_URL ausente (lib/prisma throw
        no import). Após guard na page host, exit 0; /equipamentos ○ static.
      verificado_em: "2026-09-25 17:55"
    - cmd: pnpm check:tokens
      exit: 1
      nota: >-
        brand600 resolvido (previous=#ea580c via orange600). Falha restante:
        styleResolution false (vitest filter não acha Button.*.test.tsx —
        include só tests/** e lib/**); webRender.ok false (0 botões inline
        em index.html/catalog.html). mobileExport android+ios true.
      verificado_em: "2026-09-25 17:58"
    - cmd: pnpm bundle:mobile
      exit: 0
      nota: >-
        expo export android+ios ok após override getPolyfills. Ainda resolve
        react-native@0.87.1 no junction (package.json declara 0.86.3).
        [NOT_VERIFIED: device_or_emulator]
      verificado_em: "2026-09-25 18:00"
  exits_finais:
    build_web: 0
    check_tokens: 1
    bundle_mobile: 0
  bloqueio_restante:
    - check:tokens propagation incompleto (vitest path + webRender HTML)
    - junction mobile → RN 0.87.1 vs package.json 0.86.3 (sem pnpm install)
    - TEST_DATABASE_URL ausente bloqueia vitest raiz
    - customConditions ausente: typecheck mobile ≠ proof native export
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test]"
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
    - "[NOT_VERIFIED: check:tokens styleResolution + webRender]"
  legado_raiz_mantido: true
  carrossel_3d_legado: true
  migracao_concluida: false
```
