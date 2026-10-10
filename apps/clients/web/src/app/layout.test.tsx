// Onda 135, A11 (decisão do dono D4): o Vercel Analytics e o Speed Insights são da plataforma, por projeto e sem dado de
// locadora; o host preserva o carregamento sob demanda da antiga app/layout.tsx, retirada em F. A
// medição de cada locadora (GA4 e Google Ads) é do layout [locadora], só com os IDs dela.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const web = path.resolve(__dirname, '..', '..')
const read = (file: string) => readFileSync(file, 'utf8')

describe('layout raiz do host web: medição da plataforma', () => {
  const layout = read(path.join(__dirname, 'layout.tsx'))

  it('carrega o Vercel Analytics e o Speed Insights sob demanda e os monta no corpo', () => {
    expect(layout).toContain("import dynamic from 'next/dynamic'")
    expect(layout).toMatch(
      /dynamic\(\(\) => import\('@vercel\/analytics\/next'\)\.then\(\(mod\) => \(\{ default: mod\.Analytics \}\)\)\)/
    )
    expect(layout).toMatch(
      /dynamic\(\(\) => import\('@vercel\/speed-insights\/next'\)\.then\(\(mod\) => \(\{ default: mod\.SpeedInsights \}\)\)\)/
    )
    expect(layout).toContain('{children}<SpeedInsights /><Analytics /></body>')
  })

  it('o host mantém as duas faixas de versão publicadas na primeira etapa, antes de F', () => {
    const own = JSON.parse(read(path.join(web, 'package.json'))).dependencies
    // Pins do C978ceb; F retirou as dependências da raiz, sem atualizar as do host.
    const pinned = {
      '@vercel/analytics': '^2.0.1',
      '@vercel/speed-insights': '^2.0.0',
    }
    for (const [name, version] of Object.entries(pinned)) {
      expect(own[name], name).toBeDefined()
      expect(own[name], name).toBe(version)
    }
  })

  it('nenhum dado de locadora no layout raiz: a tag do Google e as verificações ficam no layout [locadora]', () => {
    expect(layout).not.toMatch(/googletagmanager|gtag|verification|siteContent/)
  })
})
