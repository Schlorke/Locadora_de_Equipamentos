# 📊 Relatório de Performance - GB Locações

**Data:** 4 de janeiro de 2026 às 17:26

**Projeto:** GB-Locacoes

---

## 📋 Resumo Executivo

Este relatório consolida os resultados dos testes de performance realizados em
diferentes dispositivos e páginas do projeto.

- **Total de testes Puppeteer:** 3
- **Total de testes Lighthouse:** 2
- **Problemas críticos identificados:** 1
- **Avisos de validação:** 0
- **Discrepâncias entre testes:** 0
- **Recomendações:** 2

---

## 🔬 Métricas Puppeteer

### Todos os Dispositivos

| Página | Dispositivo | LCP | FCP | TTI | TBT | CLS | Load Time |
|--------|-------------|-----|-----|-----|-----|-----|-----------|| | Homepage |
Moto G4 (Low-end) | 3728ms | 720ms | 4814ms | 578ms | 0.000 | 5674ms | |
Homepage | iPhone SE (Mid-range) | 3596ms | 528ms | 4588ms | 550ms | 0.000 |
5422ms | | Homepage | Old Desktop (2015) | 3548ms | 804ms | 4857ms | 665ms |
0.000 | 5848ms |

### Moto G4 (Low-end)

| Página | Dispositivo | LCP | FCP | TTI | TBT | CLS | Load Time |
|--------|-------------|-----|-----|-----|-----|-----|-----------|| | Homepage |
Moto G4 (Low-end) | 3728ms | 720ms | 4814ms | 578ms | 0.000 | 5674ms |

### iPhone SE (Mid-range)

| Página | Dispositivo | LCP | FCP | TTI | TBT | CLS | Load Time |
|--------|-------------|-----|-----|-----|-----|-----|-----------|| | Homepage |
iPhone SE (Mid-range) | 3596ms | 528ms | 4588ms | 550ms | 0.000 | 5422ms |

### Old Desktop (2015)

| Página | Dispositivo | LCP | FCP | TTI | TBT | CLS | Load Time |
|--------|-------------|-----|-----|-----|-----|-----|-----------|| | Homepage |
Old Desktop (2015) | 3548ms | 804ms | 4857ms | 665ms | 0.000 | 5848ms |

## 🚀 Métricas Lighthouse

### Todos os Dispositivos

| Página   | Dispositivo | Performance | LCP    | FCP   | CLS   | TBT   | Speed Index |
| -------- | ----------- | ----------- | ------ | ----- | ----- | ----- | ----------- |
| homepage | mobile      | 60/100      | 8196ms | 365ms | 0.000 | 545ms | 4026ms      |
| homepage | desktop     | 84/100      | 2329ms | 160ms | 0.000 | 60ms  | 2131ms      |

### mobile

| Página   | Dispositivo | Performance | LCP    | FCP   | CLS   | TBT   | Speed Index |
| -------- | ----------- | ----------- | ------ | ----- | ----- | ----- | ----------- |
| homepage | mobile      | 60/100      | 8196ms | 365ms | 0.000 | 545ms | 4026ms      |

### desktop

| Página   | Dispositivo | Performance | LCP    | FCP   | CLS   | TBT  | Speed Index |
| -------- | ----------- | ----------- | ------ | ----- | ----- | ---- | ----------- |
| homepage | desktop     | 84/100      | 2329ms | 160ms | 0.000 | 60ms | 2131ms      |

## ⚠️ Problemas Críticos Identificados

### 🔴 Alta Prioridade (1)

- **TBT** em Homepage (Old Desktop (2015)): TBT de 665ms excede o limite de
  600ms

## 💡 Recomendações de Otimização

### 🔴 Alta Prioridade

#### Reduzir TBT (Total Blocking Time)

1 página(s) com TBT acima do limite

**Ações recomendadas:**

- Code splitting de componentes pesados
- Lazy loading de JavaScript não crítico
- Otimizar cálculos pesados (usar Web Workers se necessário)
- Debounce/throttle de event listeners

### 🟡 Média Prioridade

#### Otimizar Componentes Pesados

Vários componentes identificados como potencialmente pesados

**Ações recomendadas:**

- Analisar e otimizar components/hero.tsx: Animações CSS/JS pesadas
- Analisar e otimizar components/scroll-reveal-init.tsx: Scroll listeners e
  IntersectionObserver
- Analisar e otimizar components/equipment-3d-carousel.tsx: Renderização
  3D/WebGL
- Analisar e otimizar components/smart-equipment-pricing.tsx: Cálculos em tempo
  real
- Analisar e otimizar components/equipment-infinite-scroll.tsx: Virtualização e
  lazy loading

## ✅ Checklist de Otimização

- [ ] Verificar lazy loading de imagens (next/image)
- [ ] Analisar bundle size com @next/bundle-analyzer
- [ ] Verificar code splitting de rotas
- [ ] Testar Suspense boundaries
- [ ] Validar preload de fontes críticas
- [ ] Checar service worker caching
- [ ] Analisar CSS não utilizado
- [ ] Verificar tree-shaking de dependências
- [ ] Testar skeleton loaders
- [ ] Validar debounce em inputs

## 📦 Componentes Pesados Identificados

### components/hero.tsx

- **Tamanho:** 22KB
- **Preocupação:** Animações CSS/JS pesadas
- **Verificar:** requestAnimationFrame, CSS animations, large images

### components/scroll-reveal-init.tsx

- **Tamanho:** 32KB
- **Preocupação:** Scroll listeners e IntersectionObserver
- **Verificar:** scroll events, reflows, layout thrashing

### components/equipment-3d-carousel.tsx

- **Tamanho:** 11KB
- **Preocupação:** Renderização 3D/WebGL
- **Verificar:** canvas, WebGL, transform3d

### components/smart-equipment-pricing.tsx

- **Tamanho:** 27KB
- **Preocupação:** Cálculos em tempo real
- **Verificar:** useEffect chains, heavy computations, re-renders

### components/equipment-infinite-scroll.tsx

- **Tamanho:** 12KB
- **Preocupação:** Virtualização e lazy loading
- **Verificar:** DOM nodes count, memory leaks, scroll performance

---

**Relatório gerado automaticamente em:** 2026-01-04T20:26:37.501Z
