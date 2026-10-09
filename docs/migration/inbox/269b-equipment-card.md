# 269b-equipment-card

O card de equipamento saiu de `components/equipment-card.tsx` para o widget
`packages/frontend/src/widgets/cartao-equipamento` (regra de produto: preço/dia,
períodos, orçamento). Web preserva Tailwind, textos, variantes
`default|featured|compact` e CTAs via `@gb-locacoes/ui` (QuoteCTA/CTAButton —
não unidos). Native resolve estilo com tokens, sem classes Tailwind da web. Não
restava import do caminho antigo; o legado foi apagado. Estado intermediate; a
migração não está concluída.

```yaml
fatia:
  id: 269b-equipment-card
  estado: intermediate
  conceito: cartão de equipamento com preço/dia, disponibilidade e orçamento
  origem:
    - components/equipment-card.tsx
  destino:
    - packages/frontend/src/widgets/cartao-equipamento/model/tipos.ts
    - packages/frontend/src/widgets/cartao-equipamento/ui/Cartao.web.tsx
    - packages/frontend/src/widgets/cartao-equipamento/ui/Cartao.native.tsx
    - packages/frontend/src/widgets/cartao-equipamento/index.ts
  invariantes:
    - id: variantes-e-textos-web
      prova:
        "Cartao.web.test.tsx: default|featured|compact, Destaque, Popular,
        Disponível/Indisponível, A partir de, /dia, períodos maiores, Ver
        Detalhes, Especificações, avaliações, text-orange-600"
    - id: preco-e-orcamento
      prova:
        "Cartao.web.test.tsx: formatCurrency, QuoteCTA, /orcamento?equipamento="
    - id: nativo-sem-tailwind
      prova:
        "Cartao.web.test.tsx (nativo): react-native + tokens; sem bg-orange-600,
        text-orange-600, hover:shadow, className="
    - id: cta-nao-unido
      prova:
        "Cartao.web.test.tsx: importa QuoteCTA/CTAButton de @gb-locacoes/ui; não
        redefine CTA"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/cartao-equipamento/ui/Cartao.web.test.tsx"
      exit: 0
      verificado_em: "2026-09-25 15:59"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 15:59"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 15:59"
  gate:
    arch: pass
    tokens: pass
    vitest_platform: pass
    violacoes_conhecidas:
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
      - "CTA permanece em packages/ui (não unido a este widget)"
      - "consumidores futuros devem importar
        packages/frontend/src/widgets/cartao-equipamento"
  aposentado:
    - components/equipment-card.tsx
  nao_verificado:
    - "[NOT_VERIFIED: EquipmentCard no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```
