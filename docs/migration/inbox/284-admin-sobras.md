# 284-admin-sobras

Três componentes de formulário de equipamento com implementação própria saíram
de `components/admin/equipment-form/` para o slice `equipamentos-admin` (já os
importava em Novo/Editar). Textos e classes preservados. `ModalZoomImagem` ficou
`.web.tsx` por usar `next/image`. Exportados no index público do slice
(compartilhados). `types.ts` do formulário permanece legado. Legado `.tsx`
apagado com zero imports. Estado intermediate.

```yaml
fatia:
  id: 284-admin-sobras
  estado: intermediate
  conceito: sobras admin equipment-form (cartão período, especificações, zoom)
  origem:
    - components/admin/equipment-form/pricing-period-card.tsx
    - components/admin/equipment-form/specifications-section.tsx
    - components/admin/equipment-form/image-zoom-modal.tsx
  destino:
    - packages/frontend/src/pages/equipamentos-admin/ui/CartaoPeriodo.tsx
    - packages/frontend/src/pages/equipamentos-admin/ui/SecaoEspecificacoes.tsx
    - packages/frontend/src/pages/equipamentos-admin/ui/ModalZoomImagem.web.tsx
    - packages/frontend/src/pages/equipamentos-admin/index.ts
  invariantes:
    - id: textos-e-classes
      prova:
        "Usar desconto percentual, Valor Direto (R$), Especificações Técnicas,
        Adicionar Especificação, Equipamento - Imagem"
    - id: sombra-periodo
      prova:
        "CartaoPeriodo boxShadow rgba(0,0,0,0.1) preservada com
        token-check-allow"
    - id: next-image-web
      prova: "ModalZoomImagem.web.tsx importa next/image"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/equipamentos-admin"
      exit: 0
      verificado_em: "2026-09-25 16:08"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:08"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:08"
  gate:
    arch: pass
    tokens: pass
    vitest_platform: pass
    violacoes_conhecidas:
      - "components/admin/equipment-form/types.ts continua legado
        (Novo/Editar/CartaoPeriodo)"
      - "equipment-units-manager e demais sobras admin fora desta fatia (máx. 3)"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/equipment-form/pricing-period-card.tsx
    - components/admin/equipment-form/specifications-section.tsx
    - components/admin/equipment-form/image-zoom-modal.tsx
  callers_atualizados:
    - packages/frontend/src/pages/equipamentos-admin/ui/Novo.web.tsx
    - packages/frontend/src/pages/equipamentos-admin/ui/Editar.web.tsx
    - packages/frontend/src/pages/equipamentos-admin/ui/Novo.web.test.tsx
    - packages/frontend/src/pages/equipamentos-admin/ui/Editar.web.test.tsx
    - packages/frontend/src/pages/equipamentos-admin/index.ts
  nao_verificado:
    - "[NOT_VERIFIED: formulário novo/editar equipamento no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```
