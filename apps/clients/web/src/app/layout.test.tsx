// Onda 135, A11 (decisão do dono D4): o Vercel Analytics e o Speed Insights são da plataforma, por projeto e sem dado de
// locadora; voltam no layout raiz do host web como a raiz legada fazia (app/layout.tsx, carregados sob demanda). A
// medição de cada locadora (GA4 e Google Ads) é do layout [locadora], só com os IDs dela.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const web = path.resolve(__dirname, '..', '..')
const repoRoot = path.resolve(web, '..', '..', '..')
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

  it('o host declara as duas dependências na mesma faixa da raiz (sem atualizar versão)', () => {
    const own = JSON.parse(read(path.join(web, 'package.json'))).dependencies
    const root = JSON.parse(
      read(path.join(repoRoot, 'package.json'))
    ).dependencies
    for (const name of ['@vercel/analytics', '@vercel/speed-insights']) {
      expect(own[name], name).toBeDefined()
      expect(own[name], name).toBe(root[name])
    }
  })

  it('nenhum dado de locadora no layout raiz: a tag do Google e as verificações ficam no layout [locadora]', () => {
    expect(layout).not.toMatch(/googletagmanager|gtag|verification|siteContent/)
  })
})
