# 304-icones

Ícones SVG customizados (sem regra de negócio) saíram de
`components/icons/custom/` para `packages/ui/src/icons/custom.tsx`. Nomes
exportados preservados (`CustomIconProps`, `CUSTOM_ICONS`, `CustomIconName` e
cada ícone). Widget `personalizar-icone` só atualizou o import do index — não
foi unido ao seletor de emoji. Shim transitório em
`components/icons/custom/index.tsx` reexporta `@gb-locacoes/ui`. Carrossel 3D,
Prisma, `package.json`, `CHANGELOG.md` e `MIGRATION.md` intocados. Estado
intermediate.

```yaml
fatia:
  id: 304-icones
  estado: intermediate
  conceito: components/icons/custom → packages/ui (ícones SVG sem domínio)
  origem:
    - components/icons/custom/index.tsx
    - components/icons/custom/README.md
    - components/icons/custom/EXEMPLO.md
  destino:
    - packages/ui/src/icons/custom.tsx
    - packages/ui/src/icons/custom.test.tsx
    - packages/ui/src/index.web.ts
    - packages/ui/src/index.native.ts
    - components/icons/custom/index.tsx
  invariantes:
    - id: nomes-exportados
      prova:
        "CustomIcon1/2, AndaimeSuspenso, AndaimeTubular, Transporte,
        Terraplenagem, Rompedor, Compressor, CadeiraEletrica, Betoneira,
        TrabalhoEmAltura, Lavagem, CUSTOM_ICONS, CustomIconName, CustomIconProps"
    - id: packages-ui-nao-widget
      prova:
        "implementação em packages/ui/src/icons/custom.tsx; widget
        personalizar-icone só importa CUSTOM_ICONS de @gb-locacoes/ui"
    - id: sem-merge-emoji
      prova:
        "dados.ts do widget não absorveu SVG; emoji groups intactos; só trocou
        import do index"
    - id: sem-prisma-frontend
      prova: "slice sem import de prisma/@prisma"
    - id: sem-carrossel-3d
      prova: "components/equipment-3d-carousel.tsx não tocado"
    - id: sem-package-json
      prova: "package.json não alterado nesta fatia"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/icons/custom.test.tsx
        packages/frontend/src/pages/grid-motion
        packages/frontend/src/widgets/personalizar-icone"
      exit: 0
      verificado_em: "2026-09-25 16:42"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:42"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:42"
  gate:
    arch: pass
    tokens: pass
    vitest_platform: pass
    violacoes_conhecidas:
      - "shim transitório components/icons/custom/index.tsx ainda reexporta
        @gb-locacoes/ui"
      - "lib/constants/all-icons.tsx continua no host raiz"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/icons/custom/README.md
    - components/icons/custom/EXEMPLO.md
  callers_atualizados:
    - packages/frontend/src/widgets/personalizar-icone/model/dados.ts
    - packages/frontend/src/pages/grid-motion/ui/GridMotionPage.tsx
    - packages/frontend/src/pages/grid-motion/ui/GridMotionPage.test.tsx
    - packages/frontend/src/pages/categorias/ui/CategoriaDialog.web.tsx
    - packages/frontend/src/widgets/home-cliente/ui/Vitrine.web.tsx
    - packages/frontend/src/features/abas-categoria/ui/Abas.tsx
    - lib/constants/all-icons.tsx
  nao_verificado:
    - "[NOT_VERIFIED: ícones no browser / playground grid-motion]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```
