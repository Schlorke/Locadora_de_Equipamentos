# 328-host-reveal-sw

`scroll-reveal-init` e `service-worker-register` saíram de `components/` para
`app/` (ao lado de `ClientLayout.tsx`). O host continua o único ponto de
carregamento: `dynamic(..., { ssr: false })` para o reveal e um único
`ServiceWorkerRegister` em `hostExtras`. Evento `scrollRevealReady`, atrasos e
escopo do SW intactos. Pasta `components/` ficou sem arquivos e foi removida
(pastas vazias via Node `fs`). Carrossel 3D não tocado. arch/token exit 0.
Estado intermediate. Migração **não** concluída.

```yaml
fatia:
  id: 328-host-reveal-sw
  estado: intermediate
  conceito: >-
    mover scroll-reveal-init e service-worker-register de components/ para app/
    (host); sem duplicar init; sem alterar carrossel 3D / SW scope
  origem:
    - components/scroll-reveal-init.tsx
    - components/service-worker-register.tsx
  destino:
    - app/scroll-reveal-init.tsx
    - app/service-worker-register.tsx
    - app/ClientLayout.tsx
  lido_antes:
    - docs/features/equipment-3d-carousel.md
    - app/ClientLayout.tsx
    - packages/frontend/src/app/providers/ClientLayoutShell.web.tsx
  invariantes:
    - id: scrollRevealReady-timing
      prova:
        "app/scroll-reveal-init.tsx: dispatch 2700ms primeira visita / 200ms
        interna"
    - id: ssr-false-host
      prova:
        "app/ClientLayout.tsx: dynamic(() => import('./scroll-reveal-init'), {
        ssr: false })"
    - id: sw-unico
      prova:
        "único ServiceWorkerRegister em app/ClientLayout hostExtras;
        lib/sw-register intacto"
    - id: carrossel-3d-intacto
      prova:
        "não alterou Equipment3DCarousel/ModelViewer maxDuration 0 /
        disableAutoFit / hasPassedFirstModel"
    - id: sem-legado-imports
      prova:
        "zero imports de @/components/scroll-reveal-init|service-worker-register"
  comandos:
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "app/ da raiz continua o servidor Next de produção"
  aposentado:
    - components/scroll-reveal-init.tsx
    - components/service-worker-register.tsx
    - components/ (pasta vazia removida via node fs)
  callers_atualizados:
    - app/ClientLayout.tsx
    - packages/frontend/src/app/providers/ClientLayoutShell.web.test.tsx
    - scripts/performance-config.json
    - scripts/fix-typescript-errors.js
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test — falta TEST_DATABASE_URL]"
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  nao_fez:
    - pnpm install
    - prisma migrate/seed
    - inventar TEST_DATABASE_URL
    - pnpm test
    - alterar lógica do carrossel 3D
    - registrar SW duas vezes
    - apagar app/ da raiz
  migracao_concluida: false
```
