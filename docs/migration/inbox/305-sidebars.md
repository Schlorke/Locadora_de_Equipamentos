# 305-sidebars

Sidebars admin (`admin-sidebar` / `mobile-sidebar`) saíram de
`components/admin/` para o widget `menu-admin` (arquivos `.web` por `next/*` e
`next-auth`). Valores rgba/literais preservados; cada linha acusada pelo
`token-check` recebeu `token-check-allow` com motivo ≥ 8 caracteres (na mesma
linha ou na anterior; templates multilinha usam comentário `//` na linha
anterior ao backtick, sem alterar o conteúdo da string). Legado apagado com zero
imports. Headers, gantt, hero-carousel-manager, logistics-calendar,
mini-carousel e carrossel 3D não foram tocados além do import mínimo nos headers
que consumiam as sidebars. Estado intermediate.

```yaml
fatia:
  id: 305-sidebars
  estado: intermediate
  conceito: sidebars desktop e mobile do painel admin
  origem:
    - components/admin/admin-sidebar.tsx
    - components/admin/mobile-sidebar.tsx
  destino:
    - packages/frontend/src/widgets/menu-admin/ui/BarraLateral.web.tsx
    - packages/frontend/src/widgets/menu-admin/ui/BarraLateralMobile.web.tsx
    - packages/frontend/src/widgets/menu-admin/ui/BarraLateral.web.test.tsx
    - packages/frontend/src/widgets/menu-admin/index.ts
  invariantes:
    - id: rgba-ativo-desktop
      prova:
        "BarraLateral.web.test.tsx: rgba(251, 146, 60, 0.9) / rgba(234, 88, 12,
        0.8)"
    - id: rgba-painel-desktop
      prova:
        "BarraLateral.web.test.tsx: rgba(30, 41, 59, 0.98) / rgba(20, 31, 45,
        0.95)"
    - id: rgba-painel-mobile
      prova:
        "BarraLateral.web.test.tsx: rgba(51, 65, 85, 0.95) / rgba(30, 41, 59,
        0.9)"
    - id: sem-legado-sidebars
      prova: "zero imports de components/admin/admin-sidebar ou mobile-sidebar"
    - id: carrossel-3d-intacto
      prova:
        "nenhum arquivo equipment-3d-carousel / model-viewer / lazy-3d-carousel
        alterado"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/menu-admin"
      exit: 0
      verificado_em: "2026-09-25 16:48"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:48"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:48"
  gate:
    arch: pass
    tokens: pass
    vitest_platform: pass
    violacoes_conhecidas:
      - "headers admin permanecem em components/ (só import atualizado)"
      - "órfãos gantt/logistics-calendar/mini-carousel/hero-carousel-manager sem
        importer FSD"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/admin-sidebar.tsx
    - components/admin/mobile-sidebar.tsx
  callers_atualizados:
    - app/admin/admin-layout-client.tsx
    - components/admin/admin-header.tsx
    - components/admin/admin-mobile-header.tsx
    - packages/frontend/src/features/selos-admin/index.ts
  nao_verificado:
    - "[NOT_VERIFIED: /admin layout sidebars no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```
