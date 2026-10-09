# 288-tipos-equipamento

Tipos do formulário de equipamento admin saíram de
`components/admin/equipment-form/types.ts` para
`packages/frontend/src/pages/equipamentos-admin/model/tipos.ts` sem alterar
campos. Callers Novo/Editar/CartaoPeriodo e o index do slice passaram a
importar/exportar do model. Legado apagado com zero imports. Não unido a tipos
de orçamento. Estado intermediate.

```yaml
fatia:
  id: 288-tipos-equipamento
  estado: intermediate
  conceito: tipos do formulário de equipamento admin
  origem:
    - components/admin/equipment-form/types.ts
  destino:
    - packages/frontend/src/pages/equipamentos-admin/model/tipos.ts
    - packages/frontend/src/pages/equipamentos-admin/index.ts
  invariantes:
    - id: campos-preservados
      prova:
        "Category, EquipmentFormData, PricingPeriod, PRICING_PERIOD_CONFIG,
        DEFAULT_FORM_DATA sem mudança de campos"
    - id: sem-merge-orcamento
      prova:
        "tipos ficam em equipamentos-admin/model/tipos.ts; orcamentos-admin não
        tocado"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/equipamentos-admin"
      exit: 0
      verificado_em: "2026-09-25 16:12"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:12"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:12"
  gate:
    arch: pass
    tokens: pass
    vitest_platform: pass
    violacoes_conhecidas:
      - "pasta components/admin/equipment-form pode permanecer vazia (fora desta
        fatia)"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/equipment-form/types.ts
  callers_atualizados:
    - packages/frontend/src/pages/equipamentos-admin/ui/Novo.web.tsx
    - packages/frontend/src/pages/equipamentos-admin/ui/Editar.web.tsx
    - packages/frontend/src/pages/equipamentos-admin/ui/CartaoPeriodo.tsx
    - packages/frontend/src/pages/equipamentos-admin/index.ts
  nao_verificado:
    - "[NOT_VERIFIED: formulário novo/editar equipamento no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```
