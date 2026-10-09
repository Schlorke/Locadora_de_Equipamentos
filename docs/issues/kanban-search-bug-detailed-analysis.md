# Bug: Busca no Kanban de Orçamentos não renderiza os cards

## Resumo Executivo

Na página `/admin/orcamentos`, ao buscar por código de orçamento (ex.:
`OBRA-563`) na visualização Kanban, o **Badge da coluna mostra a contagem
correta** (ex.: "Aprovado 1") mas **nenhum card é renderizado** dentro da
coluna. O dado chega até o componente, mas o sistema de animação do
`KanbanPipeline` engole os itens.

---

## Arquitetura do Fluxo de Dados (ponta a ponta)

```
[Input de busca]
    ↓
searchTerm (estado React)
    ↓ (useDebounce, 350ms)
debouncedSearchTerm
    ↓ (dependência do useCallback fetchQuotes)
fetchQuotes()  →  GET /api/admin/quotes?page=1&limit=500&search=OBRA-563
    ↓
API: Prisma where.OR (quoteCode, legacyExternalCode, name, email, phone, company, id)
    ↓
setQuotes(normalizedQuotes)     ← state `quotes` (todos os resultados da API)
    ↓
kanbanFilteredQuotes (useMemo)  ← filtra `quotes` pelo mês selecionado (kanbanMonth)
    ↓
<KanbanPipeline items={kanbanFilteredQuotes} />
    ↓
itemsByStatus (useMemo)         ← agrupa items por status → { approved: [...], pending: [...] }
    ↓
displayedItems (useState)       ← buffer intermediário para controle de animações
    ↓
Badge usa itemsByStatus.length  ← ✅ MOSTRA CONTAGEM CORRETA
Cards usam displayedItems       ← ❌ FICA VAZIO, CARDS NÃO RENDERIZAM
```

---

## Arquivo 1: `app/api/admin/quotes/route.ts` (API)

**Status: Provavelmente OK** — A API retorna dados (o Badge mostra contagem 1).

```typescript
// Linha 239-248: Filtro de busca
if (search) {
  where.OR = [
    { id: { contains: search, mode: "insensitive" } },
    { quoteCode: { contains: search, mode: "insensitive" } },
    { legacyExternalCode: { contains: search, mode: "insensitive" } },
    { name: { contains: search, mode: "insensitive" } },
    { email: { contains: search, mode: "insensitive" } },
    { phone: { contains: search, mode: "insensitive" } },
    { company: { contains: search, mode: "insensitive" } }
  ]
}
```

**Ponto de atenção**: A API também aplica filtros `period` e `valueRange` se não
forem `'all'`. No frontend, esses filtros SÃO enviados mesmo em modo Kanban
(linhas 785-790 do page.tsx). Se o usuário tiver algum filtro de período/valor
ativo, isso pode eliminar resultados da API.

### Modelo Prisma relevante

```prisma
model Quote {
  id                  String        @id @default(cuid())
  quoteCode           String?       @unique
  legacyExternalCode  String?
  name                String
  email               String
  phone               String
  company             String?
  startDate           DateTime?
  createdAt           DateTime      @default(now())
  status              QuoteStatus   @default(PENDING)  // PENDING, APPROVED, REJECTED, COMPLETED
  // ... demais campos
}
```

---

## Arquivo 2: `app/admin/orcamentos/page.tsx` (Página principal)

### 2.1 Busca e fetch (linhas 411-833)

```typescript
const [searchTerm, setSearchTerm] = useState("")
const debouncedSearchTerm = useDebounce(searchTerm, 350)

const fetchQuotes = useCallback(async () => {
  const isKanban = viewModeRef.current === "kanban"
  const params = new URLSearchParams({
    page: isKanban ? "1" : String(currentPage),
    limit: isKanban ? "500" : String(pageSize) // 500 para Kanban
  })
  if (debouncedSearchTerm) {
    params.append("search", debouncedSearchTerm) // ⚠️ Não faz trim()
  }
  // Em Kanban NÃO envia status (todas as colunas precisam de todos os status)
  if (!isKanban && statusFilter !== "all") {
    params.append("status", statusFilter.toUpperCase())
  }
  // ⚠️ Period e valueRange SÃO enviados mesmo em Kanban
  if (periodFilter !== "all") params.append("period", periodFilter)
  if (valueFilter !== "all") params.append("valueRange", valueFilter)

  const response = await fetch(`/api/admin/quotes?${params}`)
  const data = await response.json()
  const normalizedQuotes = quotesArray.map(normalizeQuote)
  setQuotes(normalizedQuotes) // ← atualiza state principal
  return normalizedQuotes
}, [
  normalizeQuote,
  currentPage,
  pageSize,
  debouncedSearchTerm,
  statusFilter,
  periodFilter,
  valueFilter
])
```

### 2.2 Filtro por mês do Kanban (linhas 1150-1162) — PROBLEMA #1

```typescript
const kanbanFilteredQuotes = useMemo(() => {
  if (viewMode !== "kanban") return quotes
  const monthStart = startOfMonth(kanbanMonth)
  const monthEnd = endOfMonth(kanbanMonth)
  return quotes.filter((quote) => {
    const ref = quote.startDate
      ? new Date(quote.startDate)
      : new Date(quote.createdAt)
    if (isNaN(ref.getTime())) return true
    return ref >= monthStart && ref <= monthEnd // ← FILTRA POR MÊS SEMPRE
  })
}, [quotes, viewMode, kanbanMonth])
```

**Problema**: Este `useMemo` SEMPRE filtra por mês, mesmo com busca ativa. Se o
orçamento buscado estiver em um mês diferente do `kanbanMonth`, ele é
descartado. **NÃO existe auto-navegação** para o mês correto no código atual.

**Mas**: O screenshot mostra o Badge "Aprovado 1", o que significa que
`kanbanFilteredQuotes` INCLUI o quote (o usuário está no mês certo). O problema
real está no KanbanPipeline.

### 2.3 Wrapping com AnimatePresence no pai (linhas 2088-2098)

```tsx
<AnimatePresence mode="wait">
  <motion.div
    key={`kanban-${kanbanMonth.getFullYear()}-${kanbanMonth.getMonth()}`}
    initial={kanbanMonthHasMounted.current ? { opacity: 0 } : false}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.2 }}
    onAnimationComplete={() => { kanbanMonthHasMounted.current = true }}
  >
    <KanbanPipeline items={kanbanFilteredQuotes} ... />
  </motion.div>
</AnimatePresence>
```

**Relevância**: Quando `kanbanMonth` muda, a `key` muda, o `motion.div` velho
sai (200ms) e um novo entra. O `KanbanPipeline` é **desmontado e remontado**
(perde estado interno). Isso é relevante para entender o ciclo de vida.

### 2.4 Contagem de itens por mês (linhas 637-649)

```typescript
const itemCountsByMonth = useMemo(() => {
  const counts: Record<string, number> = {}
  quotes.forEach((quote) => {
    // ← usa `quotes` (NÃO kanbanFilteredQuotes)
    const ref = quote.startDate
      ? new Date(quote.startDate)
      : new Date(quote.createdAt)
    if (!isNaN(ref.getTime())) {
      const key = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`
      counts[key] = (counts[key] || 0) + 1
    }
  })
  return counts
}, [quotes])
```

Isso alimenta o `KanbanMonthNavigator` com os badges de contagem por mês.

---

## Arquivo 3: `components/admin/kanban-pipeline.tsx` — PROBLEMA PRINCIPAL

Este é o componente genérico do Kanban. O bug está no sistema de animação de
duas fases.

### 3.1 Estrutura de dados

```typescript
// Agrupa items recebidos via props por status
const itemsByStatus = useMemo(() => {
  return Object.keys(statusConfig).reduce(
    (acc, status) => {
      acc[status] = items.filter((item) => item.status === status)
      return acc
    },
    {} as Record<string, T[]>
  )
}, [items, statusConfig])

// BUFFER de animação — intermediário entre itemsByStatus e a renderização
const [displayedItems, setDisplayedItems] =
  useState<Record<string, T[]>>(itemsByStatus)

// Ref para armazenar itens que estão esperando a animação de saída completar
const pendingItemsRef = useRef<Record<string, T[] | null>>({})
```

### 3.2 Efeito de sincronização — ONDE O BUG MORA (linhas 72-105)

```typescript
useEffect(() => {
  setDisplayedItems((prev) => {
    let changed = false
    const nextDisplayed: Record<string, T[]> = { ...prev }

    Object.keys(statusConfig).forEach((status) => {
      const current = prev[status] ?? [] // displayedItems atual
      const next = itemsByStatus[status] ?? [] // novos dados

      const same =
        current.length === next.length &&
        current.every((item, idx) => item.id === next[idx]?.id)

      if (same) {
        nextDisplayed[status] = current
        return
      }

      changed = true

      if (current.length > 0) {
        // ⚠️ CAMINHO PROBLEMÁTICO:
        // 1. Armazena novos itens no ref (pendente)
        pendingItemsRef.current[status] = next
        // 2. Esvazia displayedItems para disparar animação de EXIT
        nextDisplayed[status] = []
        // 3. Espera que onExitComplete chame handleExitComplete para preencher
        return
      }

      // Coluna vazia → atualiza imediatamente
      nextDisplayed[status] = next
    })

    return changed ? nextDisplayed : prev
  })
}, [itemsByStatus, statusConfig])
```

### 3.3 Callback que deveria preencher após animação (linhas 107-116)

```typescript
const handleExitComplete = (status: string) => {
  const pending = pendingItemsRef.current[status]
  if (pending) {
    pendingItemsRef.current[status] = null
    setDisplayedItems((prev) => ({
      ...prev,
      [status]: pending
    }))
  }
}
```

### 3.4 Renderização com AnimatePresence (linhas 185-245)

```tsx
<AnimatePresence mode="wait" onExitComplete={() => handleExitComplete(status)}>
  <motion.div
    // ⚠️ Key muda quando os IDs dos itens mudam
    key={`column-${status}-${(displayedStatusItems ?? []).map((i) => i.id).join("-")}`}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0 }} // ← wrapper tem duration 0
  >
    {displayedStatusItems.map((item, index) => (
      <motion.div
        key={item.id}
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
  </motion.div>
</AnimatePresence>
```

---

## Diagnóstico: Por que o card não aparece

### O ciclo de animação de duas fases

Quando `items` muda (ex.: busca retorna resultados diferentes):

```
Fase 1 — EXIT:
  itemsByStatus["approved"] = [OBRA-563]          ← novo dado
  displayedItems["approved"] = [cards antigos]    ← dado exibido
  → efeito detecta diferença
  → pendingItemsRef["approved"] = [OBRA-563]      ← armazena pendente
  → displayedItems["approved"] = []               ← ESVAZIA para disparar exit
  → AnimatePresence: key muda → cards antigos saem com animação

Fase 2 — ENTER (deveria acontecer):
  → onExitComplete dispara
  → handleExitComplete("approved") lê pendingItemsRef → [OBRA-563]
  → displayedItems["approved"] = [OBRA-563]       ← PREENCHE
  → AnimatePresence: key muda → card OBRA-563 entra com animação
```

### O que falha

**`onExitComplete` NÃO dispara** (ou dispara mas não aplica). Possíveis causas:

1. **Race condition com Framer Motion `mode="wait"`**: O wrapper `motion.div`
   tem `transition: { duration: 0 }` mas os filhos (cards) têm durações reais
   (0.18s + stagger). `AnimatePresence mode="wait"` pode ter comportamento
   inconsistente quando o pai sai com duration 0 mas os filhos ainda têm
   animações de exit pendentes.

2. **Double animation cycle**: Quando `displayedItems` é esvaziado, a key muda
   de `column-approved-oldId1-oldId2` para `column-approved-` (vazio). O
   primeiro `onExitComplete` dispara e seta `[OBRA-563]`. A key muda novamente
   para `column-approved-obra563Id`. Isso dispara OUTRO ciclo exit/enter. O
   segundo `onExitComplete` vê `pendingItemsRef = null` e não faz nada. Mas
   entre o primeiro e o segundo ciclo, o `OBRA-563` deveria ter aparecido. Se o
   segundo exit esconde antes que o enter complete, o card fica invisível.

3. **Componente desmonta no meio da animação**: Se o `kanbanMonth` muda ao mesmo
   tempo (ex.: usuário clicou em outro mês enquanto a busca estava processando),
   o pai `AnimatePresence` desmonta o `KanbanPipeline` antes de `onExitComplete`
   disparar.

4. **React 18 batching + strictMode**: Em dev, React pode rodar o efeito de
   sincronização duas vezes, criando estado inconsistente nos refs.

### Evidência do screenshot

- **Badge "Aprovado 1"** → `itemsByStatus["approved"].length = 1` → o dado ESTÁ
  no componente
- **Coluna vazia** → `displayedItems["approved"] = []` → o buffer de animação
  está vazio
- **Conclusão**: O efeito na linha 92-96 esvaziou `displayedItems`, mas
  `handleExitComplete` nunca preencheu de volta

---

## Resumo dos dois problemas independentes

### Problema A: `kanbanFilteredQuotes` filtra por mês mesmo com busca ativa

**Arquivo**: `app/admin/orcamentos/page.tsx`, linhas 1150-1162

**Impacto**: Se o orçamento buscado estiver em um mês diferente do selecionado
no `KanbanMonthNavigator`, ele é descartado antes de chegar ao `KanbanPipeline`.
Não existe auto-navegação para o mês correto.

**Solução**: Quando `debouncedSearchTerm.trim()` não for vazio e
`viewMode === 'kanban'`, retornar `quotes` sem filtrar por mês.

### Problema B: `displayedItems` do KanbanPipeline fica vazio permanentemente

**Arquivo**: `components/admin/kanban-pipeline.tsx`, linhas 72-116 + 185-244

**Impacto**: Mesmo quando o dado chega corretamente ao componente
(`itemsByStatus` tem o item), o buffer de animação `displayedItems` é esvaziado
na Fase 1 e nunca preenchido na Fase 2 porque `onExitComplete` não dispara de
forma confiável.

**Este é o bug que o screenshot demonstra** — Badge mostra 1, card não aparece.

**Possíveis soluções**:

1. **Eliminar o sistema de duas fases**: Atualizar `displayedItems` diretamente
   (sem esvaziar) e usar `AnimatePresence` com keys individuais por card (não
   por coluna inteira) para gerenciar enter/exit de cada card independentemente.

2. **Adicionar fallback timeout**: Após N ms, se `pendingItemsRef` ainda tiver
   dados pendentes, forçar o `setDisplayedItems`. (Tentado mas não resolveu —
   pode ser que o timeout de 500ms não foi suficiente, ou a lógica de detecção
   falhou.)

3. **Remover `mode="wait"` do AnimatePresence interno**: Usar `mode="popLayout"`
   ou sem mode, permitindo que enter e exit aconteçam simultaneamente. Isso
   evita a dependência de `onExitComplete`.

4. **Simplificar radicalmente**: Remover `displayedItems` completamente e
   renderizar direto de `itemsByStatus`. Usar apenas as variants dos cards
   individuais para animação, sem o wrapper com key composta.

---

## Arquivos para modificar

| Arquivo                                | O que mudar                                                                       |
| -------------------------------------- | --------------------------------------------------------------------------------- |
| `components/admin/kanban-pipeline.tsx` | Reescrever sistema de animação (linhas 62-116, 185-244) — problema principal      |
| `app/admin/orcamentos/page.tsx`        | `kanbanFilteredQuotes` (linhas 1150-1162) — bypass do filtro de mês durante busca |

## Passos para depurar interativamente

1. Abrir DevTools → Console, adicionar no `kanban-pipeline.tsx`:
   - No efeito (linha 72):
     `console.log('sync effect', { status, currentLen: current.length, nextLen: next.length })`
   - No `handleExitComplete` (linha 107):
     `console.log('onExitComplete', status, pending?.length)`
   - Verificar se `handleExitComplete` é chamado após a busca

2. Abrir DevTools → Network → buscar `quotes?search=OBRA-563` → verificar se a
   API retorna o quote

3. No React DevTools → procurar `KanbanPipeline` → inspecionar state
   `displayedItems` → verificar se está `[]` para a coluna "approved"

---

## Stack técnica relevante

- **Next.js 16** com App Router, Turbopack
- **React 19**
- **Framer Motion** (versão em `package.json`)
- **date-fns** para manipulação de datas
- **Prisma** com PostgreSQL
- **TypeScript** strict mode
