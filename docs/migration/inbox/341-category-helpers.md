# 341-category-helpers

Typecheck mobile pós-340: 1 erro em
`packages/frontend/src/shared/lib/category-helpers.tsx` (Badge com `className`
vs contrato `@gb-locacoes/ui` native). Split `.web` / `.native` / `.tsx`
(reexport web). Visual web intacto. Native: Badge sem className; sem Tailwind no
selo. Sem unificar/apagar `category-design` nem legado `lib/`. Sem commit, sem
`pnpm install`, sem Prisma. Sem `pnpm test`. Sem editar carrossel 3D. Sem
remover `customConditions` / `moduleSuffixes` do mobile. Migração **não**
concluída.

```yaml
fatia:
  id: 341-category-helpers
  estado: intermediate
  conceito: >-
    category-helpers: .web visual intacto (className/Tailwind);
    .native Badge sem className; .tsx reexporta .web; mobile resolve .native
  lido_antes:
    - docs/migration/MIGRATION.md (## 340-resto-native)
    - docs/migration/inbox/340-resto-native.md
    - padrão Cartao/FiltroAdmin/Bloco .web/.native/.tsx
  erros_por_arquivo_antes:
    category-helpers:
      - Badge className (contrato native)
      acao: .web intacto; .native Badge sem className; .tsx reexport .web
  arquivos_criados:
    - packages/frontend/src/shared/lib/category-helpers.web.tsx
    - packages/frontend/src/shared/lib/category-helpers.native.tsx
    - docs/migration/inbox/341-category-helpers.md
  arquivos_editados:
    - packages/frontend/src/shared/lib/category-helpers.tsx
    - docs/migration/MIGRATION.md
    - CHANGELOG.md
  nao_editado:
    - carrossel 3D
    - customConditions / moduleSuffixes do tsconfig mobile
    - category-design (shared e legado)
    - lib/ utils category-helpers legado
  contagem_mobile:
    antes: 1
    depois: 0
    exit: 0
  cadeia_typecheck:
    cmd: pnpm typecheck
    exit: 0
    erros: 0
  arch:
    cmd: pnpm arch
    exit: 0
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  migracao_concluida: false
```
