import { afterEach, expect, it, vi } from 'vitest'
const fixture = vi.hoisted(() => ({ pool: vi.fn() }))
vi.mock('pg', async (importOriginal) => ({
  ...(await importOriginal<typeof import('pg')>()),
  Pool: fixture.pool,
}))
import { getPlatformDatabaseRuntime } from './platform-database'

afterEach(() => vi.unstubAllEnvs())
it.each([
  undefined,
  '',
  'not-a-url',
  'https://example.test/database',
  'postgresql://platform@127.0.0.1/db?options=-c%20role%3Dadmin',
])(
  'rejects invalid/missing platform configuration without opening a pool (%s)',
  (value) => {
    vi.stubEnv('PLATFORM_DATABASE_URL', value)
    expect(() => getPlatformDatabaseRuntime()).toThrow(
      'Platform database unavailable'
    )
    expect(fixture.pool).not.toHaveBeenCalled()
  }
)
it('never accepts the same business connection under a different URL spelling or password', () => {
  vi.stubEnv('DATABASE_URL', 'postgres://runtime:one@127.0.0.1/example')
  vi.stubEnv(
    'PLATFORM_DATABASE_URL',
    'postgresql://runtime:two@127.0.0.1:5432/example'
  )
  expect(() => getPlatformDatabaseRuntime()).toThrow(
    'Platform database unavailable'
  )
  expect(fixture.pool).not.toHaveBeenCalled()
})
