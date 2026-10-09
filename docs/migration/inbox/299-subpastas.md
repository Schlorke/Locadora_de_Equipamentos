# 299-subpastas

Três `.tsx` de subpastas de `components/` (fora de `ui`, sem 3D) foram para FSD.
`equipment-units-manager` → page `equipamentos-admin` (já importava).
`boleto-display` + `boleto-section` → entity `pagamento` (UI de produto sem dono
FSD; pasta `payment/` esvaziada). Comportamento e classes preservados. Sem
`next/*` (`.tsx` universal). Legado apagado com zero imports. Estado
intermediate.

```yaml
fatia:
  id: 299-subpastas
  estado: intermediate
  conceito: até três .tsx em subpastas de components/ (fora ui / 3D)
  origem:
    - components/admin/equipment-units-manager.tsx
    - components/payment/boleto-display.tsx
    - components/client/boleto-section.tsx
  destino:
    - packages/frontend/src/pages/equipamentos-admin/ui/GerenciadorUnidades.tsx
    - packages/frontend/src/entities/pagamento/ui/BoletoDisplay.tsx
    - packages/frontend/src/entities/pagamento/ui/BoletoSection.tsx
    - packages/frontend/src/pages/equipamentos-admin/index.ts
    - packages/frontend/src/entities/pagamento/index.ts
  invariantes:
    - id: unidades-fisicas
      prova:
        "GerenciadorUnidades: Unidades Físicas, /api/admin/equipment-units,
        status AVAILABLE|RESERVED|RENTED|MAINTENANCE|RETIRED"
    - id: boleto-display
      prova:
        "BoletoDisplay: Linha Digitável, Código de Barras, Baixar PDF,
        /api/payments/boleto/"
    - id: boleto-section
      prova:
        "BoletoSection: Boleto não disponível, Boleto Vencido, variant
        destructive"
    - id: caller-detalhe
      prova:
        "Detalhe.web importa ./GerenciadorUnidades; Alert.web.test lê
        entities/pagamento/ui/BoletoSection.tsx"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/equipamentos-admin
        packages/frontend/src/entities/pagamento
        packages/ui/src/web/Alert.web.test.tsx"
      exit: 0
      verificado_em: "2026-09-25 16:30"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:30"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:30"
  gate:
    arch: pass
    tokens: pass
    vitest_platform: pass
    violacoes_conhecidas:
      - "components/client/rental-actions.tsx continua legado (órfão;
        next/navigation)"
      - "components/admin/* (headers, sidebar, gantt, etc.) e icons/custom fora
        do máx. 3"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/equipment-units-manager.tsx
    - components/payment/boleto-display.tsx
    - components/client/boleto-section.tsx
    - components/payment/ (diretório vazio removido)
  callers_atualizados:
    - packages/frontend/src/pages/equipamentos-admin/ui/Detalhe.web.tsx
    - packages/frontend/src/pages/equipamentos-admin/ui/Detalhe.web.test.tsx
    - packages/ui/src/web/Alert.web.test.tsx
  subpastas_restantes_com_tsx:
    - admin (11+; headers, sidebar, gantt, hero-carousel, logistics, etc.)
    - client (rental-actions.tsx)
    - icons (custom/index.tsx)
  nao_verificado:
    - "[NOT_VERIFIED: UI admin detalhe equipamento no browser]"
    - "[NOT_VERIFIED: UI boleto no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
```
