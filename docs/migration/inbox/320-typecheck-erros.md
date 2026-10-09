# 320-typecheck-erros

Reduzir erros reais de `pnpm typecheck` (cadeia tsc do package.json) sem mudar
comportamento observável. Sem commit, sem `pnpm install`, sem Prisma. Sem apagar
`app/` da raiz. Sem catch-all. Sem editar carrossel 3D.

```yaml
fatia:
  id: 320
  estado: intermediate
  conceito: >-
    exportar Alert no index público de @gb-locacoes/ui; apontar types de
    react-native já instalados no mobile; incluir augment de sessão next-auth;
    não declarar migração concluída
  causa: >-
    Alert/AlertTitle/AlertDescription existiam em packages/ui mas não estavam em
    index.web.ts/index.native.ts; tsc de ui native e *.native.tsx não enxergava
    types de react-native (só em apps/clients/mobile/node_modules); Session
    padrão do next-auth sem id/role no typecheck dos pacotes
  arquivos_editados:
    - packages/ui/src/index.web.ts
    - packages/ui/src/index.native.ts
    - packages/ui/tsconfig.native.json
    - packages/frontend/tsconfig.json
    - apps/clients/mobile/tsconfig.json
    - apps/clients/web/tsconfig.json
  contagem_antes:
    ui_web: 0
    ui_native: 61
    frontend: 204
    web: 182
    mobile: 415
    verificado_em: "2026-09-25 17:28"
  contagem_depois:
    ui_web: 0
    ui_native: 0
    frontend: 122
    web: 112
    mobile: 339
    verificado_em: "2026-09-25 17:35"
  correcoes:
    - >-
      export explícito Alert, AlertTitle, AlertDescription nos index web e
      native (sem export *)
    - >-
      paths react-native → types_generated/index.d.ts do pacote já instalado em
      apps/clients/mobile/node_modules (sem stub falso; sem pnpm install; sem
      baseUrl — TS7 TS5102)
    - >-
      include de types/next-auth.d.ts em frontend, web e mobile (id/role já
      usados no código; sem alargar permissão)
  item_3_aliases:
    - >-
      parado: @/lib/utils, category-design, category-helpers, formatting,
      all-icons, icon-utils, boleto-validator, sanitize, schemas/settings,
      app/api/admin/settings/actions ainda existem no legado raiz e NÃO foram
      movidos para o pacote — não reescreveu imports; não unificou
      moeda/debounce/getInitials
    - implicits any em CategoriaDialog etc. cascateiam dos @/lib
  item_4_sessao: verde (0 erros Property id/role no frontend após include)
  nao_fez:
    - pnpm install / instalar react-native na raiz
    - prisma migrate/push/seed
    - editar CatalogPage/Expandidos/Graficos/ScrollStackBenefitCard
    - editar carrossel 3D / service worker / app/ da raiz
    - inventar comportamento para aliases não movidos
    - commit
  comandos:
    - cmd: >-
        node node_modules/typescript/bin/tsc -p packages/ui/tsconfig.json
        --pretty false
      exit: 0
      verificado_em: "2026-09-25 17:35"
      nota: EXIT_UI_WEB=0 count=0
    - cmd: >-
        node node_modules/typescript/bin/tsc -p packages/ui/tsconfig.native.json
        --pretty false
      exit: 0
      verificado_em: "2026-09-25 17:35"
      nota: EXIT_UI_NATIVE=0 count=0 (classe 2 verde)
    - cmd: >-
        node node_modules/typescript/bin/tsc -p packages/frontend/tsconfig.json
        --pretty false
      exit: 1
      verificado_em: "2026-09-25 17:35"
      nota: EXIT_FRONTEND=1 count=122 (80x @/lib legado + implicits)
    - cmd: >-
        node node_modules/typescript/bin/tsc -p apps/clients/web/tsconfig.json
        --pretty false
      exit: 1
      verificado_em: "2026-09-25 17:35"
      nota: EXIT_WEB=1 count=112; 0 rota fina com export errado
    - cmd: >-
        node node_modules/typescript/bin/tsc -p
        apps/clients/mobile/tsconfig.json --pretty false
      exit: 1
      verificado_em: "2026-09-25 17:35"
      nota: EXIT_MOBILE=1 count=339
    - cmd: node tools/arch-check.mjs
      exit: 0
      verificado_em: "2026-09-25 17:35"
    - cmd: node tools/token-check.mjs
      exit: 0
      verificado_em: "2026-09-25 17:35"
      nota: typescript 5.9.3 via loader; sem reescrita do loader
  erros_que_ficaram:
    - arquivo: packages/frontend (vários @/lib/*)
      mensagem: TS2307 Cannot find module '@/lib/...'
      escopo: >-
        alvos ainda no legado raiz; fatia 3 parou sem mover/unificar
    - arquivo: packages/frontend CategoriaDialog e afins
      mensagem: TS7006 implicitly any (cascata dos @/lib)
      escopo: fora — exigiria inventar tipo ou mover módulos
    - arquivo: components/equipment-3d-carousel.tsx (via web)
      mensagem: módulo @gb-locacoes/ui / @/components/ui/model-viewer
      escopo: fora — carrossel 3D permanece legado
  bloqueio_restante:
    typecheck: >-
      exit 1 na cadeia (ui web+native OK; frontend aliases legado; hosts ecoam
      frontend). react-native NÃO está na raiz node_modules — só em
      apps/clients/mobile (paths apontam tipos).
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test com TEST_DATABASE_URL]"
    - "[NOT_VERIFIED: build]"
    - "[NOT_VERIFIED: build:web]"
    - "[NOT_VERIFIED: bundle:mobile]"
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  migracao_concluida: false
```
