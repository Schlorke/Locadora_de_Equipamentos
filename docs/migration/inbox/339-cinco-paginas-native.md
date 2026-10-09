# 339-cinco-paginas-native

Typecheck mobile: props web vs contrato `@gb-locacoes/ui` native nos primeiros
arquivos de página do grafo pós-338 (excluídos os já zerados). Só restavam **4**
arquivos de página com erro (pedido era 5; widgets fora do escopo de página).
Sem commit, sem `pnpm install`, sem Prisma. Sem inventar `TEST_DATABASE_URL`.
Sem `pnpm test`. Sem editar carrossel 3D. Sem remover `customConditions` /
`moduleSuffixes`. Migração **não** concluída.

```yaml
fatia:
  id: 339-cinco-paginas-native
  estado: intermediate
  conceito: >-
    split .web/.native/.tsx (reexport web) para PrivacidadePage,
    RecuperarSenhaPage, ResetPasswordPage, TermosPage;
    native sem props rejeitadas (className/htmlFor/id/type/onChange);
    web visual intacto no .web.tsx; 5º arquivo de página inexistente no grafo
  lido_antes:
    - docs/migration/MIGRATION.md (## 338-cinco-paginas-native)
    - docs/migration/inbox/338-cinco-paginas-native.md
    - padrão LoginPage/CookiesPage/PoliticaDevolucaoPage .web/.native/.tsx
  erros_por_arquivo_antes:
    PrivacidadePage:
      - Card/CardContent className/id
      acao: .web intacto; .native sem className/id em UI; .tsx reexport .web
    RecuperarSenhaPage:
      - Card*/Alert*/Label htmlFor; Input id/onChange/required;
        Button type; Link className
      acao: .web intacto; .native onChangeText + strip props; .tsx reexport .web
    ResetPasswordPage:
      - Card*/Alert*/Label htmlFor; Input id/onChange/required;
        Button type/aria-label; Link className
      acao: .web intacto; .native onChangeText + strip props; .tsx reexport .web
    TermosPage:
      - Card/CardContent className/id
      acao: .web intacto; .native sem className/id em UI; .tsx reexport .web
    quinto_arquivo_pagina:
      - nota: grafo pós-338 tinha só 4 pages/* com erro; widgets não tratados
  arquivos_criados:
    - packages/frontend/src/pages/privacidade/ui/PrivacidadePage.web.tsx
    - packages/frontend/src/pages/privacidade/ui/PrivacidadePage.native.tsx
    - packages/frontend/src/pages/recuperar-senha/ui/RecuperarSenhaPage.web.tsx
    - packages/frontend/src/pages/recuperar-senha/ui/RecuperarSenhaPage.native.tsx
    - packages/frontend/src/pages/reset-password/ui/ResetPasswordPage.web.tsx
    - packages/frontend/src/pages/reset-password/ui/ResetPasswordPage.native.tsx
    - packages/frontend/src/pages/termos/ui/TermosPage.web.tsx
    - packages/frontend/src/pages/termos/ui/TermosPage.native.tsx
    - docs/migration/inbox/339-cinco-paginas-native.md
  arquivos_editados:
    - packages/frontend/src/pages/privacidade/ui/PrivacidadePage.tsx
    - packages/frontend/src/pages/recuperar-senha/ui/RecuperarSenhaPage.tsx
    - packages/frontend/src/pages/reset-password/ui/ResetPasswordPage.tsx
    - packages/frontend/src/pages/termos/ui/TermosPage.tsx
    - docs/migration/MIGRATION.md
    - CHANGELOG.md
  nao_editado:
    - carrossel 3D
    - customConditions / moduleSuffixes do tsconfig mobile
    - ContactForm / ApiDocsPage / CadastroPage / ContatoPage / CookiesPage
    - EntrarPage / EquipamentosPage / LoginPage / PermissoesPage / PoliticaDevolucaoPage
    - widgets (Cartao, FiltroAdmin, Bloco) e category-helpers
  contagem_mobile:
    antes: 96
    depois: 24
    exit: 1
    arquivos_pagina_depois: 0
    .web_no_programa_desses: 0
    so_native_no_listFiles: true
    verificado_em: "2026-09-25"
    cmd: >-
      pnpm exec tsc -p apps/clients/mobile/tsconfig.json --noEmit
  cadeia_typecheck:
    cmd: pnpm typecheck
    exit: 1
    erros_aprox: 36
    nota: >-
      mobile 24 ≤ 30 — cadeia rodada; package frontend tipa .native com
      contrato web (onChangeText vs onChange) em natives já zerados no mobile
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
