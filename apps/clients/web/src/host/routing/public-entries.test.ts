// Lista gerada de public/ (tools/generate-public-entries.mjs): sincronia com o disco e com o matcher do proxy.
import { execFileSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { isReservedSubdomain, isTenantSlug } from '@gb-locacoes/contracts/platform'
import { config } from '../../proxy'
import { PUBLIC_DIRECTORIES, PUBLIC_FILES } from './public-entries.generated'
import { isPublicPassthrough } from './route-table'

const repoRoot = path.resolve(__dirname, '../../../../../..')
const publicDir = path.join(repoRoot, 'public')

describe('public-entries.generated.ts', () => {
  it('está em dia com public/ (gerador em modo --check)', () => {
    expect(() =>
      execFileSync(process.execPath, [path.join(repoRoot, 'tools', 'generate-public-entries.mjs'), '--check'], {
        cwd: repoRoot,
        stdio: 'pipe',
      })
    ).not.toThrow()
    const entries = readdirSync(publicDir)
    const directories = entries.filter((name) => statSync(path.join(publicDir, name)).isDirectory())
    expect([...PUBLIC_DIRECTORIES].sort()).toEqual(directories.sort())
    expect([...PUBLIC_FILES].sort()).toEqual(entries.filter((name) => !directories.includes(name)).sort())
  })

  it('o matcher do proxy exclui exatamente os diretórios de public/ (além de _next/static, _next/image e _vercel)', () => {
    const [source] = config.matcher
    const lookahead = /^\/\(\(\?!(.*)\)\.\*\)$/.exec(source ?? '')?.[1]
    expect(lookahead).toBeDefined()
    const excluded = (lookahead ?? '').split('|')
    expect(excluded.filter((entry) => entry.startsWith('_'))).toEqual(['_next/static/', '_next/image', '_vercel/'])
    const directories = excluded.filter((entry) => !entry.startsWith('_'))
    expect(directories.every((entry) => entry.endsWith('/'))).toBe(true)
    expect(directories.map((entry) => entry.slice(0, -1)).sort()).toEqual([...PUBLIC_DIRECTORIES].sort())
    // Nenhuma exclusão por extensão (D4).
    expect(source).not.toMatch(/\\\.|\$/)
  })

  it('diretórios de public/ são reservados: nunca viram locadora nem segmento interno de locadora', () => {
    for (const directory of PUBLIC_DIRECTORIES) {
      expect(isTenantSlug(directory)).toBe(false)
      expect(isReservedSubdomain(directory)).toBe(true)
    }
    for (const file of PUBLIC_FILES) expect(isTenantSlug(file)).toBe(false)
  })

  it('isPublicPassthrough reconhece só entradas exatas', () => {
    expect(isPublicPassthrough('/favicon.ico')).toBe(true)
    expect(isPublicPassthrough('/fonts/inter.woff2')).toBe(true)
    expect(isPublicPassthrough('/favicon.ico/x')).toBe(false)
    expect(isPublicPassthrough('/locadora-a/favicon.ico')).toBe(false)
    expect(isPublicPassthrough('/robots.txt')).toBe(false)
    expect(isPublicPassthrough('/manifest.json')).toBe(false)
    expect(isPublicPassthrough('/')).toBe(false)
  })
})
