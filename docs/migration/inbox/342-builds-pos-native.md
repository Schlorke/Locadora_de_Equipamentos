# 342-builds-pos-native

Prova pós-separações `.web`/`.native` (páginas/widgets + fatia 341
category-helpers). Ordem: `pnpm check:tokens` → `pnpm build:web` →
`pnpm bundle:mobile`. Sem correção de import (nenhuma falha). Sem commit, sem
`pnpm install`, sem Prisma. Sem inventar `TEST_DATABASE_URL`. Sem `pnpm test`.
Sem editar carrossel 3D. Sem remover `customConditions` / `moduleSuffixes` do
mobile. Migração **não** concluída.

```yaml
fatia:
  id: 342-builds-pos-native
  estado: intermediate
  conceito: >-
    re-rodar check:tokens + build:web + bundle:mobile após splits .web/.native;
    exits isolados; sem fix de import
  contexto_anterior:
    - tsc mobile 0 / pnpm typecheck 0 / pnpm arch 0 (fatia 341)
    - build:web e bundle:mobile anteriores às separações pages/widgets
    - check:tokens também anterior às separações
  arquivos_editados:
    - docs/migration/inbox/342-builds-pos-native.md
    - docs/migration/MIGRATION.md
  nao_editado:
    - packages/frontend (código)
    - apps/clients/**
    - carrossel 3D
    - customConditions / moduleSuffixes do tsconfig mobile
    - CHANGELOG.md (sem mudança de código)
  comandos:
    - cmd: pnpm check:tokens
      exit: 0
      nota: >-
        styleResolution true; webRender ok; mobileExport android+ios true;
        script também dispara build:web/bundle:mobile internos
      verificado_em: "2026-09-25 19:06"
    - cmd: pnpm build:web
      exit: 0
      nota: Next.js 16.3.6 Turbopack; 44 rotas; sem falha de import .native
      verificado_em: "2026-09-25 19:08"
    - cmd: pnpm bundle:mobile
      exit: 0
      nota: expo export android+ios; dist-export; sem falha de reexport
      verificado_em: "2026-09-25 19:08"
  exits_finais:
    check_tokens: 0
    build_web: 0
    bundle_mobile: 0
  correcao_import:
    aplicada: false
    motivo: nenhum comando falhou por import/reexport .web/.native
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  migracao_concluida: false
```
