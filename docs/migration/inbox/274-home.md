# 274-home

**Estado: concluído.** Composição da `/` saiu de `app/page.tsx` para
`packages/frontend/src/pages/home`. Prisma e o recorte de `setting` permanecem
no host (server component); props `localBusiness` e `heroInitialSettings` vão
para `HomePage`. Carrossel 3D / model-viewer / lazy-3d / scroll-reveal /
`maxDuration={0}` / `disableAutoFit` **não** foram tocados.

## Host (`app/page.tsx`)

- `getPrisma()` + `prisma.setting.findFirst` (telefone, WhatsApp, e-mail,
  endereço, heroCarousel, waveAnimation, aboutUsText)
- `getLocalBusinessData` / `buildHeroInitialSettings` (transformação pura)
- Render: `<HomePage localBusiness={...} heroInitialSettings={...} />`

## Pacote (`pages/home`)

- `ui/HomePage.web.tsx` — StructuredData + Hero + lazy HomeCliente /
  PorQueEscolher / ContatoHome
- `model/hero-settings.ts` (já existia) + testes
- Export público via `@gb-locacoes/frontend/pages/home`

```yaml
fatia:
  id: 274-home
  estado: concluido
  conceito: shell da home (/) com composição em pages/home
  origem:
    - app/page.tsx
  destino:
    - packages/frontend/src/pages/home/ui/HomePage.web.tsx
    - packages/frontend/src/pages/home/ui/HomePage.web.test.tsx
    - packages/frontend/src/pages/home/index.ts
  invariantes:
    - id: prisma-no-host
      prova:
        "app/page.tsx continua com getPrisma + setting.findFirst;
        packages/frontend sem import de Prisma"
    - id: carrossel-3d-intacto
      prova:
        "não alterou equipment-3d-carousel, model-viewer, lazy-3d-carousel,
        scroll-reveal-init, maxDuration 0, disableAutoFit"
    - id: props-only
      prova:
        "HomePage recebe localBusiness + heroInitialSettings; sem query no
        pacote"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/home"
      exit: 0
      verificado_em: "2026-09-25 15:58"
    - cmd: "node tools/arch-check.mjs"
      exit: 1
      verificado_em: "2026-09-25 15:58"
      nota: "violação prévia email-admin/react-dom; home sem hits FSD"
    - cmd: "node tools/token-check.mjs"
      exit: 1
      verificado_em: "2026-09-25 15:58"
      nota:
        "violação prévia Progress.native borderRadius 9999; pages/home sem hits"
  gate:
    arch: fail_preexistente
    tokens: fail_preexistente
    vitest_platform: pass
    violacoes_conhecidas:
      - "RUNTIME-WEB-ONLY
        packages/frontend/src/pages/email-admin/ui/email-folder-list.tsx
        (react-dom) — fora desta fatia"
      - "TOKEN number-literal packages/ui/src/native/Progress.native.tsx
        borderRadius 9999 — fora desta fatia"
  aposentado: []
  nao_verificado: []
```
