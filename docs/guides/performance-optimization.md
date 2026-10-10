# ⚡ Otimizações de Performance - GB Locações

**Data:** Janeiro 2026 **Versão:** 1.0.0 **Status:** Implementado

---

## 📋 Visão Geral

Este documento descreve as otimizações de performance implementadas no projeto
GB-Locações para melhorar métricas Core Web Vitals, especialmente LCP (Largest
Contentful Paint) e TBT (Total Blocking Time).

---

## 🎯 Objetivos das Otimizações

1. **Reduzir LCP mobile** de 8333ms para < 2500ms (meta Core Web Vitals)
2. **Reduzir TBT** de 626-674ms para < 600ms
3. **Aumentar Performance Score** de 64-72 para > 90

---

## ✅ Otimizações Implementadas

### 1. Otimização do Scroll Reveal System

**Arquivo:** `packages/frontend/src/app/providers/ScrollRevealInit.web.tsx`

**Problema Identificado:**

- MutationObserver processando muitos elementos sem otimização
- Periodic check executando a cada 500ms causando TBT alto
- Processamento síncrono bloqueando a thread principal

**Soluções Aplicadas:**

#### a) Batch Processing com requestAnimationFrame

```typescript
// Antes: Processamento síncrono
internalMutation = new MutationObserver((records) => {
  records.forEach((record) => {
    record.addedNodes.forEach((node) => {
      // Processamento síncrono...
    })
  })
})

// Depois: Batch processing com requestAnimationFrame
const processNewElements = (nodes: NodeList | Node[]) => {
  requestAnimationFrame(() => {
    nodes.forEach((node) => {
      // Processamento no próximo frame...
    })
  })
}
```

**Benefícios:**

- Reduz bloqueio da thread principal
- Processamento distribuído em múltiplos frames
- Melhor utilização do tempo ocioso do navegador

#### b) Periodic Check Otimizado

```typescript
// Antes: Interval de 500ms
periodicCheck = setInterval(() => {
  const hiddenElements = document.querySelectorAll(...)
  hiddenElements.forEach((element) => {
    // Processamento de todos elementos de uma vez
  })
}, 500)

// Depois: Interval de 2000ms + batch processing
const processPeriodicCheck = () => {
  requestAnimationFrame(() => {
    const hiddenElements = document.querySelectorAll(...)
    // Processar em batches de 10 elementos
    const batchSize = 10
    // ...
  })
}
periodicCheck = setInterval(processPeriodicCheck, 2000)
```

**Benefícios:**

- Interval aumentado de 500ms para 2000ms (75% redução em frequência)
- Processamento em batches reduz bloqueio
- Melhor balanceamento entre responsividade e performance

**Impacto Esperado:**

- Redução de ~200-300ms no TBT
- Menor uso de CPU durante scroll
- Melhor experiência em dispositivos de baixa performance

---

### 2. Funções Utilitárias de Performance

**Owner atual de debounce:** `packages/frontend/src/shared/lib/debounce-fn.ts`,
exportado pelo index da shared/lib. O hook de valor `debounce.ts` (useDebounce)
tem outro contrato; não unificar os dois. A antiga lib/utils.ts foi aposentada
em F.

**Novas Funções Adicionadas:**

#### a) Debounce

```typescript
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void
```

**Uso:**

- Event listeners que disparam frequentemente
- Input handlers que fazem cálculos pesados
- Window resize handlers

#### b) Throttle — registro histórico

A assinatura abaixo pertence ao helper da raiz aposentado em F. Não há export
genérico equivalente na shared/lib atual a apontar como substituto.
ScrollStack.web.tsx mantém seu controle local de scroll; portar um utilitário
novo requer consumidor e contrato reais, não restauração por esta receita.

```typescript
export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void
```

**Uso:**

- Scroll listeners
- Mouse move handlers
- Eventos que precisam executar periodicamente mas não a cada frame

**Benefícios registrados na etapa de Janeiro 2026:**

- Redução de execuções desnecessárias
- Melhor controle de frequência de callbacks
- Reuso do debounce atual pelo contrato da shared; a assinatura throttle acima
  não é uma API nova do monorepo

---

### 3. Análise de Performance

**Arquivo:** `scripts/generate-performance-report.js`

**Melhorias:**

- Detecção automática de discrepâncias entre Puppeteer e Lighthouse
- Análise de métricas suspeitas
- Recomendações específicas baseadas em problemas identificados

**Exemplo de Relatório:**

```markdown
## ⚠️ Discrepâncias entre Puppeteer e Lighthouse

- **LCP**: Discrepância de 2.6x no LCP: Puppeteer=3224ms vs Lighthouse=8333ms
```

---

## 📊 Métricas de Sucesso

### Antes das Otimizações

- **LCP Mobile (Lighthouse):** 8333ms ❌
- **TBT (Puppeteer):** 626-674ms ❌
- **Performance Score:** 64-72/100 ⚠️

### Meta das Otimizações

- **LCP Mobile:** < 2500ms ✅
- **TBT:** < 600ms ✅
- **Performance Score:** > 90/100 ✅

---

## 🧪 Como Validar as Otimizações

### 1. Executar Testes de Performance

Preparar API/web e fixture de locadora próprias; medir a vitrine, não o catálogo
global. scripts/performance-config.json define a origem e o destino do
relatório; performance-test.js aceita --base-url. Os scripts não sobem servidor
nem criam uma sessão válida por conta própria. As métricas de Janeiro acima
permanecem históricas; repetir medição no build/alvo atual.

```bash
# Testes Puppeteer
pnpm perf:test

# Testes Lighthouse
pnpm perf:lighthouse

# Gerar relatório consolidado
pnpm perf:report
```

### 2. Analisar Relatório

O relatório é gerado em `reports/performance/performance-analysis.md` e inclui:

- Métricas detalhadas por dispositivo
- Problemas críticos identificados
- Discrepâncias entre ferramentas
- Recomendações de otimização

### 3. Validar em Produção

- Use Google PageSpeed Insights
- Monitore Core Web Vitals no Google Search Console
- Analise métricas no Vercel Analytics

---

## 🔄 Próximos Passos Recomendados

### Alta Prioridade

1. **Lazy Loading do Equipment3DCarousel**
   - Carregar apenas quando visível no viewport
   - Considerar IntersectionObserver para detecção
   - **Nota:** Preservar lógica de sincronização com ScrollReveal

2. **Otimização de Animações Framer Motion**
   - Reduzir complexidade de animações SVG
   - Usar CSS animations quando possível
   - Desativar animações em dispositivos de baixa performance

3. **Code Splitting do Hero Component**
   - Separar Equipment3DCarousel em chunk separado
   - Lazy load de componentes não críticos
   - Reduzir bundle size inicial

### Admin Dashboard (Janeiro 2026 — histórico e owners atuais)

4. **Otimização da Página /admin/dashboard**
   - **Problema:** LCP de 5.48s–7.52s (Poor) reportado pelo Speed Insights da
     Vercel
   - **Soluções aplicadas:**
     - **Bundle size:** Remoção de Recharts do bundle principal. Gráficos
       extraídos para `QuotesTrendChart`, `StatusDistributionChart`,
       `EquipmentByCategoryChart` e carregados via `next/dynamic` (ssr: false)
     - **Carregamento progressivo:** API `/api/admin/dashboard` carregada
       primeiro; assim que retorna, a página exibe stats principais. APIs de
       revenue, aging e quotes carregam em paralelo em background
     - **Lazy-load de KPIs:** `DashboardFinancialKPIs` e `DebtorsTable`
       carregados sob demanda (usam Recharts)
     - **Shell imediato (Jan 2026):** Eliminação do loading full-screen. A
       página exibe header + skeletons dos cards imediatamente; LCP passa a ser
       o primeiro conteúdo pintado (header/cards) em vez de esperar a API
     - **API paralela:** `availableEquipments` movido para `Promise.all` na rota
   - **Owners atuais:**
     `packages/frontend/src/pages/dashboard/ui/DashboardPage.web.tsx` e
     `model/carga.ts`; wrapper em
     `apps/clients/web/src/app/(admin)/admin/dashboard/page.tsx`; adapter
     `apps/services/api/src/app/api/admin/dashboard/route.ts` sobre
     `packages/backend/src/modules/billing/dashboard-read.ts`.
   - **Fluxo atual conferido:** o modelo inicia stats e as leituras secundárias
     em paralelo; libera stats antes de aguardar as demais e descarta respostas
     fora do escopo. O dashboard usa dynamic para Kpis.web; os demais módulos da
     UI estão em .web. Os nomes de charts e as métricas do relato de Janeiro são
     história, não garantia atual de um chunk/ganho medido. O backend mantém
     availableEquipments no Promise.all sob o principal da locadora.

### Média Prioridade

6. **Bundle Analysis**
   - Executar `@next/bundle-analyzer`
   - Identificar dependências grandes
   - Otimizar tree-shaking

7. **Preload de Recursos Críticos**
   - Preload de primeira imagem do carrossel
   - Preload de fontes críticas
   - Preconnect para domínios externos

---

## 🚨 Considerações Importantes

### Regras Críticas

1. **NUNCA alterar** a lógica de sincronização do Equipment3DCarousel
   - Documentação: `docs/features/equipment-3d-carousel.md`
   - Preservar props `isRevealComplete` e `delayBoundsFit`

2. **PRESERVAR** identidade visual e animações existentes
   - Não modificar comportamento visual sem solicitação
   - Testar em diferentes dispositivos após mudanças

3. **TESTAR** em dispositivos de baixa performance
   - Usar Moto G4 (Low-end) para validação
   - Verificar TBT e LCP após cada otimização

---

## 📚 Referências

- **Sistema de Testes:** `docs/guides/performance-testing.md`
- **Equipment 3D Carousel:** `docs/features/equipment-3d-carousel.md`
- **Scroll Reveal System:** `docs/guides/scroll-reveal.md`
- **Core Web Vitals:** https://web.dev/vitals/
- **Lighthouse Docs:** https://developers.google.com/web/tools/lighthouse

---

## 📝 Changelog

### 2026-01-04

- ✅ Otimização do Scroll Reveal System com batch processing
- ✅ Funções utilitárias de debounce/throttle adicionadas
- ✅ Periodic check otimizado (500ms → 2000ms)
- ✅ Documentação completa de otimizações

---

**Última atualização:** Janeiro 2026 **Autor:** GB-Locações Development Team
**Versão:** 1.0.0
