# 326-arch-metro

`arch-check` deixa de varrer `metro.config.js` (ferramenta Node do Metro, não
código universal). Critério estreito: só o basename `metro.config.js`. Polyfill
RN 0.86 da 324 intacto; bundle não reexecutado. Regra RUNTIME-NODE em
`packages/frontend` intacta. Sem commit, sem `pnpm install`, sem Prisma, sem
`TEST_DATABASE_URL`. Migração **não** concluída.

```yaml
fatia:
  id: 326
  estado: intermediate
  conceito: >-
    excluir metro.config.js do arch-check (RUNTIME-NODE falso positivo); não
    declarar migração concluída
  arquivos_editados:
    - tools/arch-check.mjs (listFiles ignora basename metro.config.js apenas)
    - docs/migration/inbox/326-arch-metro.md
    - docs/migration/MIGRATION.md
    - CHANGELOG.md
  nao_editado:
    - apps/clients/mobile/metro.config.js
    - packages/frontend/**
    - components/equipment-3d-carousel.tsx
    - app/ (raiz legado)
  comandos:
    - cmd: node tools/arch-check.mjs
      exit: 0
      nota: >-
        gate passed; exclusão estreita de metro.config.js; sem rebuild de bundle
        (path do polyfill inalterado)
      verificado_em: "2026-09-25 18:08"
  exits_finais:
    arch: 0
  bundle_mobile_reexecutado: false
  motivo_sem_bundle: >-
    só exclusão no checker; resolução de rn-get-polyfills em metro.config.js
    inalterada
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test]"
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  legado_raiz_mantido: true
  carrossel_3d_legado: true
  migracao_concluida: false
```
