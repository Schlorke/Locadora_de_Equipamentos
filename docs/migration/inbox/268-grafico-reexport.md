# 268-grafico-reexport

O widget `graficos-financeiros` passou a importar `ChartContainer`,
`ChartTooltip` e `ChartTooltipContent` de `@gb-locacoes/ui`. Cores e dados dos
gráficos (aging, receita, categorias) não foram alterados. O reexport
`components/ui/chart.tsx` permanece porque `components/admin/financial/*` e
`components/admin/dashboard/*` ainda importam `@/components/ui/chart`. Esta
fatia está em estado intermediate; a migração não está concluída.

```yaml
fatia:
  id: 268-grafico-reexport
  estado: intermediate
  conceito: widget financeiro deixa o reexport e usa o Chart de packages/ui
  origem:
    - packages/frontend/src/widgets/graficos-financeiros/ui/AgingChart.tsx
    - packages/frontend/src/widgets/graficos-financeiros/ui/RevenueChart.tsx
    - packages/frontend/src/widgets/graficos-financeiros/ui/RevenueByCategoryChart.tsx
  destino:
    - "@gb-locacoes/ui (ChartContainer, ChartTooltip, ChartTooltipContent)"
  invariantes:
    - id: cores-graficos
      prova:
        "graficos.test.tsx: aging #16A34A #D97706 #EA580C #DC2626 #991B1B
        #94a3b8, receita #ea580c #f97316 e categorias"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/graficos-financeiros/ui/graficos.test.tsx
        packages/frontend/src/widgets/graficos-financeiros/ui/KPICard.test.tsx"
      exit: 0
      verificado_em: "2026-09-25 15:56"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 15:56"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 15:56"
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "components/ui/chart.tsx ainda reexporta (admin financial/dashboard
        ainda importa)"
      - "components/admin/financial/{Aging,Revenue,RevenueByCategory}Chart.tsx
        continuam no legado"
      - "components/admin/dashboard/{QuotesTrend,StatusDistribution,EquipmentByCategory}Chart.tsx
        continuam no legado"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: gráficos no browser admin]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```
