# 301-category-badge

O selo de categoria saiu de `components/ui/category-badge.tsx` para a entity
`packages/frontend/src/entities/categoria` (regra de produto: tamanho, hover e
delegação ao helper de cores). Exportado pelo `index` da entity. Cores e textos
continuam no helper legado `lib/utils/category-helpers` (compartilhado; não
exclusivo do badge e fora de `components/`). Não foi para `packages/ui`. Não
unido à listagem admin (`CATEGORY_PAGE_SIZE = 9`). Sem `next/*`, portanto sem
variante `.web`. Estado intermediate; a migração não está concluída.

```yaml
fatia:
  id: 301-category-badge
  estado: intermediate
  conceito: selo de categoria (tamanho, hover, cores via helper)
  origem:
    - components/ui/category-badge.tsx
  destino:
    - packages/frontend/src/entities/categoria/ui/CategoryBadge.tsx
    - packages/frontend/src/entities/categoria/index.ts
  invariantes:
    - id: defaults-e-helper
      prova:
        "CategoryBadge.test.tsx: size sm, hover false, getCategoryBadgePreview,
        category-helpers"
    - id: index-sem-page-size
      prova:
        "CategoryBadge.test.tsx: export pelo index; CATEGORY_PAGE_SIZE = 9
        intacto no mapa"
    - id: consumidor-detalhe
      prova:
        "CategoryBadge.test.tsx: EquipamentoDetalhePage importa
        entities/categoria; size sm hover false"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/entities/categoria/ui/CategoryBadge.test.tsx"
      exit: 0
      verificado_em: "2026-09-25 16:40"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:40"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:40"
  gate:
    arch: pass
    tokens: pass
    vitest_platform: pass
    violacoes_conhecidas:
      - "lib/utils/category-helpers continua legado (compartilhado)"
      - "listagem admin de categorias continua com CATEGORY_PAGE_SIZE 9"
      - "app/page.tsx continua dono da home e do Prisma"
      - "model-viewer, lazy-3d-carousel, equipment-3d-carousel e scroll-reveal
        não tocados"
  aposentado:
    - components/ui/category-badge.tsx
  nao_verificado:
    - "[NOT_VERIFIED: CategoryBadge no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```
