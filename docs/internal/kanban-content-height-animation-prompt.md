# Prompt Definitivo V2: Animação de Altura do Conteúdo Kanban

> **Uso**: Cole este documento inteiro em um novo chat para que outro agente de
> IA implemente a animação descrita com 100% de precisão. O prompt combina
> narrativa textual, especificação JSON máquina-parseável, código-fonte completo
> e diagrama de estados visuais.

> **Versão**: 2.0 — 2026-02-19 **Substitui**: V1.0

---

## 0. INSTRUÇÕES PARA O AGENTE EXECUTOR

**ANTES de escrever qualquer código**, você DEVE:

1. Ler `AGENTS.md` (raiz do projeto) — fluxo de trabalho obrigatório
2. Ler `docs/ai/boot.md` — contexto mínimo e ordem de leitura
3. Ler `.cursor/skills/react-best-practices/AGENTS.md` — regras de
   rendering/re-render React
4. Ler `components/admin/kanban-pipeline.tsx` — código-fonte completo (fornecido
   na Seção 4)
5. Ler `components/ui/card.tsx` — implementação base do CardContent (fornecido
   na Seção 4)

**NÃO pule nenhuma etapa.** Mesmo que a tarefa pareça simples, siga o fluxo
completo.

---

## 1. CONTEXTO E OBJETIVO

### 1.1 O Que É o Kanban Pipeline

O componente `KanbanPipeline` (`components/admin/kanban-pipeline.tsx`) é um
quadro Kanban genérico com 4 colunas de status (Pendente, Aprovado, Rejeitado,
Concluído). Cada coluna é um `Card` com header fixo e área de conteúdo
(`CardContent`) que lista os orçamentos (quotes) como cards filhos animados via
Framer Motion.

### 1.2 Objetivo da Tarefa

Implementar uma **animação de altura suave** na área de conteúdo (`CardContent`)
de cada coluna do Kanban, de modo que, quando orçamentos são removidos de uma
coluna, a área de conteúdo **diminua de altura de forma gradual e orgânica** —
nunca de forma abrupta ou instantânea.

### 1.3 Metáfora de UX — "Pia com Ralo" (INTERNALIZAR ANTES DE IMPLEMENTAR)

> **Imagine uma pia cheia de água com uma tampa no ralo.** Quando você remove a
> tampa, a água **não desaparece instantaneamente**. O nível da água **baixa
> gradualmente** até que toda a água escoe pelo ralo.
>
> **Equivalente no Kanban:**
>
> - A "pia" = a área de conteúdo (`CardContent`)
> - A "água" = os orçamentos (cards de quote)
> - "Remover a tampa" = o usuário filtra/move/exclui orçamentos
> - "Nível baixando" = a altura do CardContent diminui suavemente
> - "Pia vazia" = coluna sem itens, CardContent na altura mínima

**O efeito visual desejado**: ao remover N itens de uma coluna, a altura do
bloco de conteúdo transiciona suavemente do tamanho antigo para o novo tamanho,
como se o espaço estivesse sendo "drenado" de baixo para cima.

### 1.4 Direção da Animação (BIDIRECIONAL)

A animação de altura deve funcionar em **ambas as direções**:

| Cenário                                                   | Comportamento Esperado               |
| --------------------------------------------------------- | ------------------------------------ |
| Itens **removidos** (filtragem, mudança de status)        | Altura **diminui** suavemente        |
| Itens **adicionados** (novo orçamento, mudança de filtro) | Altura **aumenta** suavemente        |
| Coluna fica **vazia** (0 itens)                           | Altura diminui até o `min-h` do card |
| Coluna recebe **primeiro item** (0→1)                     | Altura aumenta suavemente do mínimo  |

---

## 2. ANATOMIA DOM — O QUE ANIMAR E O QUE NÃO ANIMAR

### 2.1 Árvore DOM Completa (de fora para dentro)

```
div.grid (KanbanPipeline root) ← NÃO TOCAR — controla layout do grid
│
├── Card (coluna "Pendente") ← NÃO ANIMAR diretamente
│   ├── div[role="banner"] (Header) ← NÃO ANIMAR — fixo, shrink-0
│   └── CardContent ← ★ ALVO PRIMÁRIO DA ANIMAÇÃO ★
│       └── div.scroll-container (overflow-y-auto/hidden)
│           └── div.flex.flex-col.gap-5
│               └── AnimatePresence mode="popLayout"
│                   ├── motion.div (item 1 — exit animation já existe)
│                   ├── motion.div (item 2)
│                   └── motion.div (item N)
│
├── Card (coluna "Aprovado")  ← mesma estrutura
├── Card (coluna "Rejeitado") ← mesma estrutura
└── Card (coluna "Concluído") ← mesma estrutura
```

### 2.2 Mapa de Elementos — ANIMAR vs NÃO ANIMAR

| Elemento                      | Classes Atuais                                                                                                                                           | Ação                                                                           |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `div.grid` (root)             | `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-4`                                                                                    | **NÃO MODIFICAR** — pode adicionar `items-start` se necessário (ver Seção 3.3) |
| `Card` (coluna)               | `bg-white shadow-lg border-0 flex flex-col min-h-[14rem] overflow-hidden max-h-[48rem]`                                                                  | **NÃO ANIMAR** diretamente                                                     |
| `div[role="banner"]` (header) | `relative flex shrink-0 items-center justify-between gap-3 p-4 md:p-6 border-b border-gray-100 rounded-t-lg bg-gradient-to-r from-slate-50 to-slate-100` | **NUNCA ANIMAR** — header fixo                                                 |
| `CardContent`                 | `p-4 flex flex-col flex-1 min-h-0 overflow-hidden`                                                                                                       | **★ ANIMAR ALTURA AQUI ★**                                                     |
| `div` (scroll container)      | `space-y-2 flex-1 overflow-y-auto/hidden pr-2 pt-3 pb-1 min-h-0 max-h-[44rem]`                                                                           | Pode receber `layout` prop se envolvido em `motion.div`                        |
| `div` (items wrapper)         | `flex flex-col gap-5 min-w-0`                                                                                                                            | Pode receber `layout` prop                                                     |
| `AnimatePresence`             | `mode="popLayout" initial={false}`                                                                                                                       | **PRESERVAR** integralmente                                                    |
| `motion.div` (cada item)      | `layout="position"` + variants (hidden/show/exit)                                                                                                        | **PRESERVAR** integralmente                                                    |

### 2.3 Constraint Crítica: CSS Grid e Altura das Colunas

**Problema fundamental**: Em CSS Grid com `align-items: stretch` (padrão), todas
as colunas na mesma row compartilham a mesma altura (= a do maior card). Isso
significa que se a coluna "Aprovado" tem 51 itens e "Pendente" tem 0, ambos os
Cards terão a mesma altura visual — o `CardContent` do "Pendente" terá muito
espaço vazio.

**Por isso** a animação deve ocorrer **dentro do CardContent**, não no Card
externo. O CardContent já tem `flex-1 min-h-0`, então ele preenche o espaço
disponível. A animação deve ser no **conteúdo renderizado** dentro dele (a lista
de itens e o espaço que ocupam).

**Opção avançada (se desejado)**: Adicionar `items-start` ao grid para que cada
Card tenha altura independente. Isso permitiria que cards com poucos itens sejam
visualmente menores. Porém, **isso muda o layout visual** — implementar SOMENTE
se o resultado visual for superior e não quebrar responsividade. Na dúvida,
**não adicionar**.

---

## 3. ESPECIFICAÇÃO TÉCNICA DA ANIMAÇÃO

### 3.1 Especificação JSON (Máquina-Parseável)

```json
{
  "task_id": "kanban-content-height-animation",
  "version": "2.0",
  "target": {
    "file": "components/admin/kanban-pipeline.tsx",
    "component": "KanbanPipeline",
    "animation_target": {
      "element": "CardContent ou wrapper motion.div imediatamente dentro dele",
      "current_classes": "p-4 flex flex-col flex-1 min-h-0 overflow-hidden",
      "dom_position": "Card > (após div[role=banner]) > CardContent"
    },
    "elements_never_animate": [
      {
        "element": "div[role=banner]",
        "reason": "Header fixo com shrink-0, NUNCA participa da animação"
      },
      {
        "element": "Card (container externo)",
        "reason": "Controlado pelo CSS Grid, animação interna apenas"
      },
      {
        "element": "div.grid (root)",
        "reason": "Layout principal do pipeline, não modificar comportamento"
      }
    ]
  },
  "animation": {
    "name": "content-height-drain",
    "direction": "bidirecional (shrink ao remover, grow ao adicionar)",
    "trigger": "Mudança em statusItems.length (itens filtrados por status)",
    "property": "height (ou equivalente via layout animation)",
    "duration_ms": {
      "shrink": "300-500 (mais lento para efeito 'drenagem')",
      "grow": "200-350 (mais rápido para efeito 'preenchimento')"
    },
    "easing": {
      "shrink": "easeOut ([0.0, 0.0, 0.58, 1.0]) — desaceleração natural",
      "grow": "easeInOut ([0.42, 0.0, 0.58, 1.0]) — suave nos dois lados"
    },
    "coordination": {
      "with_exit_animation": "A height transition deve INICIAR após ou durante as exit animations dos itens (delay de ~100ms ou usar onExitComplete)",
      "with_layout_position": "Itens restantes já usam layout='position' — a height animation deve ser coordenada para que os itens reposicionem E o container encolha simultaneamente"
    }
  },
  "dependencies": {
    "framer_motion_version": "^12.34.2 (já instalado)",
    "new_dependencies": "NENHUMA — usar apenas framer-motion já disponível",
    "forbidden": "NÃO instalar pacotes novos (@react-hook/use-measure, auto-animate, etc.)"
  },
  "preservation_rules": {
    "must_preserve_exactly": [
      "AnimatePresence mode='popLayout' initial={false}",
      "motion.div layout='position' com variants (hidden/show/exit)",
      "Stagger timing nos variants (delay: idx * 0.055 enter, idx * 0.04 exit)",
      "onItemClick handler no motion.div",
      "showScroll lógica (overflow-y-auto quando items > 4)",
      "scrollbar styling (webkit + scrollbarWidth/scrollbarColor)",
      "Custom scrollbar gutter (scrollbarGutter: 'stable both-edges')",
      "Tipagem genérica <T extends KanbanItem>",
      "Memoização via useMemo para itemsByStatus"
    ]
  },
  "acceptance_criteria": [
    "AC1: Quando itens saem de uma coluna, a altura visível do conteúdo diminui com animação suave (300-500ms)",
    "AC2: Quando itens entram em uma coluna, a altura visível do conteúdo aumenta com animação suave (200-350ms)",
    "AC3: O header (role=banner) permanece absolutamente fixo — zero movimento",
    "AC4: AnimatePresence exit animation (opacity + y) funciona exatamente como antes",
    "AC5: Layout position animation nos itens restantes funciona como antes",
    "AC6: Responsividade mantida em mobile (1 col), tablet (2 cols), desktop (4 cols)",
    "AC7: Scroll customizado (orange scrollbar) funciona quando items > 4",
    "AC8: Zero flicker, zero layout thrashing, zero salto visual",
    "AC9: Performance: nenhum re-render desnecessário no componente pai",
    "AC10: TypeScript compila sem erros (pnpm type-check)",
    "AC11: Build passa (pnpm build)",
    "AC12: Lint passa (pnpm lint)"
  ],
  "anti_patterns": [
    "NÃO animar o header",
    "NÃO animar o Card externo",
    "NÃO instalar dependências novas",
    "NÃO remover ou alterar AnimatePresence mode='popLayout'",
    "NÃO remover layout='position' dos motion.div filhos",
    "NÃO remover os variants existentes (hidden/show/exit)",
    "NÃO usar height: 'auto' como valor de animate (buggy no framer-motion)",
    "NÃO usar CSS transition em vez de framer-motion (manter consistência)",
    "NÃO causar layout thrashing (leitura/escrita DOM alternadas)",
    "NÃO usar useEffect para medir altura sem cleanup adequado",
    "NÃO alterar estilos ou cores (AGENTS.md regra: não modificar identidade visual)",
    "NÃO criar arquivos novos — toda a mudança é em kanban-pipeline.tsx"
  ]
}
```

### 3.2 Diagrama de Estados Visuais

```
ESTADO A: Coluna com 5 itens
┌─────────────────────┐
│  Header (fixo)      │
├─────────────────────┤
│  [Item 1]           │
│  [Item 2]           │
│  [Item 3]           │  ← CardContent height = H1
│  [Item 4]           │
│  [Item 5]           │
└─────────────────────┘

       │ Usuário remove Item 2 e Item 4
       │ (status muda, filtro aplicado, etc.)
       ▼

ESTADO B (TRANSIÇÃO — 300-500ms):
┌─────────────────────┐
│  Header (fixo)      │  ← ZERO movimento
├─────────────────────┤
│  [Item 1]  ↑        │
│  [Item 3]  ↑        │  ← Itens restantes sobem (layout="position")
│  [Item 5]  ↑        │  ← Altura H1→H2 transiciona suavemente
│  ░░░░░░░░░░░░░░░░░  │  ← Espaço "drenando" (desaparecendo)
│                     │
└─────────────────────┘

       │ Animação completa
       ▼

ESTADO C: Coluna com 3 itens
┌─────────────────────┐
│  Header (fixo)      │
├─────────────────────┤
│  [Item 1]           │
│  [Item 3]           │  ← CardContent height = H2 (menor que H1)
│  [Item 5]           │
│                     │  ← Espaço restante (flex-1 no grid)
└─────────────────────┘
```

### 3.3 Abordagem Recomendada de Implementação

**ABORDAGEM PRIMÁRIA: `layout` prop do Framer Motion no wrapper de conteúdo**

Esta é a abordagem recomendada porque:

- Framer Motion `^12.x` tem suporte maduro para `layout` animations
- Já existe `layout="position"` nos itens filhos — adicionar `layout` no
  container pai é natural
- `AnimatePresence mode="popLayout"` foi projetado para funcionar com `layout`
  animations
- Não requer medir altura manualmente (sem ResizeObserver, sem layout thrashing)

**Implementação passo a passo:**

```tsx
// PASSO 1: Envolver o conteúdo do CardContent em motion.div com layout
<CardContent className="p-4 flex flex-col flex-1 min-h-0 overflow-hidden">
  <motion.div
    layout // ← Anima mudanças de layout (incluindo altura)
    transition={{
      layout: {
        duration: 0.35, // 350ms — meio da faixa 300-500ms
        ease: [0.0, 0.0, 0.58, 1.0] // easeOut — desaceleração natural
      }
    }}
    className={`space-y-2 flex-1 ${showScroll ? "overflow-y-auto" : "overflow-hidden"} ...`}
    style={{
      scrollbarWidth: "thin",
      scrollbarColor: "rgb(249 115 22) transparent",
      scrollbarGutter: showScroll ? "stable both-edges" : undefined
    }}
  >
    <div className="flex flex-col gap-5 min-w-0">
      <AnimatePresence mode="popLayout" initial={false}>
        {/* ... itens existentes sem alteração ... */}
      </AnimatePresence>
    </div>
  </motion.div>
</CardContent>
```

**PASSO 2: Garantir que `overflow-hidden` está no CardContent** (já está —
verificar que permanece).

**PASSO 3: Testar coordenação** — a `layout` animation no wrapper deve acontecer
naturalmente quando os filhos saem via `AnimatePresence`. O `mode="popLayout"`
remove os itens do fluxo imediatamente, permitindo que o `layout` animation
recalcule a altura suavemente.

**ABORDAGEM ALTERNATIVA (se layout sozinho não for suficiente):**

Se a abordagem com `layout` não produzir o efeito visual desejado (por exemplo,
se a transição for abrupta ou se houver conflito com `flex-1`), usar a abordagem
com `LayoutGroup`:

```tsx
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'

// Envolver todo o card em LayoutGroup para coordenar as animations
<LayoutGroup>
  <Card ...>
    <div role="banner" ...>{/* header */}</div>
    <CardContent className="p-4 flex flex-col flex-1 min-h-0 overflow-hidden">
      <motion.div
        layout
        transition={{ layout: { duration: 0.35, ease: 'easeOut' } }}
        className={`space-y-2 flex-1 ...`}
      >
        {/* ... conteúdo ... */}
      </motion.div>
    </CardContent>
  </Card>
</LayoutGroup>
```

**ÚLTIMA ALTERNATIVA (mecanismo explícito):**

Se ambas as abordagens acima falharem, usar medição explícita com `useRef` +
`ResizeObserver` e animar com `animate={{ height: measuredHeight }}`:

```tsx
const contentRef = useRef<HTMLDivElement>(null)
const [contentHeight, setContentHeight] = useState<number | 'auto'>('auto')

useEffect(() => {
  if (!contentRef.current) return
  const observer = new ResizeObserver(([entry]) => {
    setContentHeight(entry.contentRect.height)
  })
  observer.observe(contentRef.current)
  return () => observer.disconnect()
}, [])

<motion.div
  animate={{ height: contentHeight }}
  transition={{ duration: 0.35, ease: 'easeOut' }}
  style={{ overflow: 'hidden' }}
>
  <div ref={contentRef}>
    {/* conteúdo real */}
  </div>
</motion.div>
```

**Ordem de tentativa**: layout → LayoutGroup → ResizeObserver explícito

---

## 4. CÓDIGO-FONTE COMPLETO ATUAL (COPIAR LITERALMENTE)

### 4.1 `components/admin/kanban-pipeline.tsx` (192 linhas)

```tsx
"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { motion, AnimatePresence } from "framer-motion"
import { LucideIcon } from "lucide-react"
import type React from "react"
import { useMemo } from "react"

export interface KanbanStatusConfig {
  key: string
  label: string
  color: string
  icon: LucideIcon
  gradient: string
}

export interface KanbanItem {
  id: string
  status: string
  [key: string]: unknown
}

export interface KanbanPipelineProps<T extends KanbanItem> {
  items: T[]
  statusConfig: Record<string, KanbanStatusConfig>
  renderItem: (_item: T) => React.ReactNode
  onItemClick?: (_item: T) => void
  className?: string
  columnsPerRow?: {
    mobile?: number
    tablet?: number
    desktop?: number
    xl?: number
  }
}

export function KanbanPipeline<T extends KanbanItem>({
  items,
  statusConfig,
  renderItem,
  onItemClick,
  className = "",
  columnsPerRow = {
    mobile: 1,
    tablet: 3,
    desktop: 3,
    xl: 6
  }
}: KanbanPipelineProps<T>) {
  // Agrupar itens por status
  const itemsByStatus = useMemo(() => {
    return Object.keys(statusConfig).reduce(
      (acc, status) => {
        acc[status] = items.filter((item) => item.status === status)
        return acc
      },
      {} as Record<string, T[]>
    )
  }, [items, statusConfig])

  // Mapear valores para classes Tailwind completas (necessário porque Tailwind não suporta classes dinâmicas)
  const getGridColsClass = () => {
    const mobile = columnsPerRow.mobile || 1
    const tablet = columnsPerRow.tablet || 3
    const desktop = columnsPerRow.desktop || 3
    const xl = columnsPerRow.xl || 6

    // Mapear valores para classes completas do Tailwind
    const gridColsMap: Record<number, string> = {
      1: "grid-cols-1",
      2: "grid-cols-2",
      3: "grid-cols-3",
      4: "grid-cols-4",
      5: "grid-cols-5",
      6: "grid-cols-6"
    }

    const mobileCol = gridColsMap[mobile] || "grid-cols-1"
    const tabletCol = gridColsMap[tablet]
      ? `md:${gridColsMap[tablet]}`
      : "md:grid-cols-3"
    const desktopCol = gridColsMap[desktop]
      ? `lg:${gridColsMap[desktop]}`
      : "lg:grid-cols-3"
    const xlCol = gridColsMap[xl] ? `xl:${gridColsMap[xl]}` : "xl:grid-cols-6"

    return `${mobileCol} ${tabletCol} ${desktopCol} ${xlCol}`
  }

  return (
    <div className={`grid ${getGridColsClass()} gap-4 ${className}`}>
      {Object.entries(statusConfig).map(([status, config]) => {
        const statusItems = itemsByStatus[status] || []
        const showScroll = statusItems.length > 4
        const Icon = config.icon

        return (
          <Card
            key={status}
            className="bg-white shadow-lg border-0 flex flex-col min-h-[14rem] overflow-hidden max-h-[48rem]"
            style={{
              maxHeight: "min(48rem, calc(100vh - 140px))"
            }}
          >
            <div
              className="relative flex shrink-0 items-center justify-between gap-3 p-4 md:p-6 border-b border-gray-100 rounded-t-lg bg-gradient-to-r from-slate-50 to-slate-100"
              role="banner"
            >
              <div className="flex items-center gap-2">
                <div
                  className={`p-2 rounded-lg bg-gradient-to-br ${config.gradient}`}
                >
                  <Icon className="w-4 h-4 text-white" aria-hidden />
                </div>
                <h3 className="font-semibold text-sm text-slate-900">
                  {config.label}
                </h3>
              </div>
              <Badge variant="secondary" className="text-xs">
                {statusItems.length}
              </Badge>
            </div>
            <CardContent className="p-4 flex flex-col flex-1 min-h-0 overflow-hidden">
              <div
                className={`space-y-2 flex-1 ${showScroll ? "overflow-y-auto" : "overflow-hidden"} pr-2 pt-3 pb-1 min-h-0 max-h-[44rem] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-orange-500 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-orange-600 [&::-webkit-scrollbar-button]:bg-orange-500`}
                style={{
                  scrollbarWidth: "thin",
                  scrollbarColor: "rgb(249 115 22) transparent",
                  scrollbarGutter: showScroll ? "stable both-edges" : undefined
                }}
              >
                <div className="flex flex-col gap-5 min-w-0">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {Array.isArray(statusItems) &&
                      statusItems.map((item, index) => (
                        <motion.div
                          key={item.id}
                          layout="position"
                          custom={{ index }}
                          variants={{
                            hidden: ({ index: idx }: { index: number }) => ({
                              opacity: 0,
                              x: -16,
                              y: 10,
                              transition: {
                                duration: 0.24,
                                delay: idx * 0.055
                              }
                            }),
                            show: ({ index: idx }: { index: number }) => ({
                              opacity: 1,
                              x: 0,
                              y: 0,
                              transition: {
                                duration: 0.24,
                                delay: idx * 0.055
                              }
                            }),
                            exit: ({ index: idx }: { index: number }) => ({
                              opacity: 0,
                              y: -10,
                              transition: {
                                duration: 0.18,
                                // Stagger normal na saída (primeiro sai primeiro, de cima para baixo)
                                delay: idx * 0.04
                              }
                            })
                          }}
                          initial="hidden"
                          animate="show"
                          exit="exit"
                          className={
                            onItemClick
                              ? "cursor-pointer transition-colors min-w-0"
                              : "min-w-0"
                          }
                          onClick={() => onItemClick?.(item)}
                        >
                          {renderItem(item)}
                        </motion.div>
                      ))}
                  </AnimatePresence>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
```

### 4.2 `components/ui/card.tsx` — CardContent (relevante)

```tsx
const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"
```

**Nota**: O `CardContent` renderiza um `<div>` simples. As classes passadas via
`className` são mergeadas com `cn('p-6 pt-0', className)`, então `p-4`
sobrescreve `p-6 pt-0`. O componente aceita `ref` — útil se precisar medir.

### 4.3 Consumidor — Como o KanbanPipeline é Usado

```tsx
// app/admin/orcamentos/page.tsx (trecho relevante)
const KanbanPipeline = dynamic(
  () => import('@/components/admin/kanban-pipeline').then((m) => ({ default: m.KanbanPipeline })),
  { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-lg bg-gray-100" /> }
)

// Uso:
<KanbanPipeline
  items={kanbanFilteredQuotes}          // ← array reativo — muda quando filtros mudam
  statusConfig={statusConfig}
  onItemClick={(quote) => openQuoteDetails(quote as Quote)}
  columnsPerRow={{ mobile: 1, tablet: 2, desktop: 4, xl: 4 }}
  renderItem={(quote) => {
    // ... renderiza card de orçamento com badge, nome, email, valor, data
  }}
/>
```

**Trigger real da animação**: `kanbanFilteredQuotes` é um array filtrado que
muda quando o usuário aplica filtros de busca, muda de mês, ou quando um
orçamento muda de status via API. A mudança no array causa re-render do
`KanbanPipeline`, que recalcula `itemsByStatus` via `useMemo`, resultando em
novos valores de `statusItems` para cada coluna.

---

## 5. EDGE CASES E CENÁRIOS DE TESTE

| #   | Cenário                                               | Estado Anterior   | Estado Novo         | Comportamento Esperado                                           |
| --- | ----------------------------------------------------- | ----------------- | ------------------- | ---------------------------------------------------------------- |
| 1   | Filtro remove 3 itens de "Aprovado"                   | 51 itens          | 48 itens            | Altura diminui suavemente, scroll ajusta                         |
| 2   | Filtro remove TODOS os itens                          | 51 itens          | 0 itens             | Altura diminui até mínimo, sem crash                             |
| 3   | Filtro adiciona itens (clear filter)                  | 0 itens           | 51 itens            | Altura aumenta suavemente                                        |
| 4   | Mudança de status (1 item sai, entra em outra coluna) | Coluna A: 5, B: 3 | A: 4, B: 4          | Ambas colunas animam simultaneamente                             |
| 5   | Coluna com scroll (>4 itens) perde itens até ≤4       | 6 itens (scroll)  | 3 itens (no scroll) | Transition de overflow-y-auto → overflow-hidden suave            |
| 6   | Coluna sem itens recebe 1 item                        | 0 itens           | 1 item              | Altura cresce suavemente do mínimo                               |
| 7   | Render inicial (mount)                                | N/A               | N itens             | Animação de entrada (initial="hidden" → animate="show") funciona |
| 8   | Mobile (1 coluna)                                     | N/A               | N/A                 | Animação funciona em layout single-column                        |
| 9   | Resize de janela                                      | N/A               | N/A                 | Grid recalcula, animação não quebra                              |

---

## 6. REGRAS DE QUALIDADE DO PROJETO

### 6.1 Regras do AGENTS.md (Aplicáveis)

- **NÃO modifique estilos ou identidade visual** sem solicitação explícita
- **NÃO "melhore" ou "otimize"** além do escopo (apenas a animação de altura)
- **Faça APENAS o que foi pedido**: animação de altura no CardContent
- **Siga os padrões existentes**: Framer Motion, Tailwind, componentes de `ui/`

### 6.2 Regras do React Best Practices (Aplicáveis)

- **Avoid layout thrashing** (Section 7.1): Não intercalar leituras/escritas DOM
- **Use Transitions for Non-Urgent Updates** (Section 5.11): Se houver state
  update para medição, considerar startTransition
- **Narrow Effect Dependencies** (Section 5.6): Se usar useEffect, depender de
  primitivos (length), não do array inteiro
- **Calculate Derived State During Rendering** (Section 5.1): showScroll é
  derivado, não usar useEffect para calculá-lo

### 6.3 Comandos de Validação

```bash
pnpm type-check    # TypeScript deve compilar sem erros
pnpm build         # Build de produção deve passar
pnpm lint          # ESLint deve passar
```

---

## 7. CHECKLIST PÓS-IMPLEMENTAÇÃO

### Funcionalidade

- [ ] AC1: Altura diminui suavemente quando itens saem
- [ ] AC2: Altura aumenta suavemente quando itens entram
- [ ] AC3: Header permanece fixo (zero movimento)
- [ ] AC4: AnimatePresence exit animation intacta
- [ ] AC5: Layout position animation nos itens intacta
- [ ] AC6: Responsividade mantida (1/2/4 colunas)
- [ ] AC7: Scroll customizado funciona com >4 itens
- [ ] AC8: Zero flicker ou salto visual
- [ ] AC9: Nenhum re-render desnecessário

### Qualidade de Código

- [ ] AC10: `pnpm type-check` passa
- [ ] AC11: `pnpm build` passa
- [ ] AC12: `pnpm lint` passa
- [ ] Nenhuma dependência nova instalada
- [ ] Nenhum arquivo novo criado (tudo em kanban-pipeline.tsx)
- [ ] Nenhum estilo/cor alterado

### Documentação (OBRIGATÓRIA — ver AGENTS.md)

- [ ] `CHANGELOG.md` atualizado com data real do commit (`git log --date=short`)

---

## 8. RESUMO EXECUTIVO PARA O AGENTE

**O que fazer**: Adicionar `layout` animation no wrapper do conteúdo dentro do
`CardContent` para que a altura do bloco de conteúdo transicione suavemente
quando itens são adicionados/removidos.

**Onde fazer**: `components/admin/kanban-pipeline.tsx` — apenas este arquivo.

**Como fazer**: Converter o `<div>` scroll container (filho direto do
`CardContent`) em `<motion.div>` com prop `layout` e `transition.layout`
configurada.

**O que preservar**: TUDO exceto a adição da animação. Zero mudanças em estilos,
variants, AnimatePresence, tipagem, ou lógica de negócio.

**O que validar**: Todos os 12 acceptance criteria + checklist + 9 edge cases.
