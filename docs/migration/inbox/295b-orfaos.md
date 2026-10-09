# 295b-orfaos

**Estado: intermediate.** Seis órfãos da raiz de `components/` foram para FSD.
`service-worker-register`, `equipment-3d-carousel` e `scroll-reveal-init`
permanecem no host / fora desta fatia. Zero imports de produto apontavam para os
caminhos antigos; legados apagados.

## Movimentos

| Origem                                     | Destino                                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `components/theme-provider.tsx`            | `app/providers/ThemeProvider.web.tsx` (next-themes; sem reexport em `app/index` — host/`ClientLayoutShell` não consomem) |
| `components/quote-form.tsx`                | `pages/orcamento/ui/QuoteForm.web.tsx` + export em `pages/orcamento/index.ts`                                            |
| `components/legal-page-layout.tsx`         | `widgets/legal-page-layout` (`.web` por `next/link`)                                                                     |
| `components/categories.tsx`                | `widgets/categorias-publicas/ui/Categories.tsx`                                                                          |
| `components/categories-with-animation.tsx` | `widgets/categorias-publicas/ui/CategoriesWithAnimation.web.tsx`                                                         |
| `components/mdx.tsx`                       | `widgets/mdx` + `shared/lib/sanitize-html.ts` (sem `@/lib/sanitize` / sem `package.json`)                                |

## Invariantes

- WhatsApp do QuoteForm: `555198205163`
- Categorias públicas: `GET /api/categories` (não misturar com admin
  `pages/categorias` / page size 9 / `/api/admin/categories`)
- Chaves de período `diaria`/`semanal`/`quinzenal`/`mensal` em
  `entities/orcamento` intactas (QuoteForm não as altera)

```yaml
fatia:
  id: 295b-orfaos
  estado: intermediate
  conceito:
    órfãos restantes da raiz de components/ (sem SW / 3D / scroll-reveal)
  origem:
    - components/theme-provider.tsx
    - components/quote-form.tsx
    - components/legal-page-layout.tsx
    - components/categories.tsx
    - components/categories-with-animation.tsx
    - components/mdx.tsx
  destino:
    - packages/frontend/src/app/providers/ThemeProvider.web.tsx
    - packages/frontend/src/pages/orcamento/ui/QuoteForm.web.tsx
    - packages/frontend/src/pages/orcamento/index.ts
    - packages/frontend/src/widgets/legal-page-layout/ui/LegalPageLayout.web.tsx
    - packages/frontend/src/widgets/legal-page-layout/index.ts
    - packages/frontend/src/widgets/categorias-publicas/ui/Categories.tsx
    - packages/frontend/src/widgets/categorias-publicas/ui/CategoriesWithAnimation.web.tsx
    - packages/frontend/src/widgets/categorias-publicas/index.ts
    - packages/frontend/src/widgets/mdx/ui/Mdx.tsx
    - packages/frontend/src/widgets/mdx/index.ts
    - packages/frontend/src/shared/lib/sanitize-html.ts
    - packages/frontend/src/shared/lib/index.ts
    - packages/frontend/src/app/providers/orfaos-295b.web.test.tsx
  invariantes:
    - id: whatsapp-quote-form
      prova: "orfaos-295b.web.test.tsx: openWhatsAppQuote(..., '555198205163')"
    - id: categorias-publicas-nao-admin
      prova:
        "orfaos-295b.web.test.tsx: /api/categories; carga admin continua
        /api/admin/categories"
    - id: sem-carrossel-3d-nem-sw
      prova:
        "não alterou equipment-3d-carousel, scroll-reveal-init,
        service-worker-register"
    - id: legado-zero-imports
      prova:
        "rg
        components/(categories|quote-form|theme-provider|legal-page-layout|mdx)
        em *.ts/*.tsx = 0; Test-Path dos seis = False"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/app/providers/orfaos-295b.web.test.tsx"
      exit: 0
      verificado_em: "2026-09-25 16:26"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:26"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:26"
  gate:
    arch: pass
    tokens: pass
    vitest_platform: pass
  aposentado:
    - components/theme-provider.tsx
    - components/quote-form.tsx
    - components/legal-page-layout.tsx
    - components/categories.tsx
    - components/categories-with-animation.tsx
    - components/mdx.tsx
  nao_verificado:
    - "[NOT_VERIFIED: consumidores futuros no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
```
