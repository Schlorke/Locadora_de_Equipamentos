# 306-headers-admin

Headers da barra admin (`admin-header`, `admin-desktop-header`,
`admin-mobile-header`, `admin-header-actions`) saíram de `components/admin/`
para o widget `cabecalho-admin-barra` (separado de `cabecalho-admin`, que já
exporta `AdminPageHeader`). Arquivos `.web` por `next/*` e `next-auth`. Literais
rgba/rgb preservados com `token-check-allow` (motivo ≥ 8 caracteres). Para
evitar import widget→widget, o mobile expoe `onMenuOpen` e o host
(`admin-layout-client`) compõe `MobileSidebar`; a barra órfã recebe `sidebar`
como slot. Legado apagado com zero imports. `menu-admin`, carrossel 3D, gantt,
mini-carousel, hero-carousel-manager e logistics-calendar não foram alterados
além do uso de `MobileSidebar` já existente no layout. Estado intermediate.

```yaml
fatia:
  id: 306-headers-admin
  estado: intermediate
  conceito: barra superior desktop/mobile e ações do painel admin
  origem:
    - components/admin/admin-header.tsx
    - components/admin/admin-desktop-header.tsx
    - components/admin/admin-mobile-header.tsx
    - components/admin/admin-header-actions.tsx
  destino:
    - packages/frontend/src/widgets/cabecalho-admin-barra/ui/Barra.web.tsx
    - packages/frontend/src/widgets/cabecalho-admin-barra/ui/BarraDesktop.web.tsx
    - packages/frontend/src/widgets/cabecalho-admin-barra/ui/BarraMobile.web.tsx
    - packages/frontend/src/widgets/cabecalho-admin-barra/ui/Acoes.web.tsx
    - packages/frontend/src/widgets/cabecalho-admin-barra/ui/Barra.web.test.tsx
    - packages/frontend/src/widgets/cabecalho-admin-barra/index.ts
  invariantes:
    - id: rgba-desktop
      prova:
        "Barra.web.test.tsx: rgba(51, 65, 85, 0.98) / rgba(30, 41, 59, 0.95)"
    - id: rgb-mobile
      prova: "Barra.web.test.tsx: rgb(51, 65, 85) e gradiente do botão menu"
    - id: rotas-acoes
      prova: "Barra.web.test.tsx: /admin/perfil, /admin/settings, /admin/login"
    - id: sem-import-menu-admin
      prova:
        "Barra.web.test.tsx: Barra.web sem menu-admin; MobileSidebar no host"
    - id: sem-legado-headers
      prova: "zero imports de components/admin/admin-*-header*"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/cabecalho-admin-barra"
      exit: 0
      verificado_em: "2026-09-25 16:54"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:54"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:54"
  gate:
    arch: pass
    tokens: pass
    vitest_platform: pass
    violacoes_conhecidas:
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
      - "AdminHeader (barra órfã) exportado sem caller"
  aposentado:
    - components/admin/admin-header.tsx
    - components/admin/admin-desktop-header.tsx
    - components/admin/admin-mobile-header.tsx
    - components/admin/admin-header-actions.tsx
  callers_atualizados:
    - app/admin/admin-layout-client.tsx
  nao_verificado:
    - "[NOT_VERIFIED: /admin layout headers no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```
