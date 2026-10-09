# 321-aliases-lib

Copiar módulos CLIENT-SAFE de `lib/` (raiz) para
`packages/frontend/src/shared/lib/` e reescrever imports só no frontend. Sem
commit, sem `pnpm install`, sem Prisma. Sem apagar `app/` da raiz. Sem
catch-all. Sem editar carrossel 3D nem `tools/token-check.mjs`.

```yaml
fatia:
  id: 321
  estado: intermediate
  conceito: >-
    aliases @/lib e relativos packages/frontend→lib/ raiz: copiar CLIENT-SAFE
    para shared/lib; reescrever imports internos; não unificar
    formatadores/debounce/getInitials/labels; não declarar migração concluída
  causa: >-
    tsconfig do pacote frontend não resolve @/; alvos ainda no legado raiz
    (fatia 320 item_3_aliases)
  inventorio_distinto:
    - lib/utils (cn, debounce fn, reexports)
    - lib/utils/formatting
    - lib/utils/category-helpers
    - lib/utils/validation
    - lib/category-design
    - lib/icon-utils
    - lib/constants/all-icons (+ lucide-icons)
    - lib/sanitize
    - lib/boleto-validator
  classificacao:
    CLIENT-SAFE_movidos:
      - cn.ts (de lib/utils cn)
      - debounce-fn.ts (debounce de lib/utils; distinto de useDebounce)
      - formatting.ts (getInitials/formatDateForInput/dueDate;
        formatCurrency→moeda)
      - cep.ts (fetchAddressByCEP de validation)
      - boleto-validator.ts
      - sanitize.ts (DOMPurify; distinto de sanitize-html.ts regex)
      - icon-utils.ts
      - constants/all-icons.tsx + lucide-icons.ts
      - category-design.tsx
      - category-helpers.tsx
    ja_existiam_reuso:
      - shared/lib/moeda.ts (formatCurrency)
      - entities/orcamento/model/reajuste (ADJUSTMENT_CATEGORY_LABELS /
        formatAdjustmentReason / parseAdjustmentBlocks)
      - entities/orcamento/model/documento (formatAddress / formatDocument)
      - shared/lib/sanitize-html.ts (Mdx; NÃO unificado com sanitize.ts)
    SERVER_nao_movidos: []
    nao_unificado:
      - formatCurrency (moeda) vs cópias locais
      - debounce-fn vs useDebounce (debounce.ts)
      - getInitials (formatting) vs cópias em dashboard/EditarCliente
      - ADJUSTMENT_CATEGORY_LABELS (reajuste) vs ADJUSTMENT_CATEGORY_LABEL
        (registro)
      - sanitize.ts (DOMPurify) vs sanitize-html.ts (regex)
  arquivos_criados:
    - packages/frontend/src/shared/lib/cn.ts
    - packages/frontend/src/shared/lib/debounce-fn.ts
    - packages/frontend/src/shared/lib/formatting.ts
    - packages/frontend/src/shared/lib/cep.ts
    - packages/frontend/src/shared/lib/boleto-validator.ts
    - packages/frontend/src/shared/lib/sanitize.ts
    - packages/frontend/src/shared/lib/icon-utils.ts
    - packages/frontend/src/shared/lib/constants/all-icons.tsx
    - packages/frontend/src/shared/lib/constants/lucide-icons.ts
    - packages/frontend/src/shared/lib/category-design.tsx
    - packages/frontend/src/shared/lib/category-helpers.tsx
  arquivos_editados:
    - packages/frontend/src/shared/lib/index.ts
    - ~70 arquivos em packages/frontend com imports @/lib ou relativos a lib/
    - testes de caracterização (expect de strings de import)
  legado_raiz_mantido: true
  nota_legado: >-
    arquivos em lib/ NÃO apagados (app/, components/ e outros ainda importam)
  contagem_antes:
    ui_web: 0
    ui_native: 0
    frontend: 122
    web: 112
    mobile: 339
    verificado_em: "2026-09-25 17:35"
    fonte: fatia 320
  contagem_depois:
    ui_web: 0
    ui_native: 0
    frontend: 19
    web: 17
    mobile: 316
    verificado_em: "2026-09-25 17:39"
  comandos:
    - cmd: node tools/_tmp-321-scan-imports.mjs
      exit: 0
      nota: 9 módulos distintos; 0 restantes após rewrite
    - cmd: >-
        node node_modules/typescript/bin/tsc -p packages/ui/tsconfig.json
        --pretty false
      exit: 0
      verificado_em: "2026-09-25 17:39"
      nota: EXIT_UI_WEB=0 count=0
    - cmd: >-
        node node_modules/typescript/bin/tsc -p packages/ui/tsconfig.native.json
        --pretty false
      exit: 0
      verificado_em: "2026-09-25 17:39"
      nota: EXIT_UI_NATIVE=0 count=0
    - cmd: >-
        node node_modules/typescript/bin/tsc -p packages/frontend/tsconfig.json
        --pretty false
      exit: 1
      verificado_em: "2026-09-25 17:39"
      nota: EXIT_FRONTEND=1 count=19 (0x @/lib; settings/schemas, hero 3D, etc.)
    - cmd: >-
        node node_modules/typescript/bin/tsc -p apps/clients/web/tsconfig.json
        --pretty false
      exit: 1
      verificado_em: "2026-09-25 17:39"
      nota: EXIT_WEB=1 count=17
    - cmd: >-
        node node_modules/typescript/bin/tsc -p
        apps/clients/mobile/tsconfig.json --pretty false
      exit: 1
      verificado_em: "2026-09-25 17:39"
      nota: EXIT_MOBILE=1 count=316
    - cmd: node tools/arch-check.mjs
      exit: 0
      verificado_em: "2026-09-25 17:39"
    - cmd: node tools/token-check.mjs
      exit: 0
      verificado_em: "2026-09-25 17:39"
      nota: >-
        token-check-allow nos literais hex copiados de category-design /
        category-helpers; tools/token-check.mjs não editado
  erros_que_ficaram:
    - arquivo: packages/frontend pages/configuracoes
      mensagem:
        TS2307 @/app/api/admin/settings/actions, @/schemas/settings.schema
      escopo: fora — aliases não-lib / server actions
    - arquivo: packages/frontend widgets/filtro-admin
      mensagem: TS2307 @/types/filters
      escopo: fora — types raiz
    - arquivo: packages/frontend widgets/hero
      mensagem: TS2307 @/components/equipment-3d-carousel
      escopo: fora — carrossel 3D permanece legado
  bloqueio_restante:
    typecheck: >-
      exit 1 na cadeia (ui OK; frontend 19 sem @/lib; hosts ecoam; mobile 316).
      Outros aliases (@/schemas, @/types, @/components) e carrossel 3D fora
      desta fatia.
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
