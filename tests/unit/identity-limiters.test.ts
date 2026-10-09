import { afterEach, describe, expect, it, vi } from 'vitest'
import { createIdentityLimiters } from '@gb-locacoes/backend/identity'
import { prismaRateLimitCounter } from '@gb-locacoes/backend/directory'
import { createPlatformRateLimitTable } from '../helpers/platform-rate-limit-table'

const SECRET = 'fixture-shared-limiters-secret-more-than-32'
const now = Date.UTC(2030, 0, 1)

function fixture() {
  const table = createPlatformRateLimitTable()
  const counter = prismaRateLimitCounter(table.database)
  const loadCounter = vi.fn(async () => counter)
  const dependencies = {
    loadCounter,
    secret: vi.fn(() => SECRET),
    clientIp: vi.fn(() => '192.0.2.9'),
  }
  return {
    table,
    counter,
    dependencies,
    limiter: createIdentityLimiters(dependencies),
  }
}

afterEach(() => vi.restoreAllMocks())

describe('persistent identity limiter composition', () => {
  it('resolves the secret before loading or touching the default counter', async () => {
    const { limiter, dependencies, table } = fixture()
    dependencies.secret.mockImplementation(() => {
      throw new Error('missing fixture secret')
    })
    await expect(
      limiter.consumeAuthAttempt(
        'sign-in',
        { ip: null, account: 'fixture@example.test' },
        { now }
      )
    ).rejects.toThrow('missing fixture secret')
    expect(dependencies.loadCounter).not.toHaveBeenCalled()
    expect(table.rows.size).toBe(0)
  })

  it('loads the default store once across concurrent calls and retries a failed load', async () => {
    const { limiter, dependencies } = fixture()
    dependencies.loadCounter.mockRejectedValueOnce(
      new Error('fixture database unavailable')
    )
    await expect(
      limiter.consumeAuthAttempt(
        'register',
        { ip: null, account: 'first@example.test' },
        { now }
      )
    ).rejects.toThrow('fixture database unavailable')
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        limiter.consumeAuthAttempt(
          'register',
          { ip: null, account: `fixture-${index}@example.test` },
          { now }
        )
      )
    )
    expect(results.every((result) => result.allowed)).toBe(true)
    expect(dependencies.loadCounter).toHaveBeenCalledTimes(2)
  })

  it('two runtime compositions spend the same account/IP window', async () => {
    const { limiter, dependencies, table } = fixture()
    const second = createIdentityLimiters(dependencies)
    const attempt = { ip: '192.0.2.10', account: 'Fixture@Example.test' }
    for (let index = 0; index < 5; index++) {
      expect(
        (
          await (index % 2 ? limiter : second).consumeAuthAttempt(
            'sign-in',
            attempt,
            { now }
          )
        ).allowed
      ).toBe(true)
    }
    expect(
      (
        await second.consumeAuthAttempt(
          'sign-in',
          { ...attempt, account: 'fixture@example.test' },
          { now }
        )
      ).allowed
    ).toBe(false)
    expect(table.rows.size).toBe(3)
    expect([...table.rows.keys()].join(' ')).not.toMatch(/fixture|192\.0\.2/i)
    expect(dependencies.loadCounter).toHaveBeenCalledTimes(2)
  })

  it('retains per-call ports without loading the host default dependencies', async () => {
    const { limiter, dependencies, counter } = fixture()
    expect(
      (
        await limiter.consumeAuthAttempt(
          'register',
          { ip: null, account: 'fixture@example.test' },
          { now, counter, secret: SECRET }
        )
      ).allowed
    ).toBe(true)
    expect(dependencies.secret).not.toHaveBeenCalled()
    expect(dependencies.loadCounter).not.toHaveBeenCalled()
  })

  it('the composed sign-in guard reads its IP port and clears only the proven account window', async () => {
    const { limiter, dependencies } = fixture()
    const guard = limiter.legacySignInGuard({ now })
    const headers = new Headers({ 'x-real-ip': 'fixture untrusted' })
    const ip = guard.clientIp(headers)
    expect(dependencies.clientIp).toHaveBeenCalledExactlyOnceWith(headers)
    const attempt = { ip, account: 'fixture@example.test' }
    for (let index = 0; index < 5; index++)
      expect((await guard.consume(attempt)).allowed).toBe(true)
    expect((await guard.consume(attempt)).allowed).toBe(false)
    await guard.clear(attempt)
    expect((await guard.consume(attempt)).allowed).toBe(true)
  })
})
