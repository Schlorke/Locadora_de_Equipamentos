# 279-previews-settings

Previews de settings (`HeroCarouselPreview` e `HeaderFooterPreview`) saíram do
legado para `pages/configuracoes/ui`. Nenhum dos dois importa
`equipment-3d-carousel`, `model-viewer`, `lazy-3d-carousel` ou
`scroll-reveal-init` — ambos foram movidos. Textos e layout preservados.
`SettingsPreviews` e `ConfiguracoesPage` passam a importar o slice local.
Carrossel 3D não foi tocado. Estado intermediate.

```yaml
fatia:
  id: 279-previews-settings
  estado: intermediate
  conceito: previews hero carousel e header/footer das configurações admin
  origem:
    - components/admin/hero-carousel-preview.tsx
    - components/admin/header-footer-preview.tsx
  destino:
    - packages/frontend/src/pages/configuracoes/ui/HeroCarouselPreview.web.tsx
    - packages/frontend/src/pages/configuracoes/ui/HeaderFooterPreview.web.tsx
  invariantes:
    - id: sem-3d-scroll-reveal
      prova:
        "HeroCarouselPreview.web.tsx e HeaderFooterPreview.web.tsx sem
        equipment-3d-carousel|model-viewer|lazy-3d-carousel|scroll-reveal-init"
    - id: imports-locais
      prova:
        "ConfiguracoesPage.web.tsx → ./HeroCarouselPreview.web;
        SettingsPreviews.web.tsx → ./HeaderFooterPreview.web"
    - id: textos-preview
      prova:
        "HeaderFooterPreview: Preview Header & Footer, (51) 2313-6262,
        contato@locacoesgb.com.br; HeroCarouselPreview: Preview Hero Carousel,
        Preview em Tempo Real"
    - id: carrossel-3d-intacto
      prova:
        "nenhum arquivo equipment-3d-carousel / model-viewer / lazy-3d-carousel
        / scroll-reveal-init alterado"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/configuracoes"
      exit: 0
      verificado_em: "2026-09-25 16:04"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:04"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:04"
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "literais de preview hero (rgb/borda/#2a2d3a/fill SVG) cobertos com
        token-check-allow"
      - "entities/configuracao não foi alterado"
  aposentado:
    - components/admin/hero-carousel-preview.tsx
    - components/admin/header-footer-preview.tsx
  nao_verificado:
    - "[NOT_VERIFIED: /admin/settings no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: autoplay e reset do preview hero]"
    - "[NOT_VERIFIED: preview header/footer com logo upload]"
```
