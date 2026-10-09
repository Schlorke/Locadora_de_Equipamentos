#!/usr/bin/env node

/**
 * 🚀 Performance Test Script - GB Locações
 *
 * Script para testar performance frontend simulando dispositivos fracos
 * usando Puppeteer para controlar navegador e coletar métricas.
 *
 * Uso:
 *   node scripts/performance-test.js [--device=deviceName] [--page=pageName] [--all-devices] [--all-pages]
 *     [--base-url=<origem>] [--help]
 */

import puppeteer from 'puppeteer'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

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
  node scripts/performance-test.js [--device=<dispositivo>] [--page=<página>] [--all-devices] [--all-pages] [--base-url=<origem>]

Alvo: ${baseUrl}/ (vitrine de uma locadora no host web; suba o web antes, ex. pnpm --filter @gb-locacoes/web dev, porta 3001)
Dispositivos: ${Object.keys(config.devices).join(', ')}
Páginas: ${config.pagesToTest.map((page) => `${page.name} (${page.path})`).join(', ')}
Resultados: ${config.outputDir}/performance-results.json`)
}

/**
 * Configurar throttling de CPU via CDP
 */
async function setCPUThrottling(page, rate) {
  const client = await page.target().createCDPSession()
  await client.send('Emulation.setCPUThrottlingRate', { rate })
}

/**
 * Configurar throttling de rede
 */
async function setNetworkThrottling(page, profile) {
  const client = await page.target().createCDPSession()
  const networkProfile = config.networkProfiles[profile]

  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: networkProfile.downloadThroughput,
    uploadThroughput: networkProfile.uploadThroughput,
    latency: networkProfile.latency,
  })
}

/**
 * Aguardar LCP estável (2 segundos sem novo LCP ou timeout máximo de 10s)
 */
async function waitForStableLCP(page, maxWaitMs = 10000) {
  const stabilityWindowMs = 2000

  return await page.evaluate(
    async (maxWait, stabilityWindow) => {
      return new Promise((resolve) => {
        let lastLCP = null
        let lastLCPTime = Date.now()
        let checkInterval = null

        // Verifica se o LCP está estável
        const checkStability = () => {
          const now = Date.now()
          const elapsedSinceStart = now - startTime
          const elapsedSinceLCP = now - lastLCPTime

          // Timeout máximo atingido
          if (elapsedSinceStart >= maxWait) {
            cleanup()
            resolve(lastLCP)
            return
          }

          // LCP estável por tempo suficiente
          if (lastLCP !== null && elapsedSinceLCP >= stabilityWindow) {
            cleanup()
            resolve(lastLCP)
            return
          }
        }

        const cleanup = () => {
          if (checkInterval) {
            clearInterval(checkInterval)
          }
          if (observer) {
            observer.disconnect()
          }
        }

        const startTime = Date.now()
        let observer = null

        try {
          observer = new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries()
            if (entries.length > 0) {
              const latestEntry = entries[entries.length - 1]
              lastLCP = latestEntry.startTime
              lastLCPTime = Date.now()
            }
          })

          observer.observe({
            type: 'largest-contentful-paint',
            buffered: true,
          })

          // Checar a cada 200ms
          checkInterval = setInterval(checkStability, 200)

          // Fallback: resolver após maxWait se nenhum LCP foi capturado
          setTimeout(() => {
            cleanup()
            resolve(lastLCP)
          }, maxWait)
        } catch {
          resolve(null)
        }
      })
    },
    maxWaitMs,
    stabilityWindowMs
  )
}

/**
 * Coletar métricas do Performance API
 */
async function collectMetrics(page, stableLCP = null) {
  return await page.evaluate((providedLCP) => {
    const longTasks =
      window.__perfMetrics?.getLongTasks?.() ||
      ('PerformanceObserver' in window
        ? (() => {
            const tasks = []
            try {
              const observer = new PerformanceObserver((list) => {
                tasks.push(
                  ...list.getEntries().map((entry) => ({
                    startTime: entry.startTime,
                    duration: entry.duration,
                  }))
                )
              })
              observer.observe({ type: 'longtask', buffered: true })
              observer.disconnect()
            } catch {
              // ignore
            }
            return tasks
          })()
        : [])

    const navigation = performance.getEntriesByType('navigation')[0]
    const paint = performance.getEntriesByType('paint')

    // Paint metrics
    const fcp = paint.find((p) => p.name === 'first-contentful-paint')

    // LCP: usar valor fornecido ou tentar coletar
    const observedLCP =
      providedLCP ||
      window.__perfMetrics?.getLCP?.() ||
      performance.getEntriesByType('largest-contentful-paint').at(-1)
        ?.startTime ||
      null

    const lcpValue = observedLCP

    // TTI: max between load milestones and the end of the last long task
    const fcpStart = fcp?.startTime || 0
    const loadEventEnd = navigation?.loadEventEnd || 0

    const ttiCandidates = [
      loadEventEnd,
      navigation?.domContentLoadedEventEnd || 0,
      ...longTasks.map((task) => task.startTime + task.duration),
    ].filter((value) => Number.isFinite(value) && value > 0)

    const tti = ttiCandidates.length
      ? Math.max(...ttiCandidates)
      : navigation?.domContentLoadedEventEnd || null

    // TBT: sum of long tasks (over 50ms) after FCP and before TTI
    const tbt = longTasks.reduce((sum, task) => {
      // Ignorar tasks antes do FCP
      if (task.startTime < fcpStart) return sum
      // Ignorar tasks depois do TTI (se TTI está disponível)
      if (tti && task.startTime > tti) return sum
      // TBT = soma de (duração - 50ms) para cada long task
      const blocking = Math.max(0, task.duration - 50)
      return sum + blocking
    }, 0)

    // CLS: coletar via __perfMetrics (registrado antes do carregamento) ou fallback
    let cls = null
    try {
      // Primeiro, tentar obter do observer registrado antes do carregamento
      const observedCLS = window.__perfMetrics?.getCLS?.()
      if (observedCLS !== null && observedCLS !== undefined) {
        cls = observedCLS
      } else {
        // Fallback: tentar via performance.getEntriesByType
        const clsEntries = performance.getEntriesByType('layout-shift')
        if (clsEntries && clsEntries.length > 0) {
          cls = clsEntries.reduce((sum, entry) => {
            if (!entry.hadRecentInput) {
              return sum + entry.value
            }
            return sum
          }, 0)
        }
      }
    } catch {
      // ignore
    }

    return {
      FCP: fcp?.startTime || null,
      LCP: lcpValue || null,
      TTI: tti,
      TBT: tbt || null,
      CLS: cls,
      DOMContentLoaded: navigation?.domContentLoadedEventEnd || null,
      LoadComplete: navigation?.loadEventEnd || null,
      FirstByte: navigation?.responseStart || null,
      DNS: navigation?.domainLookupEnd - navigation?.domainLookupStart || null,
      TCP: navigation?.connectEnd - navigation?.connectStart || null,
      SSL: navigation?.secureConnectionStart
        ? navigation?.connectEnd - navigation?.secureConnectionStart
        : null,
    }
  }, stableLCP)
}

/**
 * Validar métricas coletadas
 */
function validateMetrics(metrics, _deviceName) {
  const warnings = []
  const validation = config.validation || {
    maxRealisticLCP: 15000,
    minRealisticLCP: 100,
    maxRealisticFCP: 10000,
    minRealisticFCP: 50,
  }

  if (metrics.LCP !== null) {
    if (metrics.LCP > validation.maxRealisticLCP) {
      warnings.push(
        `⚠️ LCP de ${metrics.LCP.toFixed(0)}ms é suspeitamente alto (>${validation.maxRealisticLCP}ms)`
      )
    }
    if (metrics.LCP < validation.minRealisticLCP) {
      warnings.push(
        `⚠️ LCP de ${metrics.LCP.toFixed(0)}ms é suspeitamente baixo (<${validation.minRealisticLCP}ms)`
      )
    }
  }

  if (metrics.FCP !== null) {
    if (metrics.FCP > validation.maxRealisticFCP) {
      warnings.push(
        `⚠️ FCP de ${metrics.FCP.toFixed(0)}ms é suspeitamente alto (>${validation.maxRealisticFCP}ms)`
      )
    }
    if (
      metrics.FCP !== null &&
      metrics.LCP !== null &&
      metrics.FCP > metrics.LCP
    ) {
      warnings.push(
        `⚠️ FCP (${metrics.FCP.toFixed(0)}ms) maior que LCP (${metrics.LCP.toFixed(0)}ms) - inconsistente`
      )
    }
  }

  return warnings
}

/**
 * Executar teste de performance para uma página e dispositivo
 */
async function runPerformanceTest(pageConfig, deviceConfig) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    const browserPage = await browser.newPage()

    // Registrar observadores antes do carregamento para LCP/long tasks
    await browserPage.evaluateOnNewDocument(() => {
      let lcpEntry = null
      let longTasks = []
      let clsValue = 0

      try {
        const lcpObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries()
          if (entries.length > 0) {
            lcpEntry = entries[entries.length - 1]
          }
        })
        lcpObserver.observe({
          type: 'largest-contentful-paint',
          buffered: true,
        })
      } catch {
        // ignore
      }

      try {
        const longTaskObserver = new PerformanceObserver((entryList) => {
          longTasks.push(...entryList.getEntries())
        })
        longTaskObserver.observe({ type: 'longtask', buffered: true })
      } catch {
        // ignore
      }

      try {
        const clsObserver = new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value
            }
          }
        })
        clsObserver.observe({ type: 'layout-shift', buffered: true })
      } catch {
        // ignore
      }

      window.__perfMetrics = {
        getLCP: () => (lcpEntry ? lcpEntry.startTime : null),
        getLongTasks: () =>
          longTasks.map((t) => ({
            startTime: t.startTime,
            duration: t.duration,
          })),
        getCLS: () => clsValue,
      }
    })

    // Configurar viewport
    await browserPage.setViewport({
      width: deviceConfig.viewport.width,
      height: deviceConfig.viewport.height,
      deviceScaleFactor: deviceConfig.deviceScaleFactor,
      isMobile: !!deviceConfig.isMobile,
      hasTouch: !!deviceConfig.isMobile,
    })

    // Configurar user agent
    await browserPage.setUserAgent(deviceConfig.userAgent)

    // Configurar throttling de CPU
    await setCPUThrottling(browserPage, deviceConfig.cpuThrottling)

    // Configurar throttling de rede
    await setNetworkThrottling(browserPage, deviceConfig.networkThrottling)

    // Navegar e medir tempo de carregamento
    const startTime = Date.now()
    await browserPage.goto(`${baseUrl}${pageConfig.path}`, {
      waitUntil: 'networkidle0', // Aguarda rede estabilizar
      timeout: 90000, // 1.5 minutos para dispositivos lentos
    })
    const loadTime = Date.now() - startTime

    // Aguardar LCP estável (até 10 segundos, ou 2 segundos sem novo LCP)
    const stableLCP = await waitForStableLCP(browserPage, 10000)

    // Coletar métricas do Performance API
    const performanceMetrics = await collectMetrics(browserPage, stableLCP)

    // Validar métricas
    const warnings = validateMetrics(performanceMetrics, deviceConfig.name)
    if (warnings.length > 0) {
      warnings.forEach((w) => console.log(`  ${w}`))
    }

    // Coletar métricas do navegador
    const browserMetrics = await browserPage.metrics()

    // Coletar informações sobre recursos carregados
    const resources = await browserPage.evaluate(() => {
      const entries = performance.getEntriesByType('resource')
      return entries.map((entry) => ({
        name: entry.name,
        duration: entry.duration,
        size: entry.transferSize || 0,
        type: entry.initiatorType,
      }))
    })

    // Calcular tamanho total de recursos
    const totalResourceSize = resources.reduce((sum, r) => sum + r.size, 0)

    // Contar tipos de recursos
    const resourceTypes = resources.reduce((acc, r) => {
      acc[r.type] = (acc[r.type] || 0) + 1
      return acc
    }, {})

    return {
      page: pageConfig.name,
      path: pageConfig.path,
      device: deviceConfig.name,
      loadTime,
      metrics: performanceMetrics,
      jsHeapSize: browserMetrics.JSHeapUsedSize,
      jsHeapTotal: browserMetrics.JSHeapTotalSize,
      totalResourceSize,
      resourceCount: resources.length,
      resourceTypes,
      warnings,
      timestamp: new Date().toISOString(),
    }
  } finally {
    await browser.close()
  }
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
  const allDevices = args.includes('--all-devices')
  const allPages = args.includes('--all-pages')

  // Determinar dispositivos e páginas para testar
  const devicesToTest =
    allDevices || !deviceFilter
      ? Object.entries(config.devices)
      : Object.entries(config.devices).filter(([key]) => key === deviceFilter)

  const pagesToTest =
    allPages || !pageFilter
      ? config.pagesToTest
      : config.pagesToTest.filter(
          (p) =>
            p.name.toLowerCase().includes(pageFilter.toLowerCase()) ||
            p.path.toLowerCase().includes(pageFilter.toLowerCase())
        )

  if (devicesToTest.length === 0) {
    console.error(`❌ Dispositivo não encontrado: ${deviceFilter}`)
    process.exit(1)
  }

  if (pagesToTest.length === 0) {
    console.error(`❌ Página não encontrada: ${pageFilter}`)
    process.exit(1)
  }

  console.log('🚀 Iniciando testes de performance...\n')
  console.log(`📱 Dispositivos: ${devicesToTest.length}`)
  console.log(`📄 Páginas: ${pagesToTest.length}\n`)

  const results = []

  for (const [, deviceConfig] of devicesToTest) {
    for (const pageConfig of pagesToTest) {
      console.log(`⏳ Testando ${pageConfig.name} em ${deviceConfig.name}...`)

      try {
        const result = await runPerformanceTest(pageConfig, deviceConfig)
        results.push(result)

        // Exibir resultado resumido
        console.log(
          `  ✅ LCP: ${result.metrics.LCP ? result.metrics.LCP.toFixed(0) + 'ms' : 'N/A'}`
        )
        console.log(
          `  ✅ FCP: ${result.metrics.FCP ? result.metrics.FCP.toFixed(0) + 'ms' : 'N/A'}`
        )
        console.log(
          `  ✅ CLS: ${result.metrics.CLS !== null ? result.metrics.CLS.toFixed(3) : 'N/A'}`
        )
        console.log(`  ✅ Load Time: ${result.loadTime}ms\n`)
      } catch (error) {
        console.error(
          `  ❌ Erro ao testar ${pageConfig.name} em ${deviceConfig.name}:`,
          error.message
        )
        results.push({
          page: pageConfig.name,
          path: pageConfig.path,
          device: deviceConfig.name,
          error: error.message,
          timestamp: new Date().toISOString(),
        })
      }
    }
  }

  // Salvar resultados em JSON
  const outputPath = join(
    __dirname,
    '..',
    config.outputDir,
    'performance-results.json'
  )
  const { mkdir, writeFile } = await import('fs/promises')
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, JSON.stringify(results, null, 2))

  console.log(`\n📊 Resultados salvos em: ${outputPath}`)
  console.log(`\n✅ Testes concluídos: ${results.length} testes executados`)

  // Exibir tabela resumida
  console.log('\n📋 Resumo dos Resultados:')
  console.log('─'.repeat(95))
  console.log(
    'Página'.padEnd(25) +
      'Dispositivo'.padEnd(25) +
      'LCP (ms)'.padEnd(12) +
      'FCP (ms)'.padEnd(12) +
      'CLS'.padEnd(10) +
      'Load (ms)'
  )
  console.log('─'.repeat(95))

  for (const result of results) {
    if (result.error) {
      console.log(
        result.page.padEnd(25) +
          result.device.padEnd(25) +
          'ERROR'.padEnd(12) +
          'ERROR'.padEnd(12) +
          'ERROR'.padEnd(10) +
          'ERROR'
      )
    } else {
      const lcp = result.metrics.LCP ? result.metrics.LCP.toFixed(0) : 'N/A'
      const fcp = result.metrics.FCP ? result.metrics.FCP.toFixed(0) : 'N/A'
      const cls =
        result.metrics.CLS !== null ? result.metrics.CLS.toFixed(3) : 'N/A'
      console.log(
        result.page.padEnd(25) +
          result.device.padEnd(25) +
          lcp.padEnd(12) +
          fcp.padEnd(12) +
          cls.padEnd(10) +
          result.loadTime.toString()
      )
    }
  }
  console.log('─'.repeat(95))
}

// Executar sempre quando o script é chamado diretamente
// No Windows, a verificação de import.meta.url pode falhar, então executamos sempre
main().catch((error) => {
  console.error('❌ Erro ao executar testes de performance:', error)
  process.exit(1)
})

export { runPerformanceTest, collectMetrics }
