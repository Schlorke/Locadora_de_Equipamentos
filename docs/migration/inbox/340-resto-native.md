# 340-resto-native

Typecheck mobile pós-339: props web vs contrato `@gb-locacoes/ui` native nos
widgets do grafo (pages já zeradas). Exclusão de `**/*.native.{ts,tsx}` no
`packages/frontend/tsconfig.json` (cadeia tipava native com contrato web). Sem
commit, sem `pnpm install`, sem Prisma. Sem `pnpm test`. Sem editar carrossel
3D. Sem remover `customConditions` / `moduleSuffixes` do mobile. Migração
**não** concluída.

```yaml
fatia:
  id: 340-resto-native
  estado: intermediate
  conceito: >-
    frontend tsconfig exclui *.native (não *.web); split .web/.native/.tsx
    para Cartao (cartao-admin), FiltroAdmin, Bloco (personalizar-icone);
    native sem props UI rejeitadas; web visual intacto; category-helpers resto
  lido_antes:
    - docs/migration/MIGRATION.md (## 339-cinco-paginas-native)
    - docs/migration/inbox/339-cinco-paginas-native.md
    - packages/frontend/tsconfig.json + apps/clients/mobile/tsconfig.json
  erros_por_arquivo_antes:
    Cartao (cartao-admin):
      - Card/CardHeader/CardTitle/CardContent className
      acao: .web intacto; .native sem className em UI; .tsx reexport .web
    FiltroAdmin:
      - Card/CardContent className; Input id/onChange/className
      acao: .web intacto; .native onChangeText + strip; .tsx reexport .web
    Bloco (personalizar-icone):
      - HybridTooltip ausente no native; Input onChange/id;
        Button type; Label htmlFor
      acao: .web intacto; .native sem HybridTooltip/props rejeitadas;
        .tsx reexport .web
    category-helpers (shared/lib):
      - Badge className/style
      acao: resto (não widget; fora do padrão de tela/widget desta fatia)
  arquivos_criados:
    - packages/frontend/src/widgets/cartao-admin/ui/Cartao.web.tsx
    - packages/frontend/src/widgets/cartao-admin/ui/Cartao.native.tsx
    - packages/frontend/src/widgets/filtro-admin/ui/FiltroAdmin.web.tsx
    - packages/frontend/src/widgets/filtro-admin/ui/FiltroAdmin.native.tsx
    - packages/frontend/src/widgets/personalizar-icone/ui/Bloco.web.tsx
    - packages/frontend/src/widgets/personalizar-icone/ui/Bloco.native.tsx
    - docs/migration/inbox/340-resto-native.md
  arquivos_editados:
    - packages/frontend/tsconfig.json
    - packages/frontend/src/widgets/cartao-admin/ui/Cartao.tsx
    - packages/frontend/src/widgets/filtro-admin/ui/FiltroAdmin.tsx
    - packages/frontend/src/widgets/personalizar-icone/ui/Bloco.tsx
    - packages/frontend/src/pages/equipamentos/ui/EquipamentosPage.tsx
    - docs/migration/MIGRATION.md
    - CHANGELOG.md
  nao_editado:
    - carrossel 3D
    - customConditions / moduleSuffixes do tsconfig mobile
    - category-helpers.tsx (resto)
  contagem_mobile:
    antes: 24
    depois: 1
    exit: 1
    widgets_zerados: true
  cadeia_typecheck:
    cmd: pnpm typecheck
    exit: 1
    erros: 1
    nota: >-
      ui/ui-native/frontend/web 0; mobile 1 (category-helpers Badge className);
      exclude *.native no frontend removeu tipagem native-com-contrato-web
  resto:
    - packages/frontend/src/shared/lib/category-helpers.tsx
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  migracao_concluida: false
```
