# 244-categorias

A listagem saiu do corpo de `app/admin/categorias/page.tsx`. A URL
`/admin/categorias` continua no shell fino. O título continua Gerenciar
Categorias. A página continua com 9 itens (`CATEGORY_PAGE_SIZE`). A busca
continua `GET /api/admin/categories`. `VerCategoria` e `CategoriaDialog` não
foram recriados; a listagem só os reutiliza. O hook saiu de
`hooks/use-categories-data.ts` para `pages/categorias/model/carga.ts`.

```yaml
fatia:
  id: 244-categorias
  estado: intermediate
  conceito: listagem admin de categorias (shell /admin/categorias)
  origem:
    - app/admin/categorias/page.tsx
    - hooks/use-categories-data.ts
  destino:
    - packages/frontend/src/pages/categorias/ui/CategoriasPage.web.tsx
    - packages/frontend/src/pages/categorias/model/carga.ts
    - packages/frontend/src/pages/categorias/model/tipos.ts
    - app/admin/categorias/page.tsx
  invariantes:
    - id: titulo-pagina-9-shell
      prova:
        "CategoriasPage.web.test.tsx: Gerenciar Categorias, CATEGORY_PAGE_SIZE
        9, shell AdminCategoriesPage, reusa VerCategoria e CategoriaDialog"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/categorias/ui/CategoriasPage.web.test.tsx"
      exit: 0
      verificado_em: "2026-09-25 15:54"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 15:54"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 15:54"
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "app/admin/categorias/loading.tsx continua com o spinner da rota"
      - "lib/category-design e lib/utils/category-helpers continuam legado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - hooks/use-categories-data.ts
    - "o corpo da listagem saiu de app/admin/categorias/page.tsx; a rota ficou
      só com o shell"
  nao_verificado:
    - "[NOT_VERIFIED: listagem de categorias no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```
