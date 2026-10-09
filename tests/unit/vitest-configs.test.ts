/**
 * Configurações de suíte resolvidas pelo próprio Vitest, com as opções de linha de comando aplicadas (onda 132, achado
 * 145): o que vale é o valor que a execução usa, não o objeto escrito no arquivo.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { resolveConfig } from 'vitest/node'

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
)

/** Configuração de teste efetiva de `config`, como `vitest run --config <config> <cli>` a resolveria. */
async function resolved(config: string, cli: Record<string, unknown> = {}) {
  const vite = await resolveConfig({ root, config, watch: false, ...cli })
  return vite.test as unknown as {
    maxWorkers: number
    fileParallelism: boolean
    testTimeout: number
  }
}

describe('API parity suite (vitest.api.config.ts)', () => {
  it.each([
    [{}],
    [{ maxWorkers: 2 }],
    [{ maxWorkers: 4 }],
    [{ maxWorkers: '50%' }],
  ])(
    'runs one file at a time even with %o on the command line',
    async (cli) => {
      const test = await resolved('vitest.api.config.ts', cli)
      expect(test.fileParallelism).toBe(false)
      expect(test.maxWorkers).toBe(1)
    }
  )
})

/**
 * O prazo padrão de 5 s do Vitest estourava sob carga paralela: varreduras do repositório (route-auth-inventory: 7,9 s
 * no checkpoint da onda 131), telas web completas da plataforma (Novo.web: 5,5 s) e o login multi-host da identidade
 * (6,3 s) na medição da onda 132. Plataforma, segurança e identidade usam o mesmo prazo explícito das suítes unitária,
 * de contrato e de integração.
 */
describe('explicit test timeout', () => {
  it.each([
    'vitest.platform.config.ts',
    'vitest.security.config.ts',
    'vitest.identity.config.ts',
  ])('%s declares the 20 s timeout of the other suites', async (config) => {
    expect((await resolved(config)).testTimeout).toBe(20_000)
    expect((await resolved('vitest.unit.config.ts')).testTimeout).toBe(20_000)
  })
})
