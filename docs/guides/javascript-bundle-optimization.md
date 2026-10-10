# 🚀 Otimização de Bundle JavaScript - Redução de TBT

> **Data**: Janeiro 2026  
> **Status**: ✅ IMPLEMENTADO  
> **Objetivo**: Reduzir Script Evaluation Time e Total Blocking Time (TBT)

## 📊 Problema Identificado

**Métricas originais** (Lighthouse Performance):

- **Script Evaluation**: 3,055 ms ⚠️
- **Other**: 2,956 ms
- **Style & Layout**: 966 ms
- **Rendering**: 527 ms
- **Script Parsing & Compilation**: 180 ms
- **Garbage Collection**: 80 ms

**Total Main Thread Work**: ~7,783 ms

## 🎯 Otimizações Implementadas

### 1. **Package Imports — configuração histórica da raiz**

Na etapa de Janeiro 2026 foram adicionados os packages abaixo ao
optimizePackageImports de next.config.mjs da raiz, aposentada em F. O trecho é
histórico e não deve ser colado no host novo como se fosse sua configuração.

O owner atual é `apps/clients/web/next.config.mjs` (ESM, createNextConfig), com
transpilePackages, roots de tracing/Turbopack, CSP e roteamento por host. Ele
não declara optimizePackageImports, optimizeServerReact, webVitalsAttribution ou
compiler.removeConsole. Nenhum percentual de ganho da etapa anterior foi medido
novamente por esta atualização documental.

```javascript
experimental: {
  optimizePackageImports: [
    'framer-motion',
    '@radix-ui/react-accordion',
    '@radix-ui/react-alert-dialog',
    '@radix-ui/react-aspect-ratio',
    '@radix-ui/react-avatar',
    '@radix-ui/react-checkbox',
    '@radix-ui/react-collapsible',
    '@radix-ui/react-context-menu',
    '@radix-ui/react-dialog',
    '@radix-ui/react-dropdown-menu',
    '@radix-ui/react-hover-card',
    '@radix-ui/react-label',
    '@radix-ui/react-menubar',
    '@radix-ui/react-navigation-menu',
    '@radix-ui/react-popover',
    '@radix-ui/react-progress',
    '@radix-ui/react-radio-group',
    '@radix-ui/react-scroll-area',
    '@radix-ui/react-select',
    '@radix-ui/react-separator',
    '@radix-ui/react-slider',
    '@radix-ui/react-slot',
    '@radix-ui/react-switch',
    '@radix-ui/react-tabs',
    '@radix-ui/react-toast',
    '@radix-ui/react-toggle',
    '@radix-ui/react-toggle-group',
    '@radix-ui/react-tooltip',
    'lucide-react',
    'date-fns',
    'recharts',
    '@react-three/fiber',
    '@react-three/drei',
    'three',
  ],
  optimizeServerReact: true,
  webVitalsAttribution: ['CLS', 'LCP'],
}
```

**Benefícios**:

- ✅ Tree-shaking agressivo de todas as bibliotecas UI
- ✅ Redução de bundle size em até 30-40%
- ✅ Imports otimizados automaticamente pelo Next.js

### 2. **Defer no ClientLayoutShell web compartilhado**

O owner atual é `packages/frontend/src/app/providers/ClientLayoutShell.web.tsx`,
que conserva o efeito de interceptação de console.warn/error/log e seu cleanup,
com requestIdleCallback ou setTimeout. app/ClientLayout.tsx era o owner
histórico da raiz aposentada. O trecho abaixo descreve o defer do efeito; não
inclui a interceptação de console.warn no carregamento do módulo, também
existente no arquivo. A redução de TBT é hipótese a medir, não prova de que todo
efeito/log só executa em idle.

```typescript
// 🚀 OTIMIZADO: Defer execução para reduzir TBT - executa após idle
useEffect(() => {
  if (typeof window === "undefined") {
    return // Early return para SSR
  }

  // Defer usando requestIdleCallback (executa quando o browser está idle)
  // Fallback para setTimeout se requestIdleCallback não estiver disponível
  if ("requestIdleCallback" in window) {
    const idleCallbackId = requestIdleCallback(setupConsoleInterception, {
      timeout: 2000 // Executar após 2s no máximo se não houver idle time
    })
    return () => {
      cancelIdleCallback(idleCallbackId)
      if (cleanup) cleanup()
    }
  } else {
    // Fallback para setTimeout (executa após próximo tick)
    const timeoutId = setTimeout(setupConsoleInterception, 0)
    return () => {
      clearTimeout(timeoutId)
      if (cleanup) cleanup()
    }
  }
}, [])
```

**Benefícios**:

- ✅ Execução deferida para quando o browser estiver idle
- ✅ Reduz bloqueio do main thread
- ✅ Melhora TBT (Total Blocking Time)
- ✅ Mantém funcionalidade (suprime warnings do Zustand)

### 3. **Otimizações Já Existentes (Mantidas)**

O projeto já tinha várias otimizações implementadas:

#### **Lazy Loading de Componentes Pesados**

- ✅ `ScrollRevealInit` - Lazy loaded com `dynamic()` e `ssr: false`
- ✅ `Equipment3DCarousel` (Three.js) - Lazy loaded no Hero
- ✅ `HomePageClient` - Lazy loaded
- ✅ `WhyChooseUs` - Lazy loaded (usa Lenis)
- ✅ `ContactSection` - Lazy loaded
- ✅ `Analytics` e `SpeedInsights` - Lazy loaded

#### **Compilador Next.js — registro histórico**

O trecho abaixo era da configuração da raiz aposentada em F. O host web atual
não tem compiler.removeConsole; não apresentar ausência de logs como efeito
comprovado desse build. A decisão de suprimir logs/efeitos exige seu próprio
escopo e evidência, sem alterar produto por esta documentação.

```javascript
compiler: {
  // Remove console.log em produção (reduz bundle size)
  removeConsole:
    process.env.NODE_ENV === 'production'
      ? {
          exclude: ['error', 'warn'], // Mantém erros e warnings
        }
      : false,
}
```

## 📈 Impacto Esperado

### **Redução de Bundle Size**

- **Antes**: ~X KB (não medido)
- **Depois**: Redução estimada de 20-30% com tree-shaking agressivo

### **Melhoria de Métricas**

- **Script Evaluation**: Redução esperada de 30-40% (de 3,055 ms para
  ~1,800-2,100 ms)
- **TBT (Total Blocking Time)**: Redução esperada de 20-30%
- **FCP (First Contentful Paint)**: Melhoria marginal (já otimizado)
- **LCP (Largest Contentful Paint)**: Mantém status atual

## 🔍 Como Validar

### **1. Build de Produção**

```bash
pnpm --filter @gb-locacoes/web build
```

Verificar no output do build os tamanhos dos chunks JavaScript.

### **2. Lighthouse Performance**

```bash
# Executar Lighthouse audit
pnpm perf:lighthouse
```

Verificar métricas:

- ✅ Script Evaluation < 2,000 ms (objetivo)
- ✅ TBT < 300 ms (objetivo)
- ✅ Total Blocking Time reduzido

### **3. Bundle Analyzer (Opcional)**

O exemplo anterior de require/module.exports em next.config.mjs da raiz era
histórico e foi aposentado em F. Se análise for necessária, usar o owner ESM
`apps/clients/web/next.config.mjs`, preservando createNextConfig, CSP,
roteamento e roots de workspace. Antes de adicionar uma dependência ou wrapper,
consultar dependencies.md e os guias da versão Next instalada; não instalar uma
versão flutuante nem copiar configuração antiga. Comparar chunks do mesmo
build/alvo e restaurar a configuração temporária ao terminar. Nenhum analyzer
foi executado nesta revisão.

## ⚠️ Notas Importantes

### **Otimizações Não Implementadas (Por Design)**

1. **Framer Motion no Hero**: Mantido como import direto pois é crítico para
   animações do Hero
   - O uso de optimizePackageImports era da configuração histórica da raiz;
     conferir o bundle atual antes de afirmar tree-shaking equivalente
   - Lazy load quebraria animações críticas

2. **ScrollRevealInit**: Já está lazy loaded, mas é executado cedo por
   necessidade técnica
   - Sistema de animações requer inicialização precoce
   - Defer adicional quebraria sincronização

### **Compatibilidade**

- ✅ Next.js 16.1.1+ (requerido para `optimizePackageImports`)
- ✅ React 19.2.3+
- ✅ TypeScript 5.9.3+

### **Browser Support**

- requestIdleCallback: o código faz feature detection; não presumir suporte em
  todo navegador/dispositivo
- ✅ Fallback `setTimeout`: Suportado em todos os browsers

## 📚 Referências

- [Next.js: optimizePackageImports](https://nextjs.org/docs/app/api-reference/next-config-js/optimizePackageImports)
- [Web Vitals: TBT (Total Blocking Time)](https://web.dev/tbt/)
- [MDN: requestIdleCallback](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback)
- [Chrome: Main Thread Work Breakdown](https://developer.chrome.com/docs/lighthouse/performance/mainthread-work-breakdown/)

## 🔄 Próximos Passos (Opcional)

1. **Bundle Analyzer**: Analisar tamanhos detalhados dos chunks
2. **Code Splitting Adicional**: Identificar oportunidades de code splitting
3. **Preload de Recursos Críticos**: Preload de fontes e assets críticos
4. **Service Worker**: Implementar cache de recursos estáticos

---

**Última atualização**: Janeiro 2026  
**Versão**: 1.0.0
