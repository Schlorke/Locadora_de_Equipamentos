// Tabela do proxy e a regra única modo → basePath do Better Auth (achado 113 da revisão adversarial): route-table
// reexporta a regra de @gb-locacoes/contracts/platform (a do cliente web, do app mobile e do backend) e monta a entrada
// do cliente no host de locadora a partir dela, sem uma cópia do mapeamento.
import { describe, expect, it, vi } from 'vitest'
import * as contract from '@gb-locacoes/contracts/platform'

const rule = vi.hoisted(() => ({ basePath: vi.fn() }))

vi.mock('@gb-locacoes/contracts/platform', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@gb-locacoes/contracts/platform')>()
  // Mapeamento trocado, que uma cópia da regra em route-table não reproduziria.
  rule.basePath.mockImplementation((mode: string | undefined) =>
    mode === 'better-auth' ? '/api/auth/v2' : mode === 'better-auth-v2' ? '/api/auth' : null
  )
  return { ...actual, betterAuthBasePath: rule.basePath }
})

import { BETTER_AUTH_BASE_PATHS, TENANT_ACCOUNT_API, betterAuthBasePath } from './route-table'

// Consultas feitas ao montar a tabela (na carga do módulo, antes de qualquer caso).
const consulted = rule.basePath.mock.calls.map(([mode]) => mode as unknown)

describe('route-table: basePath do Better Auth pela regra do contrato', () => {
  it('reexporta a regra e a lista do contrato (as mesmas funções, não cópias)', () => {
    expect(betterAuthBasePath).toBe(contract.betterAuthBasePath)
    expect(BETTER_AUTH_BASE_PATHS).toBe(contract.BETTER_AUTH_BASE_PATHS)
  })

  it('a entrada do cliente de cada modo fica no basePath que a regra dá ao modo; no legacy, nenhuma', () => {
    expect([...consulted].sort()).toEqual([...contract.AUTH_MODES].sort())
    expect(TENANT_ACCOUNT_API['better-auth']).toContain('/api/auth/v2/get-session')
    expect(TENANT_ACCOUNT_API['better-auth']).not.toContain('/api/auth/get-session')
    expect(TENANT_ACCOUNT_API['better-auth-v2']).toContain('/api/auth/sign-in/email')
    expect(TENANT_ACCOUNT_API['better-auth-v2']).not.toContain('/api/auth/v2/sign-in/email')
    expect(TENANT_ACCOUNT_API.legacy).toEqual([])
  })
})
