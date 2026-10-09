#!/usr/bin/env node

/**
 * 📊 Performance Report Generator - GB Locações
 *
 * Consolida resultados dos testes de performance e gera relatório Markdown
 * com análises, comparações e recomendações.
 *
 * Uso:
 *   node scripts/generate-performance-report.js
 */

import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Carregar configuração
const configPath = join(__dirname, 'performance-config.json')
const config = JSON.parse(readFileSync(configPath, 'utf-8')).testConfig

/**
 * Carregar resultados dos testes
 */
function loadResults() {
  const puppeteerResultsPath = join(
    __dirname,
    '..',
    config.outputDir,
    'performance-results.json'
  )
  const lighthouseResultsPath = join(
    __dirname,
    '..',
    config.outputDir,
    'lighthouse-results.json'
  )

  const puppeteerResults = existsSync(puppeteerResultsPath)
    ? JSON.parse(readFileSync(puppeteerResultsPath, 'utf-8'))
    : []

  const lighthouseResults = existsSync(lighthouseResultsPath)
    ? JSON.parse(readFileSync(lighthouseResultsPath, 'utf-8'))
    : []

  return { puppeteerResults, lighthouseResults }
}

/**
 * Validar métricas para detectar valores suspeitos
 */
function validateMetrics(metrics, source, deviceName) {
  const warnings = []
  const validation = config.validation || {
    maxRealisticLCP: 15000,
    minRealisticLCP: 100,
    maxRealisticFCP: 10000,
    minRealisticFCP: 50,
    maxDiscrepancyRatio: 3,
  }

  if (metrics.LCP !== null && metrics.LCP !== undefined) {
    if (metrics.LCP > validation.maxRealisticLCP) {
      warnings.push({
        type: 'VALIDATION',
        severity: 'warning',
        metric: 'LCP',
        source,
        device: deviceName,
        message: `LCP de ${metrics.LCP.toFixed(0)}ms é suspeitamente alto (>${validation.maxRealisticLCP}ms) - possível erro de medição`,
      })
    }
    if (metrics.LCP < validation.minRealisticLCP) {
      warnings.push({
        type: 'VALIDATION',
        severity: 'warning',
        metric: 'LCP',
        source,
        device: deviceName,
        message: `LCP de ${metrics.LCP.toFixed(0)}ms é suspeitamente baixo (<${validation.minRealisticLCP}ms)`,
      })
    }
  }

  if (metrics.FCP !== null && metrics.FCP !== undefined) {
    if (metrics.FCP > validation.maxRealisticFCP) {
      warnings.push({
        type: 'VALIDATION',
        severity: 'warning',
        metric: 'FCP',
        source,
        device: deviceName,
        message: `FCP de ${metrics.FCP.toFixed(0)}ms é suspeitamente alto (>${validation.maxRealisticFCP}ms)`,
      })
    }
  }

  // FCP não pode ser maior que LCP
  if (
    metrics.FCP !== null &&
    metrics.LCP !== null &&
    metrics.FCP > metrics.LCP
  ) {
    warnings.push({
      type: 'VALIDATION',
      severity: 'error',
      metric: 'FCP/LCP',
      source,
      device: deviceName,
      message: `FCP (${metrics.FCP.toFixed(0)}ms) maior que LCP (${metrics.LCP.toFixed(0)}ms) - inconsistente`,
    })
  }

  return warnings
}

/**
 * Comparar resultados entre Puppeteer e Lighthouse
 */
function compareResults(puppeteerResults, lighthouseResults) {
  const discrepancies = []
  const validation = config.validation || { maxDiscrepancyRatio: 3 }

  for (const puppet of puppeteerResults) {
    if (puppet.error || !puppet.metrics?.LCP) continue

    // Encontrar resultado Lighthouse correspondente
    const isMobile =
      puppet.device.toLowerCase().includes('mobile') ||
      puppet.device.toLowerCase().includes('moto') ||
      puppet.device.toLowerCase().includes('iphone')
    const deviceType = isMobile ? 'mobile' : 'desktop'

    const lh = lighthouseResults.find(
      (r) => !r.error && r.deviceType === deviceType && r.metrics?.LCP
    )

    if (lh) {
      const ratio = lh.metrics.LCP / puppet.metrics.LCP

      if (
        ratio > validation.maxDiscrepancyRatio ||
        ratio < 1 / validation.maxDiscrepancyRatio
      ) {
        discrepancies.push({
          metric: 'LCP',
          puppeteerDevice: puppet.device,
          lighthouseDevice: lh.deviceType,
          puppeteerValue: puppet.metrics.LCP,
          lighthouseValue: lh.metrics.LCP,
          ratio: ratio.toFixed(2),
          message: `Discrepância de ${ratio.toFixed(1)}x no LCP: Puppeteer=${puppet.metrics.LCP.toFixed(0)}ms vs Lighthouse=${lh.metrics.LCP.toFixed(0)}ms`,
        })
      }
    }
  }

  return discrepancies
}

/**
 * Gerar tabela de métricas Puppeteer
 */
function generateMetricsTable(results, deviceFilter = null) {
  const filteredResults = deviceFilter
    ? results.filter((r) => r.device === deviceFilter)
    : results

  if (filteredResults.length === 0) return 'Nenhum resultado disponível.\n'

  let table =
    '| Página | Dispositivo | LCP | FCP | TTI | TBT | CLS | Load Time |\n'
  table +=
    '|--------|-------------|-----|-----|-----|-----|-----|-----------||\n'

  for (const result of filteredResults) {
    if (result.error) {
      table += `| ${result.page} | ${result.device} | ERROR | ERROR | ERROR | ERROR | ERROR | ERROR |\n`
      continue
    }

    const lcp = result.metrics?.LCP
    const fcp = result.metrics?.FCP
    const tti = result.metrics?.TTI
    const tbt = result.metrics?.TBT
    const cls = result.metrics?.CLS
    const loadTime = result.loadTime

    const lcpFormatted = lcp ? `${lcp.toFixed(0)}ms` : 'N/A'
    const fcpFormatted = fcp ? `${fcp.toFixed(0)}ms` : 'N/A'
    const ttiFormatted = tti ? `${tti.toFixed(0)}ms` : 'N/A'
    const tbtFormatted = tbt ? `${tbt.toFixed(0)}ms` : 'N/A'
    const clsFormatted =
      cls !== null && cls !== undefined ? cls.toFixed(3) : 'N/A'
    const loadTimeFormatted = loadTime ? `${loadTime}ms` : 'N/A'

    table += `| ${result.page} | ${result.device} | ${lcpFormatted} | ${fcpFormatted} | ${ttiFormatted} | ${tbtFormatted} | ${clsFormatted} | ${loadTimeFormatted} |\n`
  }

  return table
}

/**
 * Gerar tabela de resultados Lighthouse
 */
function generateLighthouseTable(results, deviceFilter = null) {
  const filteredResults = deviceFilter
    ? results.filter((r) => r.deviceType === deviceFilter)
    : results

  if (filteredResults.length === 0)
    return 'Nenhum resultado Lighthouse disponível.\n'

  let table =
    '| Página | Dispositivo | Performance | LCP | FCP | CLS | TBT | Speed Index |\n'
  table +=
    '|--------|-------------|-------------|-----|-----|-----|-----|-------------|\n'

  for (const result of filteredResults) {
    if (result.error) {
      const pageName =
        new URL(result.url).pathname.replace(/^\//, '') || 'homepage'
      table += `| ${pageName} | ${result.deviceType} | ERROR | ERROR | ERROR | ERROR | ERROR | ERROR |\n`
      continue
    }

    const pageName =
      new URL(result.url).pathname.replace(/^\//, '') || 'homepage'
    const perf = result.metrics?.performance?.toFixed(0) || 'N/A'
    const lcp = result.metrics?.LCP
      ? `${result.metrics.LCP.toFixed(0)}ms`
      : 'N/A'
    const fcp = result.metrics?.FCP
      ? `${result.metrics.FCP.toFixed(0)}ms`
      : 'N/A'
    const cls =
      result.metrics?.CLS !== null && result.metrics?.CLS !== undefined
        ? result.metrics.CLS.toFixed(3)
        : 'N/A'
    const tbt = result.metrics?.TBT
      ? `${result.metrics.TBT.toFixed(0)}ms`
      : 'N/A'
    const speedIndex = result.metrics?.SpeedIndex
      ? `${result.metrics.SpeedIndex.toFixed(0)}ms`
      : 'N/A'

    table += `| ${pageName} | ${result.deviceType} | ${perf}/100 | ${lcp} | ${fcp} | ${cls} | ${tbt} | ${speedIndex} |\n`
  }

  return table
}

/**
 * Identificar problemas críticos
 */
function identifyCriticalIssues(puppeteerResults, lighthouseResults) {
  const issues = []

  // Analisar métricas Puppeteer
  for (const result of puppeteerResults) {
    if (result.error) continue

    const lcp = result.metrics?.LCP
    const fcp = result.metrics?.FCP
    const tbt = result.metrics?.TBT
    const cls = result.metrics?.CLS

    // Validar métricas primeiro
    const validationWarnings = validateMetrics(
      result.metrics,
      'Puppeteer',
      result.device
    )
    issues.push(...validationWarnings)

    if (lcp && lcp > config.thresholds.metrics.LCP.needsImprovement) {
      issues.push({
        type: 'LCP',
        severity: 'high',
        page: result.page,
        device: result.device,
        value: lcp,
        threshold: config.thresholds.metrics.LCP.needsImprovement,
        message: `LCP de ${lcp.toFixed(0)}ms excede o limite de ${config.thresholds.metrics.LCP.needsImprovement}ms`,
      })
    }

    if (fcp && fcp > config.thresholds.metrics.FCP.needsImprovement) {
      issues.push({
        type: 'FCP',
        severity: 'medium',
        page: result.page,
        device: result.device,
        value: fcp,
        threshold: config.thresholds.metrics.FCP.needsImprovement,
        message: `FCP de ${fcp.toFixed(0)}ms excede o limite de ${config.thresholds.metrics.FCP.needsImprovement}ms`,
      })
    }

    if (tbt && tbt > config.thresholds.metrics.TBT.needsImprovement) {
      issues.push({
        type: 'TBT',
        severity: 'high',
        page: result.page,
        device: result.device,
        value: tbt,
        threshold: config.thresholds.metrics.TBT.needsImprovement,
        message: `TBT de ${tbt.toFixed(0)}ms excede o limite de ${config.thresholds.metrics.TBT.needsImprovement}ms`,
      })
    }

    if (
      cls !== null &&
      cls !== undefined &&
      cls > config.thresholds.metrics.CLS.needsImprovement
    ) {
      issues.push({
        type: 'CLS',
        severity: 'high',
        page: result.page,
        device: result.device,
        value: cls,
        threshold: config.thresholds.metrics.CLS.needsImprovement,
        message: `CLS de ${cls.toFixed(3)} excede o limite de ${config.thresholds.metrics.CLS.needsImprovement}`,
      })
    }
  }

  // Analisar métricas Lighthouse
  for (const result of lighthouseResults) {
    if (result.error) continue

    // Validar métricas primeiro
    const validationWarnings = validateMetrics(
      result.metrics,
      'Lighthouse',
      result.deviceType
    )
    issues.push(...validationWarnings)

    if (result.metrics?.performance < config.thresholds.performance) {
      issues.push({
        type: 'Performance Score',
        severity: 'high',
        page: new URL(result.url).pathname,
        device: result.deviceType,
        value: result.metrics.performance,
        threshold: config.thresholds.performance,
        message: `Performance score de ${result.metrics.performance.toFixed(0)}/100 está abaixo do limite de ${config.thresholds.performance}`,
      })
    }

    const cls = result.metrics?.CLS
    if (
      cls !== null &&
      cls !== undefined &&
      cls > config.thresholds.metrics.CLS.needsImprovement
    ) {
      issues.push({
        type: 'CLS',
        severity: 'high',
        page: new URL(result.url).pathname,
        device: result.deviceType,
        value: cls,
        threshold: config.thresholds.metrics.CLS.needsImprovement,
        message: `CLS de ${cls.toFixed(3)} excede o limite de ${config.thresholds.metrics.CLS.needsImprovement}`,
      })
    }
  }

  return issues
}

/**
 * Gerar recomendações
 */
function generateRecommendations(issues, heavyComponents) {
  const recommendations = []

  // Recomendações baseadas em problemas identificados
  const lcpIssues = issues.filter((i) => i.type === 'LCP')
  if (lcpIssues.length > 0) {
    recommendations.push({
      priority: 'high',
      title: 'Otimizar LCP (Largest Contentful Paint)',
      description: `${lcpIssues.length} página(s) com LCP acima do limite`,
      actions: [
        'Otimizar imagens usando next/image com lazy loading',
        'Implementar preload de recursos críticos',
        'Reduzir tempo de resposta do servidor',
        'Minimizar render-blocking resources',
      ],
    })
  }

  const tbtIssues = issues.filter((i) => i.type === 'TBT')
  if (tbtIssues.length > 0) {
    recommendations.push({
      priority: 'high',
      title: 'Reduzir TBT (Total Blocking Time)',
      description: `${tbtIssues.length} página(s) com TBT acima do limite`,
      actions: [
        'Code splitting de componentes pesados',
        'Lazy loading de JavaScript não crítico',
        'Otimizar cálculos pesados (usar Web Workers se necessário)',
        'Debounce/throttle de event listeners',
      ],
    })
  }

  const clsIssues = issues.filter((i) => i.type === 'CLS')
  if (clsIssues.length > 0) {
    recommendations.push({
      priority: 'high',
      title: 'Reduzir CLS (Cumulative Layout Shift)',
      description: `${clsIssues.length} página(s) com CLS acima do limite`,
      actions: [
        'Definir dimensões explícitas para imagens',
        'Evitar inserção dinâmica de conteúdo acima do fold',
        'Usar font-display: swap para fontes',
        'Reservar espaço para elementos que carregam dinamicamente',
      ],
    })
  }

  // Recomendações baseadas em componentes pesados
  if (heavyComponents && heavyComponents.length > 0) {
    recommendations.push({
      priority: 'medium',
      title: 'Otimizar Componentes Pesados',
      description:
        'Vários componentes identificados como potencialmente pesados',
      actions: heavyComponents.map(
        (comp) => `Analisar e otimizar ${comp.file}: ${comp.concern}`
      ),
    })
  }

  return recommendations
}

/**
 * Gerar relatório Markdown completo
 */
function generateReport(
  puppeteerResults,
  lighthouseResults,
  issues,
  recommendations,
  discrepancies
) {
  const timestamp = new Date().toISOString()
  const date = new Date().toLocaleDateString('pt-BR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  let report = `# 📊 Relatório de Performance - GB Locações\n\n`
  report += `**Data:** ${date}\n\n`
  report += `**Projeto:** ${config.projectName}\n\n`
  report += `---\n\n`

  // Resumo Executivo
  report += `## 📋 Resumo Executivo\n\n`
  report += `Este relatório consolida os resultados dos testes de performance realizados em diferentes dispositivos e páginas do projeto.\n\n`
  report += `- **Total de testes Puppeteer:** ${puppeteerResults.length}\n`
  report += `- **Total de testes Lighthouse:** ${lighthouseResults.length}\n`
  report += `- **Problemas críticos identificados:** ${issues.filter((i) => i.severity === 'high').length}\n`
  report += `- **Avisos de validação:** ${issues.filter((i) => i.type === 'VALIDATION').length}\n`
  report += `- **Discrepâncias entre testes:** ${discrepancies.length}\n`
  report += `- **Recomendações:** ${recommendations.length}\n\n`
  report += `---\n\n`

  // Discrepâncias entre Puppeteer e Lighthouse
  if (discrepancies.length > 0) {
    report += `## ⚠️ Discrepâncias entre Puppeteer e Lighthouse\n\n`
    report += `> **Nota:** Discrepâncias significativas podem indicar problemas de configuração dos testes ou variância natural.\n\n`

    for (const disc of discrepancies) {
      report += `- **${disc.metric}**: ${disc.message}\n`
    }
    report += `\n---\n\n`
  }

  // Avisos de Validação
  const validationWarnings = issues.filter((i) => i.type === 'VALIDATION')
  if (validationWarnings.length > 0) {
    report += `## 🔍 Avisos de Validação\n\n`
    report += `> **Nota:** Estes avisos indicam métricas suspeitas que podem ser erros de medição.\n\n`

    for (const warning of validationWarnings) {
      const emoji = warning.severity === 'error' ? '❌' : '⚠️'
      report += `- ${emoji} **${warning.source}** (${warning.device}): ${warning.message}\n`
    }
    report += `\n---\n\n`
  }

  // Métricas Puppeteer
  if (puppeteerResults.length > 0) {
    report += `## 🔬 Métricas Puppeteer\n\n`
    report += `### Todos os Dispositivos\n\n`
    report += generateMetricsTable(puppeteerResults)
    report += `\n`

    // Por dispositivo
    const devices = [...new Set(puppeteerResults.map((r) => r.device))]
    for (const device of devices) {
      report += `### ${device}\n\n`
      report += generateMetricsTable(puppeteerResults, device)
      report += `\n`
    }
  }

  // Métricas Lighthouse
  if (lighthouseResults.length > 0) {
    report += `## 🚀 Métricas Lighthouse\n\n`
    report += `### Todos os Dispositivos\n\n`
    report += generateLighthouseTable(lighthouseResults)
    report += `\n`

    // Por dispositivo
    const deviceTypes = [...new Set(lighthouseResults.map((r) => r.deviceType))]
    for (const deviceType of deviceTypes) {
      report += `### ${deviceType}\n\n`
      report += generateLighthouseTable(lighthouseResults, deviceType)
      report += `\n`
    }
  }

  // Problemas Críticos (excluindo validações)
  const criticalIssues = issues.filter((i) => i.type !== 'VALIDATION')
  if (criticalIssues.length > 0) {
    report += `## ⚠️ Problemas Críticos Identificados\n\n`

    const highSeverity = criticalIssues.filter((i) => i.severity === 'high')
    const mediumSeverity = criticalIssues.filter((i) => i.severity === 'medium')

    if (highSeverity.length > 0) {
      report += `### 🔴 Alta Prioridade (${highSeverity.length})\n\n`
      for (const issue of highSeverity) {
        report += `- **${issue.type}** em ${issue.page} (${issue.device}): ${issue.message}\n`
      }
      report += `\n`
    }

    if (mediumSeverity.length > 0) {
      report += `### 🟡 Média Prioridade (${mediumSeverity.length})\n\n`
      for (const issue of mediumSeverity) {
        report += `- **${issue.type}** em ${issue.page} (${issue.device}): ${issue.message}\n`
      }
      report += `\n`
    }
  }

  // Recomendações
  if (recommendations.length > 0) {
    report += `## 💡 Recomendações de Otimização\n\n`

    const highPriority = recommendations.filter((r) => r.priority === 'high')
    const mediumPriority = recommendations.filter(
      (r) => r.priority === 'medium'
    )

    if (highPriority.length > 0) {
      report += `### 🔴 Alta Prioridade\n\n`
      for (const rec of highPriority) {
        report += `#### ${rec.title}\n\n`
        report += `${rec.description}\n\n`
        report += `**Ações recomendadas:**\n`
        for (const action of rec.actions) {
          report += `- ${action}\n`
        }
        report += `\n`
      }
    }

    if (mediumPriority.length > 0) {
      report += `### 🟡 Média Prioridade\n\n`
      for (const rec of mediumPriority) {
        report += `#### ${rec.title}\n\n`
        report += `${rec.description}\n\n`
        report += `**Ações recomendadas:**\n`
        for (const action of rec.actions) {
          report += `- ${action}\n`
        }
        report += `\n`
      }
    }
  }

  // Checklist de Otimização
  report += `## ✅ Checklist de Otimização\n\n`
  for (const item of config.optimizationChecklist) {
    report += `- [ ] ${item}\n`
  }
  report += `\n`

  // Componentes Pesados
  if (config.heavyComponents && config.heavyComponents.length > 0) {
    report += `## 📦 Componentes Pesados Identificados\n\n`
    for (const comp of config.heavyComponents) {
      report += `### ${comp.file}\n\n`
      report += `- **Tamanho:** ${comp.size}\n`
      report += `- **Preocupação:** ${comp.concern}\n`
      report += `- **Verificar:** ${comp.checkFor.join(', ')}\n\n`
    }
  }

  report += `---\n\n`
  report += `**Relatório gerado automaticamente em:** ${timestamp}\n`

  return report
}

/**
 * Função principal
 */
async function main() {
  console.log('📊 Gerando relatório de performance...\n')

  const { puppeteerResults, lighthouseResults } = loadResults()

  if (puppeteerResults.length === 0 && lighthouseResults.length === 0) {
    console.error('❌ Nenhum resultado encontrado. Execute os testes primeiro.')
    console.error('   Use: pnpm perf:test ou pnpm perf:lighthouse')
    process.exit(1)
  }

  // Comparar resultados entre Puppeteer e Lighthouse
  const discrepancies = compareResults(puppeteerResults, lighthouseResults)
  if (discrepancies.length > 0) {
    console.log('⚠️ Discrepâncias detectadas entre Puppeteer e Lighthouse:')
    discrepancies.forEach((d) => console.log(`   - ${d.message}`))
    console.log('')
  }

  const issues = identifyCriticalIssues(puppeteerResults, lighthouseResults)
  const recommendations = generateRecommendations(
    issues,
    config.heavyComponents
  )

  const report = generateReport(
    puppeteerResults,
    lighthouseResults,
    issues,
    recommendations,
    discrepancies
  )

  const outputPath = join(
    __dirname,
    '..',
    config.outputDir,
    'performance-analysis.md'
  )
  const { mkdir: mkdirAsync, writeFile: writeFileAsync } =
    await import('fs/promises')
  await mkdirAsync(dirname(outputPath), { recursive: true })
  await writeFileAsync(outputPath, report, 'utf-8')

  console.log(`✅ Relatório gerado em: ${outputPath}`)
  console.log(`\n📊 Estatísticas:`)
  console.log(`   - Testes Puppeteer: ${puppeteerResults.length}`)
  console.log(`   - Testes Lighthouse: ${lighthouseResults.length}`)
  console.log(
    `   - Problemas críticos: ${issues.filter((i) => i.severity === 'high' && i.type !== 'VALIDATION').length}`
  )
  console.log(
    `   - Avisos de validação: ${issues.filter((i) => i.type === 'VALIDATION').length}`
  )
  console.log(`   - Discrepâncias: ${discrepancies.length}`)
  console.log(`   - Recomendações: ${recommendations.length}`)
}

// Executar sempre quando o script é chamado diretamente
main().catch((error) => {
  console.error('❌ Erro ao gerar relatório:', error)
  process.exit(1)
})

export {
  generateReport,
  identifyCriticalIssues,
  generateRecommendations,
  compareResults,
  validateMetrics,
}
