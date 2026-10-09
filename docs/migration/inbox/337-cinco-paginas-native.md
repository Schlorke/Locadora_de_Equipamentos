# 337-cinco-paginas-native

Typecheck mobile: props web vs contrato `@gb-locacoes/ui` native nos cinco
primeiros arquivos do grafo pós-336. Sem commit, sem `pnpm install`, sem Prisma.
Sem inventar `TEST_DATABASE_URL`. Sem `pnpm test`. Sem editar carrossel 3D. Sem
remover `customConditions` / `moduleSuffixes`. Migração **não** concluída.

```yaml
fatia:
  id: 337-cinco-paginas-native
  estado: intermediate
  conceito: >-
    split .web/.native/.tsx (reexport web) para ContactForm, ApiDocsPage,
    CadastroPage, ContatoPage, CookiesPage; native sem props rejeitadas
    (className/htmlFor/id/type/onChange); web visual intacto no .web.tsx
  lido_antes:
    - docs/migration/MIGRATION.md (## 336-grafo-native)
    - docs/migration/inbox/336-grafo-native.md
    - packages/ui/src/native/{Button,Input,Label,Card,Badge,Textarea}.native.tsx
  erros_por_arquivo_antes:
    ContactForm:
      - Label htmlFor; Input id/onChange/required/maxLength; Textarea id/onChange/rows;
        Button type; e implícito any
      acao: .web intacto; .native com onChangeText e props do contrato; .tsx reexport .web
    ApiDocsPage:
      - Card/CardTitle/Badge className
      acao: .web intacto; .native sem className em UI; .tsx reexport .web
    CadastroPage:
      - Card*/Alert*/Label htmlFor; Input id/name/onChange/required/maxLength/aria-label;
        Button type; Link className
      acao: .web intacto; .native onChangeText + strip props; .tsx reexport .web
    ContatoPage:
      - Card*/Badge className
      acao: .web intacto; .native sem className em UI; .tsx reexport .web
    CookiesPage:
      - Card className/id; CardContent className
      acao: .web intacto; .native sem className/id em UI; .tsx reexport .web
  arquivos_criados:
    - packages/frontend/src/features/enviar-contato/ui/ContactForm.web.tsx
    - packages/frontend/src/features/enviar-contato/ui/ContactForm.native.tsx
    - packages/frontend/src/pages/api-docs/ui/ApiDocsPage.web.tsx
    - packages/frontend/src/pages/api-docs/ui/ApiDocsPage.native.tsx
    - packages/frontend/src/pages/cadastro/ui/CadastroPage.web.tsx
    - packages/frontend/src/pages/cadastro/ui/CadastroPage.native.tsx
    - packages/frontend/src/pages/contato/ui/ContatoPage.web.tsx
    - packages/frontend/src/pages/contato/ui/ContatoPage.native.tsx
    - packages/frontend/src/pages/cookies/ui/CookiesPage.web.tsx
    - packages/frontend/src/pages/cookies/ui/CookiesPage.native.tsx
    - docs/migration/inbox/337-cinco-paginas-native.md
  arquivos_editados:
    - packages/frontend/src/features/enviar-contato/ui/ContactForm.tsx
    - packages/frontend/src/pages/api-docs/ui/ApiDocsPage.tsx
    - packages/frontend/src/pages/cadastro/ui/CadastroPage.tsx
    - packages/frontend/src/pages/contato/ui/ContatoPage.tsx
    - packages/frontend/src/pages/cookies/ui/CookiesPage.tsx
    - docs/migration/MIGRATION.md
    - CHANGELOG.md
  nao_editado:
    - carrossel 3D
    - customConditions / moduleSuffixes do tsconfig mobile
    - demais ~250 páginas universais
  contagem_mobile:
    antes: 258
    depois: 163
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
    nota: mobile 163 > 30 — parada pedida
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
