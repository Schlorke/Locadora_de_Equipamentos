# 📑 CategoryShowcase Component

> **Status**: ✅ Implementado (Novembro 2025) **Localização**:
> `packages/frontend/src/features/abas-categoria/ui/Abas.web.tsx` **Substitui**:
> `components/tabbed-category-grid.tsx` e `components/ui/tabs.tsx`

## 🔁 Migração

O `CategoryShowcase` é a evolução direta do antigo `TabbedCategoryGrid`. Ele
concentra toda a lógica de tabs, animações e swipe em um único componente, evita
dependência do wrapper Radix Tabs e utiliza diretamente os ícones customizados
do projeto.

Principais diferenças da versão anterior:

- ✅ Tabs renderizadas com o novo layout premium da página inicial
- ✅ Swipe horizontal nativo com sobreposição animada
- ✅ Ícones customizados reutilizados em todas as abas
- ✅ API compatível (`tabs`, `defaultTab`, `onCategoryClickAction`, `gridCols`)
- ❌ Não depende mais de `components/ui/tabs.tsx` (removido)
- ❌ Arquivo `components/tabbed-category-grid.tsx` foi removido

## 🚀 Uso Rápido

Exemplo em `ui/` de widget/page do frontend, usando a API pública da feature:

```tsx
import {
  CategoryShowcase,
  type CategoryItem,
  type TabConfig
} from "../../../features/abas-categoria"
import { CadeiraEletrica } from "@gb-locacoes/ui"

const tabs: TabConfig[] = [
  {
    value: "categorias",
    label: "Categorias",
    categories: [
      { id: "1", name: "Acesso e elevação", icon: CadeiraEletrica }
      // ... demais itens
    ]
  }
  // ... demais tabs
]

export function Example() {
  return (
    <CategoryShowcase
      tabs={tabs}
      defaultTab="categorias"
      gridCols={{ base: 2, md: 3, lg: 4 }}
      onCategoryClickAction={(category) =>
        console.log("Categoria selecionada:", category)
      }
    />
  )
}
```

## 🧱 Props

| Propriedade             | Tipo                                                       | Obrigatório | Descrição                               |
| ----------------------- | ---------------------------------------------------------- | ----------- | --------------------------------------- |
| `tabs`                  | `TabConfig[]`                                              | ✅          | Lista de abas e categorias renderizadas |
| `defaultTab`            | `string`                                                   | ❌          | Valor inicial (fallback = primeira tab) |
| `onCategoryClickAction` | `(category: CategoryItem) => void`                         | ❌          | Callback disparado ao clicar em um card |
| `className`             | `string`                                                   | ❌          | Classe extra aplicada ao container raiz |
| `gridCols`              | `{ base?: number; sm?: number; md?: number; lg?: number }` | ❌          | Controla colunas por breakpoint         |

### `CategoryItem`

```ts
export type CategoryItem = {
  id: string
  name: string
  icon: ComponentType<CustomIconProps>
}
```

### `TabConfig`

```ts
export type TabConfig = {
  value: string
  label: string
  categories: CategoryItem[]
}
```

## 🎨 Visual

- Cartões `h-[120px]` com gradiente `from-slate-800` → `to-slate-900`
- Ícones com gradiente laranja e glow apenas no hover (`group-hover`)
- Texto branco com transição para laranja no hover
- Underline gradiente sincronizado com estado ativo
- Container sem `overflow` para preservar sombras

## 🌀 Animações

- Entrada/saída dos cards utiliza `framer-motion` (`AnimatePresence`)
- Delay incremental `index * 0.08` nas transições
- Swipe horizontal com overlay que desliza na direção do gesto
- Retorno do container controlado por `useMotionValue`
- Largura do painel do swipe é cacheada via `ResizeObserver` para evitar leitura
  de layout durante o gesto
- Container do swipe e overlay usam `will-change: transform` para favorecer a
  composição em mobile

## 📱 Responsividade

- Mobile: `grid-cols-2` (config padrão) e tabs empilhadas
- Tablet: `md:grid-cols-3`
- Desktop: `lg:grid-cols-4` (config via `gridCols`)
- Gestos de swipe disponíveis em qualquer breakpoint

## 🧠 Boas Práticas

1. Reutilize os ícones customizados (`packages/ui/src/icons`) para consistência
2. Garanta que `id` seja único para cada categoria (usado em `key` e callbacks)
3. Utilize `className` externo apenas para ajustes de layout, não para
   sobrescrever o estilo dos cards (manter identidade visual)
4. Em páginas com largura limitada, ajuste `gridCols` para evitar overflow
5. Mantenha `ul`/`li` como `role="presentation"` para que os tabs sejam filhos
   diretos do `tablist`

## 🔧 Integração com a Home

O `EquipmentShowcaseSection` já consome este componente diretamente:

```tsx
<CategoryShowcase
  tabs={tabsConfig}
  defaultTab="mais-alugados"
  onCategoryClickAction={handleCategoryClick}
  gridCols={{ base: 2, sm: 2, md: 3, lg: 4 }}
/>
```

## 🐛 Troubleshooting

| Sintoma                       | Possível causa                           | Solução                                      |
| ----------------------------- | ---------------------------------------- | -------------------------------------------- |
| Underline desalinhado         | CSS externo adicionando `border-bottom`  | Remover estilo manual ou envolver em wrapper |
| Swipe não troca de tab        | `tabs` com apenas uma entrada            | Verifique array de tabs                      |
| Swipe nao inicia no card      | Drag ignorado em elementos `button`      | Iniciar drag via `dragControls` no painel    |
| Ícone não renderiza           | Ícone custom sem `size/color` suportados | Ajuste componente para aceitar props padrão  |
| Grid quebra em telas pequenas | Muitas colunas no `gridCols.base`        | Reduza valor base (2 recomendado)            |

## 🗃 Histórico

- **2025-11-07**: Migração completa da home para `CategoryShowcase`
- **2025-11-07**: Remoção de `components/ui/tabs.tsx`
- **2025-11-07**: Playground oficial movido para `app/playground/page.tsx`
  (antigo `/test-components`)
