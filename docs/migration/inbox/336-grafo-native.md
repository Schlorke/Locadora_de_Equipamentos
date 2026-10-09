# 336-grafo-native

Cortar vazamento de `.web` no programa TypeScript do host mobile. Sem commit,
sem `pnpm install`, sem Prisma. Sem inventar `TEST_DATABASE_URL`. Sem
`pnpm test`. Sem editar carrossel 3D. Sem remover
`customConditions: ["react-native"]`. Sem reescrita em massa de páginas para
calar TS2322. Migração **não** concluída.

```yaml
fatia:
  id: 336-grafo-native
  estado: intermediate
  conceito: >-
    entry mobile resolve native (exports + moduleSuffixes); barrels não
    reexportam .web no grafo mobile; typecheck nativo sem módulos .web
  lido_antes:
    - docs/migration/inbox/335-tipos-nativos.md
    - apps/clients/mobile/src/app/_layout.tsx
    - packages/frontend/src/app/index.ts
    - packages/frontend/package.json
  achado_grafo:
    causa: >-
      mobile importa @gb-locacoes/frontend/app (AppProviders) e
      pages/playground (IconCustomizationPage); barrels universais
      reexportavam ClientLayoutShell.web / SessionProviderWrapper.web /
      PlaygroundPage.web; ClientLayoutShell puxava cabecalho/rodape/
      whatsapp/sincronizar.web; PlaygroundPage puxava por-que-escolher
    web_no_programa_antes: 13
    web_no_programa_depois: 0
  alteracoes:
    - packages/frontend/package.json
      (exports ./app e ./pages/playground com condition react-native)
    - packages/frontend/src/app/index.ts (só universal)
    - packages/frontend/src/app/index.web.ts
    - packages/frontend/src/app/index.native.ts
    - packages/frontend/src/pages/playground/index.native.ts
    - packages/frontend/src/widgets/cartao-equipamento/index.native.ts
    - packages/frontend/src/features/carrinho/index.native.ts
      (sem sincronizar.web)
    - apps/clients/mobile/tsconfig.json
      (moduleSuffixes: [".native", ""]; customConditions intacto)
    - packages/frontend/src/app/providers/ClientLayoutShell.web.test.tsx
      (lê index.web.ts)
  nao_editado:
    - lógica carrossel 3D
    - customConditions (mantido)
    - dezenas de páginas universais (TS2322 remanescente)
    - telas mobile (não inventou stub novo)
  contagem_mobile:
    antes:
      erros: 314
      exit: 1
      web_no_programa: 13
    depois:
      erros: 258
      exit: 1
      web_no_programa: 0
      unique_files: 18
    verificado_em: "2026-09-25"
    cmd: >-
      node node_modules/typescript/bin/tsc -p
      apps/clients/mobile/tsconfig.json --pretty false
  primeiros_5_arquivos_depois:
    - packages/frontend/src/features/enviar-contato/ui/ContactForm.tsx
    - packages/frontend/src/pages/api-docs/ui/ApiDocsPage.tsx
    - packages/frontend/src/pages/cadastro/ui/CadastroPage.tsx
    - packages/frontend/src/pages/contato/ui/ContatoPage.tsx
    - packages/frontend/src/pages/cookies/ui/CookiesPage.tsx
  decisao_parada: >-
    Após tirar .web do grafo restam 258 erros (>30). Parada sem
    reescrita em massa de páginas universais (props web vs UI native).
  cadeia_typecheck:
    mobile_exit: 1
    pnpm_typecheck: nao_rodado (mobile != 0)
    sanity_web_exit: 0
    sanity_frontend_exit: 0
  bloqueio_restante:
    - 258 TS2322/TS7006 em páginas/features universais vs contrato native
    - telas mobile ainda importam slices universais web-shaped
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  nao_fez:
    - pnpm install
    - prisma
    - inventar TEST_DATABASE_URL
    - pnpm test
    - remover customConditions
    - reescrita em massa
    - editar carrossel 3D
    - inventar tela/stub novo
  migracao_concluida: false
```
