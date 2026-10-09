# 345-tokens-hex-native

Mensagem real pré-fix:
`TOKEN color-literal packages/frontend/src/shared/lib/category-helpers.native.tsx:61:33 color #9ca3af`
(`pnpm tokens` exit **1**, 1 violação).

`#9ca3af` = Tailwind gray-400. Em `packages/design-tokens/src/tokens.ts` já
existe `palette.gray400: "#9ca3af"`. Native passou a usar `palette.gray400` nos
fallbacks do ícone `Tag` em `renderCategoryIcon` (linhas ~61 e ~66). `.web.tsx`
e legado `lib/` intactos. Sem classes Tailwind no native.

Pós-fix: `pnpm tokens` exit **0** (`token gate passed`). `pnpm check:tokens`
exit **0**. Sem `pnpm test` / build avulso nesta fatia (check:tokens aciona
build:web/bundle:mobile internamente). Sem commit. Sem editar carrossel 3D. Sem
remover `customConditions`/`moduleSuffixes`. Migração **não** concluída.

```yaml
fatia:
  id: 345-tokens-hex-native
  estado: intermediate
  conceito: >-
    Remover literal #9ca3af (gray-400) do category-helpers.native via
    palette.gray400 já existente; web intacto
  origem: []
  destino: []
  movido: []
  lido_antes:
    - packages/frontend/src/shared/lib/category-helpers.native.tsx
    - packages/design-tokens/src/tokens.ts (gray400)
    - saída real pnpm tokens (TOKEN color-literal :61:33)
    - docs/migration/MIGRATION.md (final 344)
  invariantes:
    - id: carrossel-3d-intacto
      prova: "não alterou Equipment3DCarousel/ModelViewer nem lógica 3D"
    - id: web-intacto
      prova: "category-helpers.web.tsx não editado"
    - id: legado-lib-intacto
      prova: "lib/ category-helpers não editado"
    - id: sem-tailwind-no-native
      prova: "sem copiar classes Tailwind para o native; só palette.gray400"
    - id: mesma-cor-gray-400
      prova: "palette.gray400 === #9ca3af; sem cor inventada"
  alteracoes:
    - path: packages/frontend/src/shared/lib/category-helpers.native.tsx
      mudanca: >-
        import palette; Tag fallbacks color={palette.gray400} no lugar de
        #9ca3af
  comandos:
    - cmd: "pnpm tokens"
      exit: 1
      nota: "pré-fix — TOKEN color-literal ...:61:33 color #9ca3af"
      verificado_em: "2026-09-25 19:12"
    - cmd: "pnpm tokens"
      exit: 0
      nota: "pós-fix — token gate passed; examined 692 code files"
      verificado_em: "2026-09-25 19:13"
    - cmd: "pnpm check:tokens"
      exit: 0
      nota: "vitest 5/5; webRender ok; mobileExport android+ios"
      verificado_em: "2026-09-25 19:14"
  gate:
    tokens: passed
    check_tokens: passed
  aposentado: []
  callers_atualizados: []
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test — porta 5432 aberta, sem psql/createdb/docker]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  nao_fez:
    - editar category-helpers.web.tsx
    - editar legado lib/
    - inventar outra cor
    - copiar Tailwind para native
    - pnpm test
    - pnpm install
    - prisma
    - commit
  migracao_concluida: false
```
