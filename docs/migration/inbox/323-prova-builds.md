# 323-prova-builds

Prova de builds/testes após typecheck 0 (fatia 322). Sem commit, sem
`pnpm install`, sem Prisma. Sem apagar `app/` da raiz. Sem editar carrossel 3D
nem `tools/token-check.mjs`. Não declarar migração concluída.

```yaml
fatia:
  id: 323
  estado: intermediate
  conceito: >-
    prova test + build:web + bundle:mobile + check:tokens; anotar limitação
    customConditions; não declarar migração concluída
  limitacao_customConditions: >-
    Fatia 322 removeu customConditions:["react-native"] do tsconfig mobile para
    zerar typecheck. Isso NÃO foi revertido. Limitação: o tsc do mobile pode
    resolver o export web de @gb-locacoes/ui em vez do native; typecheck 0 não
    prova resolução nativa correta em runtime/Metro.
  arquivos_editados:
    - apps/clients/web/src/app/layout.tsx (SessionProviderWrapper; 1ª falha de
      prerender /area-cliente)
    - docs/migration/inbox/323-prova-builds.md
    - docs/migration/MIGRATION.md
    - CHANGELOG.md
  nao_editado:
    - components/equipment-3d-carousel.tsx
    - tools/token-check.mjs
    - apps/clients/mobile/tsconfig.json (customConditions permanece ausente)
    - app/ (raiz legado)
  comandos:
    - cmd: pnpm test
      exit: 1
      erro: >-
        TEST_DATABASE_URL is required for tests (tests/global-setup.ts). Sem
        inventar URL; sem subir banco.
      verificado_em: "2026-09-25 17:46"
    - cmd: pnpm build:web
      exit: 1
      tentativa_1:
        erro: >-
          /area-cliente prerender: useSession() undefined (SessionProvider
          ausente no host thin)
        fix: SessionProviderWrapper em apps/clients/web/src/app/layout.tsx
      tentativa_2_unica:
        erro: >-
          /equipamentos: useSearchParams() sem Suspense boundary
          (missing-suspense-with-csr-bailout). Sem segunda correção nesta fatia
          (já usou a retentativa).
      verificado_em: "2026-09-25 17:47"
    - cmd: pnpm bundle:mobile
      exit: 1
      erro: >-
        Cannot find module '.../react-native/rn-get-polyfills' (Expo Metro /
        react-native package layout). Sem emulador.
      nota: "[NOT_VERIFIED: device_or_emulator]"
      verificado_em: "2026-09-25 17:48"
    - cmd: pnpm check:tokens
      exit: 1
      erro: "brand600 token not found (tools/token-propagation-check.mjs)"
      nota: >-
        Script existe e falhou. tools/token-check.mjs (gate de literais)
        reexecutado após edição de layout → exit 0.
      verificado_em: "2026-09-25 17:49"
    - cmd: node tools/arch-check.mjs
      exit: 0
      nota: reexecutado porque layout.tsx foi editado
    - cmd: node tools/token-check.mjs
      exit: 0
      nota: reexecutado porque layout.tsx foi editado
  exits_finais:
    test: 1
    build_web: 1
    bundle_mobile: 1
    check_tokens: 1
    arch: 0
    token_check: 0
  bloqueio_restante:
    - TEST_DATABASE_URL ausente bloqueia vitest raiz
    - build:web bloqueado por Suspense/useSearchParams em /equipamentos
    - bundle:mobile bloqueado por rn-get-polyfills (ambiente/RN)
    - check:tokens (propagation) falha brand600; gate token-check.mjs OK
    - customConditions ausente: typecheck mobile ≠ proof native export
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test]"
    - "[NOT_VERIFIED: build:web]"
    - "[NOT_VERIFIED: bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: cobertura]"
    - "[NOT_VERIFIED: check:tokens propagation brand600]"
  legado_raiz_mantido: true
  carrossel_3d_legado: true
  migracao_concluida: false
```
