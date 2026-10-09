# 290-components-raiz

**Estado: concluído.** Até três `.tsx` da raiz de `components/` (excluídos
`equipment-3d-carousel`, `scroll-reveal-init` e qualquer carrossel 3D /
model-viewer) foram para FSD. Comportamento preservado. Legados apagados com
zero imports de produto.

## Movimentos

| Origem                                    | Destino                                                                                 |
| ----------------------------------------- | --------------------------------------------------------------------------------------- |
| `components/image-carousel-zoom.tsx`      | `pages/equipamentos-admin/ui/ImageCarouselZoom.web.tsx` (consumidor: `Detalhe.web.tsx`) |
| `components/session-provider-wrapper.tsx` | `app/providers/SessionProviderWrapper.web.tsx` (reexport `@gb-locacoes/frontend/app`)   |
| `components/seo-schemas.tsx`              | `widgets/seo-schemas` + reexport em `app/index.ts` (host `app/layout.tsx`)              |

## Fora desta fatia (ainda na raiz)

Órfãos / host / excluídos: `categories.tsx`, `categories-with-animation.tsx`,
`legal-page-layout.tsx`, `mdx.tsx`, `quote-form.tsx`, `theme-provider.tsx`,
`service-worker-register.tsx` (host + `@/lib/sw-register`),
`equipment-3d-carousel.tsx`, `scroll-reveal-init.tsx`.

```yaml
fatia:
  id: 290-components-raiz
  estado: concluido
  conceito: até três .tsx da raiz de components/ (sem 3D / scroll-reveal)
  origem:
    - components/image-carousel-zoom.tsx
    - components/session-provider-wrapper.tsx
    - components/seo-schemas.tsx
  destino:
    - packages/frontend/src/pages/equipamentos-admin/ui/ImageCarouselZoom.web.tsx
    - packages/frontend/src/pages/equipamentos-admin/ui/ImageCarouselZoom.web.test.tsx
    - packages/frontend/src/app/providers/SessionProviderWrapper.web.tsx
    - packages/frontend/src/app/providers/layout-providers.web.test.tsx
    - packages/frontend/src/widgets/seo-schemas/ui/SEOSchemas.tsx
    - packages/frontend/src/widgets/seo-schemas/index.ts
    - packages/frontend/src/app/index.ts
    - app/layout.tsx
    - packages/frontend/src/pages/equipamentos-admin/ui/Detalhe.web.tsx
    - packages/frontend/src/pages/equipamentos-admin/ui/Detalhe.web.test.tsx
  invariantes:
    - id: sem-carrossel-3d
      prova:
        "não alterou equipment-3d-carousel, model-viewer, lazy-3d-carousel,
        scroll-reveal-init"
    - id: next-image-web
      prova:
        "ImageCarouselZoom.web.tsx e SessionProviderWrapper.web.tsx usam next/*
        / next-auth"
    - id: legado-zero-imports
      prova:
        "rg
        components/(image-carousel-zoom|session-provider-wrapper|seo-schemas) só
        em asserts negativos de teste; Test-Path dos três = False"
    - id: seo-via-entity
      prova:
        "SEOSchemas importa DEFAULT_LOCAL_BUSINESS de entities/configuracao (API
        pública)"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/equipamentos-admin/ui/ImageCarouselZoom.web.test.tsx
        packages/frontend/src/pages/equipamentos-admin/ui/Detalhe.web.test.tsx
        packages/frontend/src/app/providers/layout-providers.web.test.tsx"
      exit: 0
      verificado_em: "2026-09-25 16:14"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:14"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:14"
  gate:
    arch: pass
    tokens: pass
    vitest_platform: pass
  aposentado:
    - components/image-carousel-zoom.tsx
    - components/session-provider-wrapper.tsx
    - components/seo-schemas.tsx
  nao_verificado:
    - "[NOT_VERIFIED: layout + detalhe admin no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
```
