import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Scripts de performance (pnpm perf:*; docs/guides/performance-testing.md) medem a vitrine de uma locadora no host
 * web (onda 135, Lote C, C8): `{slug}.localhost` na porta pública de development do web
 * (apps/clients/web/.env.example), nunca o `pnpm dev` da raiz legada em 3000. `--help` responde sem abrir
 * navegador nem rede: o navegador apontado para um executável inexistente faria o script falhar se fosse aberto.
 */
const ROOT = path.resolve(import.meta.dirname, '../..')
const config = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'scripts/performance-config.json'), 'utf8')
).testConfig as { baseUrl: string }
const webPort = /^PLATFORM_PUBLIC_PORT="(\d+)"$/m.exec(
  fs.readFileSync(path.join(ROOT, 'apps/clients/web/.env.example'), 'utf8')
)?.[1]

function help(script: string, ...args: string[]) {
  const missing = path.join(ROOT, '.tmp', 'no-browser-here', 'chrome.exe')
  return spawnSync(process.execPath, [script, '--help', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 20000,
    env: {
      ...process.env,
      PUPPETEER_EXECUTABLE_PATH: missing,
      CHROME_PATH: missing,
    },
  })
}

describe('scripts de performance', () => {
  it('apontam para a vitrine de uma locadora no host web de development', () => {
    expect(webPort).toBe('3001')
    const url = new URL(config.baseUrl)
    expect(url.origin).toBe(config.baseUrl)
    expect(url.port).toBe(webPort)
    expect(url.hostname).toMatch(/^[a-z0-9-]+\.localhost$/)
  })

  for (const script of [
    'scripts/performance-test.js',
    'scripts/lighthouse-batch.js',
  ])
    it(`${script} --help mostra o alvo e sai sem abrir navegador`, () => {
      const result = help(script)
      expect(result.error).toBeUndefined()
      expect(result.status, result.stderr).toBe(0)
      expect(result.stdout).toContain(`${config.baseUrl}/`)
      expect(result.stdout).toContain('--base-url=')
      expect(result.stdout).not.toContain('localhost:3000')
      const other = help(script, '--base-url=http://outra.localhost:3001/')
      expect(other.status, other.stderr).toBe(0)
      expect(other.stdout).toContain('http://outra.localhost:3001/')
      expect(other.stdout).not.toContain(config.baseUrl)
    })
})
