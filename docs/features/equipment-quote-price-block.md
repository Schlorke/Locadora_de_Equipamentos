# Equipment Quote Price Block

> **Caminhos atuais (conferidos em 2026-10-09)**: o componente está em
> `packages/frontend/src/features/bloco-preco/ui/Bloco.web.tsx`;
> `components/equipment-quote-price-block` é o caminho antigo.

## 1. Propósito

Componente reutilizável que exibe o bloco de preço de um equipamento em um
orçamento, garantindo **o mesmo formato DOM** em toda a aplicação (área do
cliente, admin orçamentos, etc.).

**Localização web**:
`packages/frontend/src/features/bloco-preco/ui/Bloco.web.tsx`. Expo usa
`Bloco.native.tsx`; props e variantes ficam em `ui/contract.ts`, publicados
pelos índices web/nativo da feature.

## 2. Formato DOM (design system)

O componente renderiza sempre:

- **Nome do equipamento**: `p.text-sm.font-medium.text-gray-900.mb-2`
- **Preço original** (quando há desconto ou valor direto): label e valor em
  `text-xs.text-gray-500.line-through`
- **Desconto** (quando `variant.kind === 'discount'`): período (ex. Mensal),
  percentual e valor em `text-xs.font-semibold.text-orange-600`
- **Preço final**: label em `text-sm.font-bold.text-gray-900`, valor em
  `text-sm.font-bold.text-green-600`, com `border-t.border-gray-200` antes

O **Frete** não faz parte do componente: deve ser exibido sempre como último
item da lista, na página que usa o componente (ex.: uma linha “Frete: R$ X” após
todos os blocos de equipamento).

Assim, qualquer tela que mostre “orçamento de um equipamento” usa o mesmo layout
e classes.

## 3. Variantes

- **`discount`**: exibe preço original, linha de desconto (ex. “Mensal: -72%” e
  valor em reais) e preço final.
- **`direct`**: exibe preço original e “Valor direto” (valor fixo).
- **`simple`**: exibe apenas “Preço final” e valor.

## 4. Onde é usado

- `pages/historico-detalhe/ui/HistoricoDetalhePage.{web,native}.tsx`: resumo do
  orçamento e itens da locação, na URL `/area-cliente/historico/[id]`.
- `pages/orcamentos-admin/ui/Painel.web.tsx`: painel lateral “Equipamentos e
  Valores” na URL `/admin/orcamentos`. Ambos consomem a API pública da feature.

## 5. Uso

Em `ui/` de uma page do frontend, como `HistoricoDetalhePage.web.tsx`:

```tsx
import { EquipmentQuotePriceBlock } from '../../../features/bloco-preco'

// Com desconto percentual
<EquipmentQuotePriceBlock
  equipmentName={item.equipment.name}
  originalPrice={originalPrice}
  finalPrice={finalPrice}
  variant={{
    kind: 'discount',
    periodLabel: 'Mensal',
    appliedDiscount,
    discountAmount,
  }}
/>

// Apenas preço final (sem desconto)
<EquipmentQuotePriceBlock
  equipmentName={item.equipment.name}
  originalPrice={originalPrice}
  finalPrice={finalPrice}
  variant={{ kind: 'simple' }}
/>
```

## 6. Referências

- Design system: `docs/features/design-system.md`
- Sistema de orçamentos: `docs/features/quote-system.md`
- Página admin orçamentos: `docs/features/admin-orcamentos-page.md`
