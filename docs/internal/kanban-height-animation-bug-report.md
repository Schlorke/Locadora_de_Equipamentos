# Bug Report: Animação de altura do Kanban quebra durante busca cross-mês

## Resumo do Problema

No Kanban de orçamentos (`/admin/orcamentos`), cada coluna (status) possui um
wrapper `AnimatedHeight` que usa `ResizeObserver` + `framer-motion` para animar
suavemente a altura do conteúdo quando itens são adicionados/removidos. **Essa
animação funciona perfeitamente para filtragem dentro do mesmo mês**, mas
**quebra quando o usuário pesquisa um orçamento de outro mês** (ex: está em
Fevereiro, pesquisa "OBRA-563" que pertence a Janeiro).

**Comportamento esperado**: A coluna deve animar suavemente de `736px` → `214px`
(ou qualquer altura final). **Comportamento atual**: A coluna muda de `736px` →
`214px` instantaneamente, sem animação nenhuma, ou faz um collapse para ~0px e
depois expande.

---

## Stack Técnico Relevante

- **React 19** (com automatic batching)
- **Next.js 16** (App Router, `'use client'`)
- **framer-motion ^12.34.2**
- **TypeScript strict mode**

---

## Arquitetura dos Componentes

### Hierarquia DOM de uma coluna do Kanban

```
<Card>                                           ← overflow-hidden, flex flex-col, min-h-[14rem]
  <div role="banner">                            ← Header fixo (ícone + label + badge count)
  <AnimatedHeight>                               ← COMPONENTE QUE CONTÉM O BUG
    └ <motion.div animate={{height}} overflow:hidden>  ← Container animado
        └ <div ref={contentRef}>                 ← Div medido pelo ResizeObserver
            └ <div className="p-4 flex flex-col min-h-0">   ← Padding
                └ <div className="space-y-2 overflow-...">   ← Scroll container
                    └ <div className="flex flex-col gap-5">   ← Items container
                        └ <AnimatePresence mode="popLayout">
                            └ <motion.div key={item.id}>      ← Cada item (orçamento)
                                └ {renderItem(item)}
```

### Componente AnimatedHeight (estado atual)

```tsx
// Arquivo: components/admin/kanban-pipeline.tsx (linhas 38-103)
function AnimatedHeight({ children }: { children: React.ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | undefined>(undefined)
  const lastCommitted = useRef(0)

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    let timeoutId: ReturnType<typeof setTimeout>
    let stabilityId: ReturnType<typeof setTimeout>

    const commit = () => {
      const h = el.getBoundingClientRect().height
      lastCommitted.current = h
      setHeight(h)
    }

    const observer = new ResizeObserver(() => {
      clearTimeout(timeoutId)
      clearTimeout(stabilityId)

      timeoutId = setTimeout(() => {
        const h = el.getBoundingClientRect().height
        const prev = lastCommitted.current

        if (prev > 80 && h < 40) {
          stabilityId = setTimeout(commit, 200)
          return
        }

        lastCommitted.current = h
        setHeight(h)
      }, 50)
    })
    observer.observe(el)
    return () => {
      clearTimeout(timeoutId)
      clearTimeout(stabilityId)
      observer.disconnect()
    }
  }, [])

  return (
    <motion.div
      animate={height !== undefined ? { height } : undefined}
      initial={false}
      transition={{
        height: {
          duration: 0.35,
          ease: [0.0, 0.0, 0.58, 1.0]
        }
      }}
      style={{ overflow: "hidden" }}
    >
      <div ref={contentRef}>{children}</div>
    </motion.div>
  )
}
```

### Componente KanbanPipeline (uso do AnimatedHeight)

```tsx
// Arquivo: components/admin/kanban-pipeline.tsx (linhas 105-273)
export function KanbanPipeline<T extends KanbanItem>({
  items, // ← kanbanFilteredQuotes (já filtrado por mês)
  statusConfig, // ← 4 status: pending, approved, rejected, completed
  renderItem,
  onItemClick,
  columnsPerRow // ← { mobile: 1, tablet: 2, desktop: 4, xl: 4 }
}) {
  const itemsByStatus = useMemo(() => {
    return Object.keys(statusConfig).reduce(
      (acc, status) => {
        acc[status] = items.filter((item) => item.status === status)
        return acc
      },
      {} as Record<string, T[]>
    )
  }, [items, statusConfig])

  return (
    <div className="grid ... items-start gap-4">
      {Object.entries(statusConfig).map(([status, config]) => {
        const statusItems = itemsByStatus[status] || []
        return (
          <Card key={status} className="... overflow-hidden">
            {/* Header */}
            <AnimatedHeight>
              <div className="p-4 flex flex-col min-h-0">
                <div className="space-y-2 ...">
                  <div className="flex flex-col gap-5 min-w-0">
                    <AnimatePresence mode="popLayout" initial={false}>
                      {statusItems.map((item, index) => (
                        <motion.div
                          key={item.id}
                          layout="position"
                          custom={{ index }}
                          variants={{
                            hidden: ({ index: idx }) => ({
                              opacity: 0,
                              x: -16,
                              y: 10,
                              transition: { duration: 0.24, delay: idx * 0.055 }
                            }),
                            show: ({ index: idx }) => ({
                              opacity: 1,
                              x: 0,
                              y: 0,
                              transition: { duration: 0.24, delay: idx * 0.055 }
                            }),
                            exit: ({ index: idx }) => ({
                              opacity: 0,
                              y: -10,
                              transition: { duration: 0.18, delay: idx * 0.04 }
                            })
                          }}
                          initial="hidden"
                          animate="show"
                          exit="exit"
                        >
                          {renderItem(item)}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </AnimatedHeight>
          </Card>
        )
      })}
    </div>
  )
}
```

---

## Fluxo de Dados: Busca Cross-Mês (a causa raiz)

### Estado Inicial

- Usuário visualiza **Fevereiro** no Kanban
- `kanbanMonth = 2026-02-01`
- `quotes = [F1, F2, F3, ...]` (orçamentos de fevereiro retornados pela API)
- `kanbanFilteredQuotes = [F1, F2, F3, ...]` (filtrados por fev)
- KanbanPipeline recebe `items = [F1, F2, F3, ...]`
- Coluna "Aprovado" tem height=736px

### Cenário: Usuário digita "OBRA-563" (orçamento de Janeiro)

#### Passo 1: Input + Debounce (350ms)

```
searchTerm = "OBRA-563"
  → useDebounce(searchTerm, 350)
  → 350ms depois: debouncedSearchTerm = "OBRA-563"
```

#### Passo 2: Fetch (assíncrono)

```
debouncedSearchTerm mudou → useEffect → fetchQuotes()
  → API: GET /api/admin/quotes?search=OBRA-563&limit=500
  → Retorna: [{ id: "J1", status: "approved", startDate: "2026-01-15", ... }]
  → setQuotes([J1])  ← STATE UPDATE #1
```

#### Passo 3: RENDER INTERMEDIÁRIO (O PROBLEMA!)

```
React re-renderiza com:
  quotes = [J1]                       ← Novo (Janeiro)
  kanbanMonth = 2026-02-01            ← AINDA Fevereiro!

kanbanFilteredQuotes = useMemo():
  monthStart = 2026-02-01
  monthEnd = 2026-02-28
  J1.startDate = 2026-01-15
  → 2026-01-15 < 2026-02-01 → FILTRADO!

RESULTADO: kanbanFilteredQuotes = []   ← VAZIO!

KanbanPipeline recebe items = []
  → Todas as colunas ficam vazias
  → AnimatePresence: todos os itens de Fev saem (exit animation)
  → Content height cai para ~32px (só padding)
  → ResizeObserver detecta mudança
```

#### Passo 4: Auto-navegação (useEffect, roda DEPOIS do render)

```
useEffect([quotes, viewMode, kanbanMonth, debouncedSearchTerm]):
  currentMonthHasResults = false (J1 não está em Fev)
  firstMonthWithResults = 2026-01-01
  → setKanbanMonth(2026-01-01)  ← STATE UPDATE #2
```

#### Passo 5: RENDER FINAL

```
React re-renderiza com:
  quotes = [J1]
  kanbanMonth = 2026-01-01            ← Agora Janeiro!

kanbanFilteredQuotes = useMemo():
  monthStart = 2026-01-01
  monthEnd = 2026-01-31
  J1.startDate = 2026-01-15
  → Incluído!

RESULTADO: kanbanFilteredQuotes = [J1]

KanbanPipeline recebe items = [J1]
  → Coluna "Aprovado" tem 1 item
  → AnimatePresence: J1 entra (enter animation)
  → Content height vai para ~214px
```

### Diagrama de Timeline

```
t=0ms     searchTerm="OBRA-563"
t=350ms   debouncedSearchTerm="OBRA-563" → fetchQuotes()
t=~600ms  API retorna [J1] → setQuotes([J1])

          ┌─── RENDER 2 (INTERMEDIÁRIO) ───────────────────────┐
          │ quotes=[J1], kanbanMonth=FEV                        │
          │ kanbanFilteredQuotes=[] ← VAZIO!                    │
          │ KanbanPipeline items=[]                             │
          │ AnimatePresence: Feb items exit → height cai ~32px  │
          │ ResizeObserver fires                                │
          └─────────────────────────────────────────────────────┘

t=~602ms  useEffect (auto-nav) → setKanbanMonth(JAN)

          ┌─── RENDER 3 (FINAL) ──────────────────────────────┐
          │ quotes=[J1], kanbanMonth=JAN                        │
          │ kanbanFilteredQuotes=[J1]                            │
          │ KanbanPipeline items=[J1]                           │
          │ AnimatePresence: J1 enters → height sobe ~214px    │
          │ ResizeObserver fires                                │
          └─────────────────────────────────────────────────────┘
```

### Por que o gap entre Render 2 e Render 3 é o problema

O `setKanbanMonth()` é chamado dentro de um `useEffect`, que roda **depois** do
render e do commit no DOM. São **dois ciclos de render separados**:

1. **Render 2**: React commita DOM vazio → browser **pode pintar** →
   ResizeObserver dispara (height ~32px)
2. **Render 3**: React commita DOM com itens Jan → browser pinta →
   ResizeObserver dispara (height ~214px)

A questão crítica é: **o ResizeObserver do Render 2 dispara ANTES do Render 3?**

- Se sim → o debounce de 50ms captura height ~32px → anima 736→32 → depois anima
  32→214 (JITTER)
- Se o gap é <50ms → debounce cancela o primeiro → captura direto height ~214px
  (funciona)

**Na prática, o gap entre renders é ~2-20ms** (dentro do debounce de 50ms). MAS:
o ResizeObserver não dispara no mesmo microtask que o DOM commit — ele dispara
no próximo frame (16ms). Se Render 2 e Render 3 estão em frames diferentes, os
ResizeObservers podem não se cancelar via debounce.

---

## Tentativas de Correção (todas falharam)

### Tentativa 1: Debounce de 100ms no ResizeObserver

**Ideia**: Atrasar a medição para "pular" o estado vazio transitório.
**Resultado**: Não funcionou — o gap entre renders pode ser > 100ms dependendo
do scheduling do browser.

### Tentativa 2: Generation-based key (remount)

**Ideia**: Detectar quando TODOS os IDs de uma coluna mudam (sem sobreposição),
incrementar uma "geração" e usar como `key` no AnimatedHeight → React
unmount/remount → estado fresco. **Resultado**: A animação desapareceu
completamente (height muda instantaneamente sem transição) porque o remount
destrói o estado anterior do `motion.div` — não há "de onde" animar.

### Tentativa 3: Stability guard (pular medições near-zero)

**Ideia**: Se height cai de >80px para <40px, é provavelmente o estado vazio
transitório → esperar 200ms para o conteúdo real chegar. **Resultado**: Não
funcionou — o ResizeObserver pode não disparar novamente após o Render 3 se o
content height final estabilizar num valor que já foi observado, ou o timing dos
dois ResizeObserver callbacks não segue a sequência esperada.

---

## Código Fonte Completo e Atual

### `components/admin/kanban-pipeline.tsx`

```tsx
"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { motion, AnimatePresence } from "framer-motion"
import { LucideIcon } from "lucide-react"
import type React from "react"
import { useMemo, useRef, useState, useEffect } from "react"

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

function AnimatedHeight({ children }: { children: React.ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | undefined>(undefined)
  const lastCommitted = useRef(0)

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    let timeoutId: ReturnType<typeof setTimeout>
    let stabilityId: ReturnType<typeof setTimeout>

    const commit = () => {
      const h = el.getBoundingClientRect().height
      lastCommitted.current = h
      setHeight(h)
    }

    const observer = new ResizeObserver(() => {
      clearTimeout(timeoutId)
      clearTimeout(stabilityId)

      timeoutId = setTimeout(() => {
        const h = el.getBoundingClientRect().height
        const prev = lastCommitted.current

        if (prev > 80 && h < 40) {
          stabilityId = setTimeout(commit, 200)
          return
        }

        lastCommitted.current = h
        setHeight(h)
      }, 50)
    })
    observer.observe(el)
    return () => {
      clearTimeout(timeoutId)
      clearTimeout(stabilityId)
      observer.disconnect()
    }
  }, [])

  return (
    <motion.div
      animate={height !== undefined ? { height } : undefined}
      initial={false}
      transition={{
        height: {
          duration: 0.35,
          ease: [0.0, 0.0, 0.58, 1.0]
        }
      }}
      style={{ overflow: "hidden" }}
    >
      <div ref={contentRef}>{children}</div>
    </motion.div>
  )
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
  const itemsByStatus = useMemo(() => {
    return Object.keys(statusConfig).reduce(
      (acc, status) => {
        acc[status] = items.filter((item) => item.status === status)
        return acc
      },
      {} as Record<string, T[]>
    )
  }, [items, statusConfig])

  const getGridColsClass = () => {
    const mobile = columnsPerRow.mobile || 1
    const tablet = columnsPerRow.tablet || 3
    const desktop = columnsPerRow.desktop || 3
    const xl = columnsPerRow.xl || 6
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
    <div
      className={`grid ${getGridColsClass()} items-start gap-4 ${className}`}
    >
      {Object.entries(statusConfig).map(([status, config]) => {
        const statusItems = itemsByStatus[status] || []
        const showScroll = statusItems.length > 4
        const Icon = config.icon
        return (
          <Card
            key={status}
            className="bg-white shadow-lg border-0 flex flex-col min-h-[14rem] overflow-hidden max-h-[48rem]"
            style={{ maxHeight: "min(48rem, calc(100vh - 140px))" }}
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
            <AnimatedHeight>
              <div className="p-4 flex flex-col min-h-0">
                <div
                  className={`space-y-2 ${showScroll ? "overflow-y-auto" : "overflow-hidden"} pr-2 pt-3 pb-1 min-h-0 max-h-[44rem] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-orange-500 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-orange-600 [&::-webkit-scrollbar-button]:bg-orange-500`}
                  style={{
                    scrollbarWidth: "thin",
                    scrollbarColor: "rgb(249 115 22) transparent",
                    scrollbarGutter: showScroll
                      ? "stable both-edges"
                      : undefined
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
              </div>
            </AnimatedHeight>
          </Card>
        )
      })}
    </div>
  )
}
```

### Fluxo de dados na page (trechos relevantes de `app/admin/orcamentos/page.tsx`)

```tsx
// Linha 411-412: States
const [searchTerm, setSearchTerm] = useState('')
const debouncedSearchTerm = useDebounce(searchTerm, 350)

// Linha 428-430: Estado do mês
const [kanbanMonth, setKanbanMonth] = useState<Date>(() => startOfMonth(new Date()))

// Linha 769-840: Fetch (chamado quando debouncedSearchTerm muda)
const fetchQuotes = useCallback(async () => {
  const params = new URLSearchParams({
    page: isKanban ? '1' : String(currentPage),
    limit: isKanban ? '500' : String(pageSize),
  })
  if (normalizedSearchTerm !== '') params.append('search', normalizedSearchTerm)
  const response = await fetch(`/api/admin/quotes?${params}`)
  const data = await response.json()
  setQuotes(normalizedQuotes) // ← STATE UPDATE #1
}, [currentPage, pageSize, debouncedSearchTerm, statusFilter, periodFilter, valueFilter])

// Linha 1153-1155: Trigger do fetch
useEffect(() => { fetchQuotes() }, [fetchQuotes])

// Linha 1158-1169: Filtragem por mês (SÍNCRONO via useMemo)
const kanbanFilteredQuotes = useMemo(() => {
  if (viewMode !== 'kanban') return quotes
  const monthStart = startOfMonth(kanbanMonth)
  const monthEnd = endOfMonth(kanbanMonth)
  return quotes.filter((quote) => {
    const ref = quote.startDate ? new Date(quote.startDate) : new Date(quote.createdAt)
    if (isNaN(ref.getTime())) return true
    return ref >= monthStart && ref <= monthEnd
  })
}, [quotes, viewMode, kanbanMonth])

// Linha 1173-1206: Auto-navegação de mês (useEffect — roda DEPOIS do render)
useEffect(() => {
  if (viewMode !== 'kanban') return
  if (debouncedSearchTerm.trim() === '') return
  if (quotes.length === 0) return

  const currentMonthHasResults = quotes.some((quote) => {
    const ref = quote.startDate ? new Date(quote.startDate) : new Date(quote.createdAt)
    if (isNaN(ref.getTime())) return false
    return ref >= currentMonthStart && ref <= currentMonthEnd
  })
  if (currentMonthHasResults) return

  const firstMonthWithResults = quotes
    .map((q) => { /* extrai mês */ })
    .filter(Boolean)
    .sort((a, b) => a.getTime() - b.getTime())[0]

  if (!firstMonthWithResults) return
  setKanbanMonth(firstMonthWithResults) // ← STATE UPDATE #2 (useEffect, pós-render)
}, [quotes, viewMode, kanbanMonth, debouncedSearchTerm])

// Linha 2143-2153: Renderização do KanbanPipeline
<KanbanPipeline
  items={kanbanFilteredQuotes}  // ← Passa os quotes filtrados por mês
  statusConfig={statusConfig}
  onItemClick={(quote) => openQuoteDetails(quote as Quote)}
  columnsPerRow={{ mobile: 1, tablet: 2, desktop: 4, xl: 4 }}
  renderItem={(quote) => { /* ... */ }}
/>
```

### Hook useDebounce (`hooks/use-debounce.ts`)

```tsx
export function useDebounce<T>(value: T, delay: number = 350): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)
    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])
  return debouncedValue
}
```

---

## A Causa Raiz (em detalhe)

O problema é um **estado vazio transitório** causado por dois state updates em
ciclos de render separados:

1. **`setQuotes([J1])`** — resultado da API com orçamento de Janeiro
2. **`setKanbanMonth(Janeiro)`** — auto-navegação via `useEffect` (roda DEPOIS
   do render)

Entre os dois, `kanbanFilteredQuotes` é um `useMemo` que depende de
`[quotes, kanbanMonth]`. Quando `quotes` muda mas `kanbanMonth` ainda é
Fevereiro, o filtro exclui todos os itens → array vazio → todas as colunas ficam
sem itens → **AnimatePresence remove tudo** → **content height cai para ~32px**
→ **ResizeObserver captura essa altura**.

Só depois do Render 2 commitar e os effects rodarem é que
`setKanbanMonth(Janeiro)` é chamado, causando o Render 3 com os itens corretos.

### Por que debounce no ResizeObserver não resolve

O gap entre Render 2 e Render 3 é variável (~2-50ms tipicamente), mas o
ResizeObserver dispara **por frame** (a cada ~16ms). Se os dois renders caem em
frames diferentes:

- Frame N: DOM vazio commitado → ResizeObserver scheduled
- Frame N callback: ResizeObserver fires com height ~32px → timeout de 50ms
  inicia
- Frame N+1: DOM com Jan items commitado → ResizeObserver scheduled
- Frame N+1 callback: ResizeObserver fires com height ~214px → timeout
  cancelado + novo timeout de 50ms

Neste cenário otimista, o debounce funciona. MAS se:

- Os renders estão no mesmo frame (React 18 batching) → apenas UM ResizeObserver
  callback
- O scheduling do browser ou GC causa delays > 50ms entre callbacks
- O `AnimatePresence mode="popLayout"` causa múltiplos reflows intermediários

...o debounce pode não funcionar de forma confiável.

---

## O que o AnimatedHeight precisa fazer

### Caso 1: Filtragem normal (dentro do mesmo mês) ✅ Funciona

- Items mudam gradualmente (alguns saem, alguns entram)
- Height muda suavemente de 500→400px
- AnimatedHeight anima normalmente

### Caso 2: Busca cross-mês ❌ Quebrado

- Items passam por: `[Feb items]` → `[]` → `[Jan items]`
- Height passa por: `736px` → `~32px` → `214px`
- AnimatedHeight deveria animar: `736px` → `214px` (ignorando o ~32px)

### Caso 3: Coluna fica legitimamente vazia ✅ Deve funcionar

- Items mudam de `[A, B, C]` → `[]`
- Height muda de 400px → ~32px
- AnimatedHeight deve animar: `400px` → `32px`

---

## Possível Solução Alternativa: Eliminar o estado vazio transitório na fonte

Em vez de tentar contornar o problema no `AnimatedHeight`, a solução mais
robusta seria **eliminar o render intermediário com array vazio**. Isso pode ser
feito no `app/admin/orcamentos/page.tsx` unificando os dois state updates:

### Opção A: Computar o mês correto ANTES de setar os quotes

```tsx
// Dentro do fetchQuotes callback, ANTES de setQuotes:
const fetchQuotes = useCallback(async () => {
  // ... fetch logic ...
  const normalizedQuotes = quotesArray.map(...)

  // Se é busca no Kanban, verificar se precisa mudar de mês
  if (isKanban && normalizedSearchTerm !== '') {
    const currentMonthStart = startOfMonth(kanbanMonth)
    const currentMonthEnd = endOfMonth(kanbanMonth)
    const currentMonthHasResults = normalizedQuotes.some((q) => {
      const ref = q.startDate ? new Date(q.startDate) : new Date(q.createdAt)
      return ref >= currentMonthStart && ref <= currentMonthEnd
    })
    if (!currentMonthHasResults) {
      const firstMonth = /* ... calcular primeiro mês com resultados ... */
      if (firstMonth) {
        // BATCH: ambos os states atualizam no MESMO render
        setKanbanMonth(firstMonth)
      }
    }
  }

  setQuotes(normalizedQuotes)
}, [...])
```

Dentro de um event handler ou callback assíncrono, React 18 batcha múltiplos
`setState` no mesmo render. Assim, `kanbanFilteredQuotes` recalcula com `quotes`
E `kanbanMonth` já atualizados → sem estado vazio intermediário.

### Opção B: Manter o useEffect mas com ref para evitar render intermediário

Usar um `useRef` para "atrasar" a propagação dos quotes até que o mês esteja
correto.

### Opção C: Resolver dentro do AnimatedHeight

Se preferir não mexer na page, o AnimatedHeight precisa de uma solução que:

1. Detecte quedas abruptas de altura (>50% em <100ms)
2. "Congele" a altura atual por ~300ms
3. Depois anime para a altura final (que já terá o conteúdo correto)

---

## Restrições e Considerações

1. A animação de height **FUNCIONA** corretamente para filtragem dentro do mesmo
   mês — não pode ser quebrada
2. O `AnimatePresence mode="popLayout"` é necessário para as animações de
   entrada/saída dos cards
3. O `layout="position"` em cada `motion.div` item é necessário para reordenação
   suave
4. O `overflow: hidden` no `motion.div` do AnimatedHeight é necessário para
   clipar conteúdo durante a animação de altura
5. A grid usa `items-start` para permitir alturas independentes por coluna
6. O `Card` pai tem `overflow-hidden` e `min-h-[14rem]`
7. framer-motion versão `^12.34.2`
