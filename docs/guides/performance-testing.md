# 🚀 Guia de Testes de Performance Frontend - GB Locações

## 📋 Visão Geral

Este guia documenta o sistema completo de testes de performance frontend
implementado no projeto GB Locações. O sistema permite simular dispositivos
fracos (celulares antigos e computadores lentos) e identificar gargalos de
performance.

**Data de Implementação:** Janeiro 2025  
**Status:** ✅ Implementado e funcional

---

## 🎯 Objetivo

O sistema de testes de performance foi criado para:

- Simular a experiência de usuários em dispositivos fracos
- Identificar gargalos de performance antes do deploy
- Coletar métricas Core Web Vitals (LCP, FCP, CLS, TBT, TTI)
- Gerar relatórios detalhados com recomendações de otimização
- Validar melhorias de performance após otimizações

---

## 🛠️ Ferramentas Utilizadas

- **Puppeteer**: Automação de navegador e coleta de métricas
- **Lighthouse**: Análise completa de performance, acessibilidade, SEO
- **Chrome DevTools Protocol (CDP)**: Throttling de CPU e rede

---

## 📦 Instalação

As dependências já estão configuradas no `package.json`:

```bash
pnpm install
```

Dependências instaladas:

- `lighthouse`: ^12.0.0
- `@lhci/cli`: ^0.13.0
- `puppeteer`: ^23.11.1

---

## 🚀 Uso Básico

### 1. Iniciar Servidor de Desenvolvimento

Os testes medem a vitrine de uma locadora no host web (onda 135): a API
compartilhada em 3002 e o web em 3001, sobre um banco local com a locadora.

```bash
pnpm --filter @gb-locacoes/api dev   # http://127.0.0.1:3002
pnpm --filter @gb-locacoes/web dev   # http://<slug>.localhost:3001
```

O alvo padrão é `http://gb.localhost:3001` (`baseUrl` de
`scripts/performance-config.json`). Para outra locadora ou ambiente, use
`--base-url=<origem>`; `node scripts/performance-test.js --help` (ou
`scripts/lighthouse-batch.js --help`) mostra o alvo sem abrir o navegador. Para
números próximos dos de produção, meça o build (`pnpm build:web` e
`pnpm --filter @gb-locacoes/web start`) em vez do `dev`.

### 2. Executar Testes Puppeteer

Testes básicos usando Puppeteer para simular dispositivos:

```bash
# Executar testes da homepage (todos os dispositivos)
pnpm perf:test

# Testar apenas dispositivos mobile
pnpm perf:mobile

# Testar apenas desktop
pnpm perf:desktop

# Testar dispositivo específico
node scripts/performance-test.js --device=lowEndMobile

# Testar página específica (precisa estar em pagesToTest)
node scripts/performance-test.js --page=Homepage
```

### 3. Executar Testes Lighthouse

Análise completa com Lighthouse (inclui performance, acessibilidade, SEO):

```bash
# Executar Lighthouse na homepage (mobile e desktop)
pnpm perf:lighthouse

# Apenas mobile
pnpm perf:lighthouse:mobile

# Apenas desktop
pnpm perf:lighthouse:desktop

# Página específica (precisa estar em pagesToTest)
node scripts/lighthouse-batch.js --page=Homepage --device=mobile
```

### 4. Gerar Relatório Consolidado

Após executar os testes, gere um relatório Markdown consolidado:

```bash
pnpm perf:report
```

O relatório será salvo em `reports/performance/performance-analysis.md`.

---

## 📊 Métricas Coletadas

### Core Web Vitals

| Métrica | Descrição                | Meta (Good) | Needs Improvement |
| ------- | ------------------------ | ----------- | ----------------- |
| **LCP** | Largest Contentful Paint | < 2.5s      | < 4.0s            |
| **FCP** | First Contentful Paint   | < 1.8s      | < 3.0s            |
| **CLS** | Cumulative Layout Shift  | < 0.1       | < 0.25            |
| **TBT** | Total Blocking Time      | < 200ms     | < 600ms           |
| **TTI** | Time to Interactive      | < 3.8s      | < 7.3s            |
| **FID** | First Input Delay        | < 100ms     | < 300ms           |

### Métricas Adicionais

- **Load Time**: Tempo total de carregamento da página
- **DOM Content Loaded**: Tempo até DOM estar pronto
- **Resource Count**: Número de recursos carregados
- **Resource Size**: Tamanho total dos recursos
- **JS Heap Size**: Uso de memória JavaScript

---

## 🔧 Configuração

A configuração está em `scripts/performance-config.json`. Você pode
personalizar:

### Dispositivos Simulados

```json
{
  "devices": {
    "lowEndMobile": {
      "name": "Moto G4 (Low-end)",
      "viewport": { "width": 360, "height": 640 },
      "cpuThrottling": 6,
      "networkThrottling": "Slow 3G"
    }
  }
}
```

### Perfis de Rede

```json
{
  "networkProfiles": {
    "Slow 3G": {
      "downloadThroughput": 50000,
      "uploadThroughput": 50000,
      "latency": 400
    }
  }
}
```

### Como as métricas são coletadas

- **LCP real**: `scripts/performance-test.js` registra um `PerformanceObserver`
  com `buffered: true` antes da navegação, garantindo que o LCP seja capturado
  mesmo em páginas SPA. Não desabilite `PerformanceObserver` no runtime.
- **TBT/TTI reais**: calculados a partir de long tasks (>50ms) após o FCP; se o
  navegador não reportar long tasks, os valores aparecem como `N/A`.
- **Diretório temporário do Lighthouse**: `reports/performance/.tmp` é usado
  como `user-data-dir` e TMP/TEMP forçados (chrome-launcher), evitando `EPERM` e
  cleanup automático. Mantenha a pasta gravável.

### Páginas para Testar

```json
{
  "pagesToTest": [
    {
      "name": "Homepage",
      "path": "/",
      "priority": "critical",
      "expectedLCP": 2500
    }
  ]
}
```

Por padrão, apenas a homepage está configurada. Para incluir outras páginas,
adicione-as em `pagesToTest` e use `--page` nos comandos.

---

## 📄 Estrutura de Relatórios

Os relatórios são salvos em `reports/performance/`:

```
reports/performance/
├── .gitkeep
├── .tmp/                            # Temp do Lighthouse
├── performance-results.json          # Resultados Puppeteer
├── lighthouse-results.json          # Resultados Lighthouse
├── performance-analysis.md          # Relatório consolidado
└── *.html                            # Relatórios HTML do Lighthouse
```

### Relatório Markdown

O relatório consolidado (`performance-analysis.md`) contém:

1. **Resumo Executivo**: Visão geral dos resultados
2. **Métricas Puppeteer**: Tabelas por dispositivo e página
3. **Métricas Lighthouse**: Scores e Core Web Vitals
4. **Problemas Críticos**: Issues identificados com prioridade
5. **Recomendações**: Ações de otimização priorizadas
6. **Checklist de Otimização**: Lista de tarefas
7. **Componentes Pesados**: Análise de componentes identificados

---

## 🔍 Interpretando Resultados

### Status das Métricas

- ✅ **Good**: Dentro do limite recomendado
- ⚠️ **Needs Improvement**: Acima do limite, mas aceitável
- ❌ **Poor**: Muito acima do limite, requer ação imediata

### Exemplo de Resultado

```
Página: Homepage
Dispositivo: Moto G4 (Low-end)
LCP: 3200ms ⚠️ (meta: 2500ms)
FCP: 1800ms ✅ (meta: 1800ms)
TBT: 450ms ⚠️ (meta: 200ms)
```

### Problemas Críticos

O relatório identifica automaticamente problemas:

- **LCP alto**: Imagens não otimizadas, recursos bloqueantes
- **TBT alto**: JavaScript pesado, falta de code splitting
- **CLS alto**: Layout shifts, imagens sem dimensões
- **Performance Score baixo**: Múltiplos problemas combinados

---

## 💡 Recomendações de Otimização

### 1. Otimizar LCP

**Problema**: LCP acima de 2.5s

**Soluções**:

- Usar `next/image` com lazy loading
- Implementar preload de recursos críticos
- Otimizar imagens (WebP, compressão)
- Reduzir tempo de resposta do servidor
- Minimizar render-blocking resources

### 2. Reduzir TBT

**Problema**: TBT acima de 200ms

**Soluções**:

- Code splitting de componentes pesados
- Lazy loading de JavaScript não crítico
- Otimizar cálculos pesados (Web Workers)
- Debounce/throttle de event listeners
- Remover código não utilizado

### 3. Reduzir CLS

**Problema**: CLS acima de 0.1

**Soluções**:

- Definir dimensões explícitas para imagens
- Evitar inserção dinâmica acima do fold
- Usar `font-display: swap` para fontes
- Reservar espaço para elementos dinâmicos

### 4. Componentes Pesados

Componentes identificados como potencialmente pesados:

- `packages/frontend/src/widgets/hero/ui/Hero.web.tsx` (22KB - animações)
- `packages/frontend/src/app/providers/ScrollRevealInit.web.tsx` (32KB - scroll
  listeners)
- `packages/frontend/src/widgets/hero/ui/Equipment3DCarousel.web.tsx` (11KB -
  WebGL)
- `packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoPreco.tsx`
  (27KB - cálculos)
- `packages/frontend/src/widgets/cabecalho/ui/Cabecalho.web.tsx` (25KB -
  navegação)
- `packages/frontend/src/pages/orcamento/ui/QuoteForm.web.tsx` (29KB -
  formulário)

**Ações recomendadas**:

- Analisar uso de `requestAnimationFrame`
- Verificar scroll listeners e IntersectionObserver
- Implementar lazy loading condicional
- Otimizar cálculos em tempo real
- Code splitting de componentes não críticos

---

## 🔄 Fluxo de Trabalho Recomendado

### 1. Antes de Otimizar

```bash
# Executar testes completos
pnpm perf:test
pnpm perf:lighthouse

# Gerar relatório
pnpm perf:report

# Analisar relatório
cat reports/performance/performance-analysis.md
```

### 2. Implementar Otimizações

Com base no relatório:

- Priorizar problemas de alta severidade
- Implementar otimizações recomendadas
- Testar localmente

### 3. Validar Melhorias

```bash
# Re-executar testes
pnpm perf:test
pnpm perf:lighthouse

# Comparar resultados
pnpm perf:report
```

### 4. Antes do Deploy

Sempre executar testes de performance antes de fazer deploy:

```bash
pnpm perf:test && pnpm perf:lighthouse && pnpm perf:report
```

---

## 🐛 Troubleshooting

### Erro: "Cannot find module 'puppeteer'"

```bash
pnpm install
```

### Erro: "Navigation timeout"

O servidor pode não estar rodando ou a página está demorando muito para
carregar:

```bash
# Verificar se o host web responde para a locadora medida
curl http://gb.localhost:3001

# Aumentar timeout no script (editar scripts/performance-test.js)
timeout: 120000  // 2 minutos
```

### Erro: "connect ECONNREFUSED 127.0.0.1:PORT" (Lighthouse)

Isso indica falha ao conectar no Chrome headless. O script tenta novamente com
backoff, mas se continuar:

- Feche instancias de Chrome e execute `pnpm perf:lighthouse` novamente
- Verifique se o antivirus ou politicas locais nao estao bloqueando o Chrome
- Garanta que `reports/performance/.tmp` esteja gravavel

### Erro: "Chrome not found"

Puppeteer precisa do Chrome/Chromium. Instale:

```bash
# Linux
sudo apt-get install chromium-browser

# macOS
brew install chromium

# Windows
# Puppeteer instala Chrome automaticamente
```

### Relatórios não sendo gerados

Verifique se os testes foram executados:

```bash
# Verificar se existem resultados
ls -la reports/performance/

# Re-executar testes se necessário
pnpm perf:test
pnpm perf:lighthouse
```

---

## 📚 Referências

### Documentação Oficial

- [Lighthouse Documentation](https://developer.chrome.com/docs/lighthouse/)
- [Puppeteer Documentation](https://pptr.dev/)
- [Core Web Vitals](https://web.dev/vitals/)
- [Web Performance Best Practices](https://web.dev/fast/)

### Recursos do Projeto

- `scripts/performance-config.json` - Configuração completa
- `scripts/performance-test.js` - Script Puppeteer
- `scripts/lighthouse-batch.js` - Script Lighthouse
- `scripts/generate-performance-report.js` - Gerador de relatórios

---

## ✅ Checklist de Performance

Antes de considerar uma página otimizada, verifique:

- [ ] LCP < 2.5s em dispositivos mobile
- [ ] FCP < 1.8s
- [ ] CLS < 0.1
- [ ] TBT < 200ms
- [ ] TTI < 3.8s
- [ ] Performance Score > 50 (Lighthouse)
- [ ] Imagens otimizadas (next/image)
- [ ] Code splitting implementado
- [ ] Lazy loading de componentes pesados
- [ ] Fontes otimizadas (font-display: swap)

---

## 🎯 Próximos Passos

1. **Executar primeira bateria de testes**: Coletar baseline
2. **Analisar resultados**: Identificar gargalos principais
3. **Priorizar otimizações**: Focar em problemas de alta severidade
4. **Implementar correções**: Seguir recomendações do relatório
5. **Re-executar testes**: Validar melhorias
6. **Documentar otimizações**: Atualizar este guia com lições aprendidas

---

**Última atualização:** Janeiro 2025  
**Mantido por:** GB Locações Development Team
