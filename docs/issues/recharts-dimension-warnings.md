# Recharts ResponsiveContainer Dimension Warnings

**Data:** 2026-02-14 **Status:** ✅ Resolvido **Arquivos afetados:**

- `components/ui/chart.tsx`
- `components/admin/financial/KPICard.tsx`

## Problema

Console warnings persistentes ao carregar charts no dashboard:

```
Warning: The width(-1) and height(-1) of chart should be greater than 0,
please check the style of container, or the props width and height and
minWidth, minHeight.
    at ResponsiveContainer (webpack-internal:///.../recharts/es6/component/ResponsiveContainer.js:135:21)
```

### Sintomas

- Warnings aparecem **apenas após os dados carregarem** (não no mount inicial)
- Charts renderizam visualmente corretos, mas console fica poluído
- Acontece durante atualizações de estado/dados que causam resize do container

## Causa Raiz

O `ResponsiveContainer` do Recharts tenta medir o container pai durante o render
para determinar suas dimensões. Quando usa `width="100%"` e `height="100%"`, ele
internamente faz `getBoundingClientRect()` do container pai.

**O problema ocorre quando:**

1. Dados carregam assincronamente (ex: fetch de API)
2. Container pai redimensiona para acomodar novo conteúdo
3. React re-renderiza os charts
4. ResponsiveContainer tenta medir durante a fase de resize
5. Container ainda não tem dimensões finais → retorna -1

**Por que gerenciamento de estado não funcionou:** Mesmo com flags booleanas
(`isMounted`, `hasValidSize`) e conditional rendering, o ResponsiveContainer
ainda era renderizado antes do container ter dimensões válidas devido ao
batching de state updates do React.

## Tentativas que NÃO Funcionaram

### ❌ Tentativa 1: Adicionar minHeight/minWidth

```tsx
<ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={100}>
```

**Resultado:** Warnings persistiram

### ❌ Tentativa 2: State-based conditional rendering

```tsx
const [isMounted, setIsMounted] = useState(false)
const [hasValidSize, setHasValidSize] = useState(false)

{isMounted && hasValidSize ? <ResponsiveContainer> : <div />}
```

**Resultado:** Warnings persistiram

### ❌ Tentativa 3: Delay + unmount durante resize

```tsx
const measure = () => {
  if (isValid) {
    setTimeout(() => setIsMounted(true), 50)
  }
}

ResizeObserver(() => {
  setIsMounted(false) // Unmount during resize
  measure()
})
```

**Resultado:** Warnings persistiram

## ✅ Solução Final

**Passar dimensões numéricas explícitas ao invés de porcentagens.**

### Implementação

```tsx
// 1. Armazenar dimensões exatas ao invés de flags booleanas
const [dimensions, setDimensions] = useState<{
  width: number
  height: number
} | null>(null)

// 2. Medir e aguardar estabilização
useLayoutEffect(() => {
  const element = containerRef.current
  if (!element) {
    setDimensions(null)
    return
  }

  let stabilityTimer: NodeJS.Timeout | null = null

  const measure = () => {
    const { width, height } = element.getBoundingClientRect()
    const isValid = width > 0 && height > 0

    if (isValid) {
      // Aguarda 50ms de estabilização antes de atualizar
      if (stabilityTimer) clearTimeout(stabilityTimer)
      stabilityTimer = setTimeout(() => {
        setDimensions({ width, height })
      }, 50)
    } else {
      setDimensions(null)
    }
  }

  // Primeira medição com delay de 10ms
  const initialMeasure = setTimeout(measure, 10)

  // ResizeObserver para re-medir quando container muda
  const observer = new ResizeObserver(() => {
    setDimensions(null) // Limpa durante resize
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(measure)
  })
  observer.observe(element)

  return () => {
    setDimensions(null)
    clearTimeout(stabilityTimer)
    clearTimeout(initialMeasure)
    observer.disconnect()
  }
}, [])

// 3. Passar valores numéricos explícitos
{
  dimensions ? (
    <ResponsiveContainer width={dimensions.width} height={dimensions.height}>
      {children}
    </ResponsiveContainer>
  ) : (
    <div aria-hidden className="h-full w-full min-h-[200px]" />
  )
}
```

### Por Que Funciona

1. **Evita medição interna:** ResponsiveContainer recebe dimensões via props,
   não precisa medir
2. **Valores sempre válidos:** Se `dimensions` é null, não renderiza; se existe,
   tem valores numéricos positivos
3. **Estabilização:** 50ms de delay garante que dimensões sejam finais, não
   intermediárias
4. **Unmount durante resize:** Limpa `dimensions` durante mudanças, re-mede
   quando estável

## Lições Aprendidas

1. **Recharts ResponsiveContainer + porcentagens = race condition risk**
   - Melhor usar dimensões explícitas quando possível

2. **State management não garante timing**
   - React batching pode fazer componentes renderizarem em momentos inesperados

3. **Dados assíncronos + resize = caso especial**
   - Mount inicial funciona, mas updates de dados podem quebrar

4. **Medir → Aguardar → Renderizar**
   - Sempre aguardar estabilização (50ms) após medir dimensões
   - 10ms inicial para DOM estar pronto, 50ms para estabilizar

## Código de Referência

- **ChartContainer:** `components/ui/chart.tsx:59-149`
- **FinancialKPICard:** `components/admin/financial/KPICard.tsx:32-119`

## Detecção

Se você vir warnings similares:

- Procure por `width(-1) and height(-1)` no console
- Verifique se usa `ResponsiveContainer` com `width="100%"`
- Verifique se dados carregam assincronamente
- Aplique a solução de dimensões explícitas acima

## Alternativas

Se dimensões explícitas não forem viáveis, considere:

1. Suprimir warnings com wrapper customizado (não recomendado)
2. Usar `aspect` prop ao invés de height
3. Pre-calcular dimensões no servidor/parent
