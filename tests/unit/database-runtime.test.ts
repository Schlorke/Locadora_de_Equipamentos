import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const pool = {}
  const prisma = {}
  return {
    pool,
    prisma,
    Pool: vi.fn(function () {
      return pool
    }),
    PrismaClient: vi.fn(function () {
      return prisma
    }),
    PrismaPg: vi.fn(function () {
      return {}
    }),
  }
})
vi.mock('pg', () => ({ Pool: mocks.Pool }))
// Only the client constructor is replaced: the runtime entry also loads the backend modules, which use
// the generated namespace and enums (Prisma.Decimal, Prisma.sql, RentalStatus...) without connecting.
vi.mock('@prisma/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@prisma/client')>()),
  PrismaClient: mocks.PrismaClient,
}))
vi.mock('@prisma/adapter-pg', () => ({ PrismaPg: mocks.PrismaPg }))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  delete global.__pool
  delete global.__prisma
})
afterEach(() => {
  delete global.__pool
  delete global.__prisma
  vi.unstubAllEnvs()
})

describe('runtime de banco compartilhado', () => {
  it('o import não lê nem conecta o banco; falta de DATABASE_URL falha quando composto', async () => {
    vi.stubEnv('DATABASE_URL', '')
    const { getDatabaseRuntime } = await import('@gb-locacoes/backend/runtime')
    expect(mocks.Pool).not.toHaveBeenCalled()
    expect(() => getDatabaseRuntime()).toThrow('DATABASE_URL is not set')
    expect(mocks.Pool).not.toHaveBeenCalled()
  })
  it.each([
    ['5432', 1, undefined],
    ['6543', 2, 0],
  ] as const)(
    'preserva o pool legado na porta %s',
    async (port, max, statementTimeout) => {
      const url = `postgresql://local@127.0.0.1:${port}/test`
      vi.stubEnv('DATABASE_URL', url)
      const { getDatabaseRuntime } =
        await import('@gb-locacoes/backend/runtime')
      expect(getDatabaseRuntime()).toEqual({
        pool: mocks.pool,
        prisma: mocks.prisma,
      })
      expect(mocks.Pool).toHaveBeenCalledWith({
        connectionString: url,
        max,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        statement_timeout: statementTimeout,
      })
      expect(mocks.PrismaPg).toHaveBeenCalledWith(mocks.pool)
    }
  )
  it('reutiliza pool/client entre chamadas e recompilações do módulo', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://local@127.0.0.1:5432/test')
    const first = await import('@gb-locacoes/backend/runtime')
    first.getDatabaseRuntime()
    first.getDatabaseRuntime()
    vi.resetModules()
    const reloaded = await import('@gb-locacoes/backend/runtime')
    expect(reloaded.getDatabaseRuntime()).toEqual({
      pool: mocks.pool,
      prisma: mocks.prisma,
    })
    expect(mocks.Pool).toHaveBeenCalledTimes(1)
    expect(mocks.PrismaClient).toHaveBeenCalledTimes(1)
  })
})
