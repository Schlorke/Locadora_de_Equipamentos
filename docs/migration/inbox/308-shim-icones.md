# 308-shim-icones

Shim `components/icons/custom/index.tsx` removido: zero imports de código
restantes (callers já apontavam a `@gb-locacoes/ui` ou arquivos legado ausentes
no disco). Pasta `components/icons/` apagada por ficar vazia (README/EXEMPLO já
aposentados na 304 e sem presença no working tree). Implementação permanece em
`packages/ui/src/icons/custom.tsx`. Sem merge com emoji. Carrossel 3D, Prisma,
`package.json`, `CHANGELOG.md` e `MIGRATION.md` intocados. Estado intermediate.

```yaml
fatia:
  id: 308-shim-icones
  estado: intermediate
  conceito: remover shim components/icons/custom → callers só @gb-locacoes/ui
  origem:
    - components/icons/custom/index.tsx
  destino:
    - packages/ui/src/icons/custom.tsx
  invariantes:
    - id: zero-imports-shim
      prova:
        "rg @/components/icons em ts/tsx/js/jsx só encontra asserção negativa em
        GridMotionPage.test.tsx"
    - id: shim-apagado
      prova:
        "components/icons/ e components/icons/custom/ inexistentes no disco"
    - id: sem-merge-emoji
      prova: "fatia não tocou personalizar-icone/emoji"
    - id: sem-carrossel-3d
      prova: "components/equipment-3d-carousel.tsx não tocado"
    - id: sem-prisma-package-json
      prova: "prisma e package.json não alterados nesta fatia"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/icons/custom.test.tsx"
      exit: 0
      verificado_em: "2026-09-25 16:52"
    - cmd: "node tools/arch-check.mjs"
      exit: 1
      verificado_em: "2026-09-25 16:52"
      nota: >-
        3 violações pré-existentes fora desta fatia: FSD-PUBLIC-API
        widgets/mini-carousel; FSD-SLICE pages/logistica → pages/packages
        (GanttView.web.tsx, LogisticsCalendar.web.tsx). Nenhuma violação ligada
        a icons/custom ou components/icons.
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:52"
  gate:
    arch: fail_externo
    tokens: pass
    vitest_platform: pass
    violacoes_conhecidas:
      - "arch: FSD-PUBLIC-API widgets/mini-carousel (fora da fatia 308)"
      - "arch: FSD-SLICE pages/logistica → pages/packages (fora da fatia 308)"
      - "lib/constants/all-icons.tsx continua no host raiz"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/icons/custom/index.tsx
    - components/icons/custom/README.md
    - components/icons/custom/EXEMPLO.md
    - components/icons/custom/
    - components/icons/
  callers_atualizados: []
  nao_verificado:
    - "[NOT_VERIFIED: ícones no browser / playground grid-motion]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```
