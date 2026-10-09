#!/usr/bin/env node

/**
 * 🚀 Lighthouse Batch Script - GB Locações
 *
 * Executa Lighthouse programaticamente em todas as páginas configuradas
 * e gera relatórios HTML detalhados.
 *
 * Uso:
 *   node scripts/lighthouse-batch.js [--device=mobile|desktop] [--page=pageName] [--base-url=<origem>] [--help]
 */

import lighthouse from 'lighthouse'
import * as chromeLauncher from 'chrome-launcher'
import { readFileSync } from 'fs'
import { join, dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { writeFile, mkdir } from 'fs/promises'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Carregar configuração
const configPath = join(__dirname, 'performance-config.json')
const config = JSON.parse(readFileSync(configPath, 'utf-8')).testConfig

/**
 * Origem medida: a vitrine de uma locadora no host web (`baseUrl` de performance-config.json, ex.
 * http://gb.localhost:3001), ou `--base-url=<origem>` para outra locadora ou ambiente.
 */
const baseUrlArg = process.argv
  .slice(2)
  .find((arg) => arg.startsWith('--base-url='))
  ?.slice('--base-url='.length)
const baseUrl = new URL(baseUrlArg || config.baseUrl).origin

function printUsage() {
  console.log(`Uso:
  node scripts/lighthouse-batch.js [--device=mobile|desktop] [--page=<página>] [--base-url=<origem>]

Alvo: ${baseUrl}/ (vitrine de uma locadora no host web; suba o web antes, ex. pnpm --filter @gb-locacoes/web dev, porta 3001)
Páginas: ${config.pagesToTest.map((page) => `${page.name} (${page.path})`).join(', ')}
Relatórios: ${config.outputDir}/`)
}
const tempBaseDir = resolve(__dirname, '..', config.outputDir, '.tmp')

// Força Lighthouse a usar temp dentro do workspace (evita EPERM no Windows)
process.env.TEMP = tempBaseDir
process.env.TMP = tempBaseDir
process.env.TMPDIR = tempBaseDir
process.env.LHCI_TEMP_DIR = tempBaseDir

const RETRY_DELAYS_MS = [2000, 5000]
const RETRYABLE_ERROR_PATTERNS = [
  /ECONNREFUSED/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /Target closed/i,
  /Protocol error/i,
]

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function shouldRetryError(error) {
  const message = String(error?.message || error || '')
  return RETRYABLE_ERROR_PATTERNS.some((pattern) => pattern.test(message))
}

/**
 * Configuração do Lighthouse para mobile
 * Throttling ajustado para Regular 4G (mais realista para localhost)
 */
const mobileConfig = {
  extends: 'lighthouse:default',
  settings: {
    formFactor: 'mobile',
    throttling: {
      // Regular 4G: ~8 Mbps, RTT 50ms, CPU 1.5x slower
      rttMs: 50,
      throughputKbps: 8192,
      cpuSlowdownMultiplier: 1.5,
      requestLatencyMs: 50,
      downloadThroughputKbps: 8192,
      uploadThroughputKbps: 4096,
    },
    screenEmulation: {
      mobile: true,
      width: 375,
      height: 667,
      deviceScaleFactor: 2,
    },
    emulatedFormFactor: 'mobile',
    // Timeout mais generoso para localhost
    maxWaitForLoad: 60000,
  },
}

/**
 * Configuração do Lighthouse para desktop
 * Throttling mínimo para desktop moderno
 */
const desktopConfig = {
  extends: 'lighthouse:default',
  settings: {
    formFactor: 'desktop',
    throttling: {
      // Desktop moderno: ~20 Mbps, RTT 20ms, sem throttling de CPU
      rttMs: 20,
      throughputKbps: 20480,
      cpuSlowdownMultiplier: 1,
      requestLatencyMs: 20,
      downloadThroughputKbps: 20480,
      uploadThroughputKbps: 10240,
    },
    screenEmulation: {
      mobile: false,
      width: 1366,
      height: 768,
      deviceScaleFactor: 1,
    },
    emulatedFormFactor: 'desktop',
    // Timeout mais generoso para localhost
    maxWaitForLoad: 30000,
  },
}

/**
 * Extrair CLS com múltiplos fallbacks
 */
function extractCLS(lhr) {
  // Tentativa 1: audit direto
  const clsAudit = lhr.audits['cumulative-layout-shift']
  if (clsAudit?.numericValue !== undefined && clsAudit?.numericValue !== null) {
    return clsAudit.numericValue
  }

  // Tentativa 2: displayValue do audit
  if (clsAudit?.displayValue) {
    const match = clsAudit.displayValue.match(/[\d.]+/)
    if (match) {
      return parseFloat(match[0])
    }
  }

  // Tentativa 3: score do audit (convertido para valor aproximado)
  if (clsAudit?.score !== undefined && clsAudit?.score !== null) {
    // Score 1.0 = CLS 0, Score 0.0 = CLS >= 0.25
    // Aproximação linear inversa
    return (1 - clsAudit.score) * 0.25
  }

  // Tentativa 4: layout-shift-elements (pode ter informações)
  const layoutShiftElements = lhr.audits['layout-shift-elements']
  if (layoutShiftElements?.details?.items?.length > 0) {
    // Se há elementos causando shift, retornar um valor estimado
    return 0.1 // Valor estimado se há elementos de shift
  }

  return null
}

/**
 * Validar métricas coletadas
 */
function validateLighthouseMetrics(metrics, _deviceType) {
  const warnings = []
  const validation = config.validation || {
    maxRealisticLCP: 15000,
    minRealisticLCP: 100,
  }

  if (metrics.LCP !== null) {
    if (metrics.LCP > validation.maxRealisticLCP) {
      warnings.push(
        `⚠️ LCP de ${metrics.LCP.toFixed(0)}ms é suspeitamente alto - possível erro de teste`
      )
    }
    if (metrics.LCP < validation.minRealisticLCP) {
      warnings.push(
        `⚠️ LCP de ${metrics.LCP.toFixed(0)}ms é suspeitamente baixo`
      )
    }
  }

  if (metrics.performance < 20) {
    warnings.push(
      `⚠️ Performance score de ${metrics.performance.toFixed(0)}/100 é muito baixo - verificar configuração`
    )
  }

  return warnings
}

/**
 * Executar Lighthouse para uma página
 */
async function runLighthouse(url, deviceType = 'mobile') {
  const runTempDir = join(tempBaseDir, deviceType)
  await mkdir(join(runTempDir, 'cache'), { recursive: true })

  // Redirecionar diretórios temporários para dentro do workspace (evita EPERM)
  process.env.TMPDIR = runTempDir
  process.env.TEMP = runTempDir
  process.env.TMP = runTempDir
  process.env.LHCI_TEMP_DIR = runTempDir

  const chrome = await chromeLauncher.launch({
    userDataDir: runTempDir,
    chromeFlags: [
      '--headless',
      '--no-sandbox',
      `--disk-cache-dir=${join(runTempDir, 'cache')}`,
      '--disable-dev-shm-usage',
    ],
  })

  try {
    const options = {
      logLevel: 'info',
      output: 'html',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      port: chrome.port,
    }

    const lighthouseConfig =
      deviceType === 'mobile' ? mobileConfig : desktopConfig

    console.log(`🔍 Executando Lighthouse em ${url} (${deviceType})...`)

    const runnerResult = await lighthouse(url, options, lighthouseConfig)

    // Extrair CLS com fallbacks
    const clsValue = extractCLS(runnerResult.lhr)

    const metrics = {
      performance: runnerResult.lhr.categories.performance.score * 100,
      accessibility: runnerResult.lhr.categories.accessibility.score * 100,
      bestPractices: runnerResult.lhr.categories['best-practices'].score * 100,
      seo: runnerResult.lhr.categories.seo.score * 100,
      // Core Web Vitals
      LCP:
        runnerResult.lhr.audits['largest-contentful-paint']?.numericValue ||
        null,
      FID: runnerResult.lhr.audits['max-potential-fid']?.numericValue || null,
      CLS: clsValue,
      FCP:
        runnerResult.lhr.audits['first-contentful-paint']?.numericValue || null,
      TTI: runnerResult.lhr.audits['interactive']?.numericValue || null,
      TBT: runnerResult.lhr.audits['total-blocking-time']?.numericValue || null,
      SpeedIndex: runnerResult.lhr.audits['speed-index']?.numericValue || null,
    }

    // Validar métricas
    const warnings = validateLighthouseMetrics(metrics, deviceType)
    if (warnings.length > 0) {
      warnings.forEach((w) => console.log(`  ${w}`))
    }

    return {
      url,
      deviceType,
      report: runnerResult.lhr,
      html: runnerResult.report,
      metrics,
      warnings,
    }
  } finally {
    await chrome.kill()
  }
}

async function runLighthouseWithRetry(url, deviceType = 'mobile') {
  const maxAttempts = RETRY_DELAYS_MS.length + 1

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await runLighthouse(url, deviceType)
    } catch (error) {
      const message = String(error?.message || error || '')
      const canRetry = attempt < maxAttempts - 1 && shouldRetryError(error)

      if (!canRetry) {
        throw error
      }

      const delayMs = RETRY_DELAYS_MS[attempt]
      const nextAttempt = attempt + 2
      console.warn(
        `  Retry ${nextAttempt}/${maxAttempts} for ${url} (${deviceType}) in ${delayMs}ms: ${message}`
      )
      await sleep(delayMs)
    }
  }

  throw new Error('Lighthouse failed after retries.')
}

/**
 * Salvar relatório HTML
 */
async function saveReport(result, outputDir) {
  const urlPath =
    new URL(result.url).pathname.replace(/^\//, '').replace(/\//g, '-') ||
    'homepage'
  const filename = `${urlPath}-${result.deviceType}-${Date.now()}.html`
  const filepath = join(outputDir, filename)

  await mkdir(outputDir, { recursive: true })
  await writeFile(filepath, result.html)

  return filepath
}

/**
 * Função principal
 */
async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help')) {
    printUsage()
    return
  }

  // Parse argumentos
  const deviceFilter = args
    .find((arg) => arg.startsWith('--device='))
    ?.split('=')[1]
  const pageFilter = args
    .find((arg) => arg.startsWith('--page='))
    ?.split('=')[1]

  // Determinar dispositivos e páginas para testar
  const deviceTypes = deviceFilter
    ? [deviceFilter === 'mobile' ? 'mobile' : 'desktop']
    : ['mobile', 'desktop']

  const pagesToTest = pageFilter
    ? config.pagesToTest.filter(
        (p) =>
          p.name.toLowerCase().includes(pageFilter.toLowerCase()) ||
          p.path.toLowerCase().includes(pageFilter.toLowerCase())
      )
    : config.pagesToTest

  if (pagesToTest.length === 0) {
    console.error(`❌ Página não encontrada: ${pageFilter}`)
    process.exit(1)
  }

  console.log('🚀 Iniciando testes Lighthouse...\n')
  console.log(`📱 Dispositivos: ${deviceTypes.join(', ')}`)
  console.log(`📄 Páginas: ${pagesToTest.length}\n`)

  const results = []
  const outputDir = join(__dirname, '..', config.outputDir)
  await mkdir(tempBaseDir, { recursive: true })

  for (const deviceType of deviceTypes) {
    for (const pageConfig of pagesToTest) {
      const url = `${baseUrl}${pageConfig.path}`

      try {
        const result = await runLighthouseWithRetry(url, deviceType)
        const reportPath = await saveReport(result, outputDir)

        results.push({
          ...result,
          reportPath,
        })

        // Exibir resultado resumido
        console.log(
          `  ✅ Performance: ${result.metrics.performance.toFixed(0)}/100`
        )
        console.log(
          `  ✅ LCP: ${result.metrics.LCP ? result.metrics.LCP.toFixed(0) + 'ms' : 'N/A'}`
        )
        console.log(
          `  ✅ FCP: ${result.metrics.FCP ? result.metrics.FCP.toFixed(0) + 'ms' : 'N/A'}`
        )
        console.log(
          `  ✅ CLS: ${result.metrics.CLS !== null ? result.metrics.CLS.toFixed(3) : 'N/A'}`
        )
        console.log(`  📄 Relatório: ${reportPath}\n`)
      } catch (error) {
        console.error(
          `  ❌ Erro ao testar ${pageConfig.name} (${deviceType}):`,
          error.message
        )
        results.push({
          url,
          deviceType,
          error: error.message,
          timestamp: new Date().toISOString(),
        })
      }
    }
  }

  // Salvar resultados consolidados em JSON
  const resultsPath = join(outputDir, 'lighthouse-results.json')
  await writeFile(resultsPath, JSON.stringify(results, null, 2))

  console.log(`\n📊 Resultados salvos em: ${resultsPath}`)
  console.log(
    `\n✅ Testes Lighthouse concluídos: ${results.length} testes executados`
  )

  // Exibir tabela resumida
  console.log('\n📋 Resumo dos Resultados Lighthouse:')
  console.log('─'.repeat(105))
  console.log(
    'Página'.padEnd(25) +
      'Dispositivo'.padEnd(12) +
      'Perf'.padEnd(8) +
      'LCP (ms)'.padEnd(12) +
      'FCP (ms)'.padEnd(12) +
      'TBT (ms)'.padEnd(12) +
      'CLS'.padEnd(10) +
      'SI (ms)'
  )
  console.log('─'.repeat(105))

  for (const result of results) {
    if (result.error) {
      console.log(
        new URL(result.url).pathname.padEnd(25) +
          result.deviceType.padEnd(12) +
          'ERR'.padEnd(8) +
          'ERROR'.padEnd(12) +
          'ERROR'.padEnd(12) +
          'ERROR'.padEnd(12) +
          'ERROR'.padEnd(10) +
          'ERROR'
      )
    } else {
      const pageName =
        new URL(result.url).pathname.replace(/^\//, '') || 'homepage'
      const perf = result.metrics.performance.toFixed(0)
      const lcp = result.metrics.LCP ? result.metrics.LCP.toFixed(0) : 'N/A'
      const fcp = result.metrics.FCP ? result.metrics.FCP.toFixed(0) : 'N/A'
      const tbt = result.metrics.TBT ? result.metrics.TBT.toFixed(0) : 'N/A'
      const cls =
        result.metrics.CLS !== null ? result.metrics.CLS.toFixed(3) : 'N/A'
      const si = result.metrics.SpeedIndex
        ? result.metrics.SpeedIndex.toFixed(0)
        : 'N/A'

      console.log(
        pageName.padEnd(25) +
          result.deviceType.padEnd(12) +
          perf.padEnd(8) +
          lcp.padEnd(12) +
          fcp.padEnd(12) +
          tbt.padEnd(12) +
          cls.padEnd(10) +
          si
      )
    }
  }
  console.log('─'.repeat(105))
}

// Executar sempre quando o script é chamado diretamente
main().catch((error) => {
  console.error('❌ Erro ao executar Lighthouse:', error)
  process.exit(1)
})

export { runLighthouse, saveReport }
