# 322-typecheck-resto

Corrigir o resto do typecheck (frontend/web/mobile) sem mudar texto, URL, preço,
papel ou payload. Sem commit, sem `pnpm install`, sem Prisma. Sem apagar `app/`
da raiz. Sem catch-all. Sem editar carrossel 3D nem `tools/token-check.mjs`.

```yaml
fatia:
  id: 322
  estado: intermediate
  conceito: >-
    typecheck resto: aliases schema/filters + shims server/3D; tipos
    Category/Equipment/listagem; testes Dica/Sobre; mobile sem customConditions
    react-native; não declarar migração concluída
  causa_mobile_dominante_antes: >-
    customConditions:["react-native"] fazia @gb-locacoes/ui resolver para
    contratos nativos (Label/Input sem htmlFor/onChange/className); 291× TS2322
    IntrinsicAttributes em páginas shared/.tsx e .web.tsx puxadas pelo host
    mobile (316 erros; 0 em apps/clients/mobile/src)
  causa_mobile_depois: nenhuma (count 0)
  inventorio:
    CLIENT_SAFE_copiados:
      - schemas/settings.schema.ts →
        pages/configuracoes/model/settings.schema.ts
      - types/filters.ts → shared/types/filters.ts
    SERVER_nao_puxado_prisma:
      - app/api/admin/settings/actions.ts (shim typecheck only)
    shims_typecheck:
      - settings-actions.shim.ts (getSettings/updateSettings; throw se chamado)
      - equipment-3d-carousel.shim.ts (tipos; runtime host legado intacto)
  arquivos_criados:
    - packages/frontend/src/pages/configuracoes/model/settings.schema.ts
    - packages/frontend/src/pages/configuracoes/model/settings-actions.shim.ts
    - packages/frontend/src/shared/types/filters.ts
    - packages/frontend/src/widgets/hero/model/equipment-3d-carousel.shim.ts
    - docs/migration/inbox/322-typecheck-resto.md
  arquivos_editados:
    - packages/frontend/tsconfig.json (paths @/schemas, @/types, shims)
    - apps/clients/web/tsconfig.json (paths + deps do carousel legado)
    - apps/clients/mobile/tsconfig.json (remove customConditions; paths)
    - packages/frontend/src/entities/equipamento/model/listagem.ts
    - packages/frontend/src/pages/categorias/ui/VerCategoria.web.tsx
    - packages/frontend/src/pages/equipamentos/ui/EquipamentosPage.tsx
    - packages/frontend/src/pages/equipamento-detalhe/ui/Dica.test.tsx
    - packages/frontend/src/pages/sobre/ui/SobrePage.test.tsx
    - apps/clients/web/src/app/equipamentos/page.tsx (sem mudança observável)
    - CHANGELOG.md
    - docs/migration/MIGRATION.md
  nao_editado:
    - components/equipment-3d-carousel.tsx (lógica 3D)
    - tools/token-check.mjs
    - lib/ raiz (mantido)
  contagem_antes:
    ui_web: 0
    ui_native: 0
    frontend: 19
    web: 17
    mobile: 316
    verificado_em: "2026-09-25 17:39"
    fonte: fatia 321
  contagem_depois:
    ui_web: 0
    ui_native: 0
    frontend: 0
    web: 0
    mobile: 0
    verificado_em: "2026-09-25 17:45"
  comandos:
    - cmd: >-
        node node_modules/typescript/bin/tsc -p packages/ui/tsconfig.json
        --pretty false
      exit: 0
      nota: EXIT_UI_WEB=0 count=0
    - cmd: >-
        node node_modules/typescript/bin/tsc -p packages/ui/tsconfig.native.json
        --pretty false
      exit: 0
      nota: EXIT_UI_NATIVE=0 count=0
    - cmd: >-
        node node_modules/typescript/bin/tsc -p packages/frontend/tsconfig.json
        --pretty false
      exit: 0
      nota: EXIT_FRONTEND=0 count=0
    - cmd: >-
        node node_modules/typescript/bin/tsc -p apps/clients/web/tsconfig.json
        --pretty false
      exit: 0
      nota: EXIT_WEB=0 count=0
    - cmd: >-
        node node_modules/typescript/bin/tsc -p
        apps/clients/mobile/tsconfig.json --pretty false
      exit: 0
      nota: EXIT_MOBILE=0 count=0
    - cmd: node tools/arch-check.mjs
      exit: 0
      verificado_em: "2026-09-25 17:45"
    - cmd: node tools/token-check.mjs
      exit: 0
      verificado_em: "2026-09-25 17:45"
  erros_que_ficaram: []
  bloqueio_restante:
    runtime: >-
      pages shared ainda são UI web; mobile typecheck OK sem customConditions,
      mas faltam variantes .native reais. Server actions continuam no legado
      app/; shim só para tsc do pacote.
    migracao: não concluída
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test]"
    - "[NOT_VERIFIED: build]"
    - "[NOT_VERIFIED: build:web]"
    - "[NOT_VERIFIED: bundle:mobile]"
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  migracao_concluida: false
```
