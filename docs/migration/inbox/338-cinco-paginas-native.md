# 338-cinco-paginas-native

Typecheck mobile: props web vs contrato `@gb-locacoes/ui` native nos cinco
primeiros arquivos de página do grafo pós-337 (excluídos os cinco já zerados).
Sem commit, sem `pnpm install`, sem Prisma. Sem inventar `TEST_DATABASE_URL`.
Sem `pnpm test`. Sem editar carrossel 3D. Sem remover `customConditions` /
`moduleSuffixes`. Migração **não** concluída.

```yaml
fatia:
  id: 338-cinco-paginas-native
  estado: intermediate
  conceito: >-
    split .web/.native/.tsx (reexport web) para EntrarPage, EquipamentosPage,
    LoginPage, PermissoesPage (AdminPermissionsPage), PoliticaDevolucaoPage;
    native sem props rejeitadas (className/htmlFor/id/type/onChange);
    web visual intacto no .web.tsx
  lido_antes:
    - docs/migration/MIGRATION.md (## 337-cinco-paginas-native)
    - docs/migration/inbox/337-cinco-paginas-native.md
    - padrão CadastroPage/CookiesPage .web/.native/.tsx
  erros_por_arquivo_antes:
    EntrarPage:
      - Card*/Alert*/Label htmlFor; Input id/onChange/required/aria-label;
        Button type; Link className
      acao: .web intacto; .native onChangeText + strip props; .tsx reexport .web
    EquipamentosPage:
      - Card/CardContent/CardFooter/Badge className
      acao: .web intacto; .native sem className em UI; .tsx reexport .web
    LoginPage:
      - Card*/Alert*/Label htmlFor; Input id/onChange/required/aria-label;
        Button type; Link className
      acao: .web intacto; .native onChangeText + strip props; .tsx reexport .web
    PermissoesPage:
      - Card/CardContent className (export AdminPermissionsPage)
      acao: .web intacto; .native sem className em UI; .tsx reexport .web
    PoliticaDevolucaoPage:
      - Card className/id; CardContent className
      acao: .web intacto; .native sem className/id em UI; .tsx reexport .web
  arquivos_criados:
    - packages/frontend/src/pages/entrar/ui/EntrarPage.web.tsx
    - packages/frontend/src/pages/entrar/ui/EntrarPage.native.tsx
    - packages/frontend/src/pages/equipamentos/ui/EquipamentosPage.web.tsx
    - packages/frontend/src/pages/equipamentos/ui/EquipamentosPage.native.tsx
    - packages/frontend/src/pages/login/ui/LoginPage.web.tsx
    - packages/frontend/src/pages/login/ui/LoginPage.native.tsx
    - packages/frontend/src/pages/permissoes/ui/PermissoesPage.web.tsx
    - packages/frontend/src/pages/permissoes/ui/PermissoesPage.native.tsx
    - packages/frontend/src/pages/politica-devolucao/ui/PoliticaDevolucaoPage.web.tsx
    - packages/frontend/src/pages/politica-devolucao/ui/PoliticaDevolucaoPage.native.tsx
    - docs/migration/inbox/338-cinco-paginas-native.md
  arquivos_editados:
    - packages/frontend/src/pages/entrar/ui/EntrarPage.tsx
    - packages/frontend/src/pages/equipamentos/ui/EquipamentosPage.tsx
    - packages/frontend/src/pages/login/ui/LoginPage.tsx
    - packages/frontend/src/pages/permissoes/ui/PermissoesPage.tsx
    - packages/frontend/src/pages/politica-devolucao/ui/PoliticaDevolucaoPage.tsx
    - docs/migration/MIGRATION.md
    - CHANGELOG.md
  nao_editado:
    - carrossel 3D
    - customConditions / moduleSuffixes do tsconfig mobile
    - ContactForm / ApiDocsPage / CadastroPage / ContatoPage / CookiesPage
    - demais páginas universais (Privacidade, RecuperarSenha, etc.)
  contagem_mobile:
    antes: 163
    depois: 96
    exit: 1
    cinco_arquivos_depois: 0
    .web_no_programa_desses: 0
    so_native_no_listFiles: true
    verificado_em: "2026-09-25"
    cmd: >-
      pnpm exec tsc -p apps/clients/mobile/tsconfig.json --noEmit
  cadeia_typecheck:
    cmd: pnpm typecheck
    exit: nao_rodado
    nota: mobile 96 > 30 — parada pedida
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  nao_fez:
    - pnpm install
    - prisma
    - inventar TEST_DATABASE_URL
    - pnpm test
    - commit
    - reescrita em massa
  migracao_concluida: false
```
