# 335-tipos-nativos

Restaurar checagem nativa verdadeira no host mobile. Sem commit, sem
`pnpm install`, sem Prisma. Sem inventar `TEST_DATABASE_URL`. Sem `pnpm test`.
Sem editar carrossel 3D. Sem remover `customConditions` de novo para zerar o
gate. Migração **não** concluída.

```yaml
fatia:
  id: 335-tipos-nativos
  estado: intermediate
  conceito: >-
    restaurar customConditions react-native no tsconfig mobile; excluir
    **/*.web.tsx|ts do include/typecheck do host; typecheck nativo honesto (não
    mascarar); não declarar migração concluída
  lido_antes:
    - docs/migration/inbox/322-typecheck-resto.md
    - apps/clients/mobile/tsconfig.json
    - docs/migration/MIGRATION.md (final 334)
  achado_include:
    include_mobile: ["src", "../../../types/next-auth.d.ts"]
    nota: >-
      O include do mobile NÃO lista packages/frontend/**/*.web.tsx. Arquivos
      .web entram no programa via grafo de imports (barrels
      @gb-locacoes/frontend/app e widgets). exclude no tsconfig NÃO remove
      módulos já importados (comportamento tsc).
  alteracoes:
    - apps/clients/mobile/tsconfig.json (customConditions:["react-native"];
      exclude **/*.web.tsx|ts)
  nao_editado:
    - lógica carrossel 3D
    - packages/frontend (sem reescrita em massa)
    - packages/ui
    - customConditions do frontend universal
  customConditions_restaurado: true
  exclude_aplicado:
    - "**/*.web.tsx"
    - "**/*.web.ts"
  contagem_mobile:
    erros: 314
    exit: 1
    em_arquivos_web: 56
    em_universais_ou_outros: 258
    web_ainda_no_programa_via_import: 13
    verificado_em: "2026-09-25"
    cmd: >-
      node node_modules/typescript/bin/tsc -p apps/clients/mobile/tsconfig.json
      --pretty false
  primeiros_5_arquivos:
    - packages/frontend/src/features/enviar-contato/ui/ContactForm.tsx
    - packages/frontend/src/pages/api-docs/ui/ApiDocsPage.tsx
    - packages/frontend/src/pages/cadastro/ui/CadastroPage.tsx
    - packages/frontend/src/pages/contato/ui/ContatoPage.tsx
    - packages/frontend/src/pages/cookies/ui/CookiesPage.tsx
  decisao_erros: >-
    Centenas de erros (props web className/onClick/htmlFor contra contrato
    native). Sem reescrita em massa nesta fatia. Sem remover customConditions.
  cadeia_typecheck:
    cmd: pnpm typecheck
    exit: 1
    nota: >-
      ui web/native + frontend + web passam; falha no -p mobile com os 314
      erros. Exit real registrado (não mascarado).
    verificado_em: "2026-09-25"
  bloqueio_restante:
    - typecheck mobile 314 com customConditions (contrato native real)
    - .web ainda no programa via imports (exclude não corta grafo)
    - páginas universais passam props web a @gb-locacoes/ui native
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  nao_fez:
    - pnpm install
    - prisma
    - inventar TEST_DATABASE_URL
    - pnpm test
    - remover customConditions para passar
    - reescrita em massa de páginas universais
    - editar carrossel 3D
  migracao_concluida: false
```
