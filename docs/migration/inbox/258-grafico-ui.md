# 258-grafico-ui

O primitivo de gráfico saiu de `components/ui/chart.tsx` para `packages/ui`
(contrato + web + native). As classes, os seletores Recharts com `#ccc`/`#fff` e
a altura mínima `200px` permanecem. O legado só reexporta. As páginas do
dashboard importam `@gb-locacoes/ui`; o widget `graficos-financeiros` continua
no caminho antigo via reexport (fora do escopo desta fatia).

```yaml
fatia:
  id: 258-grafico-ui
  estado: intermediate
  conceito: primitivo de gráfico (chart)
  origem:
    - components/ui/chart.tsx
  destino:
    - packages/ui/src/contract/chart.ts
    - packages/ui/src/web/Chart.web.tsx
    - packages/ui/src/native/Chart.native.tsx
    - packages/ui/src/web/Chart.web.test.tsx
    - packages/frontend/src/pages/dashboard/ui/Categoria.web.tsx
    - packages/frontend/src/pages/dashboard/ui/Distribuicao.web.tsx
    - packages/frontend/src/pages/dashboard/ui/Tendencia.web.tsx
  invariantes:
    - id: medidas-e-seletores
      prova:
        "Chart.web.test.tsx: aspect-video, stroke #ccc/#fff, minHeight 200px,
        min-h-[200px], tooltip border-border/50; native sem aspect-video nem
        #ccc"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/Chart.web.test.tsx"
      exit: 0
      verificado_em: "2026-09-25 15:54"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 15:54"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 15:54"
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "widgets/graficos-financeiros continua importando components/ui/chart
        (reexport)"
      - "model-viewer, lazy-3d-carousel e date-range-picker continuam em
        components/ui"
      - "recharts permanece no package.json da raiz (não alterado nesta fatia)"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: gráfico no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```
